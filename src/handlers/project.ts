// Project grants are exact-scope; no workspace or assessment grant is inherited.
import type { Handler, Role } from "./types";
import { CapError } from "./errors";
import { countScalar, loadProject, newId, nowIso, patchOf, reqStr, requireUser, type ProjectRow } from "./common";

const view = (p: ProjectRow, role: Role) => ({ id: p.id, workspace_id: p.workspace_id, name: p.name, organization: p.organization, archived_at: p.archived_at, created_at: p.created_at, role });

export const create: Handler = async (ctx, params) => {
  const actor = requireUser(ctx);
  const provisioned = await ctx.db.prepare("SELECT provisioned FROM principal WHERE id = ?").bind(actor).first<{provisioned:number}>();
  if (!provisioned?.provisioned) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "project creation is provisioned", "D1");
  const name = reqStr(params, "name");
  const organization = params.organization === undefined ? null : reqStr(params, "organization");
  const id = newId("proj"), at = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO project (id, name, organization, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(id, name, organization, at, actor),
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId("grant"), actor, "project", id, "owner", at),
  ]);
  return { result: { project: { id, workspace_id: null, name, organization, archived_at: null, created_at: at, role: "owner" } }, scope: { type: "project", id } };
};
export const list: Handler = async (ctx) => {
  const actor = requireUser(ctx);
// L1-23 (captain 14:52): read-only child counts for cards, one correlated aggregate per row — no N+1.
  const { results } = await ctx.db.prepare('SELECT p.*, g.role, (SELECT COUNT(*) FROM assessment a2 WHERE a2.project_id = p.id AND EXISTS (SELECT 1 FROM "grant" gassessment WHERE gassessment.scope_type = \'assessment\' AND gassessment.scope_id = a2.id AND gassessment.principal_id = ?)) AS assessment_count, (SELECT COUNT(*) FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id JOIN assessment a2 ON a2.id = s.assessment_id WHERE a2.project_id = p.id AND EXISTS (SELECT 1 FROM "grant" gassessment WHERE gassessment.scope_type = \'assessment\' AND gassessment.scope_id = a2.id AND gassessment.principal_id = ?)) AS response_count FROM project p JOIN "grant" g ON g.scope_type = ? AND g.scope_id = p.id WHERE g.principal_id = ? ORDER BY p.created_at').bind(actor, actor, "project", actor).all<ProjectRow & {role:Role; assessment_count:number; response_count:number}>();
  return { result: { projects: results.map(p => ({ ...view(p, p.role), assessment_count: Number(p.assessment_count) || 0, response_count: Number(p.response_count) || 0 })) } };
};
export const get: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), { row, role } = await loadProject(ctx, id);
  const { results } = await ctx.db.prepare("SELECT id, code, name FROM language WHERE project_id = ? ORDER BY name").bind(id).all<{id:string;code:string|null;name:string}>();
  return { result: { project: view(row, role), languages: results }, scope: { type: "project", id } };
};
export const update: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row} = await loadProject(ctx, id, "owner");
  const patch = patchOf(params, ["name", "organization"]);
  const name = patch.name === undefined ? row.name : patch.name;
  if (!name) throw new CapError("INVALID_PARAMS", "name cannot be empty");
  const organization = patch.organization === undefined ? row.organization : patch.organization;
  await ctx.db.prepare("UPDATE project SET name = ?, organization = ? WHERE id = ?").bind(name, organization, id).run();
  return { result: { project: { ...view(row, "owner"), name, organization } }, scope: { type: "project", id }, priorState: { name: row.name, organization: row.organization } };
};
export const archive: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row} = await loadProject(ctx, id, "owner");
  const at = row.archived_at ?? nowIso(ctx);
  await ctx.db.prepare("UPDATE project SET archived_at = ? WHERE id = ?").bind(at, id).run();
  return { result: { project: { ...view(row, "owner"), archived_at: at } }, scope: { type: "project", id }, priorState: { archived_at: row.archived_at } };
};
export const unarchive: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row} = await loadProject(ctx, id, "owner");
  await ctx.db.prepare("UPDATE project SET archived_at = NULL WHERE id = ?").bind(id).run();
  return { result: { project: { ...view(row, "owner"), archived_at: null } }, scope: { type: "project", id }, priorState: { archived_at: row.archived_at } };
};
export const del: Handler = async (ctx, params, opts) => {
  const id = reqStr(params, "id"), {row} = await loadProject(ctx, id, "owner");
  const assessments = await countScalar(ctx, "SELECT COUNT(*) AS n FROM assessment WHERE project_id = ?", id);
  const languages = await countScalar(ctx, "SELECT COUNT(*) AS n FROM language WHERE project_id = ?", id);
  const impact = { affected: [{ project: id, assessments, languages }], irreversible: true, effect: "destructive" as const, retention: "D5 held: only empty projects can be hard-deleted" };
  if (opts?.dryRun) return { result: { project: view(row, "owner") }, scope: { type: "project", id }, impact };
  if (assessments || languages) throw new CapError("INVALID_PARAMS", "project is not empty", "remove dependent data first");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("project", id),
    ctx.db.prepare("DELETE FROM invitation WHERE scope_type = ? AND scope_id = ?").bind("project", id),
    ctx.db.prepare("DELETE FROM project WHERE id = ?").bind(id),
  ]);
  return { result: { deleted: true, id }, scope: { type: "project", id }, impact, priorState: { project: row } };
};
export const handlers: Record<string, Handler> = {
  "cap.project.create": create, "cap.project.list": list, "cap.project.get": get,
  "cap.project.update": update, "cap.project.archive": archive,
  "cap.project.unarchive": unarchive, "cap.project.delete": del,
};
