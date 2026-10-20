// cap.grant.* — invitations and grants at exactly one scope. D3: members invite ≤ member; owners are never removed or demoted;
// the last owner is protected; transfer is dangerous. Grants are stored at one scope; a workspace grant applies to its grouped projects (common.projectRole). Existence never leaks. Lane B (Fable) — owner per #14 c5704577820.
import { magicLinkEnabled } from "../magic-link";
import { requireConfirmedState } from "../receipt";
import type { Ctx, Handler, Impact, Role, ScopeType } from "./types";
import { CapError, notVisible } from "./errors";
import { ROLE_RANK, atLeast, countScalar, gate, newId, nowIso, randomToken, reqRole, reqScope, reqStr, roleAt, effectiveRoleAt, directRoleAt, grantApplies, sha256 } from "./common";
import { invitationMessage, normalizeAddress, publicOrigin, sendMail, type MailEnv, type MailResult } from "../mail";

type Scope = { type: "workspace" | "project" | "assessment"; id: string };
const INVITE_TTL_S = 7 * 24 * 3600;
const INVITE_COOLDOWN_S = 600;        // one live invitation per scope+invitee per 10 minutes (review #16-1)
// Retry/dedupe policy as implemented: a 'sent' row inside INVITE_COOLDOWN_S is live; a 'pending' row younger than
// PENDING_DEDUPE_S is treated as an in-flight twin; an 'unconfirmed' row stays live with no cooldown expiry; and
// cap.grant.revoke_invitation is the explicit way out of any of those.
// UNRESOLVED CRASH WINDOW: a 'pending' row older than PENDING_DEDUPE_S does NOT prove the provider was never contacted.
// The send and the terminal write are separate steps, so a worker stopped between provider contact and the
// 'sent'/'unconfirmed' write leaves a stale 'pending' row that MAY already have reached the provider. Such a row does not
// block a retry, and a re-invite there CAN double-send. No exactly-once delivery is promised; no outbox or retry
// redesign is added or promised here (independent review AMEND 53c5717369870).
const PENDING_DEDUPE_S = 30;          // in-flight twin window; see the crash-window note above
const INVITES_PER_INVITER_HOUR = 30;  // outbound mail from the captain's domain is not a loop target (review #16-2)

/** The caller's role at the scope; hidden when none. */
async function callerAt(ctx: Ctx, scope: Scope, min: Role): Promise<Role> {
  return gate(await effectiveRoleAt(ctx, scope.type, scope.id), min, scope.type);
}
/** ASK L1 default 1 (cookbook work/active/2026-10-15-3d-workspace-permissions/ASK.md): inviting at, or revoking an invitation
 *  at, ONE project needs the caller's own DIRECT project grant (member or above). An inherited workspace role no longer
 *  suffices, so removing a workspace grant ends every line of access that grant handed on. A caller with no role at all
 *  still gets NOT_FOUND_OR_NOT_VISIBLE (directRoleAt decides visibility on the effective role first). Workspace and
 *  assessment roles are exact, so inviting there already needs the caller's own grant at that scope. */
const PROJECT_INVITE_HINT = "your role here comes from the workspace — invite them at the workspace instead (cap.grant.invite with scope workspace), or ask a direct project member";
async function directAtProject(ctx: Ctx, scope: Scope) {
  if (scope.type === "project") await directRoleAt(ctx, "project", scope.id, "member", PROJECT_INVITE_HINT);
}
/** update_role's direct-owner rule: raising anyone to owner needs a DIRECT owner at the scope (HOLD #483 c6204865181 #2), and
 *  since 0.35.23 (cookbook work/active/2026-10-15-3d-workspace-permissions/ASK-f4-finding4.md default 1, F4) ANY role change at a
 *  project needs a DIRECT project owner: an owner through the workspace manages project people at the workspace, or is added to
 *  the project directly. Workspace and assessment roles are direct only, so their callerAt check already is this rule. */
const PROJECT_ROLE_HINT = "your owner role here comes from the workspace — ask a direct project owner, or get added to the project directly";
async function directOwnerFor(ctx: Ctx, scope: Scope, to: Role | undefined) {
  if (scope.type === "project") await directRoleAt(ctx, "project", scope.id, "owner", PROJECT_ROLE_HINT);
  else if (to === "owner") await directRoleAt(ctx, scope.type, scope.id, "owner");
}
/** D3: a member may act only up to member. */
function ceiling(caller: Role, target: Role, what: string) {
  if (caller !== "owner" && ROLE_RANK[target] > ROLE_RANK["member"])
    throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `members ${what} up to member only`, "D3 — ask an owner, or invite as member");
}
/** HOLD #483 c6204865181 #1: an invitation may not reach a person who already has access at the scope — the caller
 *  themselves, or any principal whose email already holds a role there (direct, or inherited from the grouping workspace).
 *  Otherwise an inherited role is laundered into a permanent direct grant by inviting oneself and accepting. Changing an
 *  existing direct grant is cap.grant.update_role's job, under its own rules. */
async function refuseExistingAccess(ctx: Ctx, scope: Scope, inviteeHash: string) {
  const me = await ctx.db.prepare("SELECT email_hash FROM principal WHERE id = ?").bind(ctx.principal.id).first<{ email_hash: string | null }>();
  if (me?.email_hash && me.email_hash === inviteeHash)
    throw new CapError("INVALID_PARAMS", "cannot invite yourself", "your access here comes from an existing grant; ask a direct owner if it should change", "cap.grant.invite");
  const held = await ctx.db.prepare(`SELECT 1 FROM "grant" g JOIN principal pr ON pr.id = g.principal_id WHERE pr.email_hash = ?1 AND (
      (g.scope_type = ?2 AND g.scope_id = ?3)
      OR (?2 = 'project' AND g.scope_type = 'workspace' AND g.scope_id = (SELECT p.workspace_id FROM project p WHERE p.id = ?3))) LIMIT 1`)
    .bind(inviteeHash, scope.type, scope.id).first();
  if (held) throw new CapError("INVALID_PARAMS", "this person already has access at this scope", "change a direct grant with cap.grant.update_role; inherited access follows the workspace", "cap.grant.update_role");
}
async function owners(ctx: Ctx, scope: Scope): Promise<string[]> {
  const r = await ctx.db.prepare('SELECT principal_id FROM "grant" WHERE scope_type = ? AND scope_id = ? AND role = ?').bind(scope.type, scope.id, "owner").all<{ principal_id: string }>();
  return r.results.map((x) => x.principal_id);
}
/** ASK L1 default 1 (follow-ups F3 and dead-invitations (2)/(3)): ONE predicate for "this invitation's inviter still stands
 *  behind it", over an invitation row aliased `i`. An owner invitation needs its inviter's DIRECT owner grant at the scope; any
 *  other project invitation needs the inviter's DIRECT project grant at member or above (the rule invite applies,
 *  directAtProject). 0.35.23 (cookbook work/active/2026-10-15-3d-workspace-permissions/ASK-f4-finding4.md default 1): the same
 *  holds for workspace and assessment invitations — every invitation needs its inviter's DIRECT grant at its scope (member or
 *  above; owner for an owner invitation); there is no longer a scope that skips the check. accept refuses
 *  a row that fails it; cap.me.invitations and the roster's pending_invitations do not list it; invite de-duplication does not
 *  count it, so a re-invite sends a fresh invitation instead of "nothing was sent again", and that re-invite revokes the dead
 *  row it supersedes. An invitation the caller sent to themselves is NOT covered by this predicate: accept refuses it and
 *  cap.me.invitations omits it by their own created_by checks, but the roster still lists it and de-duplication still
 *  counts it while it is live. */
