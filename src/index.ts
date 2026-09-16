import { Hono } from "hono";
import { resolvePrincipal } from "./auth";
import { execute } from "./dispatch";
import { fail, statusFor } from "./envelope";
import type { Ctx, Env } from "./handlers/types";
import { CapError } from "./handlers/types";
import { capabilities } from "./registry";
import { newTraceId } from "./receipt";

const app = new Hono<{ Bindings: Env }>();
const json = (value: unknown, status: number) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json; charset=utf-8" },
});

export async function contextForRequest(req: Request, env: Env): Promise<Ctx> {
  return {
    env, db: env.DB, principal: await resolvePrincipal(req, env),
    traceId: newTraceId(), now: () => new Date(), log: () => {},
  };
}

for (const cap of capabilities) {
  if (cap.tool === "danger" && cap.http.method.toUpperCase() === "GET")
    throw new Error(`danger twin cannot be GET: ${cap.id}`);
  const path = cap.http.path.replace(/\{([^}]+)\}/g, ":$1");
  app.on(cap.http.method.toUpperCase(), path, async (c) => {
    const ctx = await contextForRequest(c.req.raw, c.env);
    try {
      let body: Record<string, unknown> = {};
      if (!["GET", "HEAD"].includes(c.req.method)) {
        try {
          const raw = await c.req.text();
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body is not an object");
            body = parsed as Record<string, unknown>;
          }
        } catch {
          return json(fail("INVALID_PARAMS", "JSON object body required", undefined, cap.id, ctx.traceId), 400);
        }
      }
      const params: Record<string, unknown> = {
        ...(c.req.method === "GET" ? Object.fromEntries(new URL(c.req.url).searchParams) : {}),
        ...(body.params && typeof body.params === "object" && !Array.isArray(body.params) ? body.params as Record<string, unknown> : body),
        ...c.req.param(),
      };
      if (cap.tool === "danger" && !body.params) {
        delete params.mode;
        delete params.confirm_token;
      }
      const result = await execute(ctx, cap.id, params, {
        tool: cap.tool,
        mode: cap.tool === "danger" ? body.mode as "dry_run" | "execute" : undefined,
        confirm_token: cap.tool === "danger" ? body.confirm_token as string | undefined : undefined,
        transport: "http",
      });
      return json(result, result.ok ? 200 : statusFor(result.error.code));
    } catch (e) {
      if (e instanceof CapError) return json(fail(e.code, e.message, e.hint, e.docs, ctx.traceId), statusFor(e.code));
      console.error("http.execute.failed", ctx.traceId, String(e));
      return json(fail("INVALID_PARAMS", "request could not be completed", undefined, cap.id, ctx.traceId), 500);
    }
  });
}

// MCP is mounted with Lane B-1's adapter; both transports call execute().
export default app;
