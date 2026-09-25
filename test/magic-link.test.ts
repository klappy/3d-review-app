/**
 * B38 email sign-in link (src/magic-link.ts + transport routes in src/index.ts). Real D1 (Miniflare) with the repo's
 * migrations; the Hono app is driven directly. Addresses are synthetic (example.invalid): the real sendMail refuses
 * them, so tests that need the token capture it through the injectable sender.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { invitationMessage } from "../src/mail";
import worker from "../src/worker";
import { resolvePrincipal } from "../src/auth";
import { sha256 } from "../src/handlers/common";
import { execute } from "../src/dispatch";
import {
  MAGIC_LINK_PER_EMAIL, MAGIC_TOKEN, magicLinkMessage, newMagicToken, requestMagicLink, timingSafeEqual, verifyMagicToken,
} from "../src/magic-link";

const MIGRATIONS = ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql"];
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "magic-link", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "magic-link-db" }, kvNamespaces: { OAUTH_KV: "magic-link-kv" } }] }));
afterAll(() => mf.dispose());
const sqlOf = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");

let db: any;
let env: any;
const ORIGIN = "https://app.invalid";
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const f of MIGRATIONS) for (const s of sqlOf(`../migrations/${f}`).split(";").map((x) => x.trim()).filter(Boolean)) await db.prepare(s).run();
});
beforeEach(async () => {
  await db.prepare("DELETE FROM login_code").run();
  await db.prepare("DELETE FROM session").run();
  env = { DB: db, ENVIRONMENT: "dev", MAGIC_LINK: "on", PUBLIC_ORIGIN: ORIGIN, SESSION_SECRET: "synthetic-secret" };
});

/** Issue a link and capture what was mailed. */
async function issue(email: string, opts: { now?: number; next?: "oauth" } = {}) {
  const sent: any[] = [];
  const out = await requestMagicLink(env, email, { ...opts, send: async (_e, m) => { sent.push(m); return { delivered: true, state: "accepted" }; } });
  const token = sent[0] ? /#t=([A-Za-z0-9_-]{43})/.exec(sent[0].text)![1] : "";
  return { out, sent, token };
}
const post = (path: string, body: Record<string, string>, headers: Record<string, string> = {}) =>
  app.fetch(new Request(ORIGIN + path, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(body).toString() }), env);
const postJson = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.fetch(new Request(ORIGIN + path, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }), env);
const sessionFrom = (res: Response) => /^\/#session=(st_[A-Za-z0-9]{32})$/.exec(res.headers.get("location") ?? "")?.[1];

