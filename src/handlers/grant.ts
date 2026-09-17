// cap.grant.* — invitations and grants at exactly one scope. D3: members invite ≤ member; owners are never removed or demoted;
// the last owner is protected; transfer is dangerous. No inheritance (D2). Existence never leaks. Lane B (Fable) — owner per #14 c5704577820.
import type { Ctx, Handler, Role, ScopeType } from "./types";
import { CapError, notVisible } from "./errors";
import { ROLE_RANK, atLeast, countScalar, gate, newId, nowIso, randomToken, reqRole, reqScope, reqStr, roleAt, sha256 } from "./common";
import { invitationMessage, normalizeAddress, publicOrigin, sendMail, type MailEnv, type MailResult } from "../mail";

type Scope = { type: "workspace" | "project" | "assessment"; id: string };
const INVITE_TTL_S = 7 * 24 * 3600;
const INVITE_COOLDOWN_S = 600;        // one live invitation per scope+invitee per 10 minutes (review #16-1)
const PENDING_DEDUPE_S = 30;          // an in-flight twin; older 'pending' rows were never mailed and must not block a retry
const INVITES_PER_INVITER_HOUR = 30;  // outbound mail from the captain's domain is not a loop target (review #16-2)

/** The caller's role at the scope; hidden when none. */
async function callerAt(ctx: Ctx, scope: Scope, min: Role): Promise<Role> {
  return gate(await roleAt(ctx, scope.type, scope.id), min, scope.type);
}
/** D3: a member may act only up to member. */
function ceiling(caller: Role, target: Role, what: string) {
  if (caller !== "owner" && ROLE_RANK[target] > ROLE_RANK["member"])
    throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `members ${what} up to member only`, "D3 — ask an owner, or invite as member");
}
async function owners(ctx: Ctx, scope: Scope): Promise<string[]> {
  const r = await ctx.db.prepare('SELECT principal_id FROM "grant" WHERE scope_type = ? AND scope_id = ? AND role = ?').bind(scope.type, scope.id, "owner").all<{ principal_id: string }>();
  return r.results.map((x) => x.principal_id);
}
/** A LIVE invitation for the same scope+invitee, as ONE predicate shared by the de-duplicating INSERT and the read-back.
 *  Three shapes are live: a 'sent' row inside the cooldown, a 'pending' row younger than PENDING_DEDUPE_S (an in-flight twin),
 *  and an 'unconfirmed' row for as long as it is unexpired — the mail MAY have gone out, so no cooldown expiry may re-open it
 *  (independent review AMEND P2). Placeholders are passed in so both statements can number their binds independently. */
const dupWhere = (scopeT: string, scopeI: string, hash: string, sentSince: string, pendingSince: string, now: string) =>
  `scope_type = ${scopeT} AND scope_id = ${scopeI} AND invitee_hash = ${hash} AND (`
  + `(status = 'sent' AND created_at > ${sentSince})`
  + ` OR (status = 'pending' AND created_at > ${pendingSince})`
  + ` OR (status = 'unconfirmed' AND (expires_at IS NULL OR expires_at > ${now})))`;

async function scopeExists(ctx: Ctx, scope: Scope): Promise<boolean> {
  const t = scope.type === "workspace" ? "workspace" : scope.type === "project" ? "project" : "assessment";
  return !!(await ctx.db.prepare(`SELECT id FROM ${t} WHERE id = ?`).bind(scope.id).first());
}

/** The ONE place the post-send status is decided (independent review AMEND 53c5716917027). `target` is the status this send
 *  would write, or null when the outcome transitions nothing (provider refusal, not_sent). A transition is conditional on the
 *  row still being 'pending', because the send awaited the network and a concurrent revoke or accept may already have written
 *  a terminal state. Every path that does not win the transition — including every null-target path — re-reads the STORED
 *  status and reports that. delivery.state is reported separately and always carries only the provider's own outcome.
 *  There is NO 'pending' fallback: a missing row is reported as `null` and mapped at the call site (AMEND 53c5717098103).
 *  A row can be missing because `cap.workspace.delete` / `cap.project.delete` hard-delete the scope's `invitation` rows
 *  (src/handlers/workspace.ts, src/handlers/project.ts), and that can land while the send is in flight. */
