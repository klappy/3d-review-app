// No grant inheritance: assessment reads/writes require an exact assessment grant.
// Creation and archive membership are deliberately project-scoped per contract.
import type { Ctx, Handler, Role } from "./types";
import { templateDisplayName } from "../display-names";
import { CapError, notVisible } from "./errors";
import { DEMOGRAPHICS_KEY, demographicsEnabled, parseContextJson } from "../context-fields";
import { STAGES, countScalar, gate, loadProject, newId, nowIso, patchOf, reqStr, roleAt, type AssessmentRow } from "./common";
import { lwcOf, saveLwc, saveLwcOnCreate, takeLwc } from "./lwc";

async function exact(ctx: Ctx, id: string, min: Role = "viewer") {
  const row = await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id).first<AssessmentRow>();
  if (!row) throw notVisible("assessment");
  return { row, role: gate(await roleAt(ctx, "assessment", id), min, "assessment") };
}
const view = (a: AssessmentRow, role: Role) => { const { lwc_json: _raw, ...rest } = a as AssessmentRow & { lwc_json?: unknown }; return { ...rest, lwc: lwcOf(a), role }; };
async function language(ctx: Ctx, pid: string, languageId: string) {
  const row = await ctx.db.prepare("SELECT id, archived_at FROM language WHERE id = ? AND project_id = ?").bind(languageId, pid).first<{id:string; archived_at: string | null}>();
  if (!row) throw notVisible("language");
  if (row.archived_at) throw new CapError("INVALID_PARAMS", "language is archived", "cap.language.unarchive it or pick another");
}
export const create: Handler = async (ctx, params) => {
  const pid = reqStr(params, "pid");
  await loadProject(ctx, pid, "member");
  const lwc = takeLwc(params);
  const name = reqStr(params, "name"), language_id = reqStr(params, "language_id");
  await language(ctx, pid, language_id);
  const id = newId("assess"), at = nowIso(ctx);
  const purpose = params.purpose === undefined ? null : reqStr(params, "purpose");
  const period = params.period === undefined ? null : reqStr(params, "period");
  const format = params.format === undefined ? null : reqStr(params, "format");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO assessment (id, project_id, language_id, name, purpose, period, format, stage, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'prepare', ?, ?)").bind(id, pid, language_id, name, purpose, period, format, at, ctx.principal.id),
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId("grant"), ctx.principal.id, "assessment", id, "owner", at),
  ]);
  const saved = await saveLwcOnCreate(ctx, "assessment", id, lwc);
  return { result: { assessment: { id, project_id: pid, language_id, name, purpose, period, format, lwc: saved, stage: "prepare", archived_at: null, created_at: at, role: "owner" } }, scope: { type: "assessment", id } };
};
export const list: Handler = async (ctx, params) => {
  const pid = reqStr(params, "pid");
  await loadProject(ctx, pid);
  const {results} = await ctx.db.prepare('SELECT a.*, g.role, (SELECT COUNT(*) FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id WHERE s.assessment_id = a.id) AS response_count FROM assessment a JOIN "grant" g ON g.scope_type = ? AND g.scope_id = a.id WHERE a.project_id = ? AND g.principal_id = ? ORDER BY a.created_at').bind("assessment", pid, ctx.principal.id).all<AssessmentRow & {role:Role; response_count:number}>();
  return { result: { assessments: results.map(a => ({ ...view(a, a.role), response_count: Number(a.response_count) || 0 })) }, scope: { type: "project", id: pid } };
};
// Survey rows carry the template's display name (Translators, Team leaders & mentors); the pinned name stays as source_name.
function shownSurvey(s: Record<string, unknown>) {
  const id = String(s.template_id ?? ""), name = String(s.template_name ?? ""), shown = templateDisplayName(id, name);
  return shown === name ? s : { ...s, template_name: shown, template_source_name: name };
}

