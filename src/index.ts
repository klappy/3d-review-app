/** Worker entry. HTTP twins generated from the registry + POST /mcp. Both call execute(). Lane A owns the domain handlers; this file is shared. */
import { Hono } from "hono";
import type { Ctx, Env } from "./handlers/types";
import { capabilities } from "./registry";
import { execute } from "./dispatch";
import { handleMcp } from "./mcp";
import { docs } from "./handlers/docs";
import { resolvePrincipal } from "./auth";
import { ok, fail } from "./envelope";
import openapiText from "../contract/openapi.yaml";

const app = new Hono<{ Bindings: Env }>();

async function mkCtx(req: Request, env: Env): Promise<Ctx & { spans: any[] }> {
  const spans: any[] = [];
  const t0 = Date.now();
  const principal = await resolvePrincipal(req, env);
  spans.push({ span: "auth", ms: Date.now() - t0, kind: principal.kind });
  return { env, db: env.DB, principal, traceId: `tr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, now: () => new Date(),
    log: (span, data) => spans.push({ span, at: Date.now() - t0, ...(data ?? {}) }), spans };
}
async function persistTrace(ctx: Ctx & { spans: any[] }, cf: { waitUntil: (p: Promise<any>) => void }) {
  cf.waitUntil(ctx.db.prepare("INSERT OR IGNORE INTO trace (trace_id, actor, spans_json, at) VALUES (?,?,?,?)").bind(ctx.traceId, ctx.principal.id, JSON.stringify(ctx.spans), new Date().toISOString()).run().catch(() => {}));
}

app.get("/v2/openapi.yaml", (c) => c.text(openapiText as unknown as string, 200, { "content-type": "application/yaml" }));

app.post("/mcp", async (c) => {
  const ctx = await mkCtx(c.req.raw, c.env);
  const res = await handleMcp(c.req.raw, ctx, execute, async (cx, a) => { try { const r = await docs(cx, a); return ok("cap.docs.get", r.result, cx.traceId); } catch (e: any) { return fail(e.code ?? "INVALID_PARAMS", e.message, e.hint, "cap.docs.get", cx.traceId); } });
  await persistTrace(ctx, c.executionCtx as any);
  return res;
});

// HTTP twins from the registry. Danger twins are never GET (contract guarantees it).
for (const cap of capabilities) {
  const path = cap.http.path.replace(/\{(\w+)\}/g, ":$1").replace("@:ver", "@:ver");
  const method = cap.http.method.toLowerCase() as "get" | "post" | "patch" | "delete";
  app[method](path, async (c) => {
    const ctx = await mkCtx(c.req.raw, c.env);
    let body: any = {};
    if (method !== "get") { try { body = await c.req.json(); } catch { body = {}; } }
    const { mode: _m, confirm_token: _c, ...bodyParams } = body.params ?? body;
    const params: Record<string, any> = { ...c.req.query(), ...c.req.param(), ...bodyParams };
    if (cap.id === "cap.auth.logout") params.__token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.header("cookie")?.match(/session=([^;]+)/)?.[1];
    const r = await execute(ctx, cap.id, params, "http", body.mode, body.confirm_token);
    await persistTrace(ctx, c.executionCtx as any);
    const headers: Record<string, string> = { "x-trace-id": ctx.traceId };
    if (cap.id === "cap.auth.consume_link" && r.body.ok) headers["set-cookie"] = `session=${r.body.result.session}; HttpOnly; Path=/; SameSite=Lax`;
    if (cap.id === "cap.auth.logout") headers["set-cookie"] = "session=; Max-Age=0; Path=/";
    return c.json(r.body, r.status as any, headers);
  });
}

app.notFound((c) => c.json(fail("NOT_FOUND_OR_NOT_VISIBLE", "no such route", "GET /v2/capabilities.json lists every route", "cap.docs.capabilities"), 404));
export default app;
