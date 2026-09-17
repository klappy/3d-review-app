// Stitch oracle (PR #19 + PR #20 over fable/mcp-oauth): the storage cost of an unknown bearer on /mcp, measured through
// the real worker entry with counting proxies on BOTH stores. This is the number INTERFACE.md's residual line must state.
//   - literal `a:b:c`      → not provider-shaped (grantId 16 / secret 32 required) → RL_MCP_ANON, 401 before storage: 0 KV, 0 D1
//   - provider-shaped junk → RL_MCP_CEILING → provider: 1 KV get (token miss) → resolveExternalToken → resolvePrincipal's
//                            shape gate (PR #19 B3) answers anonymous WITHOUT a lookup → 401: 1 KV get, 0 D1
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import worker from "../src/worker";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "stitch", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "stitch-test-db" }, kvNamespaces: { OAUTH_KV: "stitch-test-kv" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
const ORIGIN = "https://3dr.test";
const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined }) as any;
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
const counting = <T extends object>(t: T, methods: string[], counts: Record<string, number>) => new Proxy(t, { get(o, p) { const v = Reflect.get(o, p, o); if (typeof v !== "function") return v; return (...a: any[]) => { if (methods.includes(String(p))) counts[String(p)] = (counts[String(p)] ?? 0) + 1; return v.apply(o, a); }; } });

let env: any; const d1: Record<string, number> = {}; const kv: Record<string, number> = {};
const reset = () => { for (const k of Object.keys(d1)) delete d1[k]; for (const k of Object.keys(kv)) delete kv[k]; };
beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql"]) await db.batch(statements(db, `../migrations/${m}`));
  env = { DB: counting(db, ["prepare", "batch", "exec"], d1), OAUTH_KV: counting(await mf.getKVNamespace("OAUTH_KV"), ["get", "put", "delete", "list", "getWithMetadata"], kv),
    SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", RL_MCP_ANON: limiter(100), RL_MCP_CEILING: limiter(100), RL_HTTP_ANON: limiter(100), RL_AUTH: limiter(100), RL_REDEEM: limiter(100) };
}, 60_000);
const hit = (auth: string) => worker.fetch(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.42", authorization: auth }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), env, ectx());

describe("stitch: unknown bearer cost on /mcp at the integrated tree", () => {
  it("literal `a:b:c` is not provider-shaped: RL_MCP_ANON, 401 before any storage (0 KV, 0 D1)", async () => {
    reset();
    const r = await hit("Bearer a:b:c");
    expect(r.status).toBe(401);
    expect(kv).toEqual({}); expect(d1).toEqual({});
    expect(env.RL_MCP_ANON.seen.get("ip:203.0.113.42")).toBe(1); expect(env.RL_MCP_CEILING.seen.get("ip:203.0.113.42")).toBeUndefined();
  }, 30_000);
  it("provider-shaped unknown bearer: RL_MCP_CEILING, exactly 1 KV get and 0 D1 (shape gate refuses the fallthrough)", async () => {
    reset();
    const token = `user_x:${"g".repeat(16)}:${"s".repeat(32)}`;
    const r = await hit(`Bearer ${token}`);
    expect(r.status).toBe(401);
    expect(kv).toEqual({ get: 1 }); expect(d1).toEqual({});
    expect(env.RL_MCP_CEILING.seen.get("ip:203.0.113.42")).toBe(1);
  }, 30_000);
});