describe("link token", () => {
  it("is 256-bit random base64url and only its SHA-256 is stored — no token, no plaintext email", async () => {
    const a = newMagicToken(), b = newMagicToken();
    expect(a).toMatch(MAGIC_TOKEN); expect(a).not.toBe(b);
    const { token, out } = await issue(" Person.One@Example.invalid ");
    expect(out).toEqual({ state: "sent", minutes: 30 });
    const rows = (await db.prepare("SELECT * FROM login_code").all()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0].code_hash).toBe(await sha256(token));
    expect(rows[0].email_hash).toBe(await sha256("person.one@example.invalid")); // trimmed + lowercased
    expect(rows[0].id).toMatch(/^ml_/);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(JSON.stringify(rows).toLowerCase()).not.toContain("example.invalid");
    expect(rows[0].expires_at - rows[0].created_at).toBe(30 * 60e3);
  });
  it("mail copy is one sentence + the link (token in the fragment) + the expiry", () => {
    const m = magicLinkMessage(ORIGIN, "T".repeat(43), 30, "a+b@example.invalid");
    expect(m.link).toBe(`${ORIGIN}/v2/auth/email/open#t=${"T".repeat(43)}&e=a%2Bb%40example.invalid`); // every link names its address
    expect(m.text).toBe(`Open this link to sign in to 3D Review:\n\n${m.link}\n\nThe link expires in 30 minutes.`);
    expect(magicLinkMessage(ORIGIN, "T".repeat(43), 30, "a+b@example.invalid", "oauth").link).toBe(`${ORIGIN}/v2/auth/email/open?next=oauth#t=${"T".repeat(43)}&e=a%2Bb%40example.invalid`);
  });
  it("is reusable until it expires, then refused", async () => {
    const t0 = Date.now();
    const { token } = await issue("reuse@example.invalid", { now: t0 });
    expect(await verifyMagicToken(env, token, t0 + 1000)).not.toBeNull();
    expect(await verifyMagicToken(env, token, t0 + 29 * 60e3)).not.toBeNull(); // same link again, later
    expect(await verifyMagicToken(env, token, t0 + 30 * 60e3)).toBeNull();      // expired
  });
  it("a newer link does not cancel an older unexpired one", async () => {
    const first = await issue("twice@example.invalid");
    const second = await issue("twice@example.invalid");
    expect(first.token).not.toBe(second.token);
    expect(await verifyMagicToken(env, first.token)).not.toBeNull();
    expect(await verifyMagicToken(env, second.token)).not.toBeNull();
  });
  it("malformed or unknown tokens are refused; malformed ones never touch storage", async () => {
    const spy = vi.spyOn(env.DB, "prepare");
    for (const bad of [undefined, "", "short", "x".repeat(44), "a".repeat(42) + "!"]) expect(await verifyMagicToken(env, bad)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(await verifyMagicToken(env, newMagicToken())).toBeNull();
  });
  it("the six-digit dev code path can never redeem a link row", async () => {
    const { token } = await issue("isolated@example.invalid");
    const r: any = await execute({ env, db, principal: { kind: "anonymous", id: "anon" }, traceId: "tr_ml_iso", now: () => new Date(), log: () => {} } as any,
      "cap.auth.consume_link", { email: "isolated@example.invalid", code: token }, { tool: "write" });
    expect(r.ok).toBe(false);
    expect(await verifyMagicToken(env, token)).not.toBeNull();
  });
  it("timingSafeEqual compares whole strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true); expect(timingSafeEqual("abc", "abd")).toBe(false); expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("invitation copy follows the environment (validator 2 #1)", () => {
  it("email links off (production): byte-identical to the base copy; on: names the sign-in email", () => {
    const off = invitationMessage("https://app.invalid", "il_x", "member", "assessment", 7);
    expect(off.text).toBe([
      "You have been invited to join a assessment in 3D Review as member.", "",
      "To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.", "",
      "https://app.invalid/#invite=il_x", "",
      "The invitation expires in 7 days and only works for this email address. If you were not expecting it, you can ignore this message.",
    ].join("\n"));
    expect(off.html).toBe('<p>You have been invited to join a assessment in 3D Review as <b>member</b>.</p><p>To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.</p><p><a href="https://app.invalid/#invite=il_x">Accept the invitation</a></p><p style="color:#57606a;font-size:14px">The invitation expires in 7 days and only works for this email address. If you were not expecting it, you can ignore this message.</p>');
    const on = invitationMessage("https://app.invalid", "il_x", "member", "assessment", 7, true);
    expect(on.text).toContain("You will get a sign-in email — there is no password."); expect(on.text).not.toContain("one-time code");
    expect(on.html).toContain("You will get a sign-in email — there is no password.");
  });
});

describe("rate limits", () => {
  it(`per email: ${MAGIC_LINK_PER_EMAIL} links per 15 minutes, keyed on the normalised address`, async () => {
    const t0 = Date.now();
    for (let i = 0; i < MAGIC_LINK_PER_EMAIL; i++) expect((await issue(i % 2 ? "LIMIT@example.invalid " : "limit@example.invalid", { now: t0 + i })).out.state).toBe("sent");
    const refused = await issue("limit@example.invalid", { now: t0 + 10 });
    expect(refused.out.state).toBe("limited"); expect(refused.sent).toHaveLength(0);
    expect((await issue("other@example.invalid", { now: t0 + 10 })).out.state).toBe("sent");
    expect((await issue("limit@example.invalid", { now: t0 + 15 * 60e3 + 20 })).out.state).toBe("sent"); // window passed
  });
  it("per email is atomic: 8 concurrent requests for one address issue exactly the cap", async () => {
    const outs = await Promise.all(Array.from({ length: 8 }, () => issue("race@example.invalid")));
    expect(outs.filter((o) => o.out.state === "sent")).toHaveLength(MAGIC_LINK_PER_EMAIL);
    expect(outs.filter((o) => o.out.state === "limited")).toHaveLength(8 - MAGIC_LINK_PER_EMAIL);
    expect(outs.filter((o) => o.out.state === "limited").every((o) => o.sent.length === 0)).toBe(true);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM login_code WHERE email_hash = ?").bind(await sha256("race@example.invalid")).first("n")).toBe(MAGIC_LINK_PER_EMAIL);
  });
  it("per IP: the RL_AUTH ip: key refuses before any storage access or mail", async () => {
    const keys: string[] = [];
    env.RL_AUTH = { limit: async ({ key }: { key: string }) => { keys.push(key); return { success: false }; } };
    const spy = vi.spyOn(env.DB, "prepare");
    const res = await postJson("/v2/auth/email", { email: "ip@example.invalid" }, { "cf-connecting-ip": "192.0.2.7" });
    expect(res.status).toBe(429); expect(res.headers.get("retry-after")).toBe("60");
    expect(keys).toEqual(["ip:192.0.2.7"]); expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("per IP on opening a link: RL_REDEEM ip: key refuses before any storage access", async () => {
    env.RL_REDEEM = { limit: async () => ({ success: false }) };
    const spy = vi.spyOn(env.DB, "prepare");
    const res = await post("/v2/auth/email/open", { t: newMagicToken() });
    expect(res.status).toBe(429); expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("routes", () => {
  it("answers the same for an address that has signed in before and one that never has", async () => {
    await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind("usr_known_b38", await sha256("known@example.invalid"), 1, 0, new Date().toISOString()).run();
    const a = await postJson("/v2/auth/email", { email: "known@example.invalid" });
    const b = await postJson("/v2/auth/email", { email: "stranger@example.invalid" });
    expect(a.status).toBe(200); expect(b.status).toBe(a.status);
    expect(await b.text()).toBe(await a.text());
    const fa = await post("/v2/auth/email", { email: "known@example.invalid" }), fb = await post("/v2/auth/email", { email: "stranger@example.invalid" });
    expect(fa.status).toBe(200); expect(await fb.text()).toBe(await fa.text());
  });
  it("the form answer is the one-line 'Check your email' page", async () => {
    const res = await post("/v2/auth/email", { email: "form@example.invalid" });
    const html = await res.text();
    expect(html).toContain("Check your email"); expect(html).toContain("expires in 30 minutes");
    expect(res.headers.get("content-security-policy")).toContain("form-action 'self'");
  });
  it("a per-email refusal on a connector sign-in keeps next=oauth on the page it shows", async () => {
    for (let i = 0; i < MAGIC_LINK_PER_EMAIL; i++) await issue("busy@example.invalid");
    const res = await post("/v2/auth/email", { email: "busy@example.invalid", next: "oauth" });
    expect(res.status).toBe(429);
    expect(await res.text()).toContain('<input type="hidden" name="next" value="oauth">');
  });
  it("refuses cross-site posts to both endpoints", async () => {
    expect((await postJson("/v2/auth/email", { email: "x@example.invalid" }, { origin: "https://evil.invalid" })).status).toBe(403);
    expect((await post("/v2/auth/email/open", { t: newMagicToken() }, { origin: "https://evil.invalid" })).status).toBe(403);
    expect((await post("/v2/auth/email/open", { t: newMagicToken() }, { origin: "null" })).status).toBe(403);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM login_code").first("n")).toBe(0);
  });
  it("opening the link signs in with a 30-day HttpOnly Secure SameSite=Lax cookie, any number of times, mapped to the existing principal", async () => {
    const eh = await sha256("owner@example.invalid");
    await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind("usr_owner_b38", eh, 1, 0, new Date().toISOString()).run();
    const { token } = await issue("Owner@Example.invalid");
    const first = await post("/v2/auth/email/open", { t: token, e: "owner@example.invalid" });
    expect(first.status).toBe(303);
    const cookie = first.headers.get("set-cookie")!;
    const s1 = sessionFrom(first)!;
    expect(cookie).toBe(`session=${s1}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=2592000`);
    const p = await resolvePrincipal(new Request(ORIGIN + "/v2/me", { headers: { cookie: `session=${s1}` } }), env);
    expect(p).toMatchObject({ kind: "user", id: "usr_owner_b38" }); // same row the Access route maps to → existing grants apply
    const row: any = await db.prepare("SELECT expires_at, created_at FROM session WHERE token_hash = ?").bind(await sha256(s1)).first();
    expect(row.expires_at - row.created_at).toBe(30 * 24 * 3600e3);
    // A second device / browser / scanner opening the same link also works (not single-use).
    const second = await post("/v2/auth/email/open", { t: token, e: "owner@example.invalid" });
    expect(second.status).toBe(303); expect(sessionFrom(second)).not.toBe(s1);
  });
  it("a first-time address gets a new self-serve principal (provisioned, not support)", async () => {
    const { token } = await issue("newcomer@example.invalid");
    const res = await post("/v2/auth/email/open", { t: token, e: "newcomer@example.invalid" });
    const p: any = await resolvePrincipal(new Request(ORIGIN + "/", { headers: { cookie: `session=${sessionFrom(res)}` } }), env);
    expect(p).toMatchObject({ kind: "user", provisioned: true });
    const pr: any = await db.prepare("SELECT support FROM principal WHERE email_hash = ?").bind(await sha256("newcomer@example.invalid")).first();
    expect(pr.support).toBe(0);
  });
  it("an expired or unknown link shows the 'not valid' page and opens no session", async () => {
    const t0 = Date.now() - 31 * 60e3;
    const { token } = await issue("late@example.invalid", { now: t0 });
    for (const t of [token, newMagicToken(), "junk"]) {
      const res = await post("/v2/auth/email/open", { t, e: "late@example.invalid" });
      expect(res.status).toBe(400); expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(await db.prepare("SELECT COUNT(*) AS n FROM session").first("n")).toBe(0);
  });
  it("every open requires the link's own address, hash-matched: missing or mismatched → 'incomplete' page, no session (plain sign-in too)", async () => {
    const { token } = await issue("named@example.invalid");
    for (const body of [{ t: token }, { t: token, e: "" }, { t: token, e: "someone.else@example.invalid" }, { t: token, e: "not an address" }]) {
      const res = await post("/v2/auth/email/open", body);
      expect(res.status).toBe(400); expect(res.headers.get("set-cookie")).toBeNull();
      expect(await res.text()).toContain("This link is incomplete — request a new one.");
    }
    expect(await db.prepare("SELECT COUNT(*) AS n FROM session").first("n")).toBe(0);
    expect((await post("/v2/auth/email/open", { t: token, e: " Named@Example.invalid " })).status).toBe(303); // normalised match
  });
  it("sign-out deletes the session row and clears the cookie", async () => {
    const { token } = await issue("leaver@example.invalid");
    const s = sessionFrom(await post("/v2/auth/email/open", { t: token, e: "leaver@example.invalid" }))!;
    const out = await app.fetch(new Request(ORIGIN + "/v2/auth/session", { method: "DELETE", headers: { cookie: `session=${s}`, origin: ORIGIN } }), env);
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toBe("session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0");
    expect(await db.prepare("SELECT COUNT(*) AS n FROM session WHERE token_hash = ?").bind(await sha256(s)).first("n")).toBe(0);
    expect((await resolvePrincipal(new Request(ORIGIN + "/", { headers: { cookie: `session=${s}` } }), env)).kind).toBe("anonymous");
  });
  it("landing page: nonce'd script only, token read from the fragment, same-origin referrer", async () => {
    const res = await app.fetch(new Request(ORIGIN + "/v2/auth/email/open"), env);
    const csp = res.headers.get("content-security-policy")!;
    const nonce = /script-src 'nonce-([A-Za-z0-9_-]+)'/.exec(csp)![1];
    const html = await res.text();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(csp).toContain("default-src 'none'"); expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
    expect(html).toContain('action="/v2/auth/email/open"');
    expect(csp).toContain("connect-src 'self'");
  });
  it("landing page never signs in by itself: no auto-submit, the button starts hidden and needs a click", async () => {
    const html = await (await app.fetch(new Request(ORIGIN + "/v2/auth/email/open"), env)).text();
    expect(html).not.toMatch(/\.submit\(|requestSubmit|autofocus|http-equiv/i);
    expect(html).toContain('<button type="submit" id="b" hidden>Sign in</button>');
    expect(html).toContain('"/v2/auth/email/check"'); // the script only checks the link
    expect(html).toContain('b.textContent="Sign in as "+v.email');
    expect(html).toContain('if(!v.email){bad("This link is incomplete — request a new one.");return}'); // never an unnamed sign-in
    expect(html).not.toMatch(/if\(v\.email\)/);
    // Only a definite {valid:false} says "expired"; a 429 or network failure offers a retry (Bugbot 4109240140).
    expect(html).toContain('<button type="button" id="r" hidden>Try again</button>');
    expect(html).toContain("x.status===429"); expect(html).toContain("r.onclick=function(){r.hidden=true;check()}");
  });
  it("check endpoint: live link + hash-matched address → that address; mismatch → no address; dead link → invalid; mints nothing", async () => {
    const { token } = await issue("checker@example.invalid");
    const check = async (body: unknown) => (await postJson("/v2/auth/email/check", body)).json() as Promise<any>;
    expect(await check({ t: token, e: "Checker@Example.invalid" })).toEqual({ valid: true, email: "checker@example.invalid" });
    expect(await check({ t: token, e: "attacker@example.invalid" })).toEqual({ valid: true, email: null });
    expect(await check({ t: token })).toEqual({ valid: true, email: null });
    expect(await check({ t: newMagicToken(), e: "checker@example.invalid" })).toEqual({ valid: false });
    expect((await postJson("/v2/auth/email/check", { t: token }, { origin: "https://evil.invalid" })).status).toBe(403);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM session").first("n")).toBe(0);
  });
  it("probe tells the UI whether email links are on (production: off)", async () => {
    expect(await (await app.fetch(new Request(ORIGIN + "/v2/auth/email?probe"), env)).json()).toEqual({ email_links: true });
    const off = await app.fetch(new Request(ORIGIN + "/v2/auth/email?probe"), { ...env, MAGIC_LINK: undefined });
    expect(off.status).toBe(200); expect(await off.json()).toEqual({ email_links: false });
  });
  it("sign-in page: one email field and one 'Email me a sign-in link' button", async () => {
    const html = await (await app.fetch(new Request(ORIGIN + "/v2/auth/email"), env)).text();
    expect(html.match(/<input /g)).toHaveLength(1);
    expect(html).toContain('type="email"'); expect(html).toContain("Email me a sign-in link");
  });
  it("when not enabled every route hands the browser to the Access route; when enabled a bare Access visit lands on the sign-in page", async () => {
    const off = { ...env, MAGIC_LINK: undefined };
    for (const [m, p] of [["GET", "/v2/auth/email"], ["POST", "/v2/auth/email"], ["GET", "/v2/auth/email/open"], ["POST", "/v2/auth/email/open"]]) {
      const res = await app.fetch(new Request(ORIGIN + p, { method: m, headers: { origin: ORIGIN } }), off);
      expect(res.status).toBe(303); expect(res.headers.get("location")).toBe("/v2/auth/access");
    }
    const bare = await app.fetch(new Request(ORIGIN + "/v2/auth/access"), env);
    expect(bare.status).toBe(302); expect(bare.headers.get("location")).toBe("/v2/auth/email");
    const oauth = await app.fetch(new Request(ORIGIN + "/v2/auth/access?next=oauth"), env);
    expect(oauth.headers.get("location")).toBe("/v2/auth/email?next=oauth");
  });
  it("connector sign-in (next=oauth): with this browser's parked request the link shows consent naming the verified email and opens no web session", async () => {
    const oauthEnv = { ...env, OAUTH_KV: { get: async () => JSON.stringify({ clientId: "c1", redirectUri: "https://client.invalid/cb" }) }, OAUTH_PROVIDER: { lookupClient: async () => ({ clientName: "Test app" }) } };
    const { token, sent } = await issue("connector@example.invalid", { next: "oauth" });
    expect(sent[0].text).toContain("?next=oauth#t=" + token + "&e=connector%40example.invalid");
    expect((await issue("plain@example.invalid")).sent[0].text).toContain("&e=plain%40example.invalid"); // ordinary links too
    const req = (e: string, cookie?: string) => app.fetch(new Request(ORIGIN + "/v2/auth/email/open?next=oauth", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) }, body: new URLSearchParams({ t: token, e }).toString() }), oauthEnv);
    const consent = await req("connector@example.invalid", "__Host-oauth_req=park1");
    expect(consent.status).toBe(200); expect(consent.headers.get("set-cookie")).toBeNull();
    const html = await consent.text();
    expect(html).toContain("Test app"); expect(html).toContain("connector@example.invalid");
    const spoofed = await req("someone.else@example.invalid", "__Host-oauth_req=park1"); // e must hash-match the link's row
    expect(spoofed.status).toBe(400); expect(await spoofed.text()).not.toContain("someone.else@example.invalid");
    const unnamed = await req("", "__Host-oauth_req=park1"); // no address → connector binding refused, no session either
    expect(unnamed.status).toBe(400); expect(unnamed.headers.get("set-cookie")).toBeNull();
    const elsewhere = await req("connector@example.invalid"); // opened in another browser: ordinary sign-in
    expect(elsewhere.status).toBe(303); expect(sessionFrom(elsewhere)).toBeTruthy();
  });
});

describe("connector end to end through the real worker: register → authorize → email link (e=) → consent → token → MCP", () => {
  const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined }) as any;
  let wenv: any;
  const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(ORIGIN + path, { redirect: "manual", ...init }), wenv, ectx());
  it("signs a connector in with the verified address and no web session; a mismatched address is refused", async () => {
    wenv = { ...env, OAUTH_KV: await mf.getKVNamespace("OAUTH_KV") };
    const reg = await call("/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "E2E Connector", redirect_uris: ["https://client.invalid/cb"], token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] }) });
    expect(reg.status).toBe(201); const clientId = ((await reg.json()) as any).client_id as string;
    const verifier = b64u(crypto.getRandomValues(new Uint8Array(32))), challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const authz = await call(`/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("https://client.invalid/cb")}&code_challenge=${challenge}&code_challenge_method=S256&state=st-e2e&scope=3dreview`);
    expect(authz.status).toBe(302); expect(authz.headers.get("location")).toBe("/v2/auth/access?next=oauth");
    const park = authz.headers.get("set-cookie")!.split(";")[0];
    const bounce = await call("/v2/auth/access?next=oauth", { headers: { cookie: park } }); // Access removed: no assertion
    expect(bounce.status).toBe(302); expect(bounce.headers.get("location")).toBe("/v2/auth/email?next=oauth");
    // The mail step (sendMail refuses synthetic addresses, so the link is captured from the injectable sender).
    const sent: any[] = [];
    expect((await requestMagicLink(wenv, "E2E.Owner@example.invalid", { next: "oauth", send: async (_e, m) => { sent.push(m); return { delivered: true, state: "accepted" }; } })).state).toBe("sent");
    const link = new URL(/https:\S+/.exec(sent[0].text)![0]);
    expect(link.pathname + link.search).toBe("/v2/auth/email/open?next=oauth");
    const frag = /^#t=([A-Za-z0-9_-]{43})&e=(.+)$/.exec(link.hash)!; const t = frag[1], e = decodeURIComponent(frag[2]);
    expect(e).toBe("e2e.owner@example.invalid");
    const landing = await call(link.pathname + link.search, { headers: { cookie: park } });
    expect(landing.status).toBe(200); expect(landing.headers.get("set-cookie")).toBeNull();
    const checked: any = await (await call("/v2/auth/email/check", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ t, e }) })).json();
    expect(checked).toEqual({ valid: true, email: "e2e.owner@example.invalid" });
    const open = (addr: string) => call("/v2/auth/email/open?next=oauth", { method: "POST", headers: { origin: ORIGIN, cookie: park, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ t, e: addr }).toString() });
    const refused = await open("other.person@example.invalid");
    expect(refused.status).toBe(400); expect(refused.headers.get("set-cookie")).toBeNull();
    const page = await open(e);
    expect(page.status).toBe(200); expect(page.headers.get("set-cookie") ?? "").not.toMatch(/session=/);
    const html = await page.text();
    expect(html).toContain("e2e.owner@example.invalid"); expect(html).toContain("E2E Connector");
    const ticket = /name="ticket" value="([^"]+)"/.exec(html)![1];
    const done = await call("/oauth/consent", { method: "POST", headers: { cookie: park, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ticket, decision: "approve" }).toString() });
    expect(done.status).toBe(302);
    const back = new URL(done.headers.get("location")!); expect(back.searchParams.get("state")).toBe("st-e2e");
    const tok = await call("/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code")!, client_id: clientId, redirect_uri: "https://client.invalid/cb", code_verifier: verifier }).toString() });
    expect(tok.status).toBe(200); const access = ((await tok.json()) as any).access_token as string;
    const me: any = await (await call("/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${access}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read", arguments: { capability: "cap.auth.me", params: {} } } }) })).json();
    const pr: any = await db.prepare("SELECT id FROM principal WHERE email_hash = ?").bind(await sha256("e2e.owner@example.invalid")).first();
    expect(me.result.structuredContent.result.principal).toMatchObject({ id: pr.id, kind: "user", delegated_by: `oauth:${clientId}` });
  });
});
