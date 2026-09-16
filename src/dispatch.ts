/** One execute() for HTTP twins and MCP tools. Lane A may extend receipts/handlers; the flow here is the contract (18-D MCP-REQ-002…006, 010, 012). */
import type { Ctx, Handler } from "./handlers/types";
import { CapError, id, sha256 } from "./handlers/types";
import { byId, toolForClass } from "./registry";
import { authorize } from "./policy";
import { ok, fail, statusFor, type Receipt } from "./envelope";
import { handlers } from "./handlers/index";

const CONFIRM_TTL_MS = 300_000; // inherited from 05 sketch — 18-C decides

export async function execute(ctx: Ctx, capability: string, params: Record<string, any>, viaTool: string, mode?: string, confirmToken?: string): Promise<{ status: number; body: any }> {
  const t = ctx.traceId;
  const cap = byId.get(capability);
  if (!cap) return { status: 400, body: fail("INVALID_PARAMS", `unknown capability ${capability}`, "call docs with no arguments for the index", "docs", t) };
  const want = toolForClass(cap.class);
  if (viaTool !== "http" && viaTool !== want) return { status: 400, body: fail("WRONG_TOOL_FOR_CLASS", `${capability} is ${cap.class}`, `use the ${want} tool`, capability, t) };
  if (cap.slice === "v2.1-oct") return { status: 501, body: fail("RESERVED_NOT_BUILT", `${capability} is planned for v2.1-oct`, "not built yet — see docs", capability, t) };
  const h: Handler | undefined = (handlers as Record<string, Handler>)[capability];
  if (!h) return { status: 501, body: fail("RESERVED_NOT_BUILT", `${capability} not built yet (phase 0)`, "target v2.0-bcs; lane ticket open", capability, t) };
  try {
    await authorize(ctx, cap, params);
    const isDanger = cap.tool === "danger";
    // 04: for cap.auth.request_link the sign-in submit IS the intent-bound confirm — one step, no token.
    const implicitConfirm = capability === "cap.auth.request_link" && !mode;
    if (isDanger && !implicitConfirm) {
      if (mode !== "dry_run" && mode !== "execute") throw new CapError("INVALID_PARAMS", "mode must be dry_run or execute", "danger rows are two-step", capability);
      if (mode === "dry_run") {
        const r = await h(ctx, params, { dryRun: true });
        const token = `cf_${crypto.randomUUID().replace(/-/g, "")}`;
        await ctx.db.prepare("INSERT INTO confirm_token (token_hash, capability, params_hash, actor, expires_at) VALUES (?,?,?,?,?)")
          .bind(await sha256(token), capability, await sha256(JSON.stringify(params)), ctx.principal.id, new Date(Date.now() + CONFIRM_TTL_MS).toISOString()).run();
        return { status: 200, body: ok(capability, { impact: r.impact ?? { affected: [], irreversible: true, effect: cap.danger?.effect ?? "destructive" }, confirm_token: token, expires_in: CONFIRM_TTL_MS / 1000 }, t) };
      }
      if (!confirmToken) throw new CapError("CONFIRM_REQUIRED", "execute needs a confirm_token from dry_run", "call with mode:'dry_run' first", capability);
      const row = await ctx.db.prepare("SELECT capability, params_hash, actor, expires_at, used_at FROM confirm_token WHERE token_hash = ?").bind(await sha256(confirmToken)).first<any>();
      const ph = await sha256(JSON.stringify(params));
      if (!row || row.used_at || row.expires_at < new Date().toISOString() || row.capability !== capability || row.params_hash !== ph || row.actor !== ctx.principal.id)
        throw new CapError("CONFIRM_EXPIRED", "confirm_token expired or does not match this intent", "run dry_run again", capability);
      await ctx.db.prepare("UPDATE confirm_token SET used_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), await sha256(confirmToken)).run();
    }
    const r = await h(ctx, params);
    if (cap.class === "read") return { status: 200, body: ok(capability, r.result, t) };
    const receipt: Receipt = {
      id: id("rcpt"), actor: ctx.principal.id, scope: r.scope ?? { type: "platform", id: "-" }, class: cap.class,
      inverse: cap.inverse.kind === "true" ? (cap.inverse.via ?? "none") : "none", trace_id: t, at: ctx.now().toISOString(),
      ...(cap.inverse.kind === "true" ? { undo_token: `undo_${crypto.randomUUID().replace(/-/g, "")}` } : {}),
      ...(cap.inverse.compensating_control ? { compensating_control: cap.inverse.compensating_control } : {}),
    };
    await ctx.db.prepare("INSERT INTO receipt (id, actor, capability, scope_type, scope_id, class, inverse, undo_token, trace_id, prior_state_json, params_json, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(receipt.id, receipt.actor, capability, receipt.scope.type, receipt.scope.id, receipt.class, receipt.inverse, receipt.undo_token ?? null, t, r.priorState ? JSON.stringify(r.priorState) : null, JSON.stringify(params), ctx.now().toISOString()).run();
    return { status: cap.http.method === "POST" && /create|issue|select|invite|submit|accept/.test(capability) ? 201 : 200, body: ok(capability, r.result, t, receipt) };
  } catch (e: any) {
    if (e instanceof CapError) return { status: statusFor(e.code), body: fail(e.code, e.message, e.hint, e.docs ?? capability, t) };
    ctx.log("error", { message: String(e?.message ?? e) });
    return { status: 500, body: fail("INVALID_PARAMS", "internal error", "see trace", capability, t) };
  }
}
