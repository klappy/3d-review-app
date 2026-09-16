/** cap.ops.undo — reverses ONLY rows with a declared true inverse, by invoking the inverse under the same grant. Not a generic undo. */
import type { Handler } from "./types";
import { CapError, notVisible } from "./types";
import { byId } from "../registry";
import { handlers } from "./index";
import { findReceiptByUndoToken, consumeUndoToken } from "../receipt";

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
  } else {
    const h = handlers[via]; if (!h) throw new CapError("NO_INVERSE", `inverse ${via} not built yet`, "phase 0", via);
    r = await h(ctx, { ...params, ...ids });
  }
  await consumeUndoToken(ctx, row.id);
  return { result: { undone: row.capability, via, ...r.result }, scope: { type: row.scope_type, id: row.scope_id } };
};
