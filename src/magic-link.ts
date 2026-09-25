/**
 * Email sign-in link (B38, captain 2026-09-25 17:50 ET): enter email → we email a link → opening it signs you in.
 * Replaces the Cloudflare Access one-time PIN for the app's own sign-in. Cloudflare Access may stay in front of
 * GET /v2/auth/access meanwhile; the app accepts EITHER a verified Access JWT (that route) OR a session minted here.
 * Identity = the verified email, mapped by sha256(normalised email) to the SAME principal row the Access route
 * upserts — so existing grants, invitations and self-serve creation apply unchanged.
 *
 * Link properties (captain's order):
 *   - token: 32 random bytes (256 bit), base64url; only SHA-256(token) is stored; the looked-up row's hash is compared
 *     again in constant time.
 *   - lifetime MAGIC_LINK_TTL_MINUTES (default 30). NOT single-use: the same link signs in any number of times, on any
 *     device or browser, until it expires (email security scanners that open links first cannot burn it).
 *   - a newer link never cancels an older unexpired one (nothing is deleted on request, only expired rows).
 *   - no same-browser binding (WhatsApp / Gmail in-app / Safari hand-offs work).
 *   - the token travels in the URL FRAGMENT (`/v2/auth/email/open#t=…`), like `/#invite=` and `/#session=`: it never
 *     reaches a server log, an edge log or a Referer. The landing page (tiny, CSP-locked, one nonce'd script) moves it
 *     into a same-origin POST and submits; the visible "Sign in" button is the fallback.
 *
 * Storage: the existing `login_code` table (no migration). Link rows use the `ml_` id prefix; `code_hash` = SHA-256 of
 * the token (UNIQUE → indexed lookup); `email_hash` = SHA-256 of the normalised email. No plaintext email is stored.
 * cap.auth.consume_link (the dev-only six-digit code) never matches `ml_` rows.
 *
 * Rate limits (captain: per email and per IP):
 *   per email  MAGIC_LINK_PER_EMAIL links per MAGIC_LINK_WINDOW_MS, counted in D1 (durable, global)
 *   per IP     RL_AUTH `ip:` key (10 / 60 s, the repo's sign-in limiter binding) before any storage access
 *   open       RL_REDEEM `ip:` key (60 / 60 s, sized for a workshop room behind one NAT) before any storage access
 * The request answer is the same whether or not the address has ever signed in (principals are created on first use).
 */
import type { Env } from "./handlers/types";
import { id, sha256 } from "./handlers/types";
import { mintSession } from "./auth";
import { normalizeAddress, publicOrigin, sendMail, type MailMessage, type MailResult } from "./mail";

export const MAGIC_LINK_DEFAULT_TTL_MINUTES = 30;
export const MAGIC_LINK_WINDOW_MS = 15 * 60e3;
export const MAGIC_LINK_PER_EMAIL = 5;
export const MAGIC_SESSION_TTL_MS = 30 * 24 * 3600e3;
export const MAGIC_SESSION_MAX_AGE_S = MAGIC_SESSION_TTL_MS / 1000;
/** 32 bytes base64url, no padding = exactly 43 chars. Anything else is refused with ZERO storage access. */
export const MAGIC_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ROW_PREFIX = "ml_";

/** Enabled per environment by an explicit var (wrangler.toml DEV only). Absent → the Access flow stays the only one. */
export const magicLinkEnabled = (env: Env): boolean => env.MAGIC_LINK === "on";

export function magicLinkTtlMinutes(env: Env): number {
  const n = Number(env.MAGIC_LINK_TTL_MINUTES);
  return Number.isInteger(n) && n >= 5 && n <= 60 ? n : MAGIC_LINK_DEFAULT_TTL_MINUTES;
}

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const newMagicToken = (): string => b64u(crypto.getRandomValues(new Uint8Array(32)));

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Mail copy: one short sentence + the link + the expiry. Plain, no tracking, no images. */
export function magicLinkMessage(origin: string, token: string, minutes: number, next?: "oauth") {
  const link = `${origin}/v2/auth/email/open${next === "oauth" ? "?next=oauth" : ""}#t=${token}`;
  const subject = "Your 3D Review sign-in link";
  const text = ["Open this link to sign in to 3D Review:", "", link, "", `The link expires in ${minutes} minutes.`].join("\n");
  const html = `<p>Open this link to sign in to 3D Review:</p><p><a href="${esc(link)}">Sign in to 3D Review</a></p><p style="color:#57606a;font-size:14px">The link expires in ${minutes} minutes.</p>`;
  return { subject, text, html, link };
}

