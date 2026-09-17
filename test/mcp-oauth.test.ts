// MCP authorization end to end through the real worker entry (src/worker.ts): discovery → DCR → PKCE code flow with the
// Cloudflare Access identity stubbed at the JWKS fetch → delegated MCP call → revoke. Borrowed provider is NOT mocked.
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import worker from "../src/worker";
import { mintSession } from "../src/auth";
import { resetAccessKeyCache } from "../src/access";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "oauth", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "oauth-test-db" }, kvNamespaces: { OAUTH_KV: "oauth-test-kv" } }] }));
afterAll(() => mf.dispose());
afterEach(() => { vi.restoreAllMocks(); resetAccessKeyCache(); });
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
const b64u = (b: ArrayBuffer | Uint8Array | string) => { const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
let env: any; let kp: CryptoKeyPair; let jwks: any;
const ORIGIN = "https://3dr.test";
const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined }) as any;
const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(ORIGIN + path, { redirect: "manual", ...init }), env, ectx());
async function accessJwt(email: string) {
  const head = b64u(JSON.stringify({ alg: "RS256", kid: "k1" }));
  const body = b64u(JSON.stringify({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) + 60, email, sub: "s-" + email }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
const stubJwks = () => { const real = globalThis.fetch; vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => String(input?.url ?? input).includes("/cdn-cgi/access/certs") ? new Response(JSON.stringify(jwks)) : real(input, init)); };
const mcpCall = (token: string | undefined, tool: string, capability: string) => call("/mcp", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: { capability, params: {} } } }) });

beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, OAUTH_KV: await mf.getKVNamespace("OAUTH_KV"), SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1" };
  kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  jwks = { keys: [{ kid: "k1", kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" }] };
}, 60_000);

async function register(name = "Test Connector <script>") {
  const r = await call("/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: name, redirect_uris: ["https://client.example/cb"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
  expect(r.status).toBe(201); return (await r.json() as any).client_id as string;
}
async function pkce() { const verifier = b64u(crypto.getRandomValues(new Uint8Array(32))); return { verifier, challenge: b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))) }; }
async function toConsent(clientId: string, challenge: string, email: string) {
  const a = await call(`/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("https://client.example/cb")}&code_challenge=${challenge}&code_challenge_method=S256&state=st-1&scope=3dreview`);
  expect(a.status).toBe(302); expect(a.headers.get("location")).toBe("/v2/auth/access?next=oauth");
  const cookie = a.headers.get("set-cookie")!.split(";")[0];
  stubJwks();
  const page = await call("/v2/auth/access?next=oauth", { headers: { cookie, "cf-access-jwt-assertion": await accessJwt(email) } });
  const htmlText = await page.text();
  return { cookie, page, htmlText, ticket: htmlText.match(/name="ticket" value="([^"]+)"/)?.[1] };
}
const consent = (cookie: string, ticket: string, decision: string) => call("/oauth/consent", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ticket, decision }).toString() });

