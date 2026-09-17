// cap.grant.* — invitations and grants at exactly one scope. D3: members invite ≤ member; owners are never removed or demoted;
// the last owner is protected; transfer is dangerous. No inheritance (D2). Existence never leaks. Lane B (Fable) — owner per #14 c5704577820.
import type { Ctx, Handler, Role, ScopeType } from "./types";
import { CapError, notVisible } from "./errors";
import { ROLE_RANK, atLeast, countScalar, gate, newId, nowIso, randomToken, reqRole, reqScope, reqStr, roleAt, sha256 } from "./common";

import { invitationMessage, publicOrigin, sendMail, type MailEnv, type MailResult } from "../mail";

type Scope = { type: "workspace" | "project" | "assessment"; id: string };
const INVITE_TTL_S = 7 * 24 * 3600;

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
async function scopeExists(ctx: Ctx, scope: Scope): Promise<boolean> {
  const t = scope.type === "workspace" ? "workspace" : scope.type === "project" ? "project" : "assessment";
  return !!(await ctx.db.prepare(`SELECT id FROM ${t} WHERE id = ?`).bind(scope.id).first());
}

/** E: invite → the invitation mail leaves the system (IRR-001) when a sender is configured in production (src/mail.ts, OF-3).
 *  `delivered` is the provider's acceptance, never assumed; when it is false `delivery.reason` says why. Dev returns the
 *  link token in-band so the flow can be exercised without any mailbox. */
export const invite: Handler = async (ctx, p, o) => {
  const scope = reqScope(p); const role = reqRole(p); const email = reqStr(p, "email").toLowerCase();
  const caller = await callerAt(ctx, scope, "member");
  ceiling(caller, role, "invite");
  const inviteeHash = await sha256(email);
  const impact = { affected: [{ scope, role, invitee: inviteeHash.slice(0, 12), will_see: `${scope.type} contents at role ${role}` }], irreversible: true, effect: "external" as const, compensating_control: "cap.grant.revoke_invitation (does not unsend)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  const id = newId("inv"); const token = randomToken("il");
  await ctx.db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, scope.type, scope.id, inviteeHash, await sha256(token), role, "sent", ctx.principal.id, nowIso(ctx), new Date(ctx.now().getTime() + INVITE_TTL_S * 1000).toISOString()).run();
  const env = ctx.env as MailEnv; const origin = publicOrigin(env);
  let delivery: MailResult = { delivered: false, reason: "not_configured" };
  if (origin) {
    const msg = invitationMessage(origin, token, role, scope.type, INVITE_TTL_S / 86400);
    delivery = await sendMail(env, { to: email, subject: msg.subject, text: msg.text, html: msg.html, idempotencyKey: `invite/${id}` });
  }
  ctx.log("grant.invite.mail", { delivered: delivery.delivered, reason: delivery.reason ?? null, provider_status: delivery.provider_status ?? null, invitee: inviteeHash.slice(0, 8) }); // never the address
  return { result: { invitation_id: id, role, status: "sent", accepted: true, delivered: delivery.delivered, delivery: { provider: delivery.provider ?? null, reason: delivery.reason ?? null }, ...(ctx.env.ENVIRONMENT === "dev" ? { dev_only_link_token: token } : {}) }, scope, impact };
};

export const revoke_invitation: Handler = async (ctx, p) => {
  const id = reqStr(p, "id");
  const inv = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status FROM invitation WHERE id = ?").bind(id).first<any>();
  if (!inv) throw notVisible("invitation");
  const scope: Scope = { type: inv.scope_type, id: inv.scope_id };
  const caller = await callerAt(ctx, scope, "member");
  ceiling(caller, inv.role as Role, "revoke invitations");
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "already accepted — revoke the grant instead", undefined, "cap.grant.revoke");
  await ctx.db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind(id).run();
  return { result: { id, status: "revoked" }, scope };
};

/** E: accepting releases the grant — disclosure of scope contents begins. */
export const accept: Handler = async (ctx, p, o) => {
  if (ctx.principal.kind !== "user") throw new CapError("NOT_AUTHENTICATED", "sign in to accept an invitation");
  const token = reqStr(p, "token");
  const inv = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status, expires_at, invitee_hash FROM invitation WHERE token_hash = ?").bind(await sha256(token)).first<any>();
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
  const inv = await ctx.db.prepare("SELECT id, role, status, created_at, expires_at FROM invitation WHERE scope_type = ? AND scope_id = ? AND status IN ('sent','pending') ORDER BY created_at").bind(scope.type, scope.id).all();
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
