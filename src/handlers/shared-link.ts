import type { Ctx } from "./types";
import { CapError, notVisible } from "./errors";
import { newId, nowIso, randomToken, sha256 } from "./common";
import { canonical } from "../receipt";

export interface SharedSession {
  id: string; assessment_survey_id: string; respondent_id: string; token_hash: string;
  invitation_id: string | null; expires_at: string; revoked_at: string | null;
}
interface Link { id: string; assessment_survey_id: string; expires_at: string | null; status: string; scope_type: string }
interface Collection { state: string; collection_status: string; archived_at: string | null; assessment_archived_at: string | null; stage: string }

export async function activeLink(ctx: Ctx, id: string, sid?: string): Promise<Link> {
  const row = await ctx.db.prepare("SELECT id, assessment_survey_id, scope_type, expires_at, status FROM invitation WHERE id = ?")
    .bind(id).first<Link>();
  if (!row || row.scope_type !== "survey" || !row.assessment_survey_id || (sid && row.assessment_survey_id !== sid)
    || !["pending", "accepted"].includes(row.status) || (row.expires_at !== null && row.expires_at <= nowIso(ctx))) throw notVisible("invitation");
  return row;
}
export async function collecting(ctx: Ctx, sid: string) {
  const row = await ctx.db.prepare(`SELECT s.state, s.collection_status, s.archived_at, a.archived_at AS assessment_archived_at, a.stage
    FROM assessment_survey s JOIN assessment a ON a.id = s.assessment_id WHERE s.id = ?`).bind(sid).first<Collection>();
  if (!row || row.state !== "selected" || row.collection_status !== "open" || row.archived_at || row.assessment_archived_at || row.stage !== "collect")
    throw new CapError("STAGE_CONFLICT", "survey is not collecting responses");
}

/** Only shared rows acquire the new lifetime semantics. SELECT * also supports legacy DB fixtures before 0007. */
export async function sharedSession(ctx: Ctx): Promise<SharedSession | null> {
  const sid = ctx.principal.participantSurveyId, respondent = ctx.principal.respondentId;
  if (!sid || !respondent) return null;
  const first = await ctx.db.prepare("SELECT * FROM participant_session WHERE assessment_survey_id = ? AND respondent_id = ? LIMIT 1")
    .bind(sid, respondent).first<SharedSession>();
  if (!first || !("invitation_id" in first)) return null;
  const count = await ctx.db.prepare("SELECT COUNT(*) AS n, COUNT(invitation_id) AS shared_n FROM participant_session WHERE assessment_survey_id = ? AND respondent_id = ?")
    .bind(sid, respondent).first<{ n: number; shared_n: number }>();
  if (!first.invitation_id) {
    if (Number(count?.shared_n) > 0) throw notVisible("participant session");
    return null;
  }
  if (Number(count?.n) !== 1 || first.revoked_at || first.expires_at <= nowIso(ctx)) throw notVisible("participant session");
  await activeLink(ctx, first.invitation_id, sid);
  return first;
}

