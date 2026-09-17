import { fail, ok } from "./envelope";
import type { Ctx, ScopeType } from "./handlers/types";
import { CapError } from "./handlers/types";
import { CapError as HandlerCapError } from "./handlers/errors";
import { handlers } from "./handlers";
import { authorize, targetScope } from "./policy";
import { byId, sourceSha, toolForClass, type Tool } from "./registry";
import { enforceCapabilityLimit } from "./ratelimit";
import { checkConfirmToken, mintConfirmToken, mintReceipt, paramsHash, persistTrace, type Span } from "./receipt";

export interface ExecuteOptions {
  tool?: Tool | "docs";
  mode?: "dry_run" | "execute";
  confirm_token?: string;
  transport?: "http" | "mcp";
}

export type ExecuteEnvelope = ReturnType<typeof ok> | ReturnType<typeof fail>;

const reserved = (id: string, traceId: string) =>
  fail("RESERVED_NOT_BUILT", "not built yet (phase 0)", "This capability is documented but unavailable in phase 0.", id, traceId);

/** The single execution path for HTTP and MCP. No transport-specific authorization or handler calls. */
export async function execute(
  ctx: Ctx,
  capabilityId: string,
  params: Record<string, unknown>,
  options: ExecuteOptions = {},
): Promise<ExecuteEnvelope> {
  const spans: Span[] = [];
  const log = ctx.log;
  ctx.log = (span, data) => {
    spans.push({ span, t: ctx.now().getTime(), data });
    log(span, data);
  };
  let outcome: ExecuteEnvelope | undefined;
  try {
    if (!params || typeof params !== "object" || Array.isArray(params))
      throw new CapError("INVALID_PARAMS", "params must be an object");
    const cap = byId.get(capabilityId);
    if (!cap) throw new CapError("INVALID_PARAMS", "unknown capability", "See the capabilities registry.");
    const expectedTool = toolForClass(cap.class);
    if (options.tool && options.tool !== expectedTool)
      throw new CapError("WRONG_TOOL_FOR_CLASS", `${capabilityId} requires the ${expectedTool} tool`, `Use ${expectedTool}.`, capabilityId);
    if (cap.slice === "v2.1-oct" || !handlers[capabilityId]) return (outcome = reserved(capabilityId, ctx.traceId));
    await enforceCapabilityLimit(ctx, capabilityId, params); // both faces; before authorize and before the handler touches storage
    await authorize(ctx, cap, params);

    const danger = expectedTool === "danger";
    const mode = danger ? options.mode : undefined;
    // 04 §A: for cap.auth.request_link the sign-in submit IS the intent-bound confirm — one step, no token (Lane B fold).
    const implicitConfirm = capabilityId === "cap.auth.request_link" && !options.mode;
    if (danger && !implicitConfirm && mode !== "dry_run" && mode !== "execute")
      throw new CapError("INVALID_PARAMS", "danger requires mode dry_run or execute", "Start with dry_run.", capabilityId);
    if (!danger && options.mode) throw new CapError("INVALID_PARAMS", "mode applies only to danger capabilities", undefined, capabilityId);

    const scope = targetScope(cap, params as Record<string, any>) ?? { type: "platform" as ScopeType, id: "global" };
    const intent = danger ? {
      capability: capabilityId,
      params_hash: await paramsHash(params),
      actor: ctx.principal.id,
      scope: `${scope.type}:${scope.id}`,
      revision: sourceSha,
    } : undefined;
    if (danger && mode === "execute") {
      if (!options.confirm_token) throw new CapError("CONFIRM_REQUIRED", "confirmation token required", "Call dry_run with the same params first.", capabilityId);
      const check = await checkConfirmToken(ctx.env.SESSION_SECRET, options.confirm_token, intent!, ctx.now());
      if (check !== "ok") throw new CapError(check === "expired" ? "CONFIRM_EXPIRED" : "CONFIRM_REQUIRED", "confirmation expired or does not match this intent", "Call dry_run again.", capabilityId);
    }

    const handled = await handlers[capabilityId](ctx, params, danger ? { dryRun: mode === "dry_run" } : undefined);
    if (danger && mode === "dry_run") {
      if (!handled.impact) throw new Error(`dry_run missing impact: ${capabilityId}`);
      const { token, expires_in } = await mintConfirmToken(ctx.env.SESSION_SECRET, intent!, ctx.now());
      return (outcome = ok(capabilityId, { ...handled.result, impact: handled.impact, confirm_token: token, expires_in }, ctx.traceId));
    }
    const receipt = cap.class === "read" ? undefined : await mintReceipt(ctx, {
      cap,
      scope: handled.scope ?? scope,
      priorState: handled.priorState,
      params,
      result: handled.result,
      mode,
      confirmToken: options.confirm_token,
    });
    return (outcome = ok(capabilityId, handled.result, ctx.traceId, receipt));
  } catch (e) {
    if (!(e instanceof CapError || e instanceof HandlerCapError)) throw e;
    return (outcome = fail(e.code, e.message, e.hint, e instanceof CapError ? e.docs : undefined, ctx.traceId));
  } finally {
    ctx.log = log;
    // A refused flood must not become a storage flood: rate-limited calls are not written to the trace table.
    if (outcome && !outcome.ok && outcome.error.code === "RATE_LIMITED") console.warn("ratelimit.refused", capabilityId, ctx.traceId);
    else await persistTrace(ctx, spans, {
      capability: capabilityId,
      transport: options.transport ?? "http",
      tool: options.tool,
      ok: outcome?.ok ?? false,
      ...(!outcome?.ok && outcome ? { code: outcome.error.code } : {}),
      // which app acted for the user (OAuth connector or delegated session) — every receipt links here by trace_id
      ...(ctx.principal.delegatedBy ? { delegated_by: ctx.principal.delegatedBy } : {}),
    });
  }
}
