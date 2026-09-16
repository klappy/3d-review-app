/** cap.ops.undo — reverses ONLY rows with a declared true inverse, by invoking the inverse under the same grant. Not a generic undo. */
import type { Handler } from "./types";
import { CapError, notVisible } from "./types";
import { byId } from "../registry";
import { handlers } from "./index";

export const opsUndo: Handler = async (ctx, p) => {
  const row = await ctx.db.prepare("SELECT id, actor, capability, scope_type, scope_id, prior_state_json, params_json, undone_at FROM receipt WHERE undo_token = ?").bind(p.token).first<any>();
  if (!row || (row.actor !== ctx.principal.id && ctx.principal.kind !== "support")) throw notVisible();
  if (row.undone_at) throw new CapError("INVALID_PARAMS", "already undone");
  const cap = byId.get(row.capability)!;
  if (cap.inverse.kind !== "true") throw new CapError("NO_INVERSE", `${row.capability} has no true inverse`, cap.inverse.compensating_control ?? "see 17-IRREVERSIBILITY", row.capability);
  const via = cap.inverse.via!;
  const params = JSON.parse(row.params_json ?? "{}");
  let r;
  if (via.startsWith("self:")) {
    const h = handlers[row.capability]; if (!h) throw new CapError("NO_INVERSE", "inverse handler missing");
    const prior = row.prior_state_json ? JSON.parse(row.prior_state_json) : {};
    const keep: Record<string, any> = {}; for (const k of ["id", "pid", "aid", "sid", "scope"]) if (params[k] !== undefined) keep[k] = params[k];
    r = await h(ctx, { ...keep, ...prior });
  } else {
    const h = handlers[via]; if (!h) throw new CapError("NO_INVERSE", `inverse ${via} not built yet`, "phase 0", via);
    r = await h(ctx, params);
  }
  await ctx.db.prepare("UPDATE receipt SET undone_at = ? WHERE id = ?").bind(new Date().toISOString(), row.id).run();
  return { result: { undone: row.capability, via, ...r.result }, scope: { type: row.scope_type, id: row.scope_id } };
};