export async function openSharedLink(ctx: Ctx, token: string, resume: unknown) {
  const row = await ctx.db.prepare("SELECT id FROM invitation WHERE token_hash = ?").bind(await sha256(token)).first<{ id: string }>();
  if (!row) throw notVisible("invitation");
  const link = await activeLink(ctx, row.id);
  if (resume !== undefined) {
    if (typeof resume !== "string" || !/^pt_[A-Za-z0-9_-]{32}$/.test(resume)) throw notVisible("participant session");
    const session = await ctx.db.prepare("SELECT * FROM participant_session WHERE token_hash = ?").bind(await sha256(resume)).first<SharedSession>();
    if (!session || session.invitation_id !== link.id || session.assessment_survey_id !== link.assessment_survey_id
      || session.revoked_at || session.expires_at <= nowIso(ctx)) throw notVisible("participant session");
    await sharedSession({ ...ctx, principal: { kind: "participant", id: session.respondent_id, respondentId: session.respondent_id, participantSurveyId: session.assessment_survey_id } });
    return result(session, resume, true, ctx);
  }
  await collecting(ctx, link.assessment_survey_id);
  const bearer = randomToken("pt"), expires = new Date(Math.min(ctx.now().getTime() + 43_200_000, link.expires_at ? Date.parse(link.expires_at) : Infinity)).toISOString();
  const session: SharedSession = { id: newId("ps"), assessment_survey_id: link.assessment_survey_id, respondent_id: newId("respondent"),
    token_hash: await sha256(bearer), invitation_id: link.id, expires_at: expires, revoked_at: null };
  const inserted = await ctx.db.prepare(`INSERT INTO participant_session
    (id, assessment_survey_id, respondent_id, token_hash, created_at, expires_at, invitation_id)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM invitation i JOIN assessment_survey s ON s.id = i.assessment_survey_id JOIN assessment a ON a.id = s.assessment_id
      WHERE i.id = ? AND i.status IN ('pending','accepted') AND (i.expires_at IS NULL OR i.expires_at > max(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
      AND s.state = 'selected' AND s.collection_status = 'open' AND s.archived_at IS NULL AND a.archived_at IS NULL AND a.stage = 'collect')`)
    .bind(session.id, session.assessment_survey_id, session.respondent_id, session.token_hash, nowIso(ctx), expires, link.id, link.id, nowIso(ctx)).run();
  if (inserted.meta.changes !== 1) { await activeLink(ctx, link.id); await collecting(ctx, link.assessment_survey_id); throw new CapError("STAGE_CONFLICT", "link changed during open"); }
  return result(session, bearer, false, ctx);
}
function result(session: SharedSession, bearer: string, resumed: boolean, ctx: Ctx) {
  return { result: { participant_token: bearer, survey_id: session.assessment_survey_id, respondent_id: session.respondent_id,
    expires_at: session.expires_at, expires_in: Math.max(0, Math.floor((Date.parse(session.expires_at) - ctx.now().getTime()) / 1000)), resumed },
    scope: { type: "survey" as const, id: session.assessment_survey_id } };
}
interface Claim { client_key_digest: string; payload_digest: string; response_id: string; submitted_at: string }
async function claim(ctx: Ctx, session: SharedSession) {
  return ctx.db.prepare(`SELECT c.client_key_digest, c.payload_digest, c.response_id, r.submitted_at FROM shared_response_claim c
    JOIN response r ON r.id = c.response_id WHERE c.assessment_survey_id = ? AND c.respondent_id = ?`)
    .bind(session.assessment_survey_id, session.respondent_id).first<Claim>();
}
function replay(row: Claim, key: string, payload: string) {
  if (row.client_key_digest !== key) throw new CapError("STAGE_CONFLICT", "response already submitted");
  if (row.payload_digest !== payload) throw new CapError("INVALID_PARAMS", "idempotency key has different answers");
  return { response_id: row.response_id, submitted_at: row.submitted_at, duplicate: true, undo: null };
}
export async function submitShared(ctx: Ctx, session: SharedSession, key: string, answers: Record<string, unknown>, template: { template_id: string; template_version: number }) {
  const kd = await sha256(key), pd = await sha256(canonical(answers));
  const prior = await claim(ctx, session);
  if (prior) return replay(prior, kd, pd); // authority already revalidated; collection may now be closed
  await collecting(ctx, session.assessment_survey_id);
  const responseId = newId("resp"), at = nowIso(ctx);
  try {
    const results = await ctx.db.batch([
      ctx.db.prepare(`INSERT INTO response (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version, provenance_json, source, submitted_at)
        SELECT ?, s.id, ps.respondent_id, ?, ?, s.template_id, s.template_version, ?, 'participant', ?
        FROM participant_session ps JOIN invitation i ON i.id = ps.invitation_id
        JOIN assessment_survey s ON s.id = ps.assessment_survey_id JOIN assessment a ON a.id = s.assessment_id
        WHERE ps.id = ? AND ps.invitation_id = ? AND ps.revoked_at IS NULL AND ps.expires_at > max(?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        AND i.status IN ('pending','accepted') AND (i.expires_at IS NULL OR i.expires_at > max(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
        AND i.assessment_survey_id = s.id AND i.scope_type = 'survey'
        AND s.state = 'selected' AND s.collection_status = 'open' AND s.archived_at IS NULL AND a.archived_at IS NULL AND a.stage = 'collect'
        AND s.template_id = ? AND s.template_version = ?`)
        .bind(responseId, `shared:${session.respondent_id}:${kd}`, JSON.stringify(answers), JSON.stringify({ presented_template_id: template.template_id, presented_template_version: template.template_version, link_id: session.invitation_id, trace_id: ctx.traceId }),
          at, session.id, session.invitation_id, at, at, template.template_id, template.template_version),
      ctx.db.prepare(`INSERT INTO shared_response_claim (assessment_survey_id, respondent_id, client_key_digest, payload_digest, response_id)
        SELECT assessment_survey_id, respondent_id, ?, ?, id FROM response WHERE id = ?`).bind(kd, pd, responseId),
    ]);
    if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
      await sharedSession(ctx); await collecting(ctx, session.assessment_survey_id);
      throw new CapError("STAGE_CONFLICT", "collection changed during submission");
    }
    return { response_id: responseId, submitted_at: at, duplicate: false, undo: null };
  } catch (error) {
    // A unique-key conflict rolls back the D1 batch. Never turn an unrelated storage error into success.
    if (!/UNIQUE constraint failed/i.test(String(error))) throw error;
    await sharedSession(ctx);
    const winner = await claim(ctx, session);
    if (!winner) throw error;
    return replay(winner, kd, pd);
  }
}
