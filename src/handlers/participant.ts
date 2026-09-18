// Participant entry points. A redeemed credential is exchanged for one survey-scoped token.
import type { Handler, Ctx } from "./types";
import { CapError, notVisible } from "./errors";
import { newId, nowIso, randomToken, reqStr, sha256 } from "./common";
import { codeHash } from "../code-escrow";
import { openSharedLink } from "./shared-link";

interface CodeEntry { id: string; assessment_survey_id: string; expires_at: string | null; redeemed_at: string | null; respondent_id: string | null }

async function ensureSurveyOpen(ctx: Ctx, surveyId: string, allowClosed = false) {
  const survey = await ctx.db.prepare("SELECT s.id, s.state, s.collection_status FROM assessment_survey s WHERE s.id = ?")
    .bind(surveyId).first<{ id: string; state: string; collection_status: string }>();
  if (!survey) throw notVisible("invitation");
  if (survey.state !== "selected" || (!allowClosed && survey.collection_status !== "open")) throw new CapError("STAGE_CONFLICT", "survey is not collecting responses");
}

async function issue(ctx: Ctx, surveyId: string, respondentId: string, allowClosed = false) {
  await ensureSurveyOpen(ctx, surveyId, allowClosed);
  const token = randomToken("pt");
  await ctx.db.prepare("INSERT INTO participant_session (id, assessment_survey_id, respondent_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(newId("ps"), surveyId, respondentId, await sha256(token), nowIso(ctx), new Date(ctx.now().getTime() + 12 * 3600_000).toISOString()).run();
  return { result: { participant_token: token, survey_id: surveyId, expires_in: 43200 }, scope: { type: "survey" as const, id: surveyId } };
}

export const redeem_code: Handler = async (ctx, params) => {
  const code = reqStr(params, "code").trim().toUpperCase();
  // New batches use an HKDF-separated keyed digest; the SHA branch is limited
  // to pre-escrow rows (batch_id NULL), including isolated synthetic fixtures.
  // Both lookups run when a key is configured so a miss does not reveal which
  // hash generation is in use through an early return.
  const keyed = ctx.env.CODE_ESCROW_SECRET ? await codeHash(ctx.env.CODE_ESCROW_SECRET, code) : null;
  const [newRow, legacyRow] = await Promise.all([
    keyed ? ctx.db.prepare("SELECT id, assessment_survey_id, expires_at, redeemed_at, respondent_id FROM access_code WHERE code_hash = ? AND batch_id IS NOT NULL")
      .bind(keyed).first<CodeEntry>() : Promise.resolve(null),
    ctx.db.prepare("SELECT id, assessment_survey_id, expires_at, redeemed_at, respondent_id FROM access_code WHERE code_hash = ? AND batch_id IS NULL")
      .bind(await sha256(code)).first<CodeEntry>(),
  ]);
  const row = newRow ?? legacyRow;
  if (!row || row.redeemed_at || (row.expires_at && row.expires_at <= nowIso(ctx))) throw notVisible("access code");
  await ensureSurveyOpen(ctx, row.assessment_survey_id);
  const respondentId = row.respondent_id ?? newId("respondent");
  const changed = await ctx.db.prepare("UPDATE access_code SET redeemed_at = ?, respondent_id = ? WHERE id = ? AND redeemed_at IS NULL")
    .bind(nowIso(ctx), respondentId, row.id).run();
  if (changed.meta.changes !== 1) throw notVisible("access code");
  return issue(ctx, row.assessment_survey_id, respondentId);
};

export const open_link: Handler = async (ctx, params) => {
  if (Object.keys(params).some(k => k !== "token" && k !== "resume_token")) throw new CapError("INVALID_PARAMS", "unknown link parameter");
  return openSharedLink(ctx, reqStr(params, "token"), params.resume_token);
};

export const handlers: Record<string, Handler> = {
  "cap.participant.redeem_code": redeem_code,
  "cap.participant.open_link": open_link,
};