const inviterStands = (i: string) => standsFor(`${i}.role`, `${i}.scope_type`, `${i}.scope_id`, `${i}.created_by`);
/** inviterStands over plain SQL expressions instead of a row alias, so invite can apply the SAME rule to the row it is about
 *  to write, inside its INSERT (0.35.9, cookbook work/active/2026-10-18-3d-invite-guard-race DoD (a)). */
const standsFor = (role: string, scopeT: string, scopeI: string, by: string) =>
  `EXISTS (SELECT 1 FROM "grant" ig WHERE ig.principal_id = ${by}`
  + ` AND ig.scope_type = ${scopeT} AND ig.scope_id = ${scopeI} AND ${roleBacks(role, "ig.role")})`;
/** The role half of inviterStands: whether a direct grant at role `r` backs an invitation for role `role` (SQL expressions). */
const roleBacks = (role: string, r: string) => `(${r} = 'owner' OR (${role} <> 'owner' AND ${r} = 'member'))`;
/** ONE expiry rule (0.35.9, cookbook work/active/2026-10-18-3d-invite-guard-race DoD (b)): an invitation is live while
 *  expires_at > now and expired from expires_at == now on. `unexpired` is the SQL form (row alias `i`, bound `now`);
 *  `expiredAt` is the same comparison for a row already read (accept). accept, both revoke sweeps, de-duplication and
 *  cap.me.invitations use one of the two. */
const unexpired = (i: string, now: string) => `(${i}.expires_at IS NULL OR ${i}.expires_at > ${now})`;
const expiredAt = (expiresAt: string | null | undefined, now: string) => !!expiresAt && expiresAt <= now;

/** 0.35.8 (cookbook work/active/2026-10-18-3d-invite-revoke-on-grant-removal DoD (a)-(c)): when a holder's DIRECT grant at a
 *  scope is removed or downgraded, the open, unexpired invitations that holder issued at that scope and could no longer issue
 *  (inviterStands fails) are revoked in the same batch as the grant change, so a regained grant cannot revive them. Expired
 *  rows are left as they were (history keeps expired apart from revoked). Since 0.35.23 (ASK-f4-finding4 default 1) this covers
 *  workspace and assessment invitations too: inviterStands ties every invitation to a direct grant. `o` aliases the row.
 *  `after` is the holder's role at the scope once the change lands, as a bound SQL expression (null = no grant); the dry-run
 *  counts with it, and the real call revokes against the grant table as the batch left it (the same predicate, read live). */
const orphanedWhere = (holder: string, scopeT: string, scopeI: string, now: string, after?: string) =>
  `o.created_by = ${holder} AND o.scope_type = ${scopeT} AND o.scope_id = ${scopeI} AND o.status IN ('sent','pending','unconfirmed')`
  + ` AND ${unexpired("o", now)} AND NOT `
  + (after === undefined ? inviterStands("o") : roleBacks("o.role", `COALESCE(${after}, '')`));
/** 0.35.20 (cookbook work/active/2026-10-18-3d-grant-noop-followups-5 DoD (b)): the ids (sorted) of the invitations a change
 *  to `after` would revoke, so a preview binds the id set, not only its count. `orphanedNow` is the same set as one SQL string,
 *  read inside the guarded write, so a same-count swap between the token check and the write changes no row. */
async function orphanedIds(ctx: Ctx, holder: string, scope: Scope, after: Role | null): Promise<string[]> {
  const r = await ctx.db.prepare(`SELECT o.id FROM invitation o WHERE ${orphanedWhere("?1", "?2", "?3", "?4", "?5")} ORDER BY o.id`)
    .bind(holder, scope.type, scope.id, nowIso(ctx), after).all<{ id: string }>();
  return (r.results ?? []).map((x) => x.id);
}
const orphanedNow = (holder: string, scopeT: string, scopeI: string, now: string, after: string) =>
  `COALESCE((SELECT group_concat(o.id, ',' ORDER BY o.id) FROM invitation o WHERE ${orphanedWhere(holder, scopeT, scopeI, now, after)}), '')`;
/** `afterWrite`: the sweep rides a guarded grant write as the next statement of its batch, and runs only when that write
 *  changed a row (SQLite changes() = the statement just before it in the batch; 0.35.14, cookbook
 *  work/active/2026-10-18-3d-grant-write-guard-followups DoD (a)). A refused write therefore sweeps no invitation either. */
function revokeOrphaned(ctx: Ctx, holder: string, scope: Scope, afterWrite = false) {
  return ctx.db.prepare(`UPDATE invitation SET status = 'revoked' WHERE id IN (SELECT o.id FROM invitation o WHERE ${orphanedWhere("?1", "?2", "?3", "?4")})`
    + (afterWrite ? " AND changes() = 1" : ""))
    .bind(holder, scope.type, scope.id, nowIso(ctx));
}

/** A LIVE invitation for the same scope+invitee, as ONE predicate shared by the de-duplicating INSERT and the read-back.
 *  Three shapes are live: a 'sent' row inside the cooldown, a 'pending' row younger than PENDING_DEDUPE_S (an in-flight twin),
 *  and an 'unconfirmed' row for as long as it is unexpired — the mail MAY have gone out, so no cooldown expiry may re-open it
 *  (independent review AMEND P2). A row whose inviter no longer stands behind it (inviterStands) is dead, not live.
 *  Placeholders are passed in so both statements can number their binds independently; `d` aliases the invitation row. */
const dupWhere = (scopeT: string, scopeI: string, hash: string, sentSince: string, pendingSince: string, now: string) =>
  `d.scope_type = ${scopeT} AND d.scope_id = ${scopeI} AND d.invitee_hash = ${hash} AND (`
  + `(d.status = 'sent' AND d.created_at > ${sentSince})`
  + ` OR (d.status = 'pending' AND d.created_at > ${pendingSince})`
  + ` OR (d.status = 'unconfirmed' AND ${unexpired("d", now)})) AND ${inviterStands("d")}`;

