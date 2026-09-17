// Limiter boundary — falsifying tests for the PR12 re-review (auditor 5707673911, Bugbot 4032246360).
// Method: the fake counting limiter from rate-limits.test.ts plus a Proxy over Miniflare D1 that counts prepare()
// by SQL verb, so every claim below is a COUNTED number of reads/writes, not a belief. Each `it` names the finding
// it would fail without.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession, FIRST_PARTY_TOKEN } from "../src/auth";
import { normalizeEmail, randomToken, sha256 } from "../src/handlers/common";
import { LIMITER_NAMES } from "../src/ratelimit";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "lb", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "lb-test-db" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
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
const mkEnv = (over: Record<string, unknown> = {}) => ({ DB: counted.db, SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev",
  RL_MCP_ANON: limiter(1000), RL_HTTP_ANON: limiter(1000), RL_AUTH: limiter(1000), RL_REDEEM: limiter(1000), ...over }) as any;
const req = (env: any, method: string, path: string, body?: unknown, ip = "203.0.113.7", headers: Record<string, string> = {}) => app.fetch(new Request("https://t.invalid" + path, { method,
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
const post = (env: any, path: string, body: unknown, ip?: string, headers?: Record<string, string>) => req(env, "POST", path, body, ip, headers);
const get = (env: any, path: string, ip?: string, headers?: Record<string, string>) => req(env, "GET", path, undefined, ip, headers);
const rpc = (method: string, params?: unknown, id: number = 1) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const call = (capability: string, params: unknown, name = "danger", extra: Record<string, unknown> = {}) => rpc("tools/call", { name, arguments: { capability, params, ...extra } });
const traces = async () => (await raw.prepare("SELECT COUNT(*) AS n FROM trace").first<{ n: number }>())!.n;
const feedbackRows = async () => (await raw.prepare("SELECT COUNT(*) AS n FROM feedback").first<{ n: number }>())!.n;

describe("B1 — the address unit is spent BEFORE the email shape check (Bugbot 4032246360 / auditor #1)", () => {
  const shapes = [123, { a: 1 }, ["x"], null, true];
  for (const path of ["/v2/auth/link", "/v2/auth/session"]) {
    it(`${path}: limiter refusing + non-string email → 429, 0 trace rows, 0 writes; limiter open → 400 with the ip key spent`, async () => {
      const refusing = mkEnv({ RL_AUTH: limiter(0) });
      const before = await traces(); counted.reset();
      for (const email of shapes) {
        const r = await post(refusing, path, { email, code: "000000" }, "192.0.2.10");
        expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
        expect(((await r.json()) as any).error.code).toBe("RATE_LIMITED");
      }
      expect(await traces()).toBe(before);
      expect(counted.counts.writes).toBe(0);
      expect(refusing.RL_AUTH.seen.get("ip:192.0.2.10")).toBe(shapes.length); // one unit per attempt, whatever the shape
      const open = mkEnv({ RL_AUTH: limiter(100) });
      const r = await post(open, path, { email: 123, code: "000000" }, "192.0.2.11");
      expect(r.status).toBe(400); expect(((await r.json()) as any).error.code).toBe("INVALID_PARAMS");
      expect([...open.RL_AUTH.seen.keys()]).toEqual(["ip:192.0.2.11"]); // spent, and no em: key for a non-string
    }, 30_000);
  }
  it("flood: 20 malformed sign-ins alternating both twins with the limiter refusing → 0 writes, 0 trace rows", async () => {
    const env = mkEnv({ RL_AUTH: limiter(0) });
    const before = await traces(); counted.reset();
    for (let i = 0; i < 20; i++) {
      const r = await post(env, i % 2 ? "/v2/auth/session" : "/v2/auth/link", { email: shapes[i % shapes.length], code: "1" }, "192.0.2.12");
      expect(r.status).toBe(429);
    }
    expect(counted.counts.writes).toBe(0);
    expect(await traces()).toBe(before);
  }, 30_000);
  it("MCP twin: anonymous tools/call cap.auth.request_link with a non-string email spends RL_AUTH first; refused → envelope RATE_LIMITED + retry_after, no trace row", async () => {
    const refusing = mkEnv({ RL_AUTH: limiter(0) });
    const before = await traces(); counted.reset();
    const r = await post(refusing, "/mcp", call("cap.auth.request_link", { email: 5 }), "192.0.2.13");
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.result.structuredContent.error.code).toBe("RATE_LIMITED");
    expect(j.result.structuredContent.error.data.retry_after).toBe(60); // review #12-6: one shape to back off from
    expect(await traces()).toBe(before);
    expect(counted.counts.writes).toBe(0);
    expect(refusing.RL_AUTH.seen.get("ip:192.0.2.13")).toBe(1);
    const open = mkEnv({ RL_AUTH: limiter(100) });
    const k: any = await (await post(open, "/mcp", call("cap.auth.request_link", { email: 5 }), "192.0.2.14")).json();
    expect(k.result.structuredContent.error.code).toBe("INVALID_PARAMS");
    expect([...open.RL_AUTH.seen.keys()]).toEqual(["ip:192.0.2.14"]);
  }, 30_000);
});

describe("B2 — RL_HTTP_ANON meters every anonymous HTTP twin per address (auditor #2)", () => {
  it("3× GET /v2/health 200, the 4th 429 + retry-after with the trace table unchanged; a bearer holder on the same address is not counted", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(3) });
    for (let i = 0; i < 3; i++) expect((await get(env, "/v2/health", "198.51.100.20")).status).toBe(200);
    const before = await traces(); counted.reset();
    const r = await get(env, "/v2/health", "198.51.100.20");
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json(); expect(j.error.code).toBe("RATE_LIMITED"); expect(j.trace_id).toBeTruthy();
    expect(j.error.data.retry_after).toBe(60); // same value as the header (review 5708112856 #1)
    expect(await traces()).toBe(before);
    // MCP transport refusal carries the same field in its -32029 data
    const m = await post(mkEnv({ RL_MCP_ANON: limiter(0) }), "/mcp", rpc("tools/list"), "198.51.100.22");
    expect(m.status).toBe(429); expect(((await m.json()) as any).error.data).toMatchObject({ code: "RATE_LIMITED", retry_after: 60 });
    expect(counted.counts.writes).toBe(0);
    // credentialed caller on the SAME address: served, and the anonymous counter does not move
    const bearer = await mintSession(env, "person_mara", "user");
    for (let i = 0; i < 5; i++) expect((await get(env, "/v2/health", "198.51.100.20", { authorization: `Bearer ${bearer}` })).status).toBe(200);
    expect(env.RL_HTTP_ANON.seen.get("ip:198.51.100.20")).toBe(4);
    expect([...env.RL_HTTP_ANON.seen.keys()]).toEqual(["ip:198.51.100.20"]);
    // another address has its own budget
    expect((await get(env, "/v2/health", "198.51.100.21")).status).toBe(200);
  }, 30_000);
  it("POST /v2/feedback: 3 anonymous writes land, the 4th is refused with 0 writes (before: unlimited feedback+receipt+trace rows)", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(3) });
    const fb0 = await feedbackRows();
    for (let i = 0; i < 3; i++) expect((await post(env, "/v2/feedback", { text: `anon ${i}` }, "198.51.100.30")).status).toBe(200);
    expect(await feedbackRows()).toBe(fb0 + 3);
    const t0 = await traces(); counted.reset();
    const r = await post(env, "/v2/feedback", { text: "anon 4" }, "198.51.100.30");
    expect(r.status).toBe(429);
    expect(counted.counts.writes).toBe(0);
    expect(await feedbackRows()).toBe(fb0 + 3);
    expect(await traces()).toBe(t0);
  }, 30_000);
  it("flood: 20 anonymous requests across public, 401 and 501 twins with the binding refusing → 0 writes, 0 reads, 20×429", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(0) });
    const before = await traces(); counted.reset();
    const targets: [string, string, unknown][] = [["GET", "/v2/entry", undefined], ["GET", "/v2/me", undefined], ["POST", "/v2/feedback", { text: "x" }], ["GET", "/v2/workspaces", undefined], ["POST", "/v2/requests", { text: "x" }]];
    for (let i = 0; i < 20; i++) { const [m, p, b] = targets[i % targets.length]; expect((await req(env, m, p, b, "198.51.100.40")).status).toBe(429); }
    expect(counted.counts).toEqual({ reads: 0, writes: 0 });
    expect(await traces()).toBe(before);
  }, 30_000);
  it("absent RL_HTTP_ANON binding outside dev refuses and logs ratelimit.binding_absent (distinct from a throttle)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await get(mkEnv({ RL_HTTP_ANON: undefined, ENVIRONMENT: "production" }), "/v2/entry", "198.51.100.50");
      expect(r.status).toBe(429);
      expect(err.mock.calls.some((c) => c[0] === "ratelimit.binding_absent" && c[1] === "RL_HTTP_ANON")).toBe(true);
      expect((await get(mkEnv({ RL_HTTP_ANON: undefined, ENVIRONMENT: "dev" }), "/v2/entry", "198.51.100.51")).status).toBe(200);
    } finally { err.mockRestore(); }
  }, 30_000);
  it("config oracle: wrangler.toml binds every LimiterName at top level AND under [env.production.ratelimits] with distinct namespace ids", () => {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    const tables: Record<string, { name?: string; namespace_id?: string; limit?: number; period?: number }[]> = {};
    let current: { name?: string; namespace_id?: string; limit?: number; period?: number } | undefined;
    for (const line of toml.split("\n")) {
      const t = line.trim();
      const arr = t.match(/^\[\[([\w.]+)\]\]$/);
      if (arr) { current = arr[1].endsWith("ratelimits") ? {} : undefined; if (current) (tables[arr[1]] ??= []).push(current); continue; }
      if (/^\[[\w.]+\]$/.test(t)) { current = undefined; continue; }
      if (!current) continue;
      const kv = t.match(/^(\w+)\s*=\s*(.+)$/); if (!kv) continue;
      if (kv[1] === "name") current.name = kv[2].replace(/"/g, "");
      if (kv[1] === "namespace_id") current.namespace_id = kv[2].replace(/"/g, "");
      if (kv[1] === "simple") { current.limit = Number(kv[2].match(/limit\s*=\s*(\d+)/)?.[1]); current.period = Number(kv[2].match(/period\s*=\s*(\d+)/)?.[1]); }
    }
    const dev = tables["ratelimits"] ?? [], prod = tables["env.production.ratelimits"] ?? [];
    for (const name of LIMITER_NAMES) {
      const d = dev.find((b) => b.name === name), p = prod.find((b) => b.name === name);
      expect(d, `${name} bound at top level`).toBeTruthy(); expect(p, `${name} bound under [env.production.ratelimits]`).toBeTruthy();
      expect([10, 60]).toContain(d!.period); expect(d!.limit).toBeGreaterThan(0);
      expect({ limit: p!.limit, period: p!.period }).toEqual({ limit: d!.limit, period: d!.period }); // same policy, separate counters
    }
    const ids = [...dev, ...prod].map((b) => b.namespace_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(dev.map((b) => b.name).sort()).toEqual([...LIMITER_NAMES].sort()); // no binding the code does not know
    expect(dev.find((b) => b.name === "RL_HTTP_ANON")!.limit).toBe(60);
  });
});

describe("B3 — token-shape gate in resolvePrincipal (Otto P1 5706955103 / auditor #3)", () => {
  it("Bearer garbage → 0 D1 reads, anonymous; provider-shaped a:b:c → 0 D1; cookie garbage → 0 D1", async () => {
    const env = mkEnv({ RL_AUTH: limiter(0), RL_HTTP_ANON: limiter(100) });
    counted.reset();
    expect((await post(env, "/v2/auth/link", { email: "x@example.invalid" }, "192.0.2.20", { authorization: "Bearer garbage" })).status).toBe(429);
    expect((await post(env, "/v2/auth/link", { email: "x@example.invalid" }, "192.0.2.20", { authorization: "Bearer a:b:c" })).status).toBe(429);
    expect((await post(env, "/v2/auth/link", { email: "x@example.invalid" }, "192.0.2.20", { cookie: "session=garbage" })).status).toBe(429);
    expect((await post(env, "/mcp", rpc("tools/list"), "192.0.2.20", { authorization: "Bearer a:b:c" })).status).toBe(200);
    expect(counted.counts.reads).toBe(0);
    expect(env.RL_HTTP_ANON.seen.get("ip:192.0.2.20")).toBe(3); // malformed credential = anonymous = metered
    expect(env.RL_MCP_ANON.seen.get("ip:192.0.2.20")).toBe(1);
  }, 30_000);
  it("flood: 50 rotating bogus bearers → 0 reads (before: 100)", async () => {
    const env = mkEnv({ RL_AUTH: limiter(0), RL_HTTP_ANON: limiter(100) });
    counted.reset();
    for (let i = 0; i < 50; i++) expect((await post(env, "/v2/auth/link", { email: "x@example.invalid" }, "192.0.2.21", { authorization: `Bearer bogus-${i}-${"x".repeat(i % 40)}` })).status).toBe(429);
    expect(counted.counts).toEqual({ reads: 0, writes: 0 });
  }, 30_000);
  it("residual R1 (true statement): a well-formed unknown st_ token costs exactly 2 SELECTs on EVERY request, refused ones included — reads unbounded, writes 0", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(2) });
    const token = `st_${crypto.randomUUID().replace(/-/g, "")}`;
    expect(FIRST_PARTY_TOKEN.test(token)).toBe(true);
    for (let i = 0; i < 2; i++) { counted.reset(); expect((await get(env, "/v2/entry", "192.0.2.22", { authorization: `Bearer ${token}` })).status).toBe(200); expect(counted.counts.reads).toBe(2); }
    counted.reset(); const before = await traces();
    for (let i = 0; i < 10; i++) expect((await get(env, "/v2/entry", "192.0.2.22", { authorization: `Bearer ${token}` })).status).toBe(429);
    expect(counted.counts).toEqual({ reads: 20, writes: 0 }); // 2 reads per refused request: the limiter does NOT bound reads
    expect(await traces()).toBe(before);
    expect(env.RL_HTTP_ANON.seen.get("ip:192.0.2.22")).toBe(12);
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

describe("B4 — sign-in budget is 10/60s COMBINED per address (auditor #4; doc-corrected, key kept)", () => {
  it("request_link and consume_link spend the same ip: key on RL_AUTH", async () => {
    const env = mkEnv({ RL_AUTH: limiter(2) });
    expect((await post(env, "/v2/auth/link", { email: "demo.owner@example.invalid" }, "192.0.2.30")).status).toBe(200);
    expect((await post(env, "/v2/auth/session", { email: "demo.owner@example.invalid", code: "000000" }, "192.0.2.30")).status).toBe(400);
    expect((await post(env, "/v2/auth/session", { email: "demo.owner@example.invalid", code: "000000" }, "192.0.2.30")).status).toBe(429);
    expect((await post(env, "/v2/auth/link", { email: "demo.owner@example.invalid" }, "192.0.2.30")).status).toBe(429);
    expect(env.RL_AUTH.seen.get("ip:192.0.2.30")).toBe(4);
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

describe("promoted nits — each has its own falsifier (#12-6, #12-8, #12-11)", () => {
  it("#12-6: a signed-in MCP capability refusal (200 + envelope, no header) carries error.data.retry_after = 60", async () => {
    const env = mkEnv({ RL_REDEEM: limiter(0) });
    const bearer = await mintSession(env, "person_mara", "user");
    const j: any = await (await post(env, "/mcp", call("cap.participant.redeem_code", { code: "NOPE-0001" }, "write"), "192.0.2.70", { authorization: `Bearer ${bearer}` })).json();
    expect(j.result.structuredContent.error).toMatchObject({ code: "RATE_LIMITED", data: { retry_after: 60 } });
    const h = await post(env, "/v2/participate/code", { code: "NOPE-0001" }, "192.0.2.71");
    expect(h.status).toBe(429); expect(((await h.json()) as any).error.data.retry_after).toBe(60); // HTTP twin: header AND envelope
  }, 30_000);
  it("#12-8: an absent RL_AUTH binding outside dev refuses (already true) AND logs ratelimit.binding_absent naming the binding (new)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await post(mkEnv({ RL_AUTH: undefined, ENVIRONMENT: "production" }), "/v2/auth/link", { email: "x@example.invalid" }, "192.0.2.72")).status).toBe(429);
      expect(err.mock.calls.filter((c) => c[0] === "ratelimit.binding_absent").map((c) => c[1])).toEqual(["RL_AUTH"]);
    } finally { err.mockRestore(); }
  }, 30_000);
  it("#12-11: normalizeEmail is trim + lowercase and is what both the em: key and the handler hash", () => {
    expect(normalizeEmail("  A.B@Example.INVALID \t")).toBe("a.b@example.invalid");
  });
});

describe("email normaliser — limiter key and handler hash agree (auditor #11)", () => {
  it("' A@Example.invalid ' and 'a@example.invalid' share one em: key AND one login_code.email_hash", async () => {
    const env = mkEnv({ RL_AUTH: limiter(100) });
    expect((await post(env, "/v2/auth/link", { email: " Norm.Test@Example.invalid " }, "192.0.2.60")).status).toBe(200);
    expect((await post(env, "/v2/auth/link", { email: "norm.test@example.invalid" }, "192.0.2.61")).status).toBe(200);
    expect([...env.RL_AUTH.seen.keys()].filter((k) => k.startsWith("em:"))).toHaveLength(1);
    const n = (await raw.prepare("SELECT COUNT(*) AS n FROM login_code WHERE email_hash = ?").bind(await sha256("norm.test@example.invalid")).first<{ n: number }>())!.n;
    expect(n).toBe(2); // both issuances hashed to the normalised address (before: the padded form hashed differently)
  }, 30_000);
});
