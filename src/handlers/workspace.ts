// cap.workspace.* — optional invite-only grouping of projects (03). A workspace grant inherits to every grouped project
// (cookbook work/active/2026-10-15-3d-workspace-permissions); workspace roles also reach contained assessments.
import type { Handler, Role } from "./types";
import { requireConfirmedState } from "../receipt";
import { CapError, notVisible } from "./errors";
import {
  assessmentShareAuthority, grantApplies, countScalar, loadProject, loadWorkspace, newId, nowIso, patchOf, reqStr, requireUser, isDirectOwner,
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
  if (ctx.principal.kind === "support") {
    const { results } = await ctx.db.prepare(`SELECT w.*, COALESCE((SELECT g.role FROM "grant" g WHERE g.principal_id=? AND g.scope_type='workspace' AND g.scope_id=w.id),'viewer') AS role,
      (SELECT COUNT(*) FROM project p WHERE p.workspace_id=w.id) AS project_count,
      (SELECT COUNT(*) FROM assessment a JOIN project p ON p.id=a.project_id WHERE p.workspace_id=w.id) AS assessment_count,
      (SELECT COUNT(*) FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id JOIN assessment a ON a.id=s.assessment_id JOIN project p ON p.id=a.project_id WHERE p.workspace_id=w.id) AS response_count
      FROM workspace w ORDER BY w.created_at`).bind(actor).all<WorkspaceRow & {role:Role;project_count:number;assessment_count:number;response_count:number}>();
    return { result: { workspaces: results.map(w => ({...view(w,w.role), project_count:Number(w.project_count)||0, assessment_count:Number(w.assessment_count)||0, response_count:Number(w.response_count)||0})) } };
  }
  const { results } = await ctx.db
// L1-23 (captain 14:52): read-only child counts for cards, one correlated aggregate per row — no N+1.
// project_count = every grouped project (each one is reachable through the workspace grant).
    .prepare(`SELECT w.*, g.role AS role, (SELECT COUNT(*) FROM project p2 WHERE p2.workspace_id = w.id) AS project_count, (SELECT COUNT(*) FROM assessment a2 JOIN project p2 ON p2.id = a2.project_id WHERE p2.workspace_id = w.id AND EXISTS (SELECT 1 FROM "grant" gassessment WHERE ${grantApplies("gassessment", "'assessment'", "a2.id")} AND gassessment.principal_id = ?)) AS assessment_count, (SELECT COUNT(*) FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id JOIN assessment a2 ON a2.id = s.assessment_id JOIN project p2 ON p2.id = a2.project_id WHERE p2.workspace_id = w.id AND EXISTS (SELECT 1 FROM "grant" gassessment WHERE ${grantApplies("gassessment", "'assessment'", "a2.id")} AND gassessment.principal_id = ?)) AS response_count FROM workspace w JOIN "grant" g ON g.scope_type = ? AND g.scope_id = w.id WHERE g.principal_id = ? ORDER BY w.created_at`)
    .bind(actor, actor, "workspace", actor)
    .all<WorkspaceRow & { role: Role; project_count: number; assessment_count: number; response_count: number }>();
  return { result: { workspaces: results.map((w) => ({ ...view(w, w.role), project_count: Number(w.project_count) || 0, assessment_count: Number(w.assessment_count) || 0, response_count: Number(w.response_count) || 0 })) } };
};

export const get: Handler = async (ctx, params) => {
  const id = reqStr(params, "id");
  const { row, role } = await loadWorkspace(ctx, id);
  // listing of grouped projects only (notes) — names, not contents
  const global = ctx.principal.kind === "support";
  const { results } = await ctx.db.prepare(`SELECT p.id, p.name, p.organization, p.archived_at, (SELECT COUNT(*) FROM assessment a2 WHERE a2.project_id = p.id AND (? = 1 OR EXISTS (SELECT 1 FROM "grant" gassessment WHERE ${grantApplies("gassessment", "'assessment'", "a2.id")} AND gassessment.principal_id = ?))) AS assessment_count, (SELECT COUNT(*) FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id JOIN assessment a2 ON a2.id = s.assessment_id WHERE a2.project_id = p.id AND (? = 1 OR EXISTS (SELECT 1 FROM "grant" gassessment WHERE ${grantApplies("gassessment", "'assessment'", "a2.id")} AND gassessment.principal_id = ?))) AS response_count FROM project p WHERE p.workspace_id = ? ORDER BY p.created_at`).bind(global ? 1 : 0, ctx.principal.id, global ? 1 : 0, ctx.principal.id, id).all<Pick<ProjectRow, "id" | "name" | "organization" | "archived_at"> & { assessment_count: number; response_count: number }>();
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
  // 0.35.18 (cookbook work/active/2026-10-18-3d-grant-noop-followups-3 DoD (a)): the counts the preview shows are bound into the token.
  if (opts?.dryRun) return { result: { workspace: view(row, "owner") }, scope: { type: "workspace", id }, impact, confirmState: impact.affected[0] };
  await requireConfirmedState(opts, impact.affected[0], "cap.workspace.delete");
  if (projects > 0) throw new CapError("INVALID_PARAMS", "workspace still groups projects", "has_projects");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("workspace", id),
    ctx.db.prepare("DELETE FROM invitation WHERE scope_type = ? AND scope_id = ?").bind("workspace", id),
    ctx.db.prepare("DELETE FROM workspace WHERE id = ?").bind(id),
  ]);
  return { result: { deleted: true, id }, scope: { type: "workspace", id }, impact, priorState: { workspace: row } };
};

