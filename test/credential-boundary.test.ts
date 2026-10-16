// Credential boundary — falsifying tests from the PR12 re-review (auditor 5707673911) that outlive the app-level rate
// limiter (removed, captain 2026-10-16). Method: a Proxy over Miniflare D1 that counts prepare() by SQL verb, so every
// claim below is a COUNTED number of reads/writes, not a belief.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession, FIRST_PARTY_TOKEN } from "../src/auth";
import { normalizeEmail, randomToken, sha256 } from "../src/handlers/common";
import { MCP_MAX_BATCH } from "../src/mcp";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "lb", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "lb-test-db" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
type Counts = { reads: number; writes: number };
/** D1 proxy: counts prepare() by leading SQL verb. reads = SELECT; writes = INSERT/UPDATE/DELETE. */
function countingDb(real: D1Database): { db: D1Database; counts: Counts; reset: () => void } {
  const counts: Counts = { reads: 0, writes: 0 };
  const db = new Proxy(real, { get(t, prop, r) {
    if (prop === "prepare") return (sql: string) => { const verb = sql.trimStart().slice(0, 6).toUpperCase(); if (verb.startsWith("SELECT")) counts.reads++; else if (/^(INSERT|UPDATE|DELETE)/.test(verb)) counts.writes++; return t.prepare(sql); };
    const v = Reflect.get(t, prop, r); return typeof v === "function" ? v.bind(t) : v;
  } });
  return { db, counts, reset: () => { counts.reads = 0; counts.writes = 0; } };
}
let raw: D1Database;
let counted: ReturnType<typeof countingDb>;
beforeAll(async () => {
  raw = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await raw.batch(statements(raw, `../migrations/${m}`));
  await raw.batch(statements(raw, "../seed/synthetic.sql"));
  counted = countingDb(raw);
}, 60_000);
const mkEnv = (over: Record<string, unknown> = {}) => ({ DB: counted.db, SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", ...over }) as any;
const req = (env: any, method: string, path: string, body?: unknown, ip = "203.0.113.7", headers: Record<string, string> = {}) => app.fetch(new Request("https://t.invalid" + path, { method,
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
const post = (env: any, path: string, body: unknown, ip?: string, headers?: Record<string, string>) => req(env, "POST", path, body, ip, headers);
const get = (env: any, path: string, ip?: string, headers?: Record<string, string>) => req(env, "GET", path, undefined, ip, headers);
const rpc = (method: string, params?: unknown, id: number = 1) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const traces = async () => (await raw.prepare("SELECT COUNT(*) AS n FROM trace").first<{ n: number }>())!.n;

describe("B3 — token-shape gate in resolvePrincipal (Otto P1 5706955103 / auditor #3)", () => {
  it("Bearer garbage → 0 D1 reads, anonymous; provider-shaped a:b:c → 0 D1; cookie garbage → 0 D1", async () => {
    const env = mkEnv();
    counted.reset();
    for (const headers of [{ authorization: "Bearer garbage" }, { authorization: "Bearer a:b:c" }, { cookie: "session=garbage" }])
      expect((await post(env, "/mcp", rpc("tools/list"), "192.0.2.20", headers)).status).toBe(200);
    expect(counted.counts.reads).toBe(0);
    expect((await get(env, "/v2/health", "192.0.2.20", { authorization: "Bearer garbage" })).status).toBe(200); // after the read count: health itself reads
  }, 30_000);
  it("flood: 50 rotating bogus bearers → 0 reads (before: 100)", async () => {
    const env = mkEnv();
    counted.reset();
    for (let i = 0; i < 50; i++) expect((await post(env, "/mcp", rpc("tools/list"), "192.0.2.21", { authorization: `Bearer bogus-${i}-${"x".repeat(i % 40)}` })).status).toBe(200);
    expect(counted.counts.reads).toBe(0);
  }, 30_000);
  it("residual R1 (true statement): a well-formed unknown st_ token costs exactly 2 SELECTs on every request", async () => {
    const env = mkEnv();
    const token = `st_${crypto.randomUUID().replace(/-/g, "")}`;
    expect(FIRST_PARTY_TOKEN.test(token)).toBe(true);
    for (let i = 0; i < 3; i++) { counted.reset(); expect((await get(env, "/v2/entry", "192.0.2.22", { authorization: `Bearer ${token}` })).status).toBe(200); expect(counted.counts.reads).toBe(2); }
  }, 30_000);
  it("both minted shapes pass the gate; the old fixture shape and near-misses do not", () => {
    expect(FIRST_PARTY_TOKEN.test(randomToken("pt"))).toBe(true);
    expect(FIRST_PARTY_TOKEN.test(`pt_${crypto.randomUUID().replace(/-/g, "")}`)).toBe(true);
    for (const bad of ["pt_synthetic", "st_", "st_" + "a".repeat(31), "st_" + "a".repeat(33), "xx_" + "a".repeat(32), "st_" + "a".repeat(31) + "!", "a:b:c", ""]) expect(FIRST_PARTY_TOKEN.test(bad)).toBe(false);
  });
  it("a live minted session still resolves (gate does not break real credentials)", async () => {
    const env = mkEnv();
    const bearer = await mintSession(env, "person_mara", "user");
    const r: any = await (await get(env, "/v2/me", "192.0.2.23", { authorization: `Bearer ${bearer}` })).json();
    expect(r.ok).toBe(true); expect(r.result.principal.id).toBe("person_mara");
  }, 30_000);
});

describe("B5 — one trace id per JSON-RPC message (auditor #7)", () => {
  it("a 3-message batch persists 3 rows with 3 distinct trace ids", async () => {
    const env = mkEnv();
    const bearer = await mintSession(env, "person_mara", "user");
    const before = await traces();
    const batch = [1, 2, 3].map((id) => ({ ...rpc("tools/call", { name: "read", arguments: { capability: "cap.auth.me" } }, id) }));
    const r = await post(env, "/mcp", batch, "192.0.2.40", { authorization: `Bearer ${bearer}` });
    expect(r.status).toBe(200);
    const out: any[] = await r.json();
    const ids = out.map((m) => m.result.structuredContent.trace_id);
    expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3);
    expect(await traces()).toBe(before + 3);
    for (const id of ids) expect((await raw.prepare("SELECT trace_id FROM trace WHERE trace_id = ?").bind(id).first())).toBeTruthy();
  }, 30_000);
});

describe("no app-level rate limit (captain 2026-10-16): a room on one address is never refused", () => {
  it("30 anonymous requests from one address across HTTP twins and /mcp are all served, never 429", async () => {
    const env = mkEnv({ ENVIRONMENT: "production" });
    for (let i = 0; i < 10; i++) {
      expect((await get(env, "/v2/entry", "198.51.100.40")).status).toBe(200);
      expect((await get(env, "/v2/health", "198.51.100.40")).status).toBe(200);
      expect((await post(env, "/mcp", rpc("tools/list"), "198.51.100.40")).status).toBe(200);
    }
  }, 30_000);
  it("a JSON-RPC batch over MCP_MAX_BATCH is refused for everyone (input validation, not a rate limit; Bugbot 9ea1c79e)", async () => {
    const env = mkEnv();
    const batch = (n: number) => Array.from({ length: n }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "tools/list" }));
    const big = await post(env, "/mcp", batch(MCP_MAX_BATCH + 1), "198.51.100.77");
    expect(big.status).toBe(400); expect(((await big.json()) as any).error.code).toBe(-32600);
    const bearer = await mintSession(env, "person_mara", "user");
    expect((await post(env, "/mcp", batch(MCP_MAX_BATCH + 1), "203.0.113.7", { authorization: `Bearer ${bearer}` })).status).toBe(400); // signed-in too
    expect((await post(env, "/mcp", batch(MCP_MAX_BATCH), "203.0.113.7", { authorization: `Bearer ${bearer}` })).status).toBe(200);
  }, 30_000);
});

describe("email normaliser — one form for the handler hash (auditor #11, #12-11)", () => {
  it("normalizeEmail is trim + lowercase", () => {
    expect(normalizeEmail("  A.B@Example.INVALID \t")).toBe("a.b@example.invalid");
  });
  it("' A@Example.invalid ' and 'a@example.invalid' share one login_code.email_hash", async () => {
    const env = mkEnv();
    expect((await post(env, "/v2/auth/link", { email: " Norm.Test@Example.invalid " }, "192.0.2.60")).status).toBe(200);
    expect((await post(env, "/v2/auth/link", { email: "norm.test@example.invalid" }, "192.0.2.61")).status).toBe(200);
    const n = (await raw.prepare("SELECT COUNT(*) AS n FROM login_code WHERE email_hash = ?").bind(await sha256("norm.test@example.invalid")).first<{ n: number }>())!.n;
    expect(n).toBe(2); // both issuances hashed to the normalised address (before: the padded form hashed differently)
  }, 30_000);
});