async function transitionOrRead(ctx: Ctx, id: string, target: string | null): Promise<string | null> {
  if (target) {
    const up = await ctx.db.prepare("UPDATE invitation SET status = ? WHERE id = ? AND status = 'pending'").bind(target, id).run();
    if ((up.meta.changes ?? 0) === 1) return target; // we won the transition; no need to read it back
  }
  return (await ctx.db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status ?? null;
}

/** E: invite → the invitation mail leaves the system (IRR-001) when a sender is configured and the environment policy allows
 *  this recipient (src/mail.ts, OF-3). `delivered` is the provider's acceptance and nothing more; `delivery.state` says which
 *  kind of outcome it was ("accepted" | "refused" | "unconfirmed" | "not_sent") and `delivery.reason` why, when it was not
 *  accepted. `status` is the invitation's ACTUALLY stored state, which is not the same thing: 'unconfirmed' rows are LIVE
 *  (treated like 'sent' by de-duplication, `accept`, `revoke_invitation` and the pending listing).
 *  Dev returns the link token in-band so the flow can be exercised without any mailbox. */
export const invite: Handler = async (ctx, p, o) => {
  const scope = reqScope(p); const role = reqRole(p);
  const email = normalizeAddress(reqStr(p, "email"));
  if (!email) throw new CapError("INVALID_PARAMS", "email must be one plain ASCII address", "letters, digits and . _ % + - before the @; no display names, lists, quotes or spaces", "cap.grant.invite");
  const caller = await callerAt(ctx, scope, "member");
  ceiling(caller, role, "invite");
  const inviteeHash = await sha256(email);
  const impact = { affected: [{ scope, role, invitee: inviteeHash.slice(0, 12), will_see: `${scope.type} contents at role ${role}` }], irreversible: true, effect: "external" as const, compensating_control: "cap.grant.revoke_invitation (does not unsend)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  // Intent de-duplication + inviter cap, decided and written in ONE statement so concurrent replays cannot both pass a
  // check-then-insert gap (re-review #16). A live duplicate is: a row already 'sent' inside the cooldown, a 'pending' row
  // younger than PENDING_DEDUPE_S (an in-flight twin), or an unexpired 'unconfirmed' row (the mail may have gone out —
  // no cooldown expiry may re-open it; the human path out is revoke_invitation, then invite anew).
  const now = ctx.now().getTime();
  const nowStr = nowIso(ctx);
  const sentSince = new Date(now - INVITE_COOLDOWN_S * 1000).toISOString(), pendingSince = new Date(now - PENDING_DEDUPE_S * 1000).toISOString(), hourAgo = new Date(now - 3600_000).toISOString();
  const DUP = dupWhere("?2", "?3", "?4", "?11", "?12", "?14");
  const id = newId("inv"); const token = randomToken("il");
  const ins = await ctx.db.prepare(`INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?8, ?9, ?10
      WHERE NOT EXISTS (SELECT 1 FROM invitation WHERE ${DUP})
        AND (SELECT COUNT(*) FROM invitation WHERE created_by = ?8 AND scope_type <> 'survey' AND created_at > ?13) < ?7`)
    .bind(id, scope.type, scope.id, inviteeHash, await sha256(token), role, INVITES_PER_INVITER_HOUR, ctx.principal.id, nowStr, new Date(now + INVITE_TTL_S * 1000).toISOString(), sentSince, pendingSince, hourAgo, nowStr).run();
  if ((ins.meta.changes ?? 0) !== 1) {
    const dup = await ctx.db.prepare(`SELECT id, role, status FROM invitation WHERE ${dupWhere("?1", "?2", "?3", "?4", "?5", "?6")} ORDER BY created_at DESC LIMIT 1`)
      .bind(scope.type, scope.id, inviteeHash, sentSince, pendingSince, nowStr).first<{ id: string; role: string; status: string }>();
    if (!dup) throw new CapError("RATE_LIMITED", `at most ${INVITES_PER_INVITER_HOUR} collaborator invitations per hour`, "this cap resets over the next hour, not the next minute", "cap.grant.invite");
    if (dup.role !== role) throw new CapError("INVALID_PARAMS", `already invited as ${dup.role} a moment ago`, "revoke that invitation first, then invite with the new role", "cap.grant.revoke_invitation");
    // No token was minted into this row, no new idempotency key exists and no fetch was made. An 'unconfirmed' twin is reported
    // as what it is — uncertain, not "not sent" — so a surface cannot render it as "email not delivered".
    if (dup.status === "unconfirmed")
      return { result: { invitation_id: dup.id, role: dup.role, status: dup.status, accepted: true, delivered: false, delivery: { provider: null, state: "unconfirmed", reason: "duplicate_uncertain" }, note: "an earlier invitation to this address could NOT be confirmed as sent, so nothing was sent again. Check with the recipient; to force a fresh invitation, revoke that one first (cap.grant.revoke_invitation)" }, scope, impact };
    return { result: { invitation_id: dup.id, role: dup.role, status: dup.status, accepted: true, delivered: false, delivery: { provider: null, state: "not_sent", reason: "duplicate_recent" }, note: "already invited moments ago; nothing was sent again" }, scope, impact };
  }
  const env = ctx.env as MailEnv; const origin = publicOrigin(env);
  // No PUBLIC_ORIGIN → no link can be built → nothing may be sent. One send attempt per call, never retried.
  let delivery: MailResult = { delivered: false, state: "not_sent", reason: "not_configured" };
  if (origin) {
    const msg = invitationMessage(origin, token, role, scope.type, INVITE_TTL_S / 86400);
    delivery = await sendMail(env, { to: email, subject: msg.subject, text: msg.text, html: msg.html, idempotencyKey: `invite/${id}` });
  }
  // The row says 'sent' only when the provider accepted, and 'unconfirmed' when we cannot tell (the mail MAY have gone out).
  // Both are CONDITIONAL on the row still being 'pending' (independent review AMEND P1): the send awaits the network, and in
  // that window a revoke or an accept may already have written a terminal state — a blind post-network UPDATE would resurrect
  // it. On a lost race the stored status is re-read, so the result reports what is ACTUALLY stored, separately from what the
  // provider said (delivery.state is always the provider's answer).
  // No-transition outcomes (refused, not_sent) go through the SAME helper with target === null, so a branch cannot drift
  // into reporting a stale default 'pending' over a concurrently stored 'revoked' / 'accepted'.
  // A missing row is NOT 'pending': the scope may have been deleted while the send was in flight, which hard-deletes the
  // invitation (cap.workspace.delete / cap.project.delete). That is reported as status 'deleted' — truthfully — rather than
  // thrown as NOT_FOUND, because the caller must learn BOTH facts: the invitation is gone AND what the provider did with a
  // message that may already have been accepted for delivery (AMEND 53c5717098103).
  const target = delivery.delivered ? "sent" : delivery.state === "unconfirmed" ? "unconfirmed" : null;
  const read = await transitionOrRead(ctx, id, target);
  const stored = read ?? "deleted";
  ctx.log("grant.invite.mail", { delivered: delivery.delivered, state: delivery.state, reason: delivery.reason ?? null, provider_status: delivery.provider_status ?? null, stored_status: stored }); // never the address, nor a hash of it
  const note = read === null
    ? "the invitation no longer exists: the scope was removed while the message was being sent, and the invitation was deleted with it. delivery.state reports only what the provider said — a message that was accepted may still arrive, but its link can no longer be accepted."
    : stored !== (target ?? "pending")
    ? `the invitation is ${stored}: it changed while the send was in flight, and that state was not overwritten. delivery.state reports only what the provider said.`
    : delivery.state === "accepted"
      ? "the provider accepted the invitation for delivery; the recipient has not accepted it yet"
      : delivery.state === "unconfirmed"
        ? "the send was NOT confirmed: the provider did not answer in time, so it may or may not have gone out. The invitation is kept live as 'unconfirmed' and nothing will be re-sent to this address; revoke it first if you must invite again. The recipient has not accepted it."
        : "nothing was sent; the recipient has not accepted the invitation";
  return { result: { invitation_id: id, role, status: stored, accepted: true, delivered: delivery.delivered, delivery: { provider: delivery.provider ?? null, state: delivery.state, reason: delivery.reason ?? null, ...(delivery.provider_status !== undefined ? { provider_status: delivery.provider_status } : {}) }, note, ...(ctx.env.ENVIRONMENT === "dev" ? { dev_only_link_token: token } : {}) }, scope, impact };
};

export const revoke_invitation: Handler = async (ctx, p) => {
  const id = reqStr(p, "id");
  const inv = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status FROM invitation WHERE id = ?").bind(id).first<any>();
  if (!inv) throw notVisible("invitation");
  const scope: Scope = { type: inv.scope_type, id: inv.scope_id };
  const caller = await callerAt(ctx, scope, "member");
  ceiling(caller, inv.role as Role, "revoke invitations");
  // 'unconfirmed' is revocable: it is the explicit human path out of an uncertain send (revoke, then invite anew).
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "already accepted — revoke the grant instead", undefined, "cap.grant.revoke");
  await ctx.db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind(id).run();
  return { result: { id, status: "revoked" }, scope };
};

/** E: accepting releases the grant — disclosure of scope contents begins. */
export const accept: Handler = async (ctx, p, o) => {
  if (ctx.principal.kind !== "user") throw new CapError("NOT_AUTHENTICATED", "sign in to accept an invitation");
  const token = reqStr(p, "token");
  const inv = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status, expires_at, invitee_hash FROM invitation WHERE token_hash = ?").bind(await sha256(token)).first<any>();
  // 'unconfirmed' is accepted like 'sent': the mail may well have arrived, and the token is proof enough that it did.
  if (!inv || inv.status === "revoked") throw notVisible("invitation");
  // Invitations are NOT transferable bearer tokens: the invited email must be the signed-in principal's (Astra c5704773599). Mismatch is hidden, never explained.
  const me = await ctx.db.prepare("SELECT email_hash FROM principal WHERE id = ?").bind(ctx.principal.id).first<{ email_hash: string | null }>();
  if (!me?.email_hash || me.email_hash !== inv.invitee_hash) throw notVisible("invitation");
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "invitation_used", "ask for a new invitation");
  if (inv.expires_at && inv.expires_at < nowIso(ctx)) throw new CapError("INVALID_PARAMS", "invitation_expired", "ask for a new invitation");
  const scope: Scope = { type: inv.scope_type, id: inv.scope_id };
  const existing = await roleAt(ctx, scope.type, scope.id);
  const impact = { affected: [{ scope, role: inv.role, currently: existing ?? "none" }], irreversible: true, effect: "disclosure" as const, compensating_control: "cap.grant.revoke (what was seen stays seen)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  const role: Role = existing && ROLE_RANK[existing] > ROLE_RANK[inv.role as Role] ? existing : inv.role; // never downgrade on accept
  await ctx.db.batch([
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(principal_id, scope_type, scope_id) DO UPDATE SET role = excluded.role')
      .bind(newId("grant"), ctx.principal.id, scope.type, scope.id, role, nowIso(ctx)),
    ctx.db.prepare("UPDATE invitation SET status = 'accepted', accepted_at = ? WHERE id = ?").bind(nowIso(ctx), inv.id),
  ]);
  return { result: { granted: true, scope, role }, scope, impact };
};

export const list: Handler = async (ctx, p) => {
  const scope = reqScope(p);
  await callerAt(ctx, scope, "member");
  const r = await ctx.db.prepare('SELECT id, principal_id, role, created_at FROM "grant" WHERE scope_type = ? AND scope_id = ? ORDER BY created_at').bind(scope.type, scope.id).all();
  const inv = await ctx.db.prepare("SELECT id, role, status, created_at, expires_at FROM invitation WHERE scope_type = ? AND scope_id = ? AND status IN ('sent','pending','unconfirmed') ORDER BY created_at").bind(scope.type, scope.id).all();
  return { result: { scope, grants: r.results, pending_invitations: inv.results }, scope };
};

/** E: elevation releases a grant; demotion is the compensating control. Owner only; owners are never demoted (D3). */
export const update_role: Handler = async (ctx, p, o) => {
  const scope = reqScope(p); const gid = reqStr(p, "gid"); const role = reqRole(p);
  await callerAt(ctx, scope, "owner");
  const g = await ctx.db.prepare('SELECT id, principal_id, role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first<any>();
  if (!g) throw notVisible("grant");
  if (g.role === "owner" && role !== "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be demoted", "D3 — transfer ownership instead (cap.grant.transfer_owner)");
  const impact = { affected: [{ grant: gid, from: g.role, to: role }], irreversible: ROLE_RANK[role] > ROLE_RANK[g.role as Role], effect: "disclosure" as const, compensating_control: "demotion via this capability (what was seen stays seen)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  await ctx.db.prepare('UPDATE "grant" SET role = ? WHERE id = ?').bind(role, gid).run();
  return { result: { grant: gid, role }, scope, impact, priorState: { role: g.role } };
};

export const revoke: Handler = async (ctx, p) => {
  const scope = reqScope(p); const gid = reqStr(p, "gid");
  const caller = await callerAt(ctx, scope, "member");
  const g = await ctx.db.prepare('SELECT id, principal_id, role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first<any>();
  if (!g) throw notVisible("grant");
  if (g.role === "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be removed", "D3 — last owner is protected; transfer ownership first");
  ceiling(caller, g.role as Role, "revoke grants");
  await ctx.db.prepare('DELETE FROM "grant" WHERE id = ?').bind(gid).run();
  return { result: { grant: gid, revoked: true }, scope };
};

/** D: ownership moves. Owner only; support-without-owner-consent is PROPOSED pending source (Astra 5703469487) → refused here. */
export const transfer_owner: Handler = async (ctx, p, o) => {
  const scope = reqScope(p); const to = reqStr(p, "to");
  if (ctx.principal.kind === "support" && (await roleAt(ctx, scope.type, scope.id)) !== "owner")
    throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "transfer by support without the owner's consent is not ruled", "proposed, pending source — the owner runs this step");
  await callerAt(ctx, scope, "owner");
  if (to === ctx.principal.id) throw new CapError("INVALID_PARAMS", "cannot transfer ownership to yourself", "name another principal");
  if (!(await ctx.db.prepare("SELECT id FROM principal WHERE id = ?").bind(to).first())) throw new CapError("INVALID_PARAMS", "unknown principal", "to must be a signed-up principal id");
  const current = await owners(ctx, scope);
  const stepDown = p.step_down === true;
  const impact = { affected: [{ scope, current_owners: current.length, to, to_becomes: "owner", caller_becomes: stepDown ? "member" : "owner" }], irreversible: true, effect: "disclosure" as const, compensating_control: "transfer back (requires the new owner)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  const stmts = [ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(principal_id, scope_type, scope_id) DO UPDATE SET role = ?')
    .bind(newId("grant"), to, scope.type, scope.id, "owner", nowIso(ctx), "owner")];
  if (stepDown) stmts.push(ctx.db.prepare('UPDATE "grant" SET role = ? WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind("member", ctx.principal.id, scope.type, scope.id)); // an owner remains (to), so the last-owner rule holds
  await ctx.db.batch(stmts);
  return { result: { transferred: true, scope, new_owner: to, caller_role: stepDown ? "member" : "owner" }, scope, impact };
};

export const handlers: Record<string, Handler> = {
  "cap.grant.invite": invite, "cap.grant.revoke_invitation": revoke_invitation, "cap.grant.accept": accept, "cap.grant.list": list,
  "cap.grant.update_role": update_role, "cap.grant.revoke": revoke, "cap.grant.transfer_owner": transfer_owner,
};
void countScalar; void atLeast; void scopeExists;
