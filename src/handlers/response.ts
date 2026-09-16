import type { Ctx, Handler } from "./types";
import { CapError, notVisible } from "./errors";
import { gate, newId, nowIso, parseItems, participantLabels, renderItems, reqStr, roleAt, type TemplateItem } from "./common";

interface ParticipantSurvey { id: string; assessment_id: string; template_id: string; template_version: number; state: string; collection_status: string; name: string; language_name: string; period: string | null; items_json: string; scoring_json: string; perspective: string; source_ref: string | null; published_at: string | null }

async function scopedSurvey(ctx: Ctx, requireOpen = false): Promise<ParticipantSurvey> {
  if (ctx.principal.kind !== "participant" || !ctx.principal.participantSurveyId || !ctx.principal.respondentId)
    throw new CapError("NOT_AUTHENTICATED", "participant token required");
  const s = await ctx.db.prepare(`SELECT s.*, a.name, a.period, l.name AS language_name,
    t.items_json, t.scoring_json, t.perspective, t.source_ref, t.published_at
    FROM assessment_survey s JOIN assessment a ON a.id = s.assessment_id
    JOIN language l ON l.id = a.language_id
    JOIN survey_template t ON t.id = s.template_id AND t.version = s.template_version
    WHERE s.id = ?`).bind(ctx.principal.participantSurveyId).first<ParticipantSurvey>();
  if (!s) throw notVisible("survey");
  if (requireOpen && (s.state !== "selected" || s.collection_status !== "open"))
    throw new CapError("STAGE_CONFLICT", "survey is not collecting responses");
  return s;
}

function validateAnswers(items: TemplateItem[], value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CapError("INVALID_PARAMS", "answers must be an object");
  const answers = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  const ids = new Set(items.map((i) => i.id));
  for (const key of Object.keys(answers)) if (!ids.has(key)) throw new CapError("INVALID_PARAMS", `unknown answer item ${key}`);
  for (const item of items) {
    const answer = answers[item.id];
    if (answer === undefined || answer === null || answer === "" || (item.type === "multi" && Array.isArray(answer) && answer.length === 0)) {
      if (item.required === false) { normalized[item.id] = null; continue; }
      throw new CapError("INVALID_PARAMS", `answer required for ${item.id}`);
    }
    if (item.type === "scale" && (typeof answer !== "number" || !Number.isInteger(answer) || !item.scale || answer < item.scale.min || answer > item.scale.max))
      throw new CapError("INVALID_PARAMS", `invalid scale answer for ${item.id}`);
    if (item.type === "text" && (typeof answer !== "string" || answer.length > 5000))
      throw new CapError("INVALID_PARAMS", `invalid text answer for ${item.id}`);
    if (item.type === "single" && (typeof answer !== "string" || !item.options?.some((o) => o.code === answer)))
      throw new CapError("INVALID_PARAMS", `invalid option for ${item.id}`);
    if (item.type === "multi" && (!Array.isArray(answer) || answer.length === 0 || (item.max_select && answer.length > item.max_select) || new Set(answer).size !== answer.length || !answer.every((a) => typeof a === "string" && item.options?.some((o) => o.code === a))))
      throw new CapError("INVALID_PARAMS", `invalid options for ${item.id}`);
    normalized[item.id] = answer;
  }
  return normalized;
}

export const form: Handler = async (ctx) => {
  const s = await scopedSurvey(ctx, true);
  const items = parseItems(s as any);
  if (!items.length) throw new CapError("STAGE_CONFLICT", "survey instrument is unavailable");
  return { result: { survey_id: s.id, assessment: s.name, language: s.language_name, period: s.period,
    template: { id: s.template_id, version: s.template_version, perspective: s.perspective, source_ref: s.source_ref },
    items: renderItems(items, s.language_name), participant_labels: participantLabels(s.template_id) }, scope: { type: "survey", id: s.id } };
};