export type RequestOutcome = { state: "sent"; minutes: number } | { state: "invalid" } | { state: "limited" } | { state: "unavailable" };
export type Sender = (env: Env, m: MailMessage) => Promise<MailResult>;

/**
 * Issue a link. "sent" is returned whether or not the address is known, and whether or not the provider accepted the
 * message (the outcome is logged without the address) — the caller cannot learn anything about an account from it.
 * The IP limiter runs in the route before this; the per-email count runs here.
 */
export async function requestMagicLink(env: Env, rawEmail: unknown, opts: { now?: number; next?: "oauth"; send?: Sender } = {}): Promise<RequestOutcome> {
  const email = normalizeAddress(rawEmail);
  if (!email) return { state: "invalid" };
  const origin = publicOrigin(env);
  if (!origin) { console.error("auth.magic_link.no_origin", "PUBLIC_ORIGIN is not set; no link can be built"); return { state: "unavailable" }; }
  const now = opts.now ?? Date.now();
  const minutes = magicLinkTtlMinutes(env);
  const eh = await sha256(email);
  // Housekeeping: only rows that are expired AND older than the counting window go (a newer link never removes an older one).
  await env.DB.prepare("DELETE FROM login_code WHERE id LIKE 'ml\\_%' ESCAPE '\\' AND expires_at < ? AND created_at < ?").bind(now, now - MAGIC_LINK_WINDOW_MS).run();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_code WHERE id LIKE 'ml\\_%' ESCAPE '\\' AND email_hash = ? AND created_at > ?").bind(eh, now - MAGIC_LINK_WINDOW_MS).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAGIC_LINK_PER_EMAIL) return { state: "limited" };
  const token = newMagicToken();
  const th = await sha256(token);
  await env.DB.prepare("INSERT INTO login_code (id, email_hash, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)")
    .bind(id(ROW_PREFIX.slice(0, -1)), eh, th, now + minutes * 60e3, now).run();
  const m = magicLinkMessage(origin, token, minutes, opts.next);
  const result = await (opts.send ?? sendMail)(env, { to: email, subject: m.subject, text: m.text, html: m.html, idempotencyKey: `magic-link:${th.slice(0, 16)}` });
  // Never the address or the token: the hash prefix correlates with the row for an operator, nothing more.
  console.log("auth.magic_link.issued", JSON.stringify({ email_hash_prefix: eh.slice(0, 8), state: result.state, reason: result.reason ?? null }));
  return { state: "sent", minutes };
}

/** Verify a link token. Reusable until expiry; null for anything malformed, unknown or expired. */
export async function verifyMagicToken(env: Env, token: unknown, now = Date.now()): Promise<{ emailHash: string } | null> {
  if (typeof token !== "string" || !MAGIC_TOKEN.test(token)) return null;
  const th = await sha256(token);
  const row = await env.DB.prepare("SELECT code_hash, email_hash, expires_at FROM login_code WHERE code_hash = ? AND id LIKE 'ml\\_%' ESCAPE '\\'")
    .bind(th).first<{ code_hash: string; email_hash: string; expires_at: number }>();
  if (!row || !timingSafeEqual(row.code_hash, th)) return null;
  if (!(Number(row.expires_at) > now)) return null;
  return { emailHash: row.email_hash };
}