export const get: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row, role} = await exact(ctx, id);
  const {results} = await ctx.db.prepare("SELECT s.id, s.template_id, s.template_version, s.state, s.collection_status, s.archived_at, s.created_at, t.name AS template_name, t.perspective FROM assessment_survey s JOIN survey_template t ON t.id = s.template_id AND t.version = s.template_version WHERE s.assessment_id = ? ORDER BY s.created_at").bind(id).all();
  return { result: { assessment: { ...view(row, role), demographics_enabled: await readDemographics(ctx, id) }, surveys: results.map(s => shownSurvey(s as Record<string, unknown>)) }, scope: { type: "assessment", id } };
};
async function readDemographics(ctx: Ctx, id: string): Promise<boolean> {
  const { results } = await ctx.db.prepare("SELECT context_json FROM assessment_survey WHERE assessment_id = ? AND state = 'selected'").bind(id).all<{ context_json?: string }>();
  return (results || []).some((r) => demographicsEnabled(r.context_json));
}
async function writeDemographics(ctx: Ctx, id: string, on: boolean): Promise<boolean> {
  const { results } = await ctx.db.prepare("SELECT id, context_json FROM assessment_survey WHERE assessment_id = ?").bind(id).all<{ id: string; context_json?: string }>();
  const rows = results || [];
  if (rows.length) await ctx.db.batch(rows.map((r) => ctx.db.prepare("UPDATE assessment_survey SET context_json = ? WHERE id = ?")
    .bind(JSON.stringify({ ...parseContextJson(r.context_json), [DEMOGRAPHICS_KEY]: on }), r.id)));
  // Read back: with no group selected yet there is nowhere to store the switch, so it honestly reads off.
  return readDemographics(ctx, id);
}
export const update: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row, role} = await exact(ctx, id, "member");
  const lwc = takeLwc(params); // removes lwc from params
  // S15a: demographics_enabled is the facilitator's per-assessment switch (off by default); it is stored in each
  // group's assessment_survey.context_json. Participants hold no assessment grant, so they can never reach this.
  const { demographics_enabled: demographicsParam, ...rest } = params;
  if (demographicsParam !== undefined && typeof demographicsParam !== "boolean") throw new CapError("INVALID_PARAMS", "demographics_enabled must be a boolean");
  // S13: an LWC-only update (the Prepare languages field) touches nothing else.
  if (lwc !== undefined && demographicsParam === undefined && Object.keys(rest).every(k => k === "id")) {
    await saveLwc(ctx, "assessment", id, lwc);
    return { result: { assessment: { ...view(row, role), lwc } }, scope: { type: "assessment", id }, priorState: { lwc: lwcOf(row) } };
  }
  const onlySwitch = demographicsParam !== undefined && !Object.keys(rest).some((k) => k !== "id");
  const patch = onlySwitch ? {} as Record<string, string | null> : patchOf(rest, ["name", "purpose", "period", "language_id", "format"]);
  if (patch.name !== undefined && !patch.name) throw new CapError("INVALID_PARAMS", "name cannot be empty");
  if (patch.language_id !== undefined) { if (!patch.language_id) throw new CapError("INVALID_PARAMS", "language_id cannot be empty"); await language(ctx, row.project_id, patch.language_id); }
  const next = { name: patch.name ?? row.name, purpose: patch.purpose === undefined ? row.purpose : patch.purpose, period: patch.period === undefined ? row.period : patch.period, language_id: patch.language_id ?? row.language_id, format: patch.format === undefined ? row.format : patch.format };
  await ctx.db.prepare("UPDATE assessment SET name = ?, purpose = ?, period = ?, language_id = ?, format = ? WHERE id = ?").bind(next.name, next.purpose, next.period, next.language_id, next.format, id).run();
  if (lwc !== undefined) await saveLwc(ctx, "assessment", id, lwc);
  const demographics_enabled = demographicsParam === undefined ? await readDemographics(ctx, id) : await writeDemographics(ctx, id, demographicsParam);
  return { result: { assessment: { ...view({...row, ...next}, role), demographics_enabled, ...(lwc !== undefined ? { lwc } : {}) } }, scope: { type: "assessment", id }, priorState: {name: row.name, purpose: row.purpose, period: row.period, language_id: row.language_id, format: row.format} };
};
export const set_stage: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row, role} = await exact(ctx, id, "member");
  const stage = reqStr(params, "stage");
  const current = STAGES.indexOf(row.stage), next = STAGES.indexOf(stage as typeof STAGES[number]);
  if (next < 0) throw new CapError("INVALID_PARAMS", "invalid stage");
  if (Math.abs(next-current) !== 1) throw new CapError("STAGE_CONFLICT", "move one stage at a time");
  // The stage change is the explicit collection gate. Reading an assessment
  // never opens it, and the update is scoped to this assessment's selections.
  await ctx.db.batch([
    ctx.db.prepare("UPDATE assessment SET stage = ? WHERE id = ?").bind(stage, id),
    ctx.db.prepare("UPDATE assessment_survey SET collection_status = ? WHERE assessment_id = ? AND state = 'selected'")
      .bind(stage === "collect" ? "open" : "closed", id),
  ]);
  return {result:{assessment:view({...row, stage:stage as typeof row.stage},role)},scope:{type:"assessment",id},priorState:{stage:row.stage}};
};
async function archiveChange(ctx: Ctx, params: Record<string,unknown>, archived: boolean) {
  const id = reqStr(params, "id");
  const row = await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id).first<AssessmentRow>();
  if (!row) throw notVisible("assessment");
  await loadProject(ctx, row.project_id, "member");
  const at = archived ? (row.archived_at ?? nowIso(ctx)) : null;
  await ctx.db.prepare("UPDATE assessment SET archived_at = ? WHERE id = ?").bind(at, id).run();
  return {result:{assessment:{...row,archived_at:at}},scope:{type:"assessment" as const,id},priorState:{archived_at:row.archived_at}};
}
export const archive: Handler = (ctx, params) => archiveChange(ctx, params, true);
export const unarchive: Handler = (ctx, params) => archiveChange(ctx, params, false);
export const notes_update: Handler = async (ctx, params) => {
  const id = reqStr(params, "id"), {row,role} = await exact(ctx,id,"member");
  const patch = patchOf(params,["notes_reflection","notes_next_steps"]);
  const notes_reflection = patch.notes_reflection === undefined ? row.notes_reflection : patch.notes_reflection;
  const notes_next_steps = patch.notes_next_steps === undefined ? row.notes_next_steps : patch.notes_next_steps;
  await ctx.db.prepare("UPDATE assessment SET notes_reflection = ?, notes_next_steps = ? WHERE id = ?").bind(notes_reflection,notes_next_steps,id).run();
  return {result:{assessment:view({...row,notes_reflection,notes_next_steps},role)},scope:{type:"assessment",id},priorState:{notes_reflection:row.notes_reflection,notes_next_steps:row.notes_next_steps}};
};
export const del: Handler = async (ctx, params, opts) => {
  const id = reqStr(params,"id"), {row} = await exact(ctx,id,"owner");
  const surveys = await countScalar(ctx,"SELECT COUNT(*) AS n FROM assessment_survey WHERE assessment_id = ?",id);
  const responses = await countScalar(ctx,"SELECT COUNT(*) AS n FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id WHERE s.assessment_id = ?",id);
  const impact = {affected:[{assessment:id,surveys,responses}],irreversible:true,effect:"destructive" as const,retention:"D5 held: only empty assessments can be hard-deleted"};
  if(opts?.dryRun) return {result:{assessment:view(row,"owner")},scope:{type:"assessment",id},impact};
  if(surveys || responses) throw new CapError("INVALID_PARAMS","assessment is not empty","deselect surveys first");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("assessment",id),
    ctx.db.prepare("DELETE FROM assessment WHERE id = ?").bind(id),
  ]);
  return {result:{deleted:true,id},scope:{type:"assessment",id},impact,priorState:{assessment:row}};
};
export const handlers: Record<string,Handler> = {
  "cap.assessment.create":create,"cap.assessment.list":list,"cap.assessment.get":get,
  "cap.assessment.update":update,"cap.assessment.set_stage":set_stage,
  "cap.assessment.archive":archive,"cap.assessment.unarchive":unarchive,
  "cap.assessment.delete":del,"cap.assessment.notes.update":notes_update,
};