export const submit: Handler = async (ctx, params) => {
  const s = await scopedSurvey(ctx, true);
  const idempotencyKey = reqStr(params, "idempotency_key");
  if (idempotencyKey.length > 200) throw new CapError("INVALID_PARAMS", "idempotency_key is too long");
  const respondentId = ctx.principal.respondentId!;
  const prior = await ctx.db.prepare("SELECT id, assessment_survey_id, respondent_id, submitted_at FROM response WHERE assessment_survey_id = ? AND idempotency_key = ?")
    .bind(s.id, idempotencyKey).first<{ id: string; assessment_survey_id: string; respondent_id: string; submitted_at: string }>();
  if (prior) {
    if (prior.respondent_id !== respondentId || prior.assessment_survey_id !== s.id) throw new CapError("INVALID_PARAMS", "idempotency key already used");
    return { result: { response_id: prior.id, submitted_at: prior.submitted_at, duplicate: true, undo: null }, scope: { type: "survey", id: s.id } };
  }
  const existing = await ctx.db.prepare("SELECT id FROM response WHERE assessment_survey_id = ? AND respondent_id = ? LIMIT 1")
    .bind(s.id, respondentId).first<{ id: string }>();
  if (existing) throw new CapError("STAGE_CONFLICT", "response already submitted; amendment policy is held (D6)");
  const items = parseItems(s as any);
  if (!items.length) throw new CapError("STAGE_CONFLICT", "survey instrument is unavailable");
  const answers = validateAnswers(items, params.answers);
  const responseId = newId("resp");
  const submittedAt = nowIso(ctx);
  await ctx.db.prepare(`INSERT INTO response
    (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version, provenance_json, source, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(responseId, s.id, respondentId, idempotencyKey, JSON.stringify(answers), s.template_id, s.template_version,
      JSON.stringify({ presented_template_id: s.template_id, presented_template_version: s.template_version, trace_id: ctx.traceId }), "participant", submittedAt).run();
  return { result: { response_id: responseId, submitted_at: submittedAt, duplicate: false, undo: null }, scope: { type: "survey", id: s.id } };
};

export const receipt: Handler = async (ctx) => {
  const s = await scopedSurvey(ctx);
  const row = await ctx.db.prepare("SELECT id, submitted_at, template_id, template_version FROM response WHERE assessment_survey_id = ? AND respondent_id = ? ORDER BY submitted_at DESC LIMIT 1")
    .bind(s.id, ctx.principal.respondentId).first<{ id: string; submitted_at: string; template_id: string; template_version: number }>();
  return { result: { submitted: !!row, response_id: row?.id ?? null, submitted_at: row?.submitted_at ?? null,
    template: row ? { id: row.template_id, version: row.template_version } : null }, scope: { type: "survey", id: s.id } };
};

export const assisted_next: Handler = async (ctx) => {
  const s = await scopedSurvey(ctx, true);
  // The current schema does not identify an assisted collector. Do not let any
  // ordinary participant create unlimited new respondent identities.
  throw new CapError("STAGE_CONFLICT", "assisted collector authorization is not established (D6)", s.id);
};

async function assessmentGrant(ctx: Ctx, aid: string, min: "viewer" | "member" | "owner") {
  const a = await ctx.db.prepare("SELECT id FROM assessment WHERE id = ?").bind(aid).first<{ id: string }>();
  if (!a) throw notVisible("assessment");
  gate(await roleAt(ctx, "assessment", aid), min, "assessment");
}

export const list: Handler = async (ctx, params) => {
  const aid = reqStr(params, "aid");
  await assessmentGrant(ctx, aid, "member");
  // D7 threshold and differencing policy remain unresolved. Even owners get
  // a typed, successful suppression state rather than row-level disclosure.
  return { result: { suppressed: true, status: "held", reason: "D7 disclosure policy unresolved", responses: [] }, scope: { type: "assessment", id: aid } };
};

export const purge: Handler = async (ctx, params, opts) => {
  const aid = reqStr(params, "aid");
  await assessmentGrant(ctx, aid, "owner");
  const impact = { affected: [{ assessment_id: aid, records: "responses" }], irreversible: true, effect: "destructive" as const,
    retention: "D5 retention policy unresolved; execution held" };
  if (opts?.dryRun) return { result: { held: true }, scope: { type: "assessment", id: aid }, impact };
  throw new CapError("STAGE_CONFLICT", "response purge held until D5 retention policy is decided");
};

export const handlers: Record<string, Handler> = {
  "cap.response.form": form,
  "cap.response.submit": submit,
  "cap.response.receipt": receipt,
  "cap.response.assisted_next": assisted_next,
  "cap.response.list": list,
  "cap.response.purge": purge,
};
