import type { Handler } from "./types";
import { notVisible } from "./errors";
import { gate, reqStr, roleAt } from "./common";

/** D7 is held. A typed success state is the only safe disclosure, including to owners. */
export const summary: Handler = async (ctx, params) => {
  const aid = reqStr(params, "aid");
  const assessment = await ctx.db.prepare("SELECT id, stage FROM assessment WHERE id = ?")
    .bind(aid).first<{ id: string; stage: string }>();
  if (!assessment) throw notVisible("assessment");
  gate(await roleAt(ctx, "assessment", aid), "viewer", "assessment");
  return { result: {
    assessment_id: aid,
    suppressed: true,
    status: "held",
    reason: "D7 scoring, threshold, and differencing policy unresolved",
    summary: null,
    snapshot_version: null,
    algorithm_version: null,
    policy_version: "D7-held",
  }, scope: { type: "assessment", id: aid } };
};

export const handlers: Record<string, Handler> = { "cap.results.summary": summary };