/** The dead rows a fresh invitation SUPERSEDES, as ONE predicate shared by the re-invite's revoke and its dry-run count; `s`
 *  aliases the invitation row. Only rows that are still open ('sent' / 'pending' / 'unconfirmed'), unexpired, and whose
 *  inviter no longer stands behind them (inviterStands fails) qualify; a live row is never touched. An owner row is touched
 *  only by an owner re-invite, so this revoke never goes past the ceiling revoke_invitation applies (cookbook
 *  work/active/2026-10-18-3d-invite-followups-2 DoD (a), (b)). */
const supersededWhere = (scopeT: string, scopeI: string, hash: string, role: string, now: string) =>
  `s.scope_type = ${scopeT} AND s.scope_id = ${scopeI} AND s.invitee_hash = ${hash} AND s.status IN ('sent','pending','unconfirmed')`
  + ` AND ${unexpired("s", now)} AND (s.role <> 'owner' OR ${role} = 'owner') AND NOT ${inviterStands("s")}`;

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
  await directAtProject(ctx, scope);
  // Creating an owner needs a DIRECT owner at this scope; an inherited workspace owner cannot mint project owners.
  if (role === "owner") await directRoleAt(ctx, scope.type, scope.id, "owner");
  const inviteeHash = await sha256(email);
  await refuseExistingAccess(ctx, scope, inviteeHash);
  const now = ctx.now().getTime(); const nowStr = new Date(now).toISOString(); // one clock read for the whole call (531 not-blocking 5-6)
  // revoked_superseded: how many dead invitations for this invitee at this scope the fresh invitation revokes. A dry-run counts
  // what a landed INSERT would revoke; a real call reports what the batch actually revoked (0 when it de-duplicated).
  const wouldRevoke = o?.dryRun
    ? (await ctx.db.prepare(`SELECT COUNT(*) AS n FROM invitation s WHERE ${supersededWhere("?1", "?2", "?3", "?4", "?5")}`)
        .bind(scope.type, scope.id, inviteeHash, role, nowStr).first<{ n: number }>())?.n ?? 0
    : 0;
  const impact = { affected: [{ scope, role, invitee: inviteeHash.slice(0, 12), will_see: `${scope.type} contents at role ${role}` }], irreversible: true, effect: "external" as const, compensating_control: "cap.grant.revoke_invitation (does not unsend)", revoked_superseded: wouldRevoke };
  if (o?.dryRun) return { result: {}, scope, impact };
  // Intent de-duplication + inviter cap, decided and written in ONE statement so concurrent replays cannot both pass a
  // check-then-insert gap (re-review #16). A live duplicate is: a row already 'sent' inside the cooldown, a 'pending' row
  // younger than PENDING_DEDUPE_S (an in-flight twin), or an unexpired 'unconfirmed' row (the mail may have gone out —
  // no cooldown expiry may re-open it; the human path out is revoke_invitation, then invite anew).
  const sentSince = new Date(now - INVITE_COOLDOWN_S * 1000).toISOString(), pendingSince = new Date(now - PENDING_DEDUPE_S * 1000).toISOString(), hourAgo = new Date(now - 3600_000).toISOString();
  const DUP = dupWhere("?2", "?3", "?4", "?11", "?12", "?14");
  const id = newId("inv"); const token = randomToken("il");
  // The fresh row SUPERSEDES the DEAD rows (supersededWhere: open, unexpired, inviterStands fails, owner rows only for an owner
  // re-invite) for the same scope+invitee. They are revoked in the same batch, only when the INSERT landed (a de-duplicated or
  // rate-limited call revokes nothing), so they cannot come back alive if their inviter later regains a direct grant. Live
  // rows are never touched: a live row from outside the cooldown can still stand beside the fresh one. Expired rows stay
  // 'sent'/'unconfirmed' so history keeps expired apart from revoked (cookbook work/done/2026-10-18-3d-invite-followups DoD (a);
  // work/active/2026-10-18-3d-invite-followups-2 DoD (a)-(e)).
  const [ins, rev] = await ctx.db.batch([
    ctx.db.prepare(`INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?8, ?9, ?10
      WHERE NOT EXISTS (SELECT 1 FROM invitation d WHERE ${DUP})
        AND (SELECT COUNT(*) FROM invitation WHERE created_by = ?8 AND scope_type <> 'survey' AND created_at > ?13) < ?7
        AND ${standsFor("?6", "?2", "?3", "?8")}`)
      .bind(id, scope.type, scope.id, inviteeHash, await sha256(token), role, INVITES_PER_INVITER_HOUR, ctx.principal.id, nowStr, new Date(now + INVITE_TTL_S * 1000).toISOString(), sentSince, pendingSince, hourAgo, nowStr),
    ctx.db.prepare(`UPDATE invitation SET status = 'revoked' WHERE id IN (SELECT s.id FROM invitation s WHERE s.id <> ?4
        AND ${supersededWhere("?1", "?2", "?3", "?5", "?6")})
      AND EXISTS (SELECT 1 FROM invitation n WHERE n.id = ?4)`)
      .bind(scope.type, scope.id, inviteeHash, id, role, nowStr),
  ]);
  const revokedSuperseded = rev.meta.changes ?? 0;
  impact.revoked_superseded = revokedSuperseded;
  if ((ins.meta.changes ?? 0) !== 1) {
    // The standing checks above ran before this batch; the INSERT re-checks the same rule (standsFor) in its own WHERE, so a
    // grant removed or lowered in between leaves no row (cookbook work/active/2026-10-18-3d-invite-guard-race DoD (a)). Said
    // as that, not as a duplicate or a rate limit.
    const stands = await ctx.db.prepare(`SELECT ${standsFor("?1", "?2", "?3", "?4")} AS ok`).bind(role, scope.type, scope.id, ctx.principal.id).first<{ ok: number }>();
    if (!stands?.ok) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "your role at this scope changed while the invitation was being written; nothing was sent", "ask a direct owner of this scope", "cap.grant.invite");
    const dup = await ctx.db.prepare(`SELECT d.id, d.role, d.status FROM invitation d WHERE ${dupWhere("?1", "?2", "?3", "?4", "?5", "?6")} ORDER BY d.created_at DESC LIMIT 1`)
      .bind(scope.type, scope.id, inviteeHash, sentSince, pendingSince, nowStr).first<{ id: string; role: string; status: string }>();
    if (!dup) throw new CapError("RATE_LIMITED", `at most ${INVITES_PER_INVITER_HOUR} collaborator invitations per hour`, "this cap resets over the next hour, not the next minute", "cap.grant.invite", 3600);
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
    const msg = invitationMessage(origin, token, role, scope.type, INVITE_TTL_S / 86400, magicLinkEnabled(ctx.env));
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
  ctx.log("grant.invite.mail", { delivered: delivery.delivered, state: delivery.state, reason: delivery.reason ?? null, provider_status: delivery.provider_status ?? null, stored_status: stored, revoked_superseded: revokedSuperseded }); // never the address, nor a hash of it
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
  await directAtProject(ctx, scope);
  // 'unconfirmed' is revocable: it is the explicit human path out of an uncertain send (revoke, then invite anew).
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "already accepted — revoke the grant instead", undefined, "cap.grant.revoke");
  await ctx.db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind(id).run();
  return { result: { id, status: "revoked" }, scope };
};