describe("MCP authorization (borrowed provider + Access email-code + consent)", () => {
  it("unauthenticated /mcp is refused with a discovery pointer; metadata advertises DCR + PKCE", async () => {
    const r = await mcpCall(undefined, "read", "cap.auth.me");
    expect(r.status).toBe(401); expect(r.headers.get("www-authenticate") ?? "").toMatch(/Bearer/i);
    const meta: any = await (await call("/.well-known/oauth-authorization-server")).json();
    expect(meta.authorization_endpoint).toBe(ORIGIN + "/authorize"); expect(meta.token_endpoint).toBe(ORIGIN + "/token");
    expect(meta.registration_endpoint).toBe(ORIGIN + "/register"); expect(meta.code_challenge_methods_supported).toContain("S256");
  });

  it("full flow: register → authorize → Access identity → consent → token → delegated call → logout revokes", async () => {
    const clientId = await register(); const { verifier, challenge } = await pkce();
    const { cookie, page, htmlText, ticket } = await toConsent(clientId, challenge, "Demo.Owner@Example.invalid");
    expect(page.status).toBe(200); expect(page.headers.get("x-frame-options")).toBe("DENY");
    expect(htmlText).toContain("demo.owner@example.invalid"); expect(htmlText).toContain("client.example");
    expect(htmlText).toContain("Test Connector &lt;script&gt;"); expect(htmlText).not.toContain("<script>"); // client name is attacker-controlled
    expect(page.headers.get("set-cookie") ?? "").not.toMatch(/session=/); // consent opens no web session
    const done = await consent(cookie, ticket!, "approve");
    expect(done.status).toBe(302);
    const back = new URL(done.headers.get("location")!); expect(back.origin + back.pathname).toBe("https://client.example/cb"); expect(back.searchParams.get("state")).toBe("st-1");
    const code = back.searchParams.get("code")!; expect(code).toBeTruthy();
    // single use: the same ticket cannot grant twice
    expect((await consent(cookie, ticket!, "approve")).status).toBe(400);
    // wrong PKCE verifier is refused by the provider
    const bad = await call("/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: "https://client.example/cb", code_verifier: "wrong-" + verifier }).toString() });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    // a fresh authorization (codes are single-use even on failure)
    const p2 = await pkce(); const c2 = await toConsent(clientId, p2.challenge, "demo.owner@example.invalid");
    const code2 = new URL((await consent(c2.cookie, c2.ticket!, "approve")).headers.get("location")!).searchParams.get("code")!;
    const tok = await call("/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: code2, client_id: clientId, redirect_uri: "https://client.example/cb", code_verifier: p2.verifier }).toString() });
    expect(tok.status).toBe(200); const access = (await tok.json() as any).access_token as string; expect(access).toBeTruthy();
    const me: any = await (await mcpCall(access, "read", "cap.auth.me")).json();
    expect(me.result.structuredContent.ok).toBe(true);
    expect(me.result.structuredContent.result.principal.kind).toBe("user");
    expect(me.result.structuredContent.result.principal.delegated_by).toBe(`oauth:${clientId}`);
    // the consent page's promise is true: the call is traced with the app that made it
    const traced = await env.DB.prepare("SELECT spans_json FROM trace WHERE trace_id = ?").bind(me.result.structuredContent.trace_id).first();
    expect(JSON.parse(traced.spans_json).delegated_by).toBe(`oauth:${clientId}`);
    // the OAuth token is NOT a web session: the HTTP face does not accept it
    expect((await call("/v2/me", { headers: { authorization: `Bearer ${access}` } })).status).toBe(401);
    // logout through MCP revokes the grant; the token stops working
    const out: any = await (await mcpCall(access, "write", "cap.auth.logout")).json();
    expect(out.result.structuredContent.result.signed_out).toBe(true);
    expect((await mcpCall(access, "read", "cap.auth.me")).status).toBe(401);
  }, 60_000);

  it("deny returns access_denied; a ticket is useless without the browser that parked the request", async () => {
    const clientId = await register("Other"); const { challenge } = await pkce();
    const a = await toConsent(clientId, challenge, "demo.member@example.invalid");
    expect((await consent("oauth_req=someone-else", a.ticket!, "approve")).status).toBe(400);
    expect((await consent(a.cookie, a.ticket!.slice(0, -3) + "AAA", "approve")).status).toBe(400);
    const denied = await consent(a.cookie, a.ticket!, "deny");
    expect(new URL(denied.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
  }, 60_000);

  it("authorize refuses an unregistered client and an unregistered redirect without redirecting", async () => {
    const { challenge } = await pkce();
    const unknown = await call(`/authorize?response_type=code&client_id=nope&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=${challenge}&code_challenge_method=S256`);
    expect(unknown.status).toBe(400);
    const clientId = await register("Third");
    const wrongRedirect = await call(`/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=${challenge}&code_challenge_method=S256`);
    expect(wrongRedirect.status).toBe(400); expect(wrongRedirect.headers.get("location")).toBeNull();
  }, 60_000);

  it("first-party bearers still work on /mcp; a made-up bearer does not", async () => {
    const session = await mintSession(env, "person_mara", "user");
    const me: any = await (await mcpCall(session, "read", "cap.auth.me")).json();
    expect(me.result.structuredContent.ok).toBe(true); expect(me.result.structuredContent.result.principal.delegated_by).toBeNull();
    expect((await mcpCall("st_not-a-real-token", "read", "cap.auth.me")).status).toBe(401);
  }, 60_000);

  it("without the parked-request marker the Access route behaves exactly as before (web session)", async () => {
    stubJwks();
    const r = await call("/v2/auth/access", { headers: { "cf-access-jwt-assertion": await accessJwt("demo.owner@example.invalid") } });
    expect(r.status).toBe(302); expect(r.headers.get("location")).toMatch(/^\/#session=/);
  }, 60_000);
});
