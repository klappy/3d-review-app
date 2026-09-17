/** docs — the NLX front door. Role-aware, never role-leaking. Projected from contract/capabilities.json (edit the cookbook matrix, not this). */
import type { Ctx, Handler, Role, ScopeType } from "./types";
import { CapError } from "./types";
import { capabilities, byId, contractName, sourceSha, type Capability } from "../registry";
import { roleAt } from "../policy";

const CEILING = "klappy://canon/constraints/mcp-tool-surface-ceiling";
const TOPICS: Record<string, string> = {
  glossary: "Workspace (optional grouping) › Project › Language › Assessment. An assessment owns the stage Prepare → Collect → Understand → Improve. Survey templates are platform-managed and versioned; an assessment survey is a template@version selected into an assessment. Participants answer by link or short access code and are pseudonymous. Perspective labels follow the instrument: Translator, community, church; four mid-level roles + Other.",
  permissions: "Grants are (principal, scope, role) with role owner/member/viewer at workspace, project or assessment. No inheritance: a workspace grant lists projects, it does not open them. Members invite ≤ member; owners cannot be removed or demoted; the last owner is protected; transfer is dangerous. Participants are never collaborators. Unauthorized and nonexistent look identical (NOT_FOUND_OR_NOT_VISIBLE).",
  reversibility: "read: no side effect. write.reversible: receipt + undo_token only when a true inverse is declared (archive↔unarchive, rename restores prior). write.effect: sends/grants/releases — dry_run → confirm_token → execute; compensating control (revoke) not undo. write.dangerous: destructive — same two-step; inverse none. Submitting a response is append-only: no undo.",
  telemetry: "Every response carries trace_id. read cap.ops.trace {trace_id} returns your own span log (auth, policy, db timing) scoped and redacted; support sees all. A substituted trace id is NOT_FOUND_OR_NOT_VISIBLE. Telemetry never carries answers, codes or addresses.",
  privacy: "Small-cell suppression is always on for results.summary, response.list and every viewer route. Suppressed is a success: ok:true with suppressed:true — say 'results are hidden because too few people answered', never a number that reconstructs the cell. Threshold value is held (D7). Codes are never returned by issue_codes; export_codes is a confirmed disclosure.",
  stages: "prepare (set up, pick surveys) → collect (codes/links live, responses arrive) → understand (summary, suppression applies) → improve (notes: reflection, next steps). Moves are one step in either direction via cap.assessment.set_stage; browsing never advances a stage.",
};
const INTENTS = ["what", "how", "example", "take survey", "manage", "view results"];

function page(c: Capability) {
  return {
    capability: c.id, class: c.class, tool: c.tool, http: `${c.http.method} ${c.http.path}`, roles: c.roles, slice: c.slice,
    status: c.status, section: c.section, ui_surface: c.ui_surface, rules: c.notes, inverse: c.inverse,
    how_an_agent_calls_it: c.tool === "danger" ? "danger {capability, params, mode:'dry_run'} → impact + confirm_token → danger {…, mode:'execute', confirm_token}" : `${c.tool} {capability, params}`,
    errors: ["NOT_AUTHENTICATED", "NOT_AUTHORIZED_AT_SCOPE", "WRONG_TOOL_FOR_CLASS", "INVALID_PARAMS", "NOT_FOUND_OR_NOT_VISIBLE", ...(c.tool === "danger" ? ["CONFIRM_REQUIRED", "CONFIRM_EXPIRED"] : []), ...(c.slice === "v2.1-oct" ? ["RESERVED_NOT_BUILT"] : []), "RATE_LIMITED"], // every row: anonymous callers are metered per address on both faces (RL_HTTP_ANON / RL_MCP_ANON), four rows additionally by capability
    examples: { http: `${c.http.method} ${c.http.path}`, mcp: { tool: c.tool, arguments: { capability: c.id, params: {}, ...(c.tool === "danger" ? { mode: "dry_run" } : {}) } } },
    projected_from: `${contractName} @ cookbook ${sourceSha}`,
  };
}
const index = () => {
  const g: Record<string, string[]> = {};
  for (const c of capabilities) (g[c.section] ??= []).push(c.id + (c.slice === "v2.1-oct" ? " (v2.1-oct, not built)" : ""));
  return g;
};
const allowedFor = (role: Role | "anonymous" | "participant" | "support") =>
  capabilities.filter((c) => {
    if (role === "support") return true;
    if (role === "anonymous") return c.public;
    if (role === "participant") return c.roles.startsWith("P") || c.public;
    if (role === "viewer") return c.class === "read" && !/^(O|S|P)/.test(c.roles) || c.public;
    if (role === "member") return !/^(O$|S)/.test(c.roles) && !c.roles.startsWith("P") && c.roles !== "provisioned creator (D1)";
    return !/^S$/.test(c.roles) && !c.roles.startsWith("P");
  }).map((c) => c.id);