/** Scopes a collaborator invitation can name. Survey (participant) invitations carry no invitee and are never listed or accepted here. */
const GRANT_SCOPES = ["workspace", "project", "assessment"] as const;
const LIVE_STATUSES = ["pending", "sent", "unconfirmed"] as const;

/** E: accepting releases the grant — disclosure of scope contents begins.
 *  Two ways to name the invitation (B04 step c, captain ruling 2026-09-28 15:27 ET k0015):
 *  - `token` — the mailed link token (unchanged);
 *  - `invitation_id` — for the signed-in invitee who never opened the link (listed by cap.me.invitations). No token: the
 *    authenticated principal's email hash must equal the invitation's invitee_hash — the SAME check the token path makes.
 *  Every miss (unknown id, survey invitation, revoked, someone else's) is the same NOT_FOUND_OR_NOT_VISIBLE: unauthorized == nonexistent. */
export const accept: Handler = async (ctx, p, o) => {
  if (ctx.principal.kind !== "user") throw new CapError("NOT_AUTHENTICATED", "sign in to accept an invitation");
  const byId = typeof p.invitation_id === "string" && p.invitation_id.length > 0;
  if (byId && p.token !== undefined) throw new CapError("INVALID_PARAMS", "name the invitation by token or by invitation_id, not both", "the link path uses token; the signed-in path (cap.me.invitations) uses invitation_id", "cap.grant.accept");
  const inv = byId
    ? await ctx.db.prepare(`SELECT id, scope_type, scope_id, role, status, expires_at, invitee_hash, created_by FROM invitation WHERE id = ? AND scope_type IN (${GRANT_SCOPES.map(() => "?").join(",")})`).bind(p.invitation_id as string, ...GRANT_SCOPES).first<any>()
    : await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status, expires_at, invitee_hash, created_by FROM invitation WHERE token_hash = ?").bind(await sha256(reqStr(p, "token"))).first<any>();
  // 'unconfirmed' is accepted like 'sent'. Acceptance is permitted by token possession PLUS the authenticated principal's
  // email matching the invitee (checked below) — possession does not establish the delivery channel or inbox arrival
  // (a DEV manual handoff path exists), so it is never treated as proof that mail was delivered.
  if (!inv || inv.status === "revoked") throw notVisible("invitation");
  // Invitations are NOT transferable bearer tokens: the invited email must be the signed-in principal's (Astra c5704773599). Mismatch is hidden, never explained.
  const me = await ctx.db.prepare("SELECT email_hash FROM principal WHERE id = ?").bind(ctx.principal.id).first<{ email_hash: string | null }>();
  if (!me?.email_hash || me.email_hash !== inv.invitee_hash) throw notVisible("invitation");
  await refuseDeadInvitation(ctx, inv);
  const scope: Scope = { type: inv.scope_type, id: inv.scope_id };
  const existing = await roleAt(ctx, scope.type, scope.id);
  const impact = { affected: [{ scope, role: inv.role, currently: existing ?? "none" }], irreversible: true, effect: "disclosure" as const, compensating_control: "cap.grant.revoke (what was seen stays seen)" };
  // 0.35.18 (cookbook work/active/2026-10-18-3d-grant-noop-followups-3 DoD (a)): the preview's `currently` is bound into the token.
  if (o?.dryRun) return { result: {}, scope, impact, confirmState: { currently: existing ?? "none" } };
  await requireConfirmedState(o, { currently: existing ?? "none" }, "cap.grant.accept");
  // 0.35.10 (cookbook work/active/2026-10-18-3d-invite-accept-race DoD (a)-(c)): the checks above ran before this batch, so
  // both statements re-check the invitation inside it (ACCEPTABLE: open, unexpired, inviter still stands). A revoke, an expiry
  // or a grant removal landing in between mints no grant and leaves the row as that change left it ('revoked' stays
  // 'revoked'). The upsert keeps the higher of the existing and the offered role, so a role raised concurrently is not lowered.
  // 0.35.11 (cookbook work/active/2026-10-18-3d-invite-accept-stale-role DoD (a)-(b)): the upsert binds the OFFERED role and
  // the SQL takes the max against the row as it stands at batch time (never downgrade on accept). A JS max over `existing`
  // (read above, before the batch) would re-raise a grant lowered or removed in between; RETURNING role reports what is held.
  const nowStr = nowIso(ctx);
  const [granted, used] = await ctx.db.batch([
    ctx.db.prepare(`INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6
        WHERE ${acceptable("?7", "?6")}
      ON CONFLICT(principal_id, scope_type, scope_id) DO UPDATE SET role = CASE WHEN ${roleRank("excluded.role")} > ${roleRank('"grant".role')} THEN excluded.role ELSE "grant".role END
      RETURNING role`)
      .bind(newId("grant"), ctx.principal.id, scope.type, scope.id, inv.role, nowStr, inv.id),
    ctx.db.prepare(`UPDATE invitation SET status = 'accepted', accepted_at = ?2 WHERE id = ?1 AND ${acceptable("?1", "?2")}`).bind(inv.id, nowStr),
  ]);
  if ((used.meta.changes ?? 0) !== 1) {
    // Refused inside the batch: report it with the same typed refusal the checks above give for that state (a revoked row is
    // NOT_FOUND_OR_NOT_VISIBLE, an expired one invitation_expired, a fallen inviter NOT_AUTHORIZED_AT_SCOPE), never a success.
    const row = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status, expires_at, invitee_hash, created_by FROM invitation WHERE id = ?").bind(inv.id).first<any>();
    if (!row || row.status === "revoked") throw notVisible("invitation");
    await refuseDeadInvitation(ctx, row);
    throw notVisible("invitation");
  }
  const held = ((granted.results?.[0] as { role?: Role } | undefined)?.role) ?? (inv.role as Role);
  return { result: { granted: true, scope, role: held }, scope, impact };
};

/** accept's refusals for an invitation that is no longer acceptable, in the order accept has always applied them. Run before
 *  the write and again, on a re-read row, when the write batch refuses (0.35.10 DoD (b)), so both report the same typed error. */
