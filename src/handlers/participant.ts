// Participant entry points. A redeemed credential is exchanged for one survey-scoped token.
import type { Handler, Ctx } from "./types";
import { CapError, notVisible } from "./errors";
import { newId, nowIso, randomToken, reqStr, sha256 } from "./common";

interface Entry { id: string; assessment_survey_id: string; state: string; expires_at?: string | null }

async function ensureSurveyOpen(ctx: Ctx, surveyId: string) {
  const survey = await ctx.db.prepare("SELECT s.id, s.state, a.stage FROM assessment_survey s JOIN assessment a ON a.id = s.assessment_id WHERE s.id = ?")
    .bind(surveyId).first<{ id: string; state: string; stage: string }>();
  if (!survey) throw notVisible("invitation");
  if (survey.state !== "selected" || survey.stage !== "collect") throw new CapError("STAGE_CONFLICT", "survey is not collecting responses");
}

async function issue(ctx: Ctx, surveyId: string, respondentId: string) {
  await ensureSurveyOpen(ctx, surveyId);
  const token = randomToken("pt");
  await ctx.db.prepare("INSERT INTO participant_session (id, assessment_survey_id, respondent_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(newId("ps"), surveyId, respondentId, await sha256(token), nowIso(ctx), new Date(ctx.now().getTime() + 12 * 3600_000).toISOString()).run();
  return { result: { participant_token: token, survey_id: surveyId, expires_in: 43200 }, scope: { type: "survey" as const, id: surveyId } };
}

export const redeem_code: Handler = async (ctx, params) => {
  const code = reqStr(params, "code").trim().toUpperCase();
  const row = await ctx.db.prepare("SELECT id, assessment_survey_id, state FROM access_code WHERE code_hash = ?")
    .bind(await sha256(code)).first<Entry>();
  if (!row || row.state !== "issued") throw notVisible("access code");
  await ensureSurveyOpen(ctx, row.assessment_survey_id);
  const respondentId = newId("respondent");
  const changed = await ctx.db.prepare("UPDATE access_code SET state = 'redeemed', redeemed_at = ?, code_value = NULL WHERE id = ? AND state = 'issued'")
    .bind(nowIso(ctx), row.id).run();
  if (changed.meta.changes !== 1) throw notVisible("access code");
  return issue(ctx, row.assessment_survey_id, respondentId);
};

export const open_link: Handler = async (ctx, params) => {
  const token = reqStr(params, "token");
  const row = await ctx.db.prepare("SELECT id, scope_type, scope_id, expires_at, state FROM invitation WHERE token_hash = ?")
    .bind(await sha256(token)).first<Entry>();
  if (!row || (row as any).scope_type !== "survey" || (row.expires_at && row.expires_at <= nowIso(ctx)) || row.state !== "sent") throw notVisible("invitation");
  // Invitation links are reusable so that reopening a receipt remains possible.
  const respondentId = `invitee_${row.id}`;
  return issue(ctx, (row as any).scope_id, respondentId);
};

export const handlers: Record<string, Handler> = {
  "cap.participant.redeem_code": redeem_code,
  "cap.participant.open_link": open_link,
};
