import type { Ctx, Role, ScopeType } from "./handlers/types";
import { CapError, notVisible } from "./handlers/types";
import type { Capability } from "./registry";
import { effectiveRoleAt } from "./handlers/common";

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
  if ((id === "cap.report.build" || id === "cap.report.list") && params.aid) return { type: "assessment", id: params.aid };
  return null;
}

export async function roleAt(ctx: Ctx, scope: { type: ScopeType; id: string }): Promise<Role | null> {
  // One resolver: projects inherit their workspace's grant (cookbook work/active/2026-10-15-3d-workspace-permissions).
  return effectiveRoleAt(ctx, scope.type, scope.id);
}

const RANK: Record<Role, number> = { viewer: 1, member: 2, owner: 3 };

/** Minimum grant role a scoped matrix row needs. The one role table: authorize enforces it, docs projects it. */
export const requiredRole = (roles: string): Role =>
  roles.startsWith("O, M") || roles.startsWith("project O, M") ? "member" : roles === "O" ? "owner" : "viewer";
export const roleMeets = (have: Role, need: Role): boolean => RANK[have] >= RANK[need];

/** Authorize per the matrix's role string. Only inheritance: workspace → grouped project. Unauthorized == nonexistent. */
export async function authorize(ctx: Ctx, cap: Capability, params: Record<string, any>): Promise<void> {
  const p = ctx.principal;
  if (cap.public) return;
  const roles = cap.roles;
  if (roles === "V") return;
  if (p.kind === "anonymous") throw new CapError("NOT_AUTHENTICATED", "sign in first", "POST /v2/auth/link then /v2/auth/session; agents use a delegated bearer", "cap.auth.request_link");
  if (["cap.report.build", "cap.report.get", "cap.report.list"].includes(cap.id)) {
    if (p.kind !== "user" && p.kind !== "support") throw notVisible("report");
    return; // The store's single observation owns exact grant/role/existence; no second SELECT here.
  }
  if (p.kind === "support") return; // HUMAN-ONLY rows enforce their own step in the handler
  if (roles === "S") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "support only", "ask KCS support", cap.id);
  if (roles === "P" || roles.startsWith("P ")) {
    if (p.kind !== "participant") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "participant token required", "redeem a code or open an invitation link", "cap.participant.redeem_code");
    return;
  }
  // Dead-invitations (8): a participant session opening a mailed invitation link is not signed in as a person, which is
  // retryable (sign in with the invited address), not a refusal of the invitation. NOT_AUTHENTICATED keeps the link's token
  // in the UI (ui/v3/components/invite.js inviteFailure → 'signin'); the accept handler answers every non-user the same way.
  if (p.kind === "participant" && roles === "invitee") throw new CapError("NOT_AUTHENTICATED", "sign in with the invited address to accept an invitation", "a participant session cannot accept a collaborator invitation", cap.id);
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
  const need = requiredRole(roles);
  if (!roleMeets(role, need)) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `requires ${need} at ${scope.type}`, need === "owner" ? "ask an owner (D3)" : "ask an owner or member", cap.id);
}
