/** cap.ops.undo — reverses ONLY rows with a declared true inverse, by invoking the inverse under the same grant. Not a generic undo. */
import type { Handler } from "./types";
import { CapError, notVisible } from "./types";
import { byId } from "../registry";
import { handlers } from "./index";
import { findReceiptByUndoToken, consumeUndoToken } from "../receipt";

/**
 * Batch inverses: a batch creator's true inverse must undo the WHOLE batch or nothing.
 * issue_codes → revoke every issued code in one D1 batch, refused if any code was already redeemed
 * (same rule as cap.survey.revoke_code: a redeemed code is a participant session, not a code).
 */
const BATCH_INVERSE: Record<string, (ctx: Parameters<Handler>[0], params: Record<string, any>, ids: string[]) => Promise<{ result: Record<string, unknown> }>> = {
  "cap.survey.issue_codes": async (ctx, params, codeIds) => {
    const sid = String(params.sid ?? "");
    if (!sid || codeIds.length === 0) throw new CapError("INVALID_PARAMS", "receipt lacks survey/code ids");
    const marks = codeIds.map(() => "?").join(",");
    const { results } = await ctx.db.prepare(`SELECT id, redeemed_at FROM access_code WHERE assessment_survey_id = ? AND id IN (${marks})`).bind(sid, ...codeIds).all<{ id: string; redeemed_at: string | null }>();
    const redeemed = results.filter(r => r.redeemed_at).map(r => r.id);
    if (redeemed.length) throw new CapError("INVALID_PARAMS", `${redeemed.length} of ${codeIds.length} codes already redeemed; batch cannot be revoked`, "revoke the unredeemed codes individually with cap.survey.revoke_code");
    const present = results.map(r => r.id);
    if (present.length) await ctx.db.batch(present.map(id => ctx.db.prepare("DELETE FROM access_code WHERE id = ? AND redeemed_at IS NULL").bind(id)));
    return { result: { revoked: present, count: present.length } };
  },
};

export const opsUndo: Handler = async (ctx, p) => {
  const row: any = await findReceiptByUndoToken(ctx, String(p.token ?? ""));
  if (!row || (row.actor !== ctx.principal.id && ctx.principal.kind !== "support")) throw notVisible();
  const cap = byId.get(row.capability)!;
  if (cap.inverse.kind !== "true") throw new CapError("NO_INVERSE", `${row.capability} has no true inverse`, cap.inverse.compensating_control ?? "see 17-IRREVERSIBILITY", row.capability);
  const blob = row.prior_state_json ? JSON.parse(row.prior_state_json) : {};
  const params: Record<string, any> = blob.params ?? {};
  const prior: Record<string, any> = blob.prior ?? {};
  const ids: Record<string, any> = blob.result_ids ?? {};
  const via = cap.inverse.via!;
  let r;
  if (via.startsWith("self:")) {
    const h = handlers[row.capability]; if (!h) throw new CapError("NO_INVERSE", "inverse handler missing");
    const keep: Record<string, any> = {}; for (const k of ["id", "pid", "aid", "sid", "scope"]) if (params[k] !== undefined) keep[k] = params[k];
    r = await h(ctx, { ...keep, ...prior });
  } else if (Array.isArray(ids.ids) && BATCH_INVERSE[row.capability]) {
    r = await BATCH_INVERSE[row.capability](ctx, params, ids.ids as string[]);
  } else {
    const h = handlers[via]; if (!h) throw new CapError("NO_INVERSE", `inverse ${via} not built yet`, "phase 0", via);
    r = await h(ctx, { ...params, ...ids });
  }
  await consumeUndoToken(ctx, row.id);
  return { result: { undone: row.capability, via, ...r.result }, scope: { type: row.scope_type, id: row.scope_id } };
};
