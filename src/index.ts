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
import { verifyAccessJwt } from "./access";
import synthResponsesSql from "../seed/synthetic-responses.sql";
import { mintSession } from "./auth";
import { sha256 } from "./handlers/common";
import { allow, clientIp, MCP_MAX_BATCH, RATE_LIMIT_WINDOW_SECONDS } from "./ratelimit";

const app = new Hono<{ Bindings: Env }>();
const json = (value: unknown, status: number) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json; charset=utf-8" },
});

export async function contextForRequest(req: Request, env: Env): Promise<Ctx> {
  return {
    env, db: env.DB, principal: await resolvePrincipal(req, env), clientIp: clientIp(req),
    traceId: newTraceId(), now: () => new Date(), log: () => {},
  };
}

for (const cap of capabilities) {
  if (cap.tool === "danger" && cap.http.method.toUpperCase() === "GET")
    throw new Error(`danger twin cannot be GET: ${cap.id}`);
  // Hono cannot split two parameters in one path segment (`{id}@{ver}`).
  const path = cap.http.path.replace("{id}@{ver}", ":idVersion").replace(/\{([^}]+)\}/g, ":$1");
  app.on(cap.http.method.toUpperCase(), path, async (c) => {
    const ctx = await contextForRequest(c.req.raw, c.env);
    // Anonymous HTTP traffic on EVERY twin is dampened per address (auditor 5707673911 #2: ~75 twins wrote a trace row
    // per anonymous request with no limit). Spent after credential resolution and before the body is parsed; a refusal
    // returns the contract error and writes nothing. Credential holders are not counted here. Mirrors /mcp below.
    if (ctx.principal.kind === "anonymous" && !(await allow(c.env, "RL_HTTP_ANON", `ip:${ctx.clientIp}`))) {
      const res = json(fail("RATE_LIMITED", `too many anonymous requests — sign in, or wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds`, `wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds and try again`, cap.id, ctx.traceId, { retry_after: RATE_LIMIT_WINDOW_SECONDS }), 429);
      res.headers.set("retry-after", String(RATE_LIMIT_WINDOW_SECONDS));
      return res;
    }
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
      const routeParams: Record<string, string> = c.req.param();
      if (typeof routeParams.idVersion === "string") {
        const separator = routeParams.idVersion.lastIndexOf("@");
        if (separator < 1 || separator === routeParams.idVersion.length - 1)
          return json(fail("INVALID_PARAMS", "template id@version required", undefined, cap.id, ctx.traceId), 400);
        routeParams.id = routeParams.idVersion.slice(0, separator);
        routeParams.ver = routeParams.idVersion.slice(separator + 1);
        delete routeParams.idVersion;
      }
      const params: Record<string, unknown> = {
        ...(c.req.method === "GET" ? Object.fromEntries(new URL(c.req.url).searchParams) : {}),
        ...(body.params && typeof body.params === "object" && !Array.isArray(body.params) ? body.params as Record<string, unknown> : body),
        ...routeParams,
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
      const res = json(result, result.ok ? 200 : statusFor(result.error.code));
      if (!result.ok && result.error.code === "RATE_LIMITED") res.headers.set("retry-after", String(RATE_LIMIT_WINDOW_SECONDS));
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
  // Anonymous MCP traffic (initialize, tools/list, docs, public reads) is dampened per address. Signed-in callers are
  // not counted here; the capability limiters in execute() still apply to them. A JSON-RPC batch spends one unit PER
  // MESSAGE (Bugbot 9ea1c79e: one POST must not buy many calls), and no caller may batch more than MCP_MAX_BATCH.
  const rpcError = (status: number, code: number, message: string, data?: Record<string, unknown>, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message, ...(data ? { data } : {}) } }), { status, headers: { "content-type": "application/json", ...headers } });
  let units = 1;
  try { const peek: unknown = await c.req.raw.clone().json(); if (Array.isArray(peek)) units = Math.max(1, peek.length); } catch { /* handleMcp answers the parse error */ }
  if (units > MCP_MAX_BATCH) return rpcError(400, -32600, `batch too large: at most ${MCP_MAX_BATCH} messages per request`);
  if (ctx.principal.kind === "anonymous") for (let i = 0; i < units; i++)
    if (!(await allow(c.env, "RL_MCP_ANON", `ip:${ctx.clientIp}`)))
      return rpcError(429, -32029, `rate limited — sign in, or wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds`, { code: "RATE_LIMITED", retry_after: RATE_LIMIT_WINDOW_SECONDS, trace_id: ctx.traceId }, { "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) });
  return handleMcp(c.req.raw, ctx, execute as any, async (cx, a) => {
    try { const r = await docs(cx, a); return ok("cap.docs.get", r.result, cx.traceId); }
    catch (e: any) { return fail(e.code ?? "INVALID_PARAMS", e.message, e.hint, "cap.docs.get", cx.traceId); }
  });
});
// Cloudflare email-code sign-in (OF-7). Transport route, not a capability: the browser is sent here by Cloudflare
// Access after proving its email by one-time PIN; we verify the Access JWT, mint our session, and return to the UI.
// Agents never use it (they hold a delegated bearer); the MCP surface is unchanged.
app.get("/v2/auth/access", async (c) => {
  const env = c.env;
  try {
    const id = await verifyAccessJwt(env, c.req.header("cf-access-jwt-assertion") ?? undefined);
    const eh = await sha256(id.email);
    await env.DB.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
      .bind(`usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, eh, 0, 0, new Date().toISOString()).run();
    const pr = await env.DB.prepare("SELECT id, support FROM principal WHERE email_hash = ?").bind(eh).first<{ id: string; support: number }>();
    if (!pr) throw new CapError("NOT_AUTHENTICATED", "principal could not be established");
    const token = await mintSession(env, pr.id, pr.support ? "support" : "user", { via: "cloudflare-access", sub: id.sub });
    const headers = new Headers({ location: `/#session=${token}` });
    headers.append("set-cookie", `session=${token}; HttpOnly; Path=/; SameSite=Lax; Secure`);
    return new Response(null, { status: 302, headers });
  } catch (e: any) {
    const code = e instanceof CapError ? e.code : "NOT_AUTHENTICATED";
    return json(fail(code, e.message ?? "sign-in failed", e.hint, "cap.auth.consume_link", newTraceId()), statusFor(code));
  }
});
// DEV BOOTSTRAP — explicitly OUTSIDE capability parity (Astra 5706308285): loads the committed synthetic answer sets
// (seed/synthetic-responses.sql, Steve Watters' persona generator @ f042cde) into this environment's D1. Not a
// capability, not on MCP, mints no receipt, refused outside dev, requires a signed-in user, INSERT OR IGNORE → idempotent.
// It is labelled "dev.bootstrap.seed_synthetic" so it can never be mistaken for cap.ops.health or counted as parity.
app.post("/v2/ops/seed/synthetic", async (c) => {
  const env = c.env;
  // Fail CLOSED (Astra 5706439170): only an explicit ENVIRONMENT="dev" is dev. A missing variable is not dev.
  if (env.ENVIRONMENT !== "dev") return json(fail("NOT_AUTHORIZED_AT_SCOPE", "synthetic seed loads only in the dev sandbox", undefined, "dev.bootstrap.seed_synthetic", newTraceId()), 403);
  const ctx = await contextForRequest(c.req.raw, env);
  if (ctx.principal.kind !== "user" && ctx.principal.kind !== "support") return json(fail("NOT_AUTHENTICATED", "sign in first", undefined, "dev.bootstrap.seed_synthetic", ctx.traceId), 401);
  const stmts = (synthResponsesSql as unknown as string).split("\n").filter((l) => !l.startsWith("--")).join("\n").split(";\n").map((s) => s.trim()).filter(Boolean);
  let applied = 0;
  for (let i = 0; i < stmts.length; i += 50) { await env.DB.batch(stmts.slice(i, i + 50).map((s) => env.DB.prepare(s))); applied += Math.min(50, stmts.length - i); }
  const n = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM response WHERE source='synthetic') AS responses, (SELECT COUNT(*) FROM assessment WHERE id LIKE 'assess_syn_%') AS assessments, (SELECT COUNT(*) FROM project WHERE id LIKE 'proj_syn_%') AS projects").first();
  return json(ok("dev.bootstrap.seed_synthetic", { seeded: true, statements: applied, ...(n as object) }, ctx.traceId), 200);
});
app.get("/v2/openapi.yaml", (c) => c.text(openapiText as unknown as string, 200, { "content-type": "application/yaml" }));
app.notFound((c) => json(fail("NOT_FOUND_OR_NOT_VISIBLE", "no such route", "GET /v2/capabilities.json lists every route", "cap.docs.capabilities"), 404));
export default app;