export const docs: Handler = async (ctx, a) => {
  if (a.capability) {
    const c = byId.get(a.capability);
    if (!c) return { result: { message: `unknown capability ${a.capability}`, index: index() } };
    const p = page(c);
    if (ctx.principal.kind === "user" && /^(O$|S)/.test(c.roles)) {
      // never leak: describe availability in plain words, not a 403
      return { result: { ...p, availability: c.roles === "S" ? "not available to collaborators; KCS support only" : "owners only — ask an owner" } };
    }
    return { result: p };
  }
  if (a.topic) {
    const t = TOPICS[a.topic];
    return { result: t ? { topic: a.topic, text: t } : { message: `unknown topic ${a.topic}`, topics: Object.keys(TOPICS) } };
  }
  if (a.q) {
    const q = String(a.q).toLowerCase();
    return { result: { q, hits: capabilities.filter((c) => (c.id + " " + c.notes + " " + c.ui_surface).toLowerCase().includes(q)).map((c) => ({ id: c.id, class: c.class, section: c.section })) } };
  }
  if (a.role || a.scope) {
    let role: any = a.role ?? ctx.principal.kind;
    if (a.scope?.type && a.scope?.id && ctx.principal.kind === "user") {
      const r = await roleAt(ctx, a.scope as { type: ScopeType; id: string });
      if (!r) throw new CapError("NOT_FOUND_OR_NOT_VISIBLE", "not found or not visible");
      role = r;
    } else if (ctx.principal.kind === "user" && !a.role) role = "member";
    return { result: { role, scope: a.scope ?? null, can: allowedFor(role), next_best: { prepare: "cap.survey.select", collect: "cap.survey.issue_codes", understand: "cap.results.summary", improve: "cap.assessment.notes.update" } } };
  }
  const roles = ctx.principal.kind === "user" ? (await ctx.db.prepare("SELECT scope_type, scope_id, role FROM grant WHERE principal_id = ?").bind(ctx.principal.id).all()).results : [];
  return { result: {
    what: "3D Review helps Bible translation projects assess their own health from three perspectives — the translation team, the community, and the church — and turn the findings into next steps. Create or choose a project. Review the survey results. Use the findings to identify improvements. Repeat when it helps your project reflect on progress.",
    tools: { docs: "explain", read: "class=read", write: "class=write.reversible (+ undo)", danger: "write.effect and write.dangerous, two-step" },
    tool_surface: { count: 4, governed_by: CEILING, reason: "read/write/danger split is the host-level permission boundary; telemetry rides read cap.ops.trace and trace_id on every envelope" },
    auth: "Collaborators sign in by Cloudflare email code → web session. Agents and connectors use OAuth 2.1 on /mcp (discovery at /.well-known/oauth-authorization-server, dynamic client registration, PKCE): the user signs in by email code, approves the named app, and the app acts as that user — auth.me shows delegated_by = oauth:<client_id>; write cap.auth.logout disconnects it. /mcp without a credential answers 401 + WWW-Authenticate. Participants: access code or invitation link → participant token bound to one survey. Agents act as a user, never as a role.",
    intents: INTENTS, index: index(), your_roles: roles, contract: `${contractName} @ ${sourceSha}`,
  } };
};
