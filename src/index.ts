import { Hono } from "hono";
import { resolvePrincipal } from "./auth";
import { execute } from "./dispatch";
import { fail, statusFor } from "./envelope";
import type { Ctx, Env } from "./handlers/types";
import { CapError } from "./handlers/types";
import { capabilities } from "./registry";
import { newTraceId } from "./receipt";
import { handleMcp } from "./mcp";
import { docs } from "./handlers/docs";
import { ok } from "./envelope";
import openapiText from "../contract/openapi.yaml";

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
      if (cap.id === "cap.auth.logout") params.__token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.header("cookie")?.match(/session=([^;]+)/)?.[1];
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
      const res = json(result, result.ok ? 200 : statusFor(result.error.code));
      if (cap.id === "cap.auth.consume_link" && result.ok) res.headers.append("set-cookie", `session=${(result as any).result.session}; HttpOnly; Path=/; SameSite=Lax`);
      if (cap.id === "cap.auth.logout") res.headers.append("set-cookie", "session=; Max-Age=0; Path=/");
      return res;
    } catch (e) {
      if (e instanceof CapError) return json(fail(e.code, e.message, e.hint, e.docs, ctx.traceId), statusFor(e.code));
      console.error("http.execute.failed", ctx.traceId, String(e));
      return json(fail("INVALID_PARAMS", "request could not be completed", undefined, cap.id, ctx.traceId), 500);
    }
  });
}

// MCP (Lane B-1): same execute(), four tools.
app.post("/mcp", async (c) => {
  const ctx = await contextForRequest(c.req.raw, c.env);
  return handleMcp(c.req.raw, ctx, execute as any, async (cx, a) => {
    try { const r = await docs(cx, a); return ok("cap.docs.get", r.result, cx.traceId); }
    catch (e: any) { return fail(e.code ?? "INVALID_PARAMS", e.message, e.hint, "cap.docs.get", cx.traceId); }
  });
});
app.get("/v2/openapi.yaml", (c) => c.text(openapiText as unknown as string, 200, { "content-type": "application/yaml" }));
app.notFound((c) => json(fail("NOT_FOUND_OR_NOT_VISIBLE", "no such route", "GET /v2/capabilities.json lists every route", "cap.docs.capabilities"), 404));
export default app;