/** Same principal mapping as the Access route: sha256(normalised email) → principal row, created on first sign-in. */
export async function principalForEmailHash(env: Env, eh: string): Promise<{ id: string; support: number } | null> {
  await env.DB.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
    // provisioned = 1: self-service creation (captain ruling 2026-09-17), identical to the Access route. support stays 0.
    .bind(`usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, eh, 1, 0, new Date().toISOString()).run();
  return env.DB.prepare("SELECT id, support FROM principal WHERE email_hash = ?").bind(eh).first<{ id: string; support: number }>();
}

/** A fresh web session (random, stored hashed by mintSession) valid for 30 days. */
export async function mintMagicSession(env: Env, principal: { id: string; support: number }): Promise<string> {
  return mintSession(env, principal.id, principal.support ? "support" : "user", {}, MAGIC_SESSION_TTL_MS);
}

export const magicSessionCookie = (token: string) => `session=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${MAGIC_SESSION_MAX_AGE_S}`;
export const clearSessionCookie = "session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0";

// ---------------------------------------------------------------------------------------------------------------
// Pages. Server-rendered, no framework, CSP-locked: no script except the one nonce'd fragment reader on the landing
// page, form posts only to this origin, no frames. Referrer-Policy same-origin so the same-origin POSTs carry Origin.
// ---------------------------------------------------------------------------------------------------------------
const STYLE = "body{font:16px/1.5 system-ui,sans-serif;max-width:26rem;margin:10vh auto;padding:0 1rem;color:#1b1f23}h1{font-size:1.3rem}label{display:block;margin:1rem 0 .3rem}input[type=email]{font:inherit;width:100%;box-sizing:border-box;padding:.6rem;border:1px solid #8c959f;border-radius:.4rem}button{font:inherit;width:100%;margin-top:1rem;padding:.7rem;border-radius:.4rem;border:1px solid #1b1f23;background:#1b1f23;color:#fff;cursor:pointer}small,.muted{color:#57606a}a{color:#0969da}";
export function page(title: string, body: string, status = 200, nonce?: string): Response {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; ${nonce ? `script-src 'nonce-${nonce}'; ` : ""}form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — 3D Review</title><style>${STYLE}</style>${body}</html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "content-security-policy": csp, "referrer-policy": "same-origin" } });
}
const nextField = (next?: "oauth") => (next === "oauth" ? '<input type="hidden" name="next" value="oauth">' : "");
export const signInPage = (next?: "oauth", note = "") => page("Sign in",
  `<h1>Sign in to 3D Review</h1>${note ? `<p role="alert">${esc(note)}</p>` : ""}<form method="post" action="/v2/auth/email">${nextField(next)}<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254"><button type="submit">Email me a sign-in link</button></form><p><small>No password. We email you a link that signs you in.</small></p>`);
export const checkEmailPage = (minutes: number) => page("Check your email",
  `<h1>Check your email</h1><p role="status">We sent you a sign-in link. It expires in ${minutes} minutes.</p><p><small><a href="/v2/auth/email">Use a different email</a> · <a href="/">Home</a></small></p>`);
/** Landing page for the emailed link. The script reads `#t=` (and `&e=` on connector links), strips the fragment from
 *  history, fills the form and submits it; without script the token cannot be read, so the page says so. */
export function openPage(nonce: string, next?: "oauth"): Response {
  const action = `/v2/auth/email/open${next === "oauth" ? "?next=oauth" : ""}`;
  return page("Signing in", `<h1>Sign in to 3D Review</h1><form id="f" method="post" action="${action}"><input type="hidden" name="t" id="t"><input type="hidden" name="e" id="e"><button type="submit" id="b">Sign in</button></form><p id="m" class="muted"><noscript>Your browser blocked the script this page needs. Open the link in another browser.</noscript></p>
<script nonce="${nonce}">(function(){var m=/^#t=([A-Za-z0-9_-]{43})(?:&e=([^&]{1,762}))?$/.exec(location.hash);try{history.replaceState(null,"",location.pathname+location.search)}catch(x){}if(!m){document.getElementById("b").hidden=true;document.getElementById("m").textContent="This sign-in link is incomplete. Request a new one from the sign-in page.";return}document.getElementById("t").value=m[1];if(m[2]){try{document.getElementById("e").value=decodeURIComponent(m[2])}catch(x){}}document.getElementById("f").submit()})();</script>`, 200, nonce);
}
export const badLinkPage = () => page("Link not valid",
  `<h1>This sign-in link is not valid</h1><p>It may have expired or been copied incompletely.</p><p><a href="/v2/auth/email">Request a new link</a></p>`, 400);
export const newNonce = (): string => b64u(crypto.getRandomValues(new Uint8Array(16)));

/** Cross-site form posts are refused: a same-origin POST carries Origin (Referrer-Policy same-origin on our pages).
 *  No Origin at all is accepted only when Sec-Fetch-Site does not say cross-site (older clients, non-browser callers). */
export function sameOriginPost(req: Request): boolean {
  const origin = req.headers.get("origin");
  const self = new URL(req.url).origin;
  if (origin !== null) return origin === self;
  const site = req.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}
