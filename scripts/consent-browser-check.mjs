#!/usr/bin/env node
// Browser oracle for the OAuth consent page (fix/pr15-auth-hardening A1; Bugbot 4032352529, review #15 finding 1).
//
// fetch()-driven tests cannot see browser-enforced CSP. This script runs the REAL worker entry (src/worker.ts, borrowed
// provider included) in-process on http://localhost:<port> — Miniflare D1 + KV exactly as the vitest suites use them, the
// TypeScript loaded through Vite with the same yaml/sql-as-text plugin and cloudflare:workers alias as vitest.config.ts —
// with a fetch shim for the Cloudflare Access JWKS and a synthetic Access JWT set as `cf-access-jwt-assertion` on the browser
// context. A loopback client callback server is the registered redirect_uri (the provider allows any loopback port).
// Headless Chromium (Playwright) then walks /authorize → Access → consent → Connect / Cancel and the script asserts:
//   (a) Connect → navigation lands on the client's /cb with ?code= and the state
//   (b) Cancel  → navigation lands on the client's /cb with ?error=access_denied
//   (c) no CSP violation in the console and no securitypolicyviolation event on either walk
//   (d) an unregistered redirect_uri → 400 with no Location header (no widening to unvalidated destinations)
//   (e) a custom-scheme client's consent page carries form-action 'self' <scheme>: (header-only; no protocol handler here)
//
// Playwright is NOT a dependency of this repo: point PLAYWRIGHT_DIR at a node_modules that contains it (and optionally
// PLAYWRIGHT_CHROMIUM at the Chromium executable). Exit code 0 = every assertion held.
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createServer as createVite } from "vite";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql"];
const results = []; let failures = 0;
const check = (name, ok, detail = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++; };
const b64u = (b) => { const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b); return Buffer.from(bytes).toString("base64url"); };
const listen = (srv) => new Promise((res) => srv.listen(0, "localhost", () => res(srv.address().port)));

// --- Playwright (external tool input) --------------------------------------------------------------------------------
const pwDir = process.env.PLAYWRIGHT_DIR;
const pw = await import(pwDir ? pathToFileURL(join(pwDir, "playwright", "index.mjs")).href : "playwright");
const pwVersion = JSON.parse(readFileSync(pwDir ? join(pwDir, "playwright", "package.json") : new URL("playwright/package.json", import.meta.resolve("playwright")), "utf8")).version;
const chromium = pw.chromium;

