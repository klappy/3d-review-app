import type { Ctx, Handler } from "./types";
import { notVisible } from "./errors";
import { gate, reqStr, responseCountForAssessment, roleAt, SUPPRESSION_THRESHOLD } from "./common";
import { demographicsEnabled, demographicsProjection } from "../context-fields";

/** Below the D7 minimum (SUPPRESSION_THRESHOLD, a held working default): Results, the responses list and the report all
 * name the same numbers — the assessment's response count (the one Collect and the assessment card show) and the minimum.
 * Callers read it only after their own grant check. Null at or above the minimum: those views stay exactly as they were. */
export type MinimumHold = { responses_in: number; responses_needed: number; reason: string };
export async function minimumHold(ctx: Pick<Ctx, "db">, aid: string): Promise<MinimumHold | null> {
  const { responses: n } = await responseCountForAssessment(ctx as Ctx, aid);
  if (n >= SUPPRESSION_THRESHOLD) return null;
  return { responses_in: n, responses_needed: SUPPRESSION_THRESHOLD,
    reason: `${n} response${n === 1 ? "" : "s"} so far; at least ${SUPPRESSION_THRESHOLD} are needed before any score is shown. Scores are held until then.` };
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
    ...(low ?? {}),
  }, scope: { type: "assessment", id: aid } };
};

export const handlers: Record<string, Handler> = { "cap.results.summary": summary };