async function refuseDeadInvitation(ctx: Ctx, inv: any): Promise<void> {
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "invitation_used", "ask for a new invitation");
  if (expiredAt(inv.expires_at, nowIso(ctx))) throw new CapError("INVALID_PARAMS", "invitation_expired", "ask for a new invitation");
  // HOLD #483 c6204865181 #1: no one accepts their own invitation (closes the self-invite path for rows minted before the
  // invite-side check), and an owner invitation is honoured only while its inviter still holds a DIRECT owner grant here.
  if (inv.created_by === ctx.principal.id) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "cannot accept an invitation you created", "ask a direct owner of this scope");
  // ASK L1 F3 + nit 7: one read decides both inviter rules, through the same predicate the listings and de-dup use. Since
  // 0.35.23 (ASK-f4-finding4 default 1, finding 4) it runs for every invitation: workspace and assessment ones too.
  const stands = await ctx.db.prepare(`SELECT 1 AS ok FROM invitation i WHERE i.id = ? AND ${inviterStands("i")}`).bind(inv.id).first();
  if (!stands && inv.role === "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "this owner invitation was not issued by a direct owner of this scope", "ask a direct owner for a new invitation");
  if (!stands && inv.scope_type === "project") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "this project invitation was not issued by a direct member of this project", "ask a direct project member for a new invitation, or ask to be invited to the workspace");
  if (!stands) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `the person who sent this invitation no longer has a role at this ${inv.scope_type}`, "ask a current member for a new invitation");
}
/** The invitation `id` can still be accepted at `now` (bound SQL expressions): open, unexpired by the one expiry rule, and its
 *  inviter still stands behind it (inviterStands). accept's write batch gates both statements on it (0.35.10 DoD (a)). */
const acceptable = (id: string, now: string) =>
  `EXISTS (SELECT 1 FROM invitation i WHERE i.id = ${id} AND i.status IN (${LIVE_STATUSES.map((st) => `'${st}'`).join(",")})`
  + ` AND ${unexpired("i", now)} AND ${inviterStands("i")})`;
/** ROLE_RANK as a SQL expression over a role expression `r` (unknown roles rank 0). */
const roleRank = (r: string) => `(CASE ${r} ${(Object.keys(ROLE_RANK) as Role[]).map((k) => `WHEN '${k}' THEN ${ROLE_RANK[k]}`).join(" ")} ELSE 0 END)`;

/** cap.me.invitations (B04 step c): the signed-in person's pending collaborator invitations, matched by their hashed email.
 *  Returns what the invitee may know before accepting — scope (type + id), role, expiry, inviter display name — never the
 *  token (nor its hash), never the invitee hash. The inviter display name is null: principals store no name
 *  (migrations/0001_init.sql principal has email_hash only). Anyone else's invitations are simply not in the list.
 *  S19 (captain 2026-09-29 "it's ridiculous to not see what I'm accepting the invite to"): for THIS list only — the caller's
 *  own email-matched, live invitations — the scope also carries its name and its path of names (workspace › project ›
 *  assessment; project: workspace › project; workspace: its name). Names only: no parent ids, no other scope contents.
 *  The `#invite=` token path (cap.grant.accept dry run, possibly signed out) is unchanged and still discloses no name. */
export const mine: Handler = async (ctx) => {
  if (ctx.principal.kind !== "user") throw new CapError("NOT_AUTHENTICATED", "sign in to see invitations addressed to you");
  const me = await ctx.db.prepare("SELECT email_hash FROM principal WHERE id = ?").bind(ctx.principal.id).first<{ email_hash: string | null }>();
  if (!me?.email_hash) return { result: { invitations: [] } };
  // One read: the WHERE is the S9 predicate unchanged (own hash, grant scopes, live, unexpired); the joins only resolve names
  // for the rows it already admitted. Each join is keyed on the invitation's own scope_type, so a row names at most one chain.
  const r = await ctx.db.prepare(`SELECT i.id, i.scope_type, i.scope_id, i.role, i.created_at, i.expires_at,
        w0.name AS w0_name, p1.name AS p1_name, w1.name AS w1_name, a2.name AS a2_name, p2.name AS p2_name, w2.name AS w2_name
      FROM invitation i
        LEFT JOIN workspace w0 ON i.scope_type = 'workspace' AND w0.id = i.scope_id
        LEFT JOIN project p1 ON i.scope_type = 'project' AND p1.id = i.scope_id
        LEFT JOIN workspace w1 ON w1.id = p1.workspace_id
        LEFT JOIN assessment a2 ON i.scope_type = 'assessment' AND a2.id = i.scope_id
        LEFT JOIN project p2 ON p2.id = a2.project_id
        LEFT JOIN workspace w2 ON w2.id = p2.workspace_id
      WHERE i.invitee_hash = ? AND i.scope_type IN (${GRANT_SCOPES.map(() => "?").join(",")}) AND i.status IN (${LIVE_STATUSES.map(() => "?").join(",")})
        AND ${unexpired("i", "?")} AND i.created_by IS NOT ? AND ${inviterStands("i")} ORDER BY i.created_at, i.id`)
    .bind(me.email_hash, ...GRANT_SCOPES, ...LIVE_STATUSES, nowIso(ctx), ctx.principal.id).all<InvitationRow>();
  const invitations = r.results.map((i) => {
    const { name, path } = scopeNames(i);
    return { id: i.id, scope: { type: i.scope_type, id: i.scope_id, name, path }, role: i.role, inviter_display_name: null, invited_at: i.created_at, expires_at: i.expires_at };
  });
  return { result: { invitations } };
};
type InvitationRow = { id: string; scope_type: string; scope_id: string; role: string; created_at: string; expires_at: string | null;
  w0_name: string | null; p1_name: string | null; w1_name: string | null; a2_name: string | null; p2_name: string | null; w2_name: string | null };
/** The scope's own name and its path of names, outermost first, ending with the scope itself. A missing link (a project with no
 *  workspace, a row deleted in flight) is skipped; a scope whose own row is gone has name null and an empty path. */
function scopeNames(i: InvitationRow): { name: string | null; path: string[] } {
  const chain = i.scope_type === "workspace" ? [i.w0_name]
    : i.scope_type === "project" ? [i.w1_name, i.p1_name]
    : [i.w2_name, i.p2_name, i.a2_name];
  const name = chain[chain.length - 1] ?? null;
  if (name === null) return { name: null, path: [] };
  return { name, path: chain.filter((n): n is string => typeof n === "string") };
}

export const list: Handler = async (ctx, p) => {
  const scope = reqScope(p);
  await callerAt(ctx, scope, "member");
  const r = await ctx.db.prepare('SELECT id, principal_id, role, created_at FROM "grant" WHERE scope_type = ? AND scope_id = ? ORDER BY created_at').bind(scope.type, scope.id).all();
  // Dead rows (inviter no longer stands behind them; accept refuses them) are not pending: inviterStands, one predicate.
  const inv = await ctx.db.prepare(`SELECT i.id, i.role, i.status, i.created_at, i.expires_at FROM invitation i WHERE i.scope_type = ? AND i.scope_id = ? AND i.status IN ('sent','pending','unconfirmed') AND ${inviterStands("i")} ORDER BY i.created_at`).bind(scope.type, scope.id).all();
  return { result: { scope, grants: r.results, pending_invitations: inv.results }, scope };
};