// --- Worker in-process ------------------------------------------------------------------------------------------------
const vite = await createVite({
  root, configFile: false, logLevel: "error", server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom",
  plugins: [{ name: "yaml-as-text", transform(_code, id) { if (id.endsWith(".yaml") || id.endsWith(".sql")) return { code: `export default ${JSON.stringify(readFileSync(id, "utf8"))};`, map: null }; } }],
  resolve: { alias: { "cloudflare:workers": join(root, "test/stubs/cloudflare-workers.ts") } },
  ssr: { noExternal: ["@cloudflare/workers-oauth-provider"] },
});
const { default: worker } = await vite.ssrLoadModule("/src/worker.ts");

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "oracle", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "oracle-db" }, kvNamespaces: { OAUTH_KV: "oracle-kv" } }] }));
const db = await mf.getD1Database("DB");
const statements = (path) => readFileSync(join(root, path), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n").split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
for (const m of MIGRATIONS) await db.batch(statements(`migrations/${m}`));
await db.batch(statements("seed/synthetic.sql"));
const env = { DB: db, OAUTH_KV: await mf.getKVNamespace("OAUTH_KV"), SESSION_SECRET: "oracle-secret", ENVIRONMENT: "dev", ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1" };

// Access identity: a synthetic RS256 key; the worker's JWKS fetch is shimmed to return it.
const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
const jwks = { keys: [{ kid: "k1", kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" }] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => String(input?.url ?? input).includes("/cdn-cgi/access/certs") ? new Response(JSON.stringify(jwks)) : realFetch(input, init);
async function accessJwt(email) {
  const head = b64u(JSON.stringify({ alg: "RS256", kid: "k1" }));
  const body = b64u(JSON.stringify({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) + 600, email, sub: "s-" + email }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

// Node http → worker.fetch bridge (the cf-connecting-ip header is what src/ratelimit.ts keys on).
const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined });
let origin = "";
const app = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  headers.set("cf-connecting-ip", "203.0.113.5");
  const r = await worker.fetch(new Request(origin + req.url, { method: req.method, headers, body, redirect: "manual" }), env, ectx());
  const out = {}; r.headers.forEach((v, k) => { out[k] = k === "set-cookie" ? r.headers.getSetCookie() : v; });
  res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()));
});
const port = await listen(app); origin = `http://localhost:${port}`;

// Loopback client: records what the browser lands on.
const landed = [];
const client = http.createServer((req, res) => { if (req.url !== "/favicon.ico") landed.push(req.url); res.writeHead(200, { "content-type": "text/html" }); res.end("<title>client</title><p id=cb>callback</p>"); });
const clientPort = await listen(client); const redirectUri = `http://localhost:${clientPort}/cb`;

// --- Register clients via the real /register ---------------------------------------------------------------------------
const register = async (redirect) => (await (await realFetch(`${origin}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Browser Oracle", redirect_uris: [redirect], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) })).json()).client_id;
const clientId = await register(redirectUri);
const cursorClientId = await register("cursor://anysphere.cursor-mcp/oauth/callback");
const pkce = async () => { const verifier = b64u(crypto.getRandomValues(new Uint8Array(32))); return { verifier, challenge: b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))) }; };
const authorizeUrl = (cid, redirect, challenge, state) => `${origin}/authorize?response_type=code&client_id=${encodeURIComponent(cid)}&redirect_uri=${encodeURIComponent(redirect)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}&scope=3dreview`;

// --- Browser ----------------------------------------------------------------------------------------------------------
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const chromiumVersion = browser.version();
const context = await browser.newContext({ extraHTTPHeaders: { "cf-access-jwt-assertion": await accessJwt("demo.owner@example.invalid") } });
const consoleLines = []; const violations = [];
async function walk(decision, state) {
  const page = await context.newPage();
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  await page.addInitScript(() => { document.addEventListener("securitypolicyviolation", (e) => { window.__cspv = (window.__cspv || []).concat([{ directive: e.violatedDirective, blocked: e.blockedURI, disposition: e.disposition }]); }); });
  const { challenge } = await pkce();
  await page.goto(authorizeUrl(clientId, redirectUri, challenge, state), { waitUntil: "load" });
  const consentUrl = page.url();
  const cspHeader = (await page.context().request.get(consentUrl, { headers: { cookie: (await context.cookies(origin)).map((c) => `${c.name}=${c.value}`).join("; ") } })).headers()["content-security-policy"];
  const title = await page.locator("h1").first().textContent();
  const pageViolations = await page.evaluate(() => window.__cspv || []);
  const nav = page.waitForURL((u) => u.origin === `http://localhost:${clientPort}`, { timeout: 5000 }).then(() => true, () => false);
  await page.click(decision === "approve" ? "button.go" : "button[value=deny]");
  const arrived = await nav;
  const after = page.url();
  const laterViolations = await page.evaluate(() => window.__cspv || []).catch(() => []);
  violations.push(...pageViolations, ...laterViolations);
  await page.close();
  return { consentUrl, cspHeader, title, arrived, after };
}

const a = await walk("approve", "st-connect");
const aUrl = new URL(a.after);
check("(a) Connect: consent page served by the worker", a.consentUrl === `${origin}/v2/auth/access?next=oauth` && /Connect/.test(a.title ?? ""), `${a.consentUrl} / h1="${(a.title ?? "").trim()}"`);
check("(a) Connect: consent CSP form-action widened to the client's origin only", a.cspHeader === `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://localhost:${clientPort}; frame-ancestors 'none'`, a.cspHeader);
check("(a) Connect: browser navigation reached the client callback with code + state", a.arrived && aUrl.origin === `http://localhost:${clientPort}` && aUrl.pathname === "/cb" && !!aUrl.searchParams.get("code") && aUrl.searchParams.get("state") === "st-connect", a.after.replace(/code=[^&]+/, "code=<redacted>"));

const d = await walk("deny", "st-cancel");
const dUrl = new URL(d.after);
check("(b) Cancel: browser navigation reached the client callback with error=access_denied + state", d.arrived && dUrl.origin === `http://localhost:${clientPort}` && dUrl.pathname === "/cb" && dUrl.searchParams.get("error") === "access_denied" && dUrl.searchParams.get("state") === "st-cancel", d.after);

const cspConsole = consoleLines.filter((l) => /Content Security Policy|Refused to/i.test(l));
check("(c) no CSP violation in the console on either walk", cspConsole.length === 0, cspConsole.join(" | ") || `${consoleLines.length} console line(s), none CSP`);
check("(c) no securitypolicyviolation event on either walk", violations.length === 0, JSON.stringify(violations));
check("(c) client callback server saw exactly the two landings", landed.length === 2 && landed.every((u) => u.startsWith("/cb?")), landed.map((u) => u.replace(/code=[^&]+/, "code=<redacted>")).join(" , "));

// (d) negative: unregistered redirect_uri never gets a Location (and thus no widened CSP for it)
const page = await context.newPage();
const { challenge } = await pkce();
const resp = await page.goto(authorizeUrl(clientId, `http://localhost:${clientPort}/elsewhere`, challenge, "st-neg"), { waitUntil: "load" });
check("(d) unregistered redirect_uri → 400, no Location, CSP stays 'self'", resp.status() === 400 && !resp.headers()["location"] && resp.headers()["content-security-policy"] === "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", `${resp.status()} location=${resp.headers()["location"] ?? "<none>"} csp=${resp.headers()["content-security-policy"]}`);
const evil = await page.goto(authorizeUrl(clientId, "https://evil.example/cb", challenge, "st-neg2"), { waitUntil: "load" });
check("(d) foreign redirect_uri → 400, no Location", evil.status() === 400 && !evil.headers()["location"], `${evil.status()} location=${evil.headers()["location"] ?? "<none>"}`);
await page.close();

// (e) custom scheme: header only (headless Chromium has no protocol handler for cursor://)
const cp = await context.newPage();
const { challenge: cc } = await pkce();
const cResp = await cp.goto(authorizeUrl(cursorClientId, "cursor://anysphere.cursor-mcp/oauth/callback", cc, "st-cursor"), { waitUntil: "load" });
check("(e) custom-scheme client: consent page CSP is form-action 'self' cursor: (header-only claim)", cResp.status() === 200 && cResp.headers()["content-security-policy"] === "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' cursor:; frame-ancestors 'none'", cResp.headers()["content-security-policy"]);
await cp.close();

// D1 / KV facts after the walks
const redemptions = (await db.prepare("SELECT COUNT(*) AS n FROM oauth_code_redemption").first()).n;
const parked = (await env.OAUTH_KV.list({ prefix: "3dr:authreq:" })).keys.length;

await browser.close(); await vite.close(); app.close(); client.close(); await mf.dispose();

console.log(`consent-browser-check — worker in-process at ${origin}, client callback at ${redirectUri}`);
console.log(`Chromium ${chromiumVersion} via Playwright ${pwVersion} (headless); Node ${process.version}`);
for (const r of results) console.log(r);
console.log(`facts: oauth_code_redemption rows=${redemptions} (no /token call in this script), parked authreq keys left=${parked} (consent consumed both; the cursor:// walk parked one and never consented)`);
console.log(`non-claims: Firefox/WebKit not exercised; custom-scheme redirect is header-tested only; Miniflare KV/D1, not production storage.`);
console.log(failures === 0 ? "RESULT: PASS" : `RESULT: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
