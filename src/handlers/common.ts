// Shared helpers for data handlers: ids, hashing, params, visibility/role checks.
// Roles come from `grant` rows at the exact scope (D2: no inheritance). The one
// grouping-listing exception (03 matrix): a project grant lets its holder see the
// project's assessments; a workspace grant lists grouped projects (names only).
import type { Ctx, Role, ScopeType } from "./types";
import { CapError, notVisible } from "./errors";

// ---------------------------------------------------------------- constants
/** Small-cell suppression threshold. D7 held — value is a working default, not policy. */
export const SUPPRESSION_THRESHOLD = 5;
export const SUPPRESSION_POLICY = "D7 held";
export const STAGES = ["prepare", "collect", "understand", "improve"] as const;
export type Stage = (typeof STAGES)[number];
export const ROLE_RANK: Record<Role, number> = { viewer: 1, member: 2, owner: 3 };
export const ROLES: readonly Role[] = ["owner", "member", "viewer"];

// ---------------------------------------------------------------- ids / time / hash
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
export function nowIso(ctx: Ctx): string {
  return ctx.now().toISOString();
}
export function plusSeconds(ctx: Ctx, s: number): string {
  return new Date(ctx.now().getTime() + s * 1000).toISOString();
}
export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}_${b64}`;
}
/** Short human-typeable access code: 8 chars from an unambiguous alphabet. */
export function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

// ---------------------------------------------------------------- params
type P = Record<string, unknown>;
export function reqStr(p: P, key: string): string {
  const v = p[key];
  if (typeof v !== "string" || v.length === 0) throw new CapError("INVALID_PARAMS", `${key} is required`, `missing:${key}`);
  return v;
}
export function optStr(p: P, key: string): string | undefined {
  const v = p[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new CapError("INVALID_PARAMS", `${key} must be a string`, `type:${key}`);
  return v;
}
export function optInt(p: P, key: string, def: number, min = 1, max = 1000): number {
  const v = p[key];
  if (v === undefined || v === null) return def;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new CapError("INVALID_PARAMS", `${key} must be an integer in [${min},${max}]`, `range:${key}`);
  return n;
}
export function reqRole(p: P, key = "role"): Role {
  const v = reqStr(p, key);
  if (!ROLES.includes(v as Role)) throw new CapError("INVALID_PARAMS", `${key} must be one of ${ROLES.join("|")}`, `enum:${key}`);
  return v as Role;
}
export function reqScope(p: P): { type: "workspace" | "project" | "assessment"; id: string } {
  const t = reqStr(p, "scope");
  if (t !== "workspace" && t !== "project" && t !== "assessment") throw new CapError("INVALID_PARAMS", "scope must be workspace|project|assessment", "enum:scope");
  return { type: t, id: reqStr(p, "id") };
}
/** Pick a subset of params as an update patch; unknown keys are rejected. */
export function patchOf(p: P, allowed: readonly string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "id" || k === "pid" || k === "aid" || k === "sid") continue;
    if (!allowed.includes(k)) throw new CapError("INVALID_PARAMS", `unknown field ${k}`, `allowed:${allowed.join(",")}`);
    if (v !== null && typeof v !== "string") throw new CapError("INVALID_PARAMS", `${k} must be a string or null`, `type:${k}`);
    out[k] = v as string | null;
  }
  if (Object.keys(out).length === 0) throw new CapError("INVALID_PARAMS", "no fields to update", `allowed:${allowed.join(",")}`);
  return out;
}

// ---------------------------------------------------------------- principal / roles
export function requireUser(ctx: Ctx): string {
  const p = ctx.principal;
  if (p.kind !== "user" && p.kind !== "support") throw new CapError("NOT_AUTHENTICATED", "sign in required");
  return p.id;
}
export function requireSupport(ctx: Ctx): string {
  if (ctx.principal.kind !== "support") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "support capability required", "D8");
  return ctx.principal.id;
}
export interface GrantRow { id: string; principal_id: string; scope_type: string; scope_id: string; role: Role; created_at: string }

/** Direct role at exactly this scope, or null. */
export async function roleAt(ctx: Ctx, scopeType: ScopeType, scopeId: string): Promise<Role | null> {
  if (ctx.principal.kind !== "user" && ctx.principal.kind !== "support") return null;
  const row = await ctx.db
    .prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?')
    .bind(ctx.principal.id, scopeType, scopeId)
    .first<{ role: Role }>();
  return row?.role ?? null;
}
export function maxRole(a: Role | null, b: Role | null): Role | null {
  if (!a) return b;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}
export function atLeast(role: Role | null, min: Role): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK[min];
}
/** Throw NOT_FOUND_OR_NOT_VISIBLE when no role; NOT_AUTHORIZED_AT_SCOPE when role < min. */
export function gate(role: Role | null, min: Role, what: string, hint?: string): Role {
  if (!role) throw notVisible(what);
  if (!atLeast(role, min)) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `${min} role required at this ${what}`, hint);
  return role;
}

// ---------------------------------------------------------------- row loaders (visibility-checked)
export interface WorkspaceRow { id: string; name: string; archived_at: string | null; created_at: string; created_by: string | null }
export interface ProjectRow { id: string; workspace_id: string | null; name: string; organization: string | null; archived_at: string | null; created_at: string; created_by: string | null }
export interface LanguageRow { id: string; project_id: string; code: string | null; name: string }
export interface AssessmentRow {
  id: string; project_id: string; language_id: string; name: string; purpose: string | null; period: string | null; format: string | null;
  stage: Stage; notes_reflection: string | null; notes_next_steps: string | null; archived_at: string | null; created_at: string;
}
export interface TemplateRow { id: string; name: string; version: number; perspective: string; source_ref: string | null; items_json: string; scoring_json: string; published_at: string | null }
export interface SurveyRow { id: string; assessment_id: string; template_id: string; template_version: number; state: "selected" | "archived"; collection_status: "open" | "closed"; archived_at: string | null; created_at: string }

export async function loadWorkspace(ctx: Ctx, id: string, min: Role = "viewer"): Promise<{ row: WorkspaceRow; role: Role }> {
  const row = await ctx.db.prepare("SELECT * FROM workspace WHERE id = ?").bind(id).first<WorkspaceRow>();
  const role = row ? await roleAt(ctx, "workspace", id) : null;
  if (!row) throw notVisible("workspace");
  return { row, role: gate(role, min, "workspace") };
}
export async function loadProject(ctx: Ctx, id: string, min: Role = "viewer"): Promise<{ row: ProjectRow; role: Role }> {
  const row = await ctx.db.prepare("SELECT * FROM project WHERE id = ?").bind(id).first<ProjectRow>();
  const role = row ? await roleAt(ctx, "project", id) : null;
  if (!row) throw notVisible("project");
  return { row, role: gate(role, min, "project") };
}
/** Role at an assessment = direct grant, or the project grant (project members see assessments; 03 matrix). */
/** D2/D9 (settled): NO inheritance — only an explicit assessment grant opens an assessment. A project grant lists, it does not open (Astra #14 c5704047932). */
export async function assessmentRole(ctx: Ctx, a: { id: string; project_id: string }): Promise<Role | null> {
  return roleAt(ctx, "assessment", a.id);
}
export async function loadAssessment(ctx: Ctx, id: string, min: Role = "viewer"): Promise<{ row: AssessmentRow; role: Role }> {
  const row = await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id).first<AssessmentRow>();
  const role = row ? await assessmentRole(ctx, row) : null;
  if (!row) throw notVisible("assessment");
  return { row, role: gate(role, min, "assessment") };
}
export async function loadSurvey(ctx: Ctx, sid: string, aid: string | undefined, min: Role = "viewer"): Promise<{ row: SurveyRow; assessment: AssessmentRow; role: Role }> {
  const row = await ctx.db.prepare("SELECT * FROM assessment_survey WHERE id = ?").bind(sid).first<SurveyRow>();
  if (!row || (aid && row.assessment_id !== aid)) throw notVisible("survey");
  const { row: assessment, role } = await loadAssessment(ctx, row.assessment_id, min);
  return { row, assessment, role };
}
export async function loadTemplate(ctx: Ctx, id: string, version?: number): Promise<TemplateRow> {
  const row = version === undefined
    ? await ctx.db.prepare("SELECT * FROM survey_template WHERE id = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1").bind(id).first<TemplateRow>()
    : await ctx.db.prepare("SELECT * FROM survey_template WHERE id = ? AND version = ?").bind(id, version).first<TemplateRow>();
  if (!row) throw notVisible("template");
  return row;
}

// ---------------------------------------------------------------- instrument shape
export interface TemplateItem {
  id: string;
  group: string;                       // sub-dimension (steve: rubric_item.sub_dimension)
  text: string;
  type: "scale" | "multi" | "single" | "text";
  required?: boolean;                    // absent on legacy v1 means required
  source_type?: string;                   // pinned CSV type, not a score
  scale?: { min: number; max: number };
  options?: { code: string; text: string; weight?: number }[];
  max_select?: number;
  standalone_indicator?: boolean;      // e.g. ML-Q10: never pooled into group means (FIX-03)
}
export function parseItems(t: TemplateRow): TemplateItem[] {
  try { return JSON.parse(t.items_json) as TemplateItem[]; } catch { return []; }
}
/** Render-ready projection: stable ids, options, labels; no scoring internals. */
export function renderItems(items: TemplateItem[], lang: string): Record<string, unknown>[] {
  return items.map((it) => ({
    id: it.id,
    group: it.group,
    type: it.type,
    required: it.required !== false,
    ...(it.source_type ? { source_type: it.source_type } : {}),
    text: it.text,
    lang,
    ...(it.scale ? { scale: it.scale } : {}),
    ...(it.options ? { options: it.options.map((o) => ({ code: o.code, text: o.text })) } : {}),
    ...(it.max_select ? { max_select: it.max_select } : {}),
    ...(it.standalone_indicator ? { standalone_indicator: true } : {}),
  }));
}
/** Participant role labels per 14 FIX-09 — describe respondents, never grants. */
export function participantLabels(templateId: string): string[] {
  if (templateId === "tpl_validation") return ["Translator"];
  if (templateId === "tpl_mid_level") return ["Facilitator", "Team Leader", "Consultant-in-Training", "Translation Advisor", "Other"];
  return [];
}

// ---------------------------------------------------------------- counts
export async function countScalar(ctx: Ctx, sql: string, ...binds: unknown[]): Promise<number> {
  const row = await ctx.db.prepare(sql).bind(...binds).first<{ n: number }>();
  return Number(row?.n ?? 0);
}
export async function responseCountForAssessment(ctx: Ctx, aid: string): Promise<{ responses: number; respondents: number }> {
  const row = await ctx.db
    .prepare("SELECT COUNT(*) AS responses, COUNT(DISTINCT r.respondent_id) AS respondents FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id WHERE s.assessment_id = ?")
    .bind(aid)
    .first<{ responses: number; respondents: number }>();
  return { responses: Number(row?.responses ?? 0), respondents: Number(row?.respondents ?? 0) };
}

/** Audit row for credential-bearing / delegated effects (D8, CON-PRIV-005). Platform also mints its own receipt. */
export async function auditRow(ctx: Ctx, capability: string, scope: { type: ScopeType; id: string }, detail: Record<string, unknown>): Promise<string> {
  const id = newId("audit");
  await ctx.db
    .prepare("INSERT INTO receipt (id, actor, capability, scope_type, scope_id, class, inverse, trace_id, prior_state_json, at) VALUES (?, ?, ?, ?, ?, 'audit', 'none', ?, ?, ?)")
    .bind(id, ctx.principal.id, capability, scope.type, scope.id, ctx.traceId, JSON.stringify(detail), nowIso(ctx))
    .run();
  return id;
}