/**
 * Share authority over a project (D2). Grouping hands the project's roles to every workspace grantee, so the
 * project-side condition reads the DIRECT project grant only — an inherited role can never satisfy it
 * (HOLD #483 c6204382554: member → self-service workspace owner → add_project → inherited project owner).
 * Grouping also shares contained assessments. Project ownership does not imply assessment share authority:
 * the actor must directly own EVERY contained assessment, including archived assessments. Recheck the same
 * predicate inside the containment UPDATE so a concurrent revocation/new assessment cannot widen access.
 * - add: workspace member+ AND direct project owner AND direct owner of every contained assessment.
 * - remove: workspace owner (ungrouping only narrows access), or workspace member+ with direct project owner.
 */
async function shareAuthority(ctx: Parameters<Handler>[0], wid: string, pid: string, op: "add" | "remove"): Promise<{ w: WorkspaceRow; p: ProjectRow }> {
  const { row: w, role: wRole } = await loadWorkspace(ctx, wid, "member");
  const { row: p } = await loadProject(ctx, pid, "viewer");
  const directOwner = await isDirectOwner(ctx, "project", pid);
  const ok = op === "add" ? directOwner : wRole === "owner" || directOwner;
  if (!ok) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "a direct owner grant on the project is required", "D2: share authority needs a direct project owner grant, not an inherited one");
  if (op === "add") {
    const authority = await ctx.db.prepare(`SELECT ${assessmentShareAuthority("?1", "?2")} AS allowed`)
      .bind(pid, ctx.principal.id).first<{ allowed: number }>();
    if (!authority?.allowed) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "grouping requires direct ownership of every review in the project", "Ask the project and review owners to share this project with the workspace.");
  }
  return { w, p };
}

export const add_project: Handler = async (ctx, params) => {
  const wid = reqStr(params, "id");
  const pid = reqStr(params, "pid");
  const { p } = await shareAuthority(ctx, wid, pid, "add");
  if (p.workspace_id && p.workspace_id !== wid) throw new CapError("INVALID_PARAMS", "project already grouped in another workspace", "remove_project first");
  const written = await ctx.db.prepare(`UPDATE project SET workspace_id = ?1 WHERE id = ?2 AND workspace_id IS ?3
    AND EXISTS (SELECT 1 FROM "grant" pg WHERE pg.principal_id = ?4 AND pg.scope_type = 'project' AND pg.scope_id = project.id AND pg.role = 'owner')
    AND EXISTS (SELECT 1 FROM "grant" wg WHERE wg.principal_id = ?4 AND wg.scope_type = 'workspace' AND wg.scope_id = ?1 AND wg.role IN ('member','owner'))
    AND ${assessmentShareAuthority("project.id", "?4")}`)
    .bind(wid, pid, p.workspace_id, ctx.principal.id).run();
  if (!written.meta.changes) {
    await shareAuthority(ctx, wid, pid, "add");
    throw new CapError("STAGE_CONFLICT", "project grouping changed while access was being checked", "re-read the project before grouping again");
  }
  const affectedGrants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", wid);
  return { result: { workspace_id: wid, project_id: pid, grouped: true, workspace_grantees_now_listing: affectedGrants }, scope: { type: "workspace", id: wid }, priorState: { workspace_id: p.workspace_id } };
};

export const remove_project: Handler = async (ctx, params) => {
  const wid = reqStr(params, "id");
  const pid = reqStr(params, "pid");
  const { p } = await shareAuthority(ctx, wid, pid, "remove");
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
