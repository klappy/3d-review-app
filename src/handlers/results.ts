import type { Ctx, Handler } from "./types";
import { notVisible } from "./errors";
import { gate, reqStr, responseCountForAssessment, roleAt } from "./common";
import { participantReportMinimum, perspectiveLevelMinimum } from "../report-admission";
import { demographicsEnabled, demographicsProjection } from "../context-fields";

/** Below the D7 minimum (report-admission.ts participantReportMinimum: SUPPRESSION_THRESHOLD, a held working default; 1 on DEV,
 * the same floor the report attestation applies): Results, the responses list and the report all
 * name the same numbers — the assessment's response count (the one Collect and the assessment card show) and the minimum.
 * Callers read it only after their own grant check. Null at or above the minimum: those views stay exactly as they were. */
export type MinimumHold = { responses_in: number; responses_needed: number; reason: string };
export async function minimumHold(ctx: Pick<Ctx, "db"> & { env?: { ENVIRONMENT?: string } }, aid: string): Promise<MinimumHold | null> {
  const { responses: n } = await responseCountForAssessment(ctx as Ctx, aid);
  const min = participantReportMinimum(ctx.env);
  if (n >= min) return null;
  return { responses_in: n, responses_needed: min,
    reason: `${n} response${n === 1 ? "" : "s"} so far; at least ${min} ${min === 1 ? "is" : "are"} needed before any score is shown. Scores are held until then.` };
}

/** D7 is held. A typed success state is the only safe disclosure, including to owners. */
export const summary: Handler = async (ctx, params) => {
  const aid = reqStr(params, "aid");
  const assessment = await ctx.db.prepare("SELECT id, stage FROM assessment WHERE id = ?")
    .bind(aid).first<{ id: string; stage: string }>();
  if (!assessment) throw notVisible("assessment");
  gate(await roleAt(ctx, "assessment", aid), "viewer", "assessment");
  // S15c: demographic breakdowns (age range, gender) exist only when the facilitator turned demographics on.
  const { results } = await ctx.db.prepare("SELECT context_json FROM assessment_survey WHERE assessment_id = ? AND state = 'selected'")
    .bind(aid).all<{ context_json?: string }>().catch(() => ({ results: [] as { context_json?: string }[] }));
  const low = await minimumHold(ctx, aid);
  return { result: {
    ...demographicsProjection((results || []).some((r) => demographicsEnabled(r.context_json))),
    assessment_id: aid,
    suppressed: true,
    status: "held",
    reason: "D7 scoring, threshold, and differencing policy unresolved",
    summary: null,
    snapshot_version: null,
    algorithm_version: null,
    policy_version: "D7-held",
    // One additive field: the per-perspective level minimum clients band with (report-admission.ts; DEV 1, otherwise 3).
    level_minimum_responses: perspectiveLevelMinimum(ctx.env),
    ...(low ?? {}),
  }, scope: { type: "assessment", id: aid } };
};

export const handlers: Record<string, Handler> = { "cap.results.summary": summary };
