// cap.language.* — a project's language registry (D9: language identity lives on each assessment; no new access
// scope — languages are visible to anyone who can see the project, created/archived by member-or-above).
// Contract gap found live 2026-09-16: without these, a fresh project could never host an assessment.
import type { Handler } from "./types";
import { CapError, notVisible } from "./errors";
import { loadProject, newId, nowIso, reqStr, optStr } from "./common";

export interface LanguageRow { id: string; project_id: string; code: string | null; name: string; created_at: string; archived_at: string | null }
const CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/; // BCP-47-shaped; private-use qaa–qtz for invented languages

async function byId(ctx: Parameters<Handler>[0], id: string) {
  const row = await ctx.db.prepare("SELECT * FROM language WHERE id = ?").bind(id).first<LanguageRow>();
  if (!row) throw notVisible("language");
  await loadProject(ctx, row.project_id, "member");
  return row;
}

export const create: Handler = async (ctx, params) => {
  const pid = reqStr(params, "pid");
  await loadProject(ctx, pid, "member");
  const name = reqStr(params, "name").trim();
  const code = optStr(params, "code")?.trim() ?? null;
  if (!name) throw new CapError("INVALID_PARAMS", "name is required");
  if (code !== null && !CODE.test(code)) throw new CapError("INVALID_PARAMS", "code must be BCP-47-shaped (e.g. qaa for an invented language)");
  const dup = await ctx.db.prepare("SELECT id FROM language WHERE project_id = ? AND (name = ? OR (code IS NOT NULL AND code = ?))").bind(pid, name, code).first<{ id: string }>();
  if (dup) throw new CapError("INVALID_PARAMS", "a language with that name or code already exists in this project", "use cap.language.list");
  const id = newId("lang"), at = nowIso(ctx);
  await ctx.db.prepare("INSERT INTO language (id, project_id, code, name, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, pid, code, name, at).run();
  return { result: { language: { id, project_id: pid, code, name, created_at: at, archived_at: null } }, scope: { type: "project", id: pid } };
};

export const list: Handler = async (ctx, params) => {
  const pid = reqStr(params, "pid");
  await loadProject(ctx, pid);
  const { results } = await ctx.db.prepare("SELECT * FROM language WHERE project_id = ? ORDER BY name").bind(pid).all<LanguageRow>();
  return { result: { languages: results, count: results.length } };
};

async function archiveChange(ctx: Parameters<Handler>[0], params: Record<string, unknown>, archived: boolean) {
  const id = reqStr(params, "id");
  const row = await byId(ctx, id);
  const at = archived ? (row.archived_at ?? nowIso(ctx)) : null;
  await ctx.db.prepare("UPDATE language SET archived_at = ? WHERE id = ?").bind(at, id).run();
  return { result: { language: { ...row, archived_at: at } }, scope: { type: "project" as const, id: row.project_id }, priorState: { archived_at: row.archived_at } };
}
export const archive: Handler = (ctx, p) => archiveChange(ctx, p, true);
export const unarchive: Handler = (ctx, p) => archiveChange(ctx, p, false);

export const handlers: Record<string, Handler> = {
  "cap.language.create": create, "cap.language.list": list, "cap.language.archive": archive, "cap.language.unarchive": unarchive,
};
