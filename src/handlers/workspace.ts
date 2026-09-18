// cap.workspace.* — optional invite-only grouping of projects (03). No inheritance (D2).
import type { Handler, Role } from "./types";
import { CapError, notVisible } from "./errors";
import {
  atLeast, countScalar, loadProject, loadWorkspace, newId, nowIso, patchOf, reqStr, requireUser,
  type ProjectRow, type WorkspaceRow,
} from "./common";

function view(w: WorkspaceRow, role: Role) {
  return { id: w.id, name: w.name, archived_at: w.archived_at, created_at: w.created_at, role };
}

export const create: Handler = async (ctx, params) => {
  const actor = requireUser(ctx);
  const p = await ctx.db.prepare("SELECT provisioned FROM principal WHERE id = ?").bind(actor).first<{ provisioned: number }>();
  if (!p || !p.provisioned) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "workspace creation is provisioned", "D1: request one via cap.request.create");
  const id = newId("ws");
  const at = nowIso(ctx);
  const name = reqStr(params, "name");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?, ?, ?, ?)").bind(id, name, at, actor),
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId("grant"), actor, "workspace", id, "owner", at),
  ]);
  return { result: { workspace: { id, name, archived_at: null, created_at: at, role: "owner" } }, scope: { type: "workspace", id } };
};

export const list: Handler = async (ctx) => {
  const actor = requireUser(ctx);
  const { results } = await ctx.db
    .prepare('SELECT w.*, g.role AS role FROM workspace w JOIN "grant" g ON g.scope_type = ? AND g.scope_id = w.id WHERE g.principal_id = ? ORDER BY w.created_at')
    .bind("workspace", actor)
    .all<WorkspaceRow & { role: Role }>();
  return { result: { workspaces: results.map((w) => view(w, w.role)) } };
};

export const get: Handler = async (ctx, params) => {
  const id = reqStr(params, "id");
  const { row, role } = await loadWorkspace(ctx, id);
  // listing of grouped projects only (notes) — names, not contents
  const { results } = await ctx.db.prepare("SELECT id, name, organization, archived_at FROM project WHERE workspace_id = ? ORDER BY created_at").bind(id).all<Pick<ProjectRow, "id" | "name" | "organization" | "archived_at">>();
  return { result: { workspace: view(row, role), projects: results }, scope: { type: "workspace", id } };
};

export const update: Handler = async (ctx, params) => {
  const id = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id, "owner");
  const patch = patchOf(params, ["name"]);
  if (patch.name === null || patch.name === "") throw new CapError("INVALID_PARAMS", "name cannot be empty", "name");
  await ctx.db.prepare("UPDATE workspace SET name = ? WHERE id = ?").bind(patch.name, id).run();
  return { result: { workspace: { ...view(row, "owner"), name: patch.name } }, scope: { type: "workspace", id }, priorState: { name: row.name } };
};

export const archive: Handler = async (ctx, params) => {
  const id = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id, "owner");
  const at = nowIso(ctx);
  await ctx.db.prepare("UPDATE workspace SET archived_at = COALESCE(archived_at, ?) WHERE id = ?").bind(at, id).run();
  return { result: { workspace: { ...view(row, "owner"), archived_at: row.archived_at ?? at } }, scope: { type: "workspace", id }, priorState: { archived_at: row.archived_at } };
};

export const unarchive: Handler = async (ctx, params) => {
  const id = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id, "owner");
  await ctx.db.prepare("UPDATE workspace SET archived_at = NULL WHERE id = ?").bind(id).run();
  return { result: { workspace: { ...view(row, "owner"), archived_at: null } }, scope: { type: "workspace", id }, priorState: { archived_at: row.archived_at } };
};

/** danger (D5). Phase 0 keeps it simple and honest: only an empty workspace can be hard-deleted. */
export const del: Handler = async (ctx, params, opts) => {
  const id = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id, "owner");
  const projects = await countScalar(ctx, "SELECT COUNT(*) AS n FROM project WHERE workspace_id = ?", id);
  const assessments = await countScalar(ctx, "SELECT COUNT(*) AS n FROM assessment a JOIN project p ON p.id = a.project_id WHERE p.workspace_id = ?", id);
  const responses = await countScalar(ctx, "SELECT COUNT(*) AS n FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id JOIN assessment a ON a.id = s.assessment_id JOIN project p ON p.id = a.project_id WHERE p.workspace_id = ?", id);
  const grants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", id);
  const impact = {
    affected: [{ workspace: id, projects, assessments, responses, grants }],
    irreversible: true,
    effect: "destructive" as const,
    retention: "D5 held: phase 0 deletes only an empty workspace; remove projects first (they keep their own grants)",
  };
  if (opts?.dryRun) return { result: { workspace: view(row, "owner") }, scope: { type: "workspace", id }, impact };
  if (projects > 0) throw new CapError("INVALID_PARAMS", "workspace still groups projects", "has_projects");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("workspace", id),
    ctx.db.prepare("DELETE FROM invitation WHERE scope_type = ? AND scope_id = ?").bind("workspace", id),
    ctx.db.prepare("DELETE FROM workspace WHERE id = ?").bind(id),
  ]);
  return { result: { deleted: true, id }, scope: { type: "workspace", id }, impact, priorState: { workspace: row } };
};

/** Requires share authority over the project (D2): owner at workspace, or member+ at workspace with owner on the project. */
async function shareAuthority(ctx: Parameters<Handler>[0], wid: string, pid: string): Promise<{ w: WorkspaceRow; p: ProjectRow }> {
  const { row: w, role: wRole } = await loadWorkspace(ctx, wid, "member");
  const { row: p, role: pRole } = await loadProject(ctx, pid, "viewer");
  const ok = (wRole === "owner" && atLeast(pRole, "member")) || (wRole === "member" && pRole === "owner");
  if (!ok) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "share authority over the project is required", "D2");
  return { w, p };
}

export const add_project: Handler = async (ctx, params) => {
  const wid = reqStr(params, "id");
  const pid = reqStr(params, "pid");
  const { p } = await shareAuthority(ctx, wid, pid);
  if (p.workspace_id && p.workspace_id !== wid) throw new CapError("INVALID_PARAMS", "project already grouped in another workspace", "remove_project first");
  await ctx.db.prepare("UPDATE project SET workspace_id = ? WHERE id = ?").bind(wid, pid).run();
  const affectedGrants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", wid);
  return { result: { workspace_id: wid, project_id: pid, grouped: true, workspace_grantees_now_listing: affectedGrants }, scope: { type: "workspace", id: wid }, priorState: { workspace_id: p.workspace_id } };
};

export const remove_project: Handler = async (ctx, params) => {
  const wid = reqStr(params, "id");
  const pid = reqStr(params, "pid");
  const { p } = await shareAuthority(ctx, wid, pid);
  if (p.workspace_id !== wid) throw notVisible("project in workspace");
  await ctx.db.prepare("UPDATE project SET workspace_id = NULL WHERE id = ?").bind(pid).run();
  const affectedGrants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", wid);
  return { result: { workspace_id: wid, project_id: pid, grouped: false, workspace_grantees_no_longer_listing: affectedGrants }, scope: { type: "workspace", id: wid }, priorState: { workspace_id: wid } };
};

export const handlers: Record<string, Handler> = {
  "cap.workspace.create": create,
  "cap.workspace.list": list,
  "cap.workspace.get": get,
  "cap.workspace.update": update,
  "cap.workspace.archive": archive,
  "cap.workspace.unarchive": unarchive,
  "cap.workspace.delete": del,
  "cap.workspace.add_project": add_project,
  "cap.workspace.remove_project": remove_project,
};