/** E: elevation releases a grant; demotion is the compensating control. Owner only; owners are never demoted (D3). */
export const update_role: Handler = async (ctx, p, o) => {
  const scope = reqScope(p); const gid = reqStr(p, "gid"); const role = reqRole(p);
  await callerAt(ctx, scope, "owner");
  const g = await ctx.db.prepare('SELECT id, principal_id, role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first<any>();
  if (!g) throw notVisible("grant");
  if (g.role === "owner" && role !== "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be demoted", "D3 — transfer ownership instead (cap.grant.transfer_owner)");
  // HOLD #483 c6204865181 #2: raising anyone to owner needs a DIRECT owner — an inherited owner cannot mint an undemotable owner.
  // 0.35.23 (ASK-f4-finding4 default 1, F4): at a project, ANY role change needs a direct project owner (directOwnerFor).
  await directOwnerFor(ctx, scope, role);
  // A downgrade revokes the invitations the holder could no longer issue (orphanedWhere); a raise or no-op revokes nothing.
  const downgrade = ROLE_RANK[role] < ROLE_RANK[g.role as Role];
  // 0.35.16 (cookbook work/active/2026-10-18-3d-grant-noop-dispatch-receipt DoD (b)-(c)): a target already at the requested
  // role when first read is the same no-op as one raised there by another writer in the window: the reply carries noop, and a
  // no-op impact names no disclosure and no compensating control (nothing is released, nothing to compensate).
  const noopImpact = (): Impact & { revoked_invitations: number } =>
    ({ affected: [{ grant: gid, from: role, to: role }], irreversible: false, revoked_invitations: 0, noop: true });
  // 0.35.17 (cookbook work/active/2026-10-18-3d-grant-noop-followups-2 DoD (c)-(d)): one no-op reply for both paths (first read,
  // or another writer in the window): the log line keeps the requested downgrade, HandlerResult.noop marks the receipt.
  const noopReply = () => {
    ctx.log("grant.update_role", { noop: true, downgrade, revoked_invitations: 0 });
    return { result: { grant: gid, role, noop: true }, noop: true as const, scope, priorState: { role }, impact: noopImpact() };
  };
  const firstReadNoop = g.role === role;
  // 0.35.21 (cookbook work/active/2026-10-18-3d-grant-noop-followups-6 DoD (b)): `downgrade` is the one sweep condition (the
  // preview's swept set, the write guard, the sweep and the refusal); it already implies the role moves (not firstReadNoop).
  const sweptIds = downgrade ? await orphanedIds(ctx, g.principal_id, scope, role) : [];
  const impact: Impact & { revoked_invitations: number } = firstReadNoop ? noopImpact() : { affected: [{ grant: gid, from: g.role, to: role }], irreversible: ROLE_RANK[role] > ROLE_RANK[g.role as Role], effect: "disclosure" as const, compensating_control: "demotion via this capability (what was seen stays seen)",
    revoked_invitations: sweptIds.length };
  // 0.35.17 DoD (a): the preview binds the role it read into the confirm token; an execute that reads another role (a no-op
  // preview whose target was lowered in between would otherwise run as an elevation) is refused and asks for a new dry_run.
  // 0.35.19 (cookbook work/active/2026-10-18-3d-grant-noop-followups-4 DoD (b)): the revoked_invitations count the preview
  // showed is bound too, so an execute after the holder's open invitations changed asks for a new dry_run.
  // 0.35.20 (cookbook work/active/2026-10-18-3d-grant-noop-followups-5 DoD (b)): the swept invitation id set is bound, not
  // only its count (a same-count swap is refused), and re-checked inside the UPDATE below.
  const read = { role: g.role, revoked_invitations: impact.revoked_invitations, revoked_invitation_ids: sweptIds };
  if (o?.dryRun) return { result: firstReadNoop ? { noop: true } : {}, scope, impact, confirmState: read };
  await requireConfirmedState(o, read, "cap.grant.update_role");
  // 0.35.12 (cookbook work/active/2026-10-18-3d-grant-owner-guard-race DoD (a)): the owner check above read the row before
  // this batch, so the UPDATE re-checks it in its own WHERE: a target raised to owner in between (an accept landing) is not
  // demoted. 0.35.13 (cookbook work/active/2026-10-18-3d-grant-update-role-write-guard DoD (a)-(b)): the UPDATE also writes
  // only against the role it read (role = ?3), and re-checks the caller's own authority (owner here; a DIRECT owner to raise
  // to owner, and since 0.35.23 for any role change at a project, as directOwnerFor) in the same WHERE, so a role changed in between, or a caller demoted in between, changes no row. Refused → no
  // row changed: the orphan sweep runs only when this UPDATE wrote its row (revokeOrphaned afterWrite, 0.35.14 DoD (a)), and
  // the typed refusal for the state the re-read finds (refuseGrantWrite).
  const binds: unknown[] = [role, gid, g.role, ctx.principal.id, scope.type, scope.id];
  if (downgrade) binds.push(g.principal_id, nowIso(ctx), sweptIds.join(","));
  const stmts = [ctx.db.prepare(`UPDATE "grant" SET role = ?1 WHERE id = ?2 AND role = ?3 AND (role <> 'owner' OR ?1 = 'owner')`
    + ` AND ${callerHolds("?4", "?5", "?6", "'owner'")} AND ((?1 <> 'owner' AND ?5 <> 'project') OR ${callerHolds("?4", "?5", "?6", "'owner'", true)})`
    + (downgrade ? ` AND ${orphanedNow("?7", "?5", "?6", "?8", "?1")} = ?9` : ""))
    .bind(...binds)];
  if (downgrade) stmts.push(revokeOrphaned(ctx, g.principal_id, scope, true));
  const res = await ctx.db.batch(stmts);
  if ((res[0].meta.changes ?? 0) !== 1) {
    const live = await reReadGrantWrite(ctx, scope, gid, "update_role", role);
    // 0.35.20 DoD (b): the role still reads as previewed and the caller still holds it, so the swept invitation set moved.
    if (downgrade && live.now === g.role && (await orphanedIds(ctx, g.principal_id, scope, role)).join(",") !== sweptIds.join(","))
      throw new CapError("CONFIRM_REQUIRED", "the invitations this change would revoke changed since the dry_run preview", "Call dry_run again and confirm the new preview.", "cap.grant.update_role");
    if (live.now !== role) refuseGrantWrite(live, "update_role", role, g.role as Role);
    // 0.35.14 DoD (d): the grant already holds the requested role, so the end state stands and there is no conflict. 0.35.15
    // (cookbook work/active/2026-10-18-3d-grant-noop-receipt-followups DoD (a)): this caller changed nothing, so the reply is a
    // no-op: priorState and impact carry the live role and the result and log line say noop. 0.35.16 (DoD (a), (c)): dispatch
    // marks the receipt for a noop result as a no-op (mintReceipt), so the receipt credits this caller with no change; the
    // impact names no disclosure or compensating control; the log line keeps the downgrade this caller requested.
    return noopReply();
  }
  impact.revoked_invitations = downgrade ? res[1].meta.changes ?? 0 : 0;
  if (firstReadNoop) return noopReply();
  ctx.log("grant.update_role", { downgrade, revoked_invitations: impact.revoked_invitations });
  return { result: { grant: gid, role }, scope, impact, priorState: { role: g.role } };
};

export const revoke: Handler = async (ctx, p) => {
  const scope = reqScope(p); const gid = reqStr(p, "gid");
  const caller = await callerAt(ctx, scope, "member");
  const g = await ctx.db.prepare('SELECT id, principal_id, role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first<any>();
  if (!g) throw notVisible("grant");
  if (g.role === "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be removed", "D3 — last owner is protected; transfer ownership first");
  ceiling(caller, g.role as Role, "revoke grants");
  // The grant goes and, in the same batch, the invitations its holder could no longer issue (orphanedWhere). This capability
  // is a plain write (no dry-run, no impact), so the count is reported in its result and its log line.
  // 0.35.12 (cookbook work/active/2026-10-18-3d-grant-owner-guard-race DoD (a)): the DELETE re-checks the owner guard in its own
  // WHERE, so a target raised to owner after the read above is not removed (D3). 0.35.13 (cookbook
  // work/active/2026-10-18-3d-grant-update-role-write-guard DoD (b)): it also re-checks the caller's own authority there (member
  // or above, and the ceiling against the target's live role), so a caller demoted or removed after the read removes no one.
  // Refused → no row changed (the sweep runs only when the DELETE removed its row, 0.35.14 DoD (a)), and the typed refusal
  // for the state the re-read finds (refuseGrantWrite).
  const [del, rev] = await ctx.db.batch([ctx.db.prepare(`DELETE FROM "grant" WHERE id = ?1 AND role <> 'owner'`
    + ` AND ${callerHolds("?2", "?3", "?4", `(CASE WHEN ${roleRank('"grant".role')} > ${ROLE_RANK.member} THEN 'owner' ELSE 'member' END)`)}`)
    .bind(gid, ctx.principal.id, scope.type, scope.id), revokeOrphaned(ctx, g.principal_id, scope, true)]);
  if ((del.meta.changes ?? 0) !== 1) refuseGrantWrite(await reReadGrantWrite(ctx, scope, gid, "revoke"), "revoke");
  const revoked_invitations = rev.meta.changes ?? 0;
  ctx.log("grant.revoke", { revoked_invitations });
  return { result: { grant: gid, revoked: true, revoked_invitations }, scope };
};

/** update_role's and revoke's write refused inside its batch (0.35.12 DoD (a); 0.35.13 DoD (a), (b), (d)): re-run the
 *  read-time checks against the state as it is now, in the order the handler applies them — the caller's own authority first
 *  (no role → NOT_FOUND_OR_NOT_VISIBLE, too low → NOT_AUTHORIZED_AT_SCOPE, as callerAt / directRoleAt say), then the target
 *  (gone → NOT_FOUND_OR_NOT_VISIBLE). Returns the caller's role and the target's live role for refuseGrantWrite, or, for
 *  update_role, for the no-op check (target already at the requested role, 0.35.14 DoD (d) / 0.35.15 DoD (a)). */
async function reReadGrantWrite(ctx: Ctx, scope: Scope, gid: string, op: "update_role" | "revoke", to?: Role): Promise<{ caller: Role; now: Role }> {
  const caller = await callerAt(ctx, scope, op === "update_role" ? "owner" : "member");
  if (op === "update_role") await directOwnerFor(ctx, scope, to);
  const now = await ctx.db.prepare('SELECT role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first<{ role: Role }>();
  if (!now) throw notVisible("grant");
  return { caller, now: now.role };
}
/** The typed refusal for the state reReadGrantWrite found: an owner → the D3 refusal (named only when the target IS an owner
 *  now), revoke's ceiling against the live role, update_role's target at a role other than the one it read → STAGE_CONFLICT;
 *  a grant still visible that nothing above explains is STAGE_CONFLICT, never not-visible (0.35.14 DoD (d)). Always throws:
 *  `never`, so the compiler proves both callers stop here (0.35.15 DoD (b)). update_role's no-op (already at `to`) is decided
 *  by update_role before it calls this. */
function refuseGrantWrite(live: { caller: Role; now: Role }, op: "update_role" | "revoke", to?: Role, read?: Role): never {
  const { caller, now } = live;
  if (op === "update_role") {
    if (now === "owner" && to !== "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be demoted", "D3 — transfer ownership instead (cap.grant.transfer_owner)");
    if (now !== read) throw new CapError("STAGE_CONFLICT", `this grant's role changed from ${read} to ${now} while the change was being made`, "re-read the roster (cap.grant.list) and try again");
  } else {
    if (now === "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be removed", "D3 — last owner is protected; transfer ownership first");
    ceiling(caller, now, "revoke grants");
  }
  // 0.35.14 DoD (d): the grant is still visible and nothing above explains the refusal (the state moved and moved back between
  // the write and the re-read): a conflict to retry, never "not found" for a grant the caller can see.
  throw new CapError("STAGE_CONFLICT", "this grant changed while the change was being made", "re-read the roster (cap.grant.list) and try again");
}
/** The caller (bound `caller`) holds at least `min` (a SQL role expression) at the scope, read live inside a write (0.35.13
 *  DoD (b)): the same rule callerAt applies (a project inherits its grouping workspace's grant), or, with `direct`, only a grant
 *  at exactly this scope (directRoleAt). `cg` aliases the caller's grant row; `min` may name the outer row as "grant".role. */
const callerHolds = (caller: string, scopeT: string, scopeI: string, min: string, direct = false) =>
  `EXISTS (SELECT 1 FROM "grant" cg WHERE cg.principal_id = ${caller} AND `
  + (direct ? `cg.scope_type = ${scopeT} AND cg.scope_id = ${scopeI}` : grantApplies("cg", scopeT, scopeI)) // DoD (c): one rule (common.grantApplies)
  + ` AND ${roleRank("cg.role")} >= ${roleRank(min)})`;

/** Ownership moves only from a DIRECT owner grant at this scope. An owner inherited from the grouping workspace cannot
 *  transfer or step down here: step_down rewrites only the direct grant, so the inherited powers would silently remain.
 *  0.35.21 (cookbook work/active/2026-10-18-3d-grant-noop-followups-6 DoD (c)): one preamble for transfer_owner's read-time
 *  check and its 0-row re-read, so the two cannot drift. */
async function requireDirectOwner(ctx: Ctx, scope: Scope): Promise<void> {
  await callerAt(ctx, scope, "owner");
  await directRoleAt(ctx, scope.type, scope.id, "owner", "your owner role is inherited from the workspace — a direct project owner runs this step");
}

/** D: ownership moves. Owner only; support-without-owner-consent is PROPOSED pending source (Astra 5703469487) → refused here. */
export const transfer_owner: Handler = async (ctx, p, o) => {
  const scope = reqScope(p); const to = reqStr(p, "to");
  if (ctx.principal.kind === "support" && (await roleAt(ctx, scope.type, scope.id)) !== "owner")
    throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "transfer by support without the owner's consent is not ruled", "proposed, pending source — the owner runs this step");
  await requireDirectOwner(ctx, scope);
  if (to === ctx.principal.id) throw new CapError("INVALID_PARAMS", "cannot transfer ownership to yourself", "name another principal");
  if (!(await ctx.db.prepare("SELECT id FROM principal WHERE id = ?").bind(to).first())) throw new CapError("INVALID_PARAMS", "unknown principal", "to must be a signed-up principal id");
  const current = await owners(ctx, scope);
  const stepDown = p.step_down === true;
  // Stepping down is a downgrade (owner → member): the caller's owner invitations here are revoked with it (orphanedWhere).
  const sweptIds = stepDown ? await orphanedIds(ctx, ctx.principal.id, scope, "member") : [];
  // 0.35.21 DoD (b): the impact literal is built once, after the swept set it reports.
  const impact = { affected: [{ scope, current_owners: current.length, to, to_becomes: "owner", caller_becomes: stepDown ? "member" : "owner" }], irreversible: true, effect: "disclosure" as const, compensating_control: "transfer back (requires the new owner)",
    revoked_invitations: sweptIds.length };
  // 0.35.18 (cookbook work/active/2026-10-18-3d-grant-noop-followups-3 DoD (a)): the preview binds the owner set it read and the
  // recipient's direct role here into the confirm token; an execute that reads either changed is refused (CONFIRM_REQUIRED).
  // 0.35.19 (cookbook work/active/2026-10-18-3d-grant-noop-followups-4 DoD (b)): the revoked_invitations count it showed too.
  const to_role = (await ctx.db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind(to, scope.type, scope.id).first<{ role: Role }>())?.role ?? null;
  const ownerSet = [...current].sort();
  // 0.35.20 (cookbook work/active/2026-10-18-3d-grant-noop-followups-5 DoD (b)): the swept invitation id set, not only its count.
  const read = { owners: ownerSet, to_role, revoked_invitations: impact.revoked_invitations, revoked_invitation_ids: sweptIds };
  if (o?.dryRun) return { result: {}, scope, impact, confirmState: read };
  await requireConfirmedState(o, read, "cap.grant.transfer_owner");
  // 0.35.19 DoD (a): the token check above read the state before this batch, so the write re-checks it in its own WHERE (as
  // update_role does): the owner set, the recipient's direct role and the caller's DIRECT owner grant must still be what was
  // read. A changed state writes no row; the step-down and its orphan sweep ride on changes() = 1, so they write nothing either.
  // 0.35.20 DoD (a): the aggregate orders its own input (SQLite ≥ 3.44), so the string never rests on a subquery's order.
  const ownersNow = `COALESCE((SELECT group_concat(principal_id, ',' ORDER BY principal_id) FROM "grant" WHERE scope_type = ?3 AND scope_id = ?4 AND role = 'owner'), '')`;
  const toRoleNow = `COALESCE((SELECT role FROM "grant" WHERE principal_id = ?2 AND scope_type = ?3 AND scope_id = ?4), '')`;
  const stmts = [ctx.db.prepare(`INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) SELECT ?1, ?2, ?3, ?4, 'owner', ?5`
    + ` WHERE ${ownersNow} = ?6 AND ${toRoleNow} = ?7 AND ${callerHolds("?8", "?3", "?4", "'owner'", true)}`
    + (stepDown ? ` AND ${orphanedNow("?8", "?3", "?4", "?5", "'member'")} = ?9` : "")
    + ` ON CONFLICT(principal_id, scope_type, scope_id) DO UPDATE SET role = 'owner'`)
    .bind(...[newId("grant"), to, scope.type, scope.id, nowIso(ctx), ownerSet.join(","), to_role ?? "", ctx.principal.id, ...(stepDown ? [sweptIds.join(",")] : [])])];
  if (stepDown) stmts.push(ctx.db.prepare('UPDATE "grant" SET role = ? WHERE principal_id = ? AND scope_type = ? AND scope_id = ? AND changes() = 1').bind("member", ctx.principal.id, scope.type, scope.id), // an owner remains (to), so the last-owner rule holds
    revokeOrphaned(ctx, ctx.principal.id, scope, true));
  const res = await ctx.db.batch(stmts);
  if ((res[0].meta.changes ?? 0) !== 1) {
    // 0.35.20 (cookbook work/active/2026-10-18-3d-grant-noop-followups-5 DoD (c)): re-read the caller first: one who lost the
    // DIRECT owner grant in the window is refused for that (as the read-time check says), not asked for a new preview.
    await requireDirectOwner(ctx, scope);
    // 0.35.21 (cookbook work/active/2026-10-18-3d-grant-noop-followups-6 DoD (a)): a step-down whose swept invitation set moved
    // in the window names the invitations, as update_role's refusal does.
    if (stepDown && (await orphanedIds(ctx, ctx.principal.id, scope, "member")).join(",") !== sweptIds.join(","))
      throw new CapError("CONFIRM_REQUIRED", "the invitations this change would revoke changed since the dry_run preview", "Call dry_run again and confirm the new preview.", "cap.grant.transfer_owner");
    throw new CapError("CONFIRM_REQUIRED", "the target changed since the dry_run preview", "Call dry_run again and confirm the new preview.", "cap.grant.transfer_owner");
  }
  impact.revoked_invitations = stepDown ? res[2].meta.changes ?? 0 : 0;
  ctx.log("grant.transfer_owner", { step_down: stepDown, revoked_invitations: impact.revoked_invitations });
  return { result: { transferred: true, scope, new_owner: to, caller_role: stepDown ? "member" : "owner" }, scope, impact };
};

export const handlers: Record<string, Handler> = {
  "cap.grant.invite": invite, "cap.grant.revoke_invitation": revoke_invitation, "cap.grant.accept": accept, "cap.grant.list": list, "cap.me.invitations": mine,
  "cap.grant.update_role": update_role, "cap.grant.revoke": revoke, "cap.grant.transfer_owner": transfer_owner,
};
void countScalar; void atLeast; void scopeExists;
