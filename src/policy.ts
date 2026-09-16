import type { Ctx, Role, ScopeType } from "./handlers/types";
import { CapError, notVisible } from "./handlers/types";
import type { Capability } from "./registry";

/** Where a capability's target scope comes from in params. */
export function targetScope(cap: Capability, params: Record<string, any>): { type: ScopeType; id: string } | null {
  const id = cap.id;
  if (params.scope && params.id && /^cap\.grant\./.test(id)) return { type: params.scope, id: params.id };
  if (id.startsWith("cap.workspace.") && params.id) return { type: "workspace", id: params.id };
  if (id.startsWith("cap.project.") && params.id) return { type: "project", id: params.id };
  if (id.startsWith("cap.assessment.") && params.id) return { type: "assessment", id: params.id };
  if (id === "cap.assessment.create" || id === "cap.assessment.list") return params.pid ? { type: "project", id: params.pid } : null;
  if (id.startsWith("cap.survey.") || id.startsWith("cap.response.list") || id === "cap.response.purge" || id === "cap.results.summary")
    return params.aid ? { type: "assessment", id: params.aid } : null;
  return null;
}

export async function roleAt(ctx: Ctx, scope: { type: ScopeType; id: string }): Promise<Role | null> {
  const r = await ctx.db.prepare("SELECT role FROM grant_ WHERE principal_id = ? AND scope_type = ? AND scope_id = ?")
    .bind(ctx.principal.id, scope.type, scope.id).first<{ role: Role }>();
  return r?.role ?? null;
}

const RANK: Record<Role, number> = { viewer: 1, member: 2, owner: 3 };

/** Authorize per the matrix's role string. No inheritance. Unauthorized == nonexistent. */
export async function authorize(ctx: Ctx, cap: Capability, params: Record<string, any>): Promise<void> {
  const p = ctx.principal;
  if (cap.public) return;
  const roles = cap.roles;
  if (roles === "V") return;
  if (p.kind === "anonymous") throw new CapError("NOT_AUTHENTICATED", "sign in first", "POST /v2/auth/link then /v2/auth/session; agents use a delegated bearer", "cap.auth.request_link");
  if (p.kind === "support") return; // HUMAN-ONLY rows enforce their own step in the handler
  if (roles === "S") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "support only", "ask KCS support", cap.id);
  if (roles === "P" || roles.startsWith("P ")) {
    if (p.kind !== "participant") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "participant token required", "redeem a code or open an invitation link", "cap.participant.redeem_code");
    return;
  }
  if (p.kind === "participant") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "participants cannot call this", undefined, cap.id);
  if (roles.startsWith("provisioned creator")) {
    if (!p.provisioned) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "not provisioned to create", "request one: cap.request.create", "cap.request.create");
    return;
  }
  if (["any", "any signed-in", "actor", "invitee", "actor of that trace, S"].includes(roles)) return;
  const scope = targetScope(cap, params);
  if (!scope) return; // list-style rows filter by grant inside the handler
  const role = await roleAt(ctx, scope);
  if (!role) throw notVisible();
  const need: Role = roles.startsWith("O, M") || roles.startsWith("project O, M") ? "member" : roles === "O" ? "owner" : "viewer";
  if (RANK[role] < RANK[need]) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `requires ${need} at ${scope.type}`, need === "owner" ? "ask an owner (D3)" : "ask an owner or member", cap.id);
}
