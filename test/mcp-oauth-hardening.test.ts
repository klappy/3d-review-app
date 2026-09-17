// fix/pr15-auth-hardening — the falsifying tests for review #15 findings 1 (consent CSP), 2 (code redemption race),
// 3 (PKCE for confidential clients), 5–9, 11 (minors). Real worker entry, real borrowed provider, Miniflare D1 + KV.
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import worker from "../src/worker";
import { consentCsp } from "../src/oauth";
import { mintSession } from "../src/auth";
import { resetAccessKeyCache } from "../src/access";

const MIGRATIONS = ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql"];
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "oauth-h", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "oauth-h-db", DB2: "oauth-h-db2" }, kvNamespaces: { OAUTH_KV: "oauth-h-kv" } }] }));
afterAll(() => mf.dispose());
afterEach(() => { vi.restoreAllMocks(); resetAccessKeyCache(); });
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
const b64u = (b: ArrayBuffer | Uint8Array | string) => { const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
let env: any; let db2: D1Database; let kp: CryptoKeyPair; let jwks: any;
const ORIGIN = "https://3dr.test";
const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined }) as any;
const callIn = (e: any, path: string, init: RequestInit = {}) => worker.fetch(new Request(ORIGIN + path, { redirect: "manual", ...init }), e, ectx());
const call = (path: string, init: RequestInit = {}) => callIn(env, path, init);
async function accessJwt(email: string) {
  const head = b64u(JSON.stringify({ alg: "RS256", kid: "k1" }));
  const body = b64u(JSON.stringify({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) + 60, email, sub: "s-" + email }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
const stubJwks = () => { const real = globalThis.fetch; vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => String(input?.url ?? input).includes("/cdn-cgi/access/certs") ? new Response(JSON.stringify(jwks)) : real(input, init)); };
const mcpCall = (e: any, token: string | undefined, body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read", arguments: { capability: "cap.auth.me", params: {} } } }, path = "/mcp", extra: Record<string, string> = {}) =>
  callIn(e, path, { method: "POST", headers: { "content-type": "application/json", ...(token !== undefined ? { authorization: token } : {}), ...extra }, body: JSON.stringify(body) });
/** In-memory limiter with the same shape as a Workers Rate Limiting binding. */
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
/** Counting proxies: every D1 prepare (with its SQL) and every KV get/put/delete/list. */
function counting(base: any) {
  const sqls: string[] = []; const kv: string[] = [];
  const DB = new Proxy(base.DB, { get(t, p) { if (p === "prepare") return (sql: string) => { sqls.push(sql); return t.prepare(sql); }; const v = Reflect.get(t, p, t); return typeof v === "function" ? v.bind(t) : v; } });
  const OAUTH_KV = new Proxy(base.OAUTH_KV, { get(t, p) { const v = Reflect.get(t, p, t); if (typeof v === "function" && ["get", "put", "delete", "list", "getWithMetadata"].includes(String(p))) return (...a: any[]) => { kv.push(String(p)); return v.apply(t, a); }; return typeof v === "function" ? v.bind(t) : v; } });
  return { e: { ...base, DB, OAUTH_KV }, sqls, kv };
}

beforeAll(async () => {
  const db = await mf.getD1Database("DB"); db2 = await mf.getD1Database("DB2");
  for (const d of [db, db2]) { for (const m of MIGRATIONS) await d.batch(statements(d, `../migrations/${m}`)); await d.batch(statements(d, "../seed/synthetic.sql")); }
  env = { DB: db, OAUTH_KV: await mf.getKVNamespace("OAUTH_KV"), SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1" };
  kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  jwks = { keys: [{ kid: "k1", kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" }] };
}, 60_000);

async function register(redirect = "https://client.example/cb", auth: "none" | "client_secret_post" = "none") {
  const r = await call("/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "H", redirect_uris: [redirect], token_endpoint_auth_method: auth, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
  expect(r.status).toBe(201); const j: any = await r.json(); return { clientId: j.client_id as string, secret: j.client_secret as string | undefined, redirect };
}
async function pkce() { const verifier = b64u(crypto.getRandomValues(new Uint8Array(32))); return { verifier, challenge: b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))) }; }
async function toConsent(e: any, clientId: string, redirect: string, challenge: string, email = "demo.owner@example.invalid") {
  const a = await callIn(e, `/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&code_challenge=${challenge}&code_challenge_method=S256&state=st-1&scope=3dreview`);
  expect(a.status).toBe(302); expect(a.headers.get("location")).toBe("/v2/auth/access?next=oauth");
  const cookie = a.headers.get("set-cookie")!.split(";")[0];
  stubJwks();
  const page = await callIn(e, "/v2/auth/access?next=oauth", { headers: { cookie, "cf-access-jwt-assertion": await accessJwt(email) } });
  const htmlText = await page.text();
  return { cookie, page, htmlText, ticket: htmlText.match(/name="ticket" value="([^"]+)"/)?.[1]! };
}
const consent = (e: any, cookie: string, ticket: string, decision: string) => callIn(e, "/oauth/consent", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ticket, decision }).toString() });
async function getCode(e: any, clientId: string, redirect: string, challenge: string) {
  const c = await toConsent(e, clientId, redirect, challenge);
  const done = await consent(e, c.cookie, c.ticket, "approve"); expect(done.status).toBe(302);
  return new URL(done.headers.get("location")!).searchParams.get("code")!;
}
const token = (e: any, params: Record<string, string>) => callIn(e, "/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
const redemptions = (d: D1Database) => d.prepare("SELECT COUNT(*) AS n FROM oauth_code_redemption").first<{ n: number }>().then((r) => r!.n);

describe("A1 consent CSP: form-action widened to exactly the provider-validated destination", () => {
  it("unit: origin for http/https, scheme for custom schemes, 'self' only when unparseable", () => {
    expect(consentCsp("https://client.example/cb?x=1")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://client.example; frame-ancestors 'none'");
    expect(consentCsp("http://127.0.0.1:43123/cb")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:43123; frame-ancestors 'none'");
    expect(consentCsp("cursor://anysphere.cursor-mcp/oauth/callback")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self' cursor:; frame-ancestors 'none'");
    expect(consentCsp("not a url")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    // a raw query string can never reach the directive: only a parsed origin/scheme is emitted
    expect(consentCsp("https://client.example/cb 'unsafe-inline' https://evil.example")).not.toContain("evil");
  });
  it("consent page for an https client, for a custom-scheme client; deny 302 has no CSP; error pages keep 'self'", async () => {
    const h = await register("https://client.example/cb"); const p = await pkce();
    const c1 = await toConsent(env, h.clientId, h.redirect, p.challenge);
    expect(c1.page.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://client.example; frame-ancestors 'none'");
    const cu = await register("cursor://anysphere.cursor-mcp/oauth/callback");
    const c2 = await toConsent(env, cu.clientId, cu.redirect, p.challenge);
    expect(c2.page.status).toBe(200);
    expect(c2.page.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self' cursor:; frame-ancestors 'none'");
    const denied = await consent(env, c2.cookie, c2.ticket, "deny");
    expect(denied.status).toBe(302); expect(denied.headers.get("location")).toMatch(/^cursor:\/\/anysphere\.cursor-mcp\/oauth\/callback\?error=access_denied/); expect(denied.headers.get("content-security-policy")).toBeNull();
    // error pages (expired / unknown / invalid) never widen
    stubJwks();
    const expired = await call("/v2/auth/access?next=oauth", { headers: { cookie: "__Host-oauth_req=nope", "cf-access-jwt-assertion": await accessJwt("demo.owner@example.invalid") } });
    expect(expired.status).toBe(400); expect(expired.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    const badReq = await call(`/authorize?response_type=code&client_id=${encodeURIComponent(h.clientId)}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=${p.challenge}&code_challenge_method=S256`);
    expect(badReq.status).toBe(400); expect(badReq.headers.get("location")).toBeNull(); expect(badReq.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
  }, 60_000);
});

describe("A2 authorization code is single-use under concurrency (D1 INSERT OR FAIL in tokenExchangeCallback)", () => {
  it("5 concurrent redemptions → exactly one 200, four 400 invalid_grant; exactly one INSERT per redemption", async () => {
    const { e, sqls } = counting(env);
    const h = await register(); const p = await pkce(); const code = await getCode(e, h.clientId, h.redirect, p.challenge);
    const before = await redemptions(env.DB);
    const params = { grant_type: "authorization_code", code, client_id: h.clientId, redirect_uri: h.redirect, code_verifier: p.verifier };
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => token(e, params)));
    const bodies: any[] = await Promise.all(rs.map((r) => r.json()));
    const statuses = rs.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400, 400, 400, 400]);
    expect(bodies.filter((b) => b.error).map((b) => b.error)).toEqual(["invalid_grant", "invalid_grant", "invalid_grant", "invalid_grant"]);
    expect(bodies.filter((b) => b.error).every((b) => b.error_description === "Authorization code already used")).toBe(true);
    expect(bodies.filter((b) => b.access_token).length).toBe(1);
    expect(await redemptions(env.DB) - before).toBe(1);
    expect(sqls.filter((s) => s.startsWith("INSERT OR FAIL INTO oauth_code_redemption")).length).toBe(5); // one attempt each; the PK decides
    // sequential reuse afterwards is still refused (by the provider's own check now, before the callback)
    const again = await token(e, params); expect(again.status).toBe(400); expect(((await again.json()) as any).error).toBe("invalid_grant");
  }, 60_000);

  it("a wrong verifier does not burn the code (callback runs after the PKCE check): wrong then correct → 200", async () => {
    const { e, sqls } = counting(env);
    const h = await register(); const p = await pkce(); const code = await getCode(e, h.clientId, h.redirect, p.challenge);
    const base = { grant_type: "authorization_code", code, client_id: h.clientId, redirect_uri: h.redirect };
    const bad = await token(e, { ...base, code_verifier: "wrong-" + p.verifier });
    expect(bad.status).toBe(400); expect(((await bad.json()) as any).error).toBe("invalid_grant");
    expect(sqls.filter((s) => s.startsWith("INSERT OR FAIL INTO oauth_code_redemption")).length).toBe(0);
    const good = await token(e, { ...base, code_verifier: p.verifier });
    expect(good.status).toBe(200); const access = ((await good.json()) as any).access_token as string;
    expect(sqls.filter((s) => s.startsWith("INSERT OR FAIL INTO oauth_code_redemption")).length).toBe(1);
    const me: any = await (await mcpCall(e, `Bearer ${access}`)).json();
    expect(me.result.structuredContent.result.principal.delegated_by).toBe(`oauth:${h.clientId}`);
  }, 60_000);

  it("duplicate path revokes the grant before refusing (parity with the provider's sequential-reuse path)", async () => {
    const h = await register(); const p = await pkce(); const code = await getCode(env, h.clientId, h.redirect, p.challenge);
    const [userId, grantId] = code.split(":");
    expect(await env.OAUTH_KV.get(`grant:${userId}:${grantId}`)).not.toBeNull();
    // simulate the loser: the row already exists when this redemption reaches the callback
    await env.DB.prepare("INSERT INTO oauth_code_redemption (grant_id, user_id, redeemed_at) VALUES (?, ?, ?)").bind(grantId, userId, "2026-09-16T00:00:00.000Z").run();
    const r = await token(env, { grant_type: "authorization_code", code, client_id: h.clientId, redirect_uri: h.redirect, code_verifier: p.verifier });
    expect(r.status).toBe(400); expect(((await r.json()) as any).error).toBe("invalid_grant");
    expect(await env.OAUTH_KV.get(`grant:${userId}:${grantId}`)).toBeNull();
  }, 60_000);

  it("provider is built per env: the redemption row lands in THAT env's DB (two distinct env objects)", async () => {
    const envB = { ...env, DB: db2 };
    const h = await register(); const pa = await pkce(); const pb = await pkce();
    const a0 = await redemptions(env.DB), b0 = await redemptions(db2);
    const codeA = await getCode(env, h.clientId, h.redirect, pa.challenge);
    expect((await token(env, { grant_type: "authorization_code", code: codeA, client_id: h.clientId, redirect_uri: h.redirect, code_verifier: pa.verifier })).status).toBe(200);
    expect([await redemptions(env.DB) - a0, await redemptions(db2) - b0]).toEqual([1, 0]);
    const codeB = await getCode(envB, h.clientId, h.redirect, pb.challenge);
    expect((await token(envB, { grant_type: "authorization_code", code: codeB, client_id: h.clientId, redirect_uri: h.redirect, code_verifier: pb.verifier })).status).toBe(200);
    expect([await redemptions(env.DB) - a0, await redemptions(db2) - b0]).toEqual([1, 1]);
    expect((await db2.prepare("SELECT grant_id FROM oauth_code_redemption WHERE grant_id = ?").bind(codeB.split(":")[1]).first())).not.toBeNull();
  }, 60_000);
});

describe("A3 PKCE S256 is required for every client", () => {
  it("confidential client (client_secret_post) without code_challenge → error redirect to the validated URI, nothing parked", async () => {
    const { e, kv } = counting(env);
    const h = await register("https://conf.example/cb", "client_secret_post"); expect(h.secret).toBeTruthy();
    const parkedBefore = (await env.OAUTH_KV.list({ prefix: "3dr:authreq:" })).keys.length;
    const r = await callIn(e, `/authorize?response_type=code&client_id=${encodeURIComponent(h.clientId)}&redirect_uri=${encodeURIComponent(h.redirect)}&state=xyz&scope=3dreview`);
    expect(r.status).toBe(302);
    const loc = new URL(r.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://conf.example/cb");
    expect(loc.searchParams.get("error")).toBe("invalid_request"); expect(loc.searchParams.get("error_description")).toMatch(/S256/);
    expect(loc.searchParams.get("state")).toBe("xyz"); expect(loc.searchParams.get("iss")).toBe(ORIGIN);
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(kv.filter((op) => op === "put").length).toBe(0);
    expect((await env.OAUTH_KV.list({ prefix: "3dr:authreq:" })).keys.length).toBe(parkedBefore);
    // with S256 the same client is parked as usual
    const p = await pkce();
    const ok = await callIn(e, `/authorize?response_type=code&client_id=${encodeURIComponent(h.clientId)}&redirect_uri=${encodeURIComponent(h.redirect)}&code_challenge=${p.challenge}&code_challenge_method=S256&state=xyz`);
    expect(ok.status).toBe(302); expect(ok.headers.get("location")).toBe("/v2/auth/access?next=oauth");
  }, 60_000);
});

describe("A4 minors (review #15 findings 5–9, 11)", () => {
  const e2 = () => { const c = counting(env); return { ...c, e: { ...c.e, RL_MCP_ANON: limiter(100), RL_MCP_CEILING: limiter(100), RL_AUTH: limiter(100), RL_REDEEM: limiter(100) } }; };
  it("(5)(6) non-token shapes and provider-divergent Bearer spellings → 401 with 0 D1 and 0 KV", async () => {
    const { e, sqls, kv } = e2();
    const s32 = "a".repeat(32), g16 = "g".repeat(16);
    for (const auth of [`Bearer éé:éé:${s32}`, `Bearer usr_x:${g16}:${"a".repeat(33)}`, `Bearer usr_x:${"g".repeat(17)}:${s32}`, `bearer st_${s32}`, `Bearer\tst_${s32}`, `Bearer  st_${s32}`, `BEARER st_${s32}`]) {
      const r = await mcpCall(e, auth); expect(r.status, auth).toBe(401);
      expect(r.headers.get("www-authenticate")).toContain('error="invalid_token"');
    }
    expect(sqls.length).toBe(0); expect(kv.length).toBe(0);
    // the real provider shape still passes the gate: 1 KV read, then the provider's external-token fallthrough costs the two
    // first-party SELECTs (plan v2 item 3 — recorded residual, bounded by RL_MCP_CEILING), then 401
    const r = await mcpCall(e, `Bearer usr_0123456789abcdef0123:${g16}:${s32}`); expect(r.status).toBe(401);
    expect(kv).toEqual(["get"]); expect(sqls.length).toBe(2);
  }, 60_000);
  it("(7) the early 401 pointer equals the provider's own for /mcp, /mcp/ and /mcpx; (11) both advertise the scope", async () => {
    const { e } = e2();
    for (const path of ["/mcp", "/mcp/", "/mcpx"]) {
      const early = await mcpCall(e, "Bearer junk", {}, path);                      // worker's pre-storage 401
      const provider = await mcpCall(e, `Bearer st_${"0".repeat(32)}`, {}, path);   // provider's own 401 (well-shaped, unknown)
      expect([early.status, provider.status]).toEqual([401, 401]);
      expect(early.headers.get("www-authenticate")).toBe(provider.headers.get("www-authenticate"));
      expect(early.headers.get("www-authenticate")).toBe(`Bearer realm="OAuth", resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource${path}", error="invalid_token", scope="3dreview"`);
    }
    const prm: any = await (await call("/.well-known/oauth-protected-resource/mcp")).json();
    expect(prm.scopes_supported).toEqual(["3dreview"]); expect(prm.resource).toBe(ORIGIN + "/mcp");
    const as: any = await (await call("/.well-known/oauth-authorization-server")).json();
    expect(as.scopes_supported).toEqual(["3dreview"]);
  }, 60_000);
  it("(8) OAUTH_KV absent → 503 temporarily_unavailable on /token, /register and provider-shaped /mcp; first-party bearer unaffected", async () => {
    const { e, sqls, kv } = e2(); const noKv: any = { ...e }; delete noKv.OAUTH_KV;
    const t = await token(noKv, { grant_type: "authorization_code", code: "a:b:c", client_id: "x" });
    expect(t.status).toBe(503); expect(((await t.json()) as any).error).toBe("temporarily_unavailable");
    const reg = await callIn(noKv, "/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["https://x.example/cb"] }) });
    expect(reg.status).toBe(503);
    const m = await mcpCall(noKv, `Bearer usr_0123456789abcdef0123:${"g".repeat(16)}:${"a".repeat(32)}`);
    expect(m.status).toBe(503);
    expect(sqls.length).toBe(0); expect(kv.length).toBe(0);
    const session = await mintSession(env, "person_mara", "user");
    const ok: any = await (await mcpCall(noKv, `Bearer ${session}`)).json();
    expect(ok.result.structuredContent.result.principal.kind).toBe("user");
  }, 60_000);
  it("(9) wrangler.toml run_worker_first covers /mcp and /mcp/*", () => {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    const line = toml.match(/run_worker_first = \[(.*)\]/)![1];
    for (const p of ['"/mcp"', '"/mcp/*"', '"/token"', '"/register"', '"/authorize"', '"/oauth/*"', '"/.well-known/*"']) expect(line).toContain(p);
  });
});
