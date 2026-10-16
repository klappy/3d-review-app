/**
 * Shared-IP room (DEV burst 2026-10-16: 200 cap.participant.open_link from one address, 142 refused by RL_HTTP_ANON
 * before RL_REDEEM was consulted; over /mcp RL_MCP_ANON charged the same call first). A twin or MCP tools/call whose capability has its own limiter (RL_REDEEM, RL_AUTH) is counted once,
 * by that limiter; every other anonymous twin still spends RL_HTTP_ANON exactly as before. Limiters are counting
 * fakes: the test proves WIRING (which bucket each call spends), not Cloudflare's counting.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "anon-rl", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "anon-rl" } }] }));
afterAll(() => mf.dispose());
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
const ROOM_IP = "203.0.113.200";
const base = "/v2/assessments/assess_tavo_collect/surveys/survey_tavo/links";
let db: D1Database, token: string;
const mkEnv = (over: Record<string, unknown> = {}) => ({ DB: db, SESSION_SECRET: "synthetic-anon-rl", ENVIRONMENT: "dev",
  RL_MCP_ANON: limiter(1000), RL_MCP_CEILING: limiter(1000), RL_HTTP_ANON: limiter(60), RL_AUTH: limiter(1000), RL_REDEEM: limiter(1000), ...over }) as any;
const rpc = (method: string, params?: unknown, id = 1) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const openRpc = (id = 1) => rpc("tools/call", { name: "write", arguments: { capability: "cap.participant.open_link", params: { token } } }, id);
const call = (env: any, method: string, path: string, body?: unknown, bearer?: string, ip = ROOM_IP) => app.fetch(new Request("https://t.invalid" + path, { method,
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body) }), env);

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  // One real shared survey link, issued by the owner (dry run → execute), as the summit room would scan it.
  const env = mkEnv(), owner = await mintSession(env, "person_mara", "user");
  const dry: any = await (await call(env, "POST", base, { params: {}, mode: "dry_run" }, owner)).json(); expect(dry.ok).toBe(true);
  const run: any = await (await call(env, "POST", base, { params: {}, mode: "execute", confirm_token: dry.result.confirm_token }, owner)).json(); expect(run.ok).toBe(true);
  token = run.result.link_token;
}, 60_000);

describe("anonymous twins with their own capability limiter skip RL_HTTP_ANON", () => {
  it("a 200-open burst on one link from one address is limited only by RL_REDEEM: none refused when RL_REDEEM allows it", async () => {
    const env = mkEnv({ RL_REDEEM: limiter(300) });
    const statuses: number[] = [];
    for (let i = 0; i < 200; i += 20)
      statuses.push(...(await Promise.all(Array.from({ length: 20 }, () => call(env, "POST", "/v2/participate/link", { token }).then((r) => r.status)))));
    expect(statuses.filter((s) => s === 429).length).toBe(0);
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(200); // each open counted once, by RL_REDEEM
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0); // the generic dampener was never touched
  }, 120_000);

  it("when RL_REDEEM is exhausted the open is refused by RL_REDEEM (capability error), never by RL_HTTP_ANON", async () => {
    const env = mkEnv({ RL_REDEEM: limiter(3) });
    for (let i = 0; i < 3; i++) expect((await call(env, "POST", "/v2/participate/link", { token })).status).toBe(200);
    const r = await call(env, "POST", "/v2/participate/link", { token });
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json();
    expect(j.error.code).toBe("RATE_LIMITED");
    expect(j.error.message).toBe("rate limit reached — try again in 60 seconds"); // RL_REDEEM's refusal, not "too many anonymous requests"
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(4);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0);
  }, 30_000);

  it("redeem_code and the two sign-in twins spend only their own keys (RL_REDEEM ip: / sign-in au:), never the generic ip: bucket", async () => {
    // a generic bucket that refuses every `ip:` key; the sign-in address key `au:` shares the binding (KEY_ROUTE, #488)
    const seen = new Map<string, number>();
    const env = mkEnv({ RL_HTTP_ANON: { seen, limit: async ({ key }: { key: string }) => { seen.set(key, (seen.get(key) ?? 0) + 1); return { success: !key.startsWith("ip:") }; } } });
    expect((await call(env, "POST", "/v2/participate/code", { code: "NOPE-0001" })).status).toBe(404);
    expect((await call(env, "POST", "/v2/auth/link", { email: "room.member@example.invalid" })).status).toBe(200);
    expect((await call(env, "POST", "/v2/auth/session", { email: "room.member@example.invalid", code: "000000" })).status).toBe(400);
    expect(seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0);
    expect(seen.get(`au:${ROOM_IP}`)).toBe(2);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(1);
    expect([...env.RL_AUTH.seen.keys()].every((k: string) => k.startsWith("em:"))).toBe(true);
  }, 30_000);

  it("every other anonymous twin still spends RL_HTTP_ANON per address and is refused at the limit, as before", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(3) });
    for (let i = 0; i < 3; i++) expect((await call(env, "GET", "/v2/health")).status).toBe(200);
    const r = await call(env, "GET", "/v2/health");
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json();
    expect(j.error.code).toBe("RATE_LIMITED");
    expect(j.error.message).toMatch(/^too many anonymous requests/);
    // a protected twin called anonymously spends the same bucket (refused before the 401)
    expect((await call(env, "POST", base, { params: {}, mode: "dry_run" })).status).toBe(429);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(5);
    // the open_link twin from the same exhausted address is still served (its own budget)
    expect((await call(env, "POST", "/v2/participate/link", { token })).status).toBe(200);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(5);
    // a credential holder is not counted, as before
    const bearer = await mintSession(env, "person_mara", "user");
    expect((await call(env, "GET", "/v2/health", undefined, bearer)).status).toBe(200);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(5);
  }, 30_000);

  it("over /mcp, a 200-open burst is limited only by RL_REDEEM: RL_MCP_ANON is never charged for open_link", async () => {
    const env = mkEnv({ RL_MCP_ANON: limiter(30), RL_REDEEM: limiter(300) });
    let refused = 0, opened = 0;
    for (let i = 0; i < 200; i += 20) for (const r of await Promise.all(Array.from({ length: 20 }, () => call(env, "POST", "/mcp", openRpc())))) {
      const j: any = await r.json();
      if (r.status === 429 || j.result?.structuredContent?.error?.code === "RATE_LIMITED") refused++;
      else if (j.result?.structuredContent?.ok) opened++;
    }
    expect(refused).toBe(0); expect(opened).toBe(200);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(200);
    expect(env.RL_MCP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0);
    // RL_REDEEM exhausted → the capability's own refusal, never the transport's -32029
    const tight = mkEnv({ RL_MCP_ANON: limiter(30), RL_REDEEM: limiter(1) });
    expect(((await (await call(tight, "POST", "/mcp", openRpc())).json()) as any).result.structuredContent.ok).toBe(true);
    const r = await call(tight, "POST", "/mcp", openRpc()); expect(r.status).toBe(200);
    expect(((await r.json()) as any).result.structuredContent.error.code).toBe("RATE_LIMITED");
    expect(tight.RL_MCP_ANON.seen.size).toBe(0);
  }, 120_000);

  it("every other anonymous /mcp message still spends RL_MCP_ANON per message (batch included), as before", async () => {
    const env = mkEnv({ RL_MCP_ANON: limiter(3) });
    // a batch of open_link + tools/list + a docs lookup ABOUT open_link: only the two non-exempt messages are charged
    const batch = [openRpc(1), rpc("tools/list", undefined, 2), rpc("tools/call", { name: "docs", arguments: { capability: "cap.participant.open_link" } }, 3)];
    expect((await call(env, "POST", "/mcp", batch)).status).toBe(200);
    expect(env.RL_MCP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(2);
    expect((await call(env, "POST", "/mcp", rpc("tools/list"))).status).toBe(200);
    const r = await call(env, "POST", "/mcp", rpc("tools/list"));
    expect(r.status).toBe(429); expect(((await r.json()) as any).error.data.code).toBe("RATE_LIMITED");
    // another capability over /mcp is charged too
    expect((await call(env, "POST", "/mcp", rpc("tools/call", { name: "read", arguments: { capability: "cap.ops.health" } }))).status).toBe(429);
    // the exhausted address can still open its link over /mcp (its own budget)
    expect(((await (await call(env, "POST", "/mcp", openRpc())).json()) as any).result.structuredContent.ok).toBe(true);
    // the batch cap still counts every message, exempt or not
    expect((await call(env, "POST", "/mcp", Array.from({ length: 11 }, (_, i) => openRpc(i + 1)))).status).toBe(400);
  }, 30_000);

  // Bugbot 4289984346: the /mcp exemption keyed on the tools/call shape, so messages that never reach the capability
  // limiter (wrong tool, write+undo, unknown tool, invalid JSON-RPC, notification, non-object params) skipped RL_MCP_ANON.
  it("a /mcp message that names an own-limiter capability but is not routed to it still spends RL_MCP_ANON", async () => {
    const cap = "cap.participant.open_link";
    const bypasses: Record<string, unknown> = {
      "wrong tool": rpc("tools/call", { name: "read", arguments: { capability: cap, params: { token } } }),
      "write + undo": rpc("tools/call", { name: "write", arguments: { capability: cap, params: { token }, undo: "undo_nope" } }),
      "unknown tool": rpc("tools/call", { name: "bogus", arguments: { capability: cap, params: { token } } }),
      "invalid JSON-RPC": { jsonrpc: "1.0", id: 1, method: "tools/call", params: { name: "write", arguments: { capability: cap, params: { token } } } },
      "notification": { jsonrpc: "2.0", method: "tools/call", params: { name: "write", arguments: { capability: cap, params: { token } } } },
      "non-object params": rpc("tools/call", { name: "write", arguments: { capability: cap, params: [token] } }),
    };
    for (const [label, msg] of Object.entries(bypasses)) {
      const env = mkEnv({ RL_MCP_ANON: limiter(0) });
      const r = await call(env, "POST", "/mcp", msg);
      expect([label, r.status]).toEqual([label, 429]);
      expect([label, env.RL_MCP_ANON.seen.get(`ip:${ROOM_IP}`)]).toEqual([label, 1]);
      expect([label, env.RL_REDEEM.seen.size]).toEqual([label, 0]);
    }
    // the routed open_link itself is still exempt
    const env = mkEnv({ RL_MCP_ANON: limiter(0) });
    expect(((await (await call(env, "POST", "/mcp", openRpc())).json()) as any).result.structuredContent.ok).toBe(true);
    expect(env.RL_MCP_ANON.seen.size).toBe(0);
  }, 30_000);

  // Bugbot 4289984355: an own-limiter twin whose body fails to parse returned 400 before execute(), so no limiter ran.
  it("an own-limiter twin whose body fails to parse still spends RL_HTTP_ANON", async () => {
    for (const raw of ["{not json", "[]", "\"str\""]) for (const path of ["/v2/participate/link", "/v2/participate/code", "/v2/auth/link"]) {
      const env = mkEnv({ RL_HTTP_ANON: limiter(0) });
      const r = await app.fetch(new Request("https://t.invalid" + path, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ROOM_IP }, body: raw }), env);
      expect([path, raw, r.status]).toEqual([path, raw, 429]);
      expect([path, raw, env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)]).toEqual([path, raw, 1]);
    }
    // with budget left, the parse failure is still the contract 400, charged once
    const env = mkEnv({ RL_HTTP_ANON: limiter(5) });
    const r = await app.fetch(new Request("https://t.invalid/v2/participate/link", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ROOM_IP }, body: "{not json" }), env);
    expect(r.status).toBe(400);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(1);
    expect(env.RL_REDEEM.seen.size).toBe(0);
  }, 30_000);
});
