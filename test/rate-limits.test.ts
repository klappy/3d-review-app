// Rate limits (captain ruling 2026-09-16 20:10 ET; src/ratelimit.ts). The Cloudflare binding is faked with a counting
// limiter so the test proves WIRING (which calls are counted, on which key, on both faces, before storage) — the
// binding's own counting is Cloudflare's to prove.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "rl", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "rl-test-db" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
let db: D1Database;
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../seed/synthetic.sql"));
}, 60_000);
const mkEnv = (over: Record<string, unknown> = {}) => ({ DB: db, SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", RL_MCP_ANON: limiter(3), RL_AUTH: limiter(2), RL_REDEEM: limiter(2), ...over }) as any;
const post = (env: any, path: string, body: unknown, ip = "203.0.113.7", bearer?: string) => app.fetch(new Request("https://t.invalid" + path, { method: "POST",
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body) }), env);
const rpc = (method: string, params?: unknown) => ({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) });
const traces = async () => (await db.prepare("SELECT COUNT(*) AS n FROM trace").first<{ n: number }>())!.n;

describe("rate limits", () => {
  it("anonymous /mcp is dampened per address with 429 + retry-after; another address and a signed-in caller are not", async () => {
    const env = mkEnv();
    for (let i = 0; i < 3; i++) expect((await post(env, "/mcp", rpc("tools/list"))).status).toBe(200);
    const r = await post(env, "/mcp", rpc("tools/list"));
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json(); expect(j.error.data.code).toBe("RATE_LIMITED");
    expect((await post(env, "/mcp", rpc("tools/list"), "198.51.100.9")).status).toBe(200);
    const bearer = await mintSession(env, "person_mara", "user");
    for (let i = 0; i < 6; i++) expect((await post(env, "/mcp", rpc("tools/list"), "203.0.113.7", bearer)).status).toBe(200);
    expect([...env.RL_MCP_ANON.seen.keys()].sort()).toEqual(["ip:198.51.100.9", "ip:203.0.113.7"]);
  }, 30_000);

  it("code redemption: HTTP and MCP share one budget; the refused call returns RATE_LIMITED and writes no trace row", async () => {
    const env = mkEnv({ RL_MCP_ANON: limiter(100) });
    const a = await post(env, "/v2/participate/code", { code: "NOPE-0001" });
    expect(a.status).toBe(404);
    const b: any = await (await post(env, "/mcp", rpc("tools/call", { name: "write", arguments: { capability: "cap.participant.redeem_code", params: { code: "NOPE-0002" } } }))).json();
    expect(b.result.structuredContent.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    const before = await traces();
    const c = await post(env, "/v2/participate/code", { code: "NOPE-0003" });
    expect(c.status).toBe(429); expect(c.headers.get("retry-after")).toBe("60");
    expect(((await c.json()) as any).error.code).toBe("RATE_LIMITED");
    const d: any = await (await post(env, "/mcp", rpc("tools/call", { name: "write", arguments: { capability: "cap.participant.redeem_code", params: { code: "NOPE-0004" } } }))).json();
    expect(d.result.structuredContent.error.code).toBe("RATE_LIMITED");
    expect(await traces()).toBe(before);
  }, 30_000);

  it("sign-in is limited per address AND per email (hashed key, never the address itself)", async () => {
    const env = mkEnv({ RL_AUTH: limiter(2) });
    const email = "demo.owner@example.invalid";
    for (let i = 0; i < 2; i++) expect((await post(env, "/v2/auth/link", { email }, `192.0.2.${i + 1}`)).status).toBe(200);
    // third attempt from a FRESH address: the ip key passes, the email key refuses
    expect((await post(env, "/v2/auth/link", { email }, "192.0.2.50")).status).toBe(429);
    // consume is keyed per email+address: a stranger exhausting it from elsewhere does not lock the victim out (review #12-3)
    for (let i = 0; i < 2; i++) expect((await post(env, "/v2/auth/session", { email, code: "000000" }, "192.0.2.66")).status).toBe(400);
    expect((await post(env, "/v2/auth/session", { email, code: "000000" }, "192.0.2.66")).status).toBe(429);
    expect((await post(env, "/v2/auth/session", { email, code: "000000" }, "192.0.2.67")).status).toBe(400); // victim's own address still served
    // a non-string email cannot dodge the email key (review #12-2)
    expect((await post(env, "/v2/auth/session", { email: [email], code: "000000" }, "192.0.2.68")).status).toBe(400);
    expect((await post(env, "/v2/auth/link", { email: { a: 1 } }, "192.0.2.69")).status).toBe(400);
    const keys = [...env.RL_AUTH.seen.keys()];
    expect(keys.some((k) => k.includes("demo.owner"))).toBe(false);
    expect(keys.filter((k) => /^em:[0-9a-f]{32}$/.test(k)).length).toBe(1);
    expect(keys.filter((k) => k.includes("|ip:")).length).toBe(2);
  }, 30_000);

  it("absent binding: allowed only when ENVIRONMENT is exactly dev; anywhere else it refuses (fail closed)", async () => {
    const bare = { RL_MCP_ANON: undefined, RL_AUTH: undefined, RL_REDEEM: undefined };
    expect((await post(mkEnv(bare), "/mcp", rpc("tools/list"))).status).toBe(200);
    expect((await post(mkEnv({ ...bare, ENVIRONMENT: "production" }), "/mcp", rpc("tools/list"))).status).toBe(429);
    expect((await post(mkEnv({ ...bare, ENVIRONMENT: undefined }), "/v2/participate/code", { code: "NOPE-0009" })).status).toBe(429);
  }, 30_000);

  it("a binding that throws does not take the survey down", async () => {
    const env = mkEnv({ RL_REDEEM: { limit: async () => { throw new Error("edge hiccup"); } }, RL_MCP_ANON: limiter(100) });
    expect((await post(env, "/v2/participate/code", { code: "NOPE-0010" })).status).toBe(404);
  }, 30_000);
  it("a JSON-RPC batch spends one unit per message; oversized batches are refused for everyone (Bugbot 9ea1c79e)", async () => {
    const env = mkEnv({ RL_MCP_ANON: limiter(5) });
    const batch = (n: number) => Array.from({ length: n }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "tools/list" }));
    expect((await post(env, "/mcp", batch(4))).status).toBe(200);          // 4 of 5 spent
    expect((await post(env, "/mcp", batch(2))).status).toBe(429);          // needs 2, 1 left
    expect(env.RL_MCP_ANON.seen.get("ip:203.0.113.7")).toBeGreaterThanOrEqual(5);
    const big = await post(env, "/mcp", batch(11), "198.51.100.77");
    expect(big.status).toBe(400); expect(((await big.json()) as any).error.code).toBe(-32600);
    expect(env.RL_MCP_ANON.seen.has("ip:198.51.100.77")).toBe(false);     // refused before spending
    const bearer = await mintSession(env, "person_mara", "user");
    expect((await post(env, "/mcp", batch(11), "203.0.113.7", bearer)).status).toBe(400); // cap applies signed-in too
    expect((await post(env, "/mcp", batch(10), "203.0.113.7", bearer)).status).toBe(200);
  }, 30_000);
});
