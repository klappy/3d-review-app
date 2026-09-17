/**
 * MCP authorization (captain ruling 2026-09-16 20:10 ET: "Require the same auth experience as the Bee MCP").
 *
 * 6B (cookbook #15 c5706612132): BORROW `@cloudflare/workers-oauth-provider` 0.10.3 — discovery, dynamic client
 * registration, PKCE, hashed grants and per-grant encrypted props in OAUTH_KV. No token format, no crypto, no DCR
 * parser is written here. BUILD = the glue below only:
 *
 *   GET  /authorize        provider-validated request is parked (KV, 10 min, single use) and the browser is sent
 *                          through the existing Cloudflare Access email-code route.
 *   GET  /v2/auth/access   (existing, Access-guarded) — when an authorization is parked for this browser it renders
 *                          the consent page instead of opening a web session. Identity = the verified Access JWT only.
 *   POST /oauth/consent    approve → completeAuthorization(props {principal_id, client_id}); deny → access_denied.
 *
 * The consent form carries an HMAC ticket binding {parked request, principal, expiry}; the parked-request cookie must
 * match; the KV record is deleted on first use. Provisioning and support status are NEVER frozen into the token —
 * principalFromProps() re-reads D1 on every call.
 */
import type { AuthRequest, ClientInfo, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { Env, Principal } from "./handlers/types";

export interface OAuthProps { principal_id: string; client_id: string; external?: never }
export interface ExternalProps { external: true }
export type OAuthEnv = Env & { OAUTH_KV: KVNamespace; OAUTH_PROVIDER: OAuthHelpers };

/** Set by the worker entry for requests the provider authenticated with an OAuth grant; read by contextForRequest. */
export const oauthPrincipals = new WeakMap<Request, Principal>();

export const OAUTH_SCOPE = "3dreview";
const PARK_PREFIX = "3dr:authreq:";
const PARK_TTL_S = 600;
export const PARK_COOKIE = "oauth_req";

export async function principalFromProps(env: Env, props: OAuthProps): Promise<Principal | null> {
  if (!props?.principal_id || !props?.client_id) return null;
  const row = await env.DB.prepare("SELECT id, provisioned, support FROM principal WHERE id = ?").bind(props.principal_id).first<{ id: string; provisioned: number; support: number }>();
  if (!row) return null;
  // An agent acting through a connector is always a delegated USER — support authority is never delegated to a client.
  return { kind: "user", id: row.id, provisioned: !!row.provisioned, delegatedBy: `oauth:${props.client_id}`, oauthClientId: props.client_id };
}

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`oauth-consent.v1|${msg}`))));
}
const timingSafeEqual = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function mintTicket(env: Env, parkId: string, principalId: string, now = Date.now()): Promise<string> {
  const body = `${parkId}.${principalId}.${now + PARK_TTL_S * 1000}`;
  return `${body}.${await hmac(env.SESSION_SECRET, body)}`;
}
export async function readTicket(env: Env, ticket: string, now = Date.now()): Promise<{ parkId: string; principalId: string } | null> {
  const parts = ticket.split(".");
  if (parts.length !== 4) return null;
  const [parkId, principalId, exp, mac] = parts;
  if (!env.SESSION_SECRET || !timingSafeEqual(mac, await hmac(env.SESSION_SECRET, `${parkId}.${principalId}.${exp}`))) return null;
  if (!(Number(exp) > now)) return null;
  return { parkId, principalId };
}

export function cookieValue(req: Request, name: string): string | undefined {
  return (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
}
const parkCookie = (value: string, maxAge: number) => `${PARK_COOKIE}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
const html = (body: string, status = 200, extra: Record<string, string> = {}) => new Response(
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>3D Review — connect an app</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:10vh auto;padding:0 1rem;color:#1b1f23}h1{font-size:1.25rem}.who{background:#f3f5f7;border-radius:.5rem;padding:.75rem 1rem;margin:1rem 0}button{font:inherit;padding:.6rem 1.2rem;border-radius:.4rem;border:1px solid #1b1f23;background:#fff;cursor:pointer;margin-right:.5rem}button.go{background:#1b1f23;color:#fff}small{color:#57606a}</style>${body}</html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", "referrer-policy": "no-referrer", ...extra } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** GET /authorize — validate with the provider, park, send the browser to the Access email-code route. */
export async function handleAuthorize(req: Request, env: OAuthEnv): Promise<Response> {
  if (!env.OAUTH_PROVIDER || !env.OAUTH_KV) return html("<h1>Authorization is not configured here</h1>", 501);
  let parsed: AuthRequest;
  try { parsed = await env.OAUTH_PROVIDER.parseAuthRequest(req); }
  catch (e: any) {
    if (e?.redirectUri) { // only present after the provider validated the client and its exact registered redirect URI
      const r = new URL(e.redirectUri); r.searchParams.set("error", e.code ?? "invalid_request");
      if (e.description) r.searchParams.set("error_description", e.description);
      if (e.state) r.searchParams.set("state", e.state); if (e.issuer) r.searchParams.set("iss", e.issuer);
      return Response.redirect(r.toString(), 302);
    }
    return html(`<h1>This connection request is not valid</h1><p><small>${esc(e?.description ?? e?.message ?? "invalid request")}</small></p>`, 400);
  }
  if (!(await env.OAUTH_PROVIDER.lookupClient(parsed.clientId))) return html("<h1>Unknown app</h1>", 400);
  const parkId = b64u(crypto.getRandomValues(new Uint8Array(24)));
  await env.OAUTH_KV.put(PARK_PREFIX + parkId, JSON.stringify(parsed), { expirationTtl: PARK_TTL_S });
  return new Response(null, { status: 302, headers: { location: "/v2/auth/access?next=oauth", "set-cookie": parkCookie(parkId, PARK_TTL_S), "cache-control": "no-store" } });
}

/** Called by the Access-guarded route AFTER it verified the Access JWT and established the principal. */
export async function renderConsentIfParked(req: Request, env: OAuthEnv, principalId: string, email: string): Promise<Response | null> {
  if (new URL(req.url).searchParams.get("next") !== "oauth") return null;
  const parkId = cookieValue(req, PARK_COOKIE);
  const raw = parkId && env.OAUTH_KV ? await env.OAUTH_KV.get(PARK_PREFIX + parkId) : null;
  if (!parkId || !raw) return html("<h1>This connection request expired</h1><p>Go back to the app you were connecting and start again.</p>", 400);
  const parsed = JSON.parse(raw) as AuthRequest;
  const client = await env.OAUTH_PROVIDER.lookupClient(parsed.clientId) as ClientInfo | null;
  if (!client) return html("<h1>Unknown app</h1>", 400);
  let host = "unknown"; try { host = new URL(parsed.redirectUri).host; } catch { /* shown as unknown */ }
  const ticket = await mintTicket(env, parkId, principalId);
  return html(`<h1>Connect “${esc(client.clientName ?? "an app")}” to 3D Review?</h1>
<div class="who">Signed in as <b>${esc(email)}</b><br><small>The app will return to <b>${esc(host)}</b></small></div>
<p>It will be able to do what <b>you</b> can do in 3D Review — read and change the projects and assessments you have been granted — and every action is recorded as “${esc(client.clientName ?? parsed.clientId)} on your behalf”. It gets no access you do not have. You can disconnect it at any time.</p>
<form method="post" action="/oauth/consent"><input type="hidden" name="ticket" value="${esc(ticket)}">
<button class="go" name="decision" value="approve">Connect</button><button name="decision" value="deny">Cancel</button></form>
<p><small>Only connect apps you started connecting yourself.</small></p>`);
}

/** POST /oauth/consent — single use: the parked request is deleted before anything is granted. */
export async function handleConsent(req: Request, env: OAuthEnv): Promise<Response> {
  if (!env.OAUTH_PROVIDER || !env.OAUTH_KV) return html("<h1>Authorization is not configured here</h1>", 501);
  const form = await req.formData().catch(() => null);
  const ticket = form?.get("ticket"); const decision = form?.get("decision");
  const t = typeof ticket === "string" ? await readTicket(env, ticket) : null;
  const cookie = cookieValue(req, PARK_COOKIE);
  if (!t || !cookie || !timingSafeEqual(cookie, t.parkId)) return html("<h1>This connection request is not valid</h1><p>Start again from the app you were connecting.</p>", 400);
  const raw = await env.OAUTH_KV.get(PARK_PREFIX + t.parkId);
  if (!raw) return html("<h1>This connection request expired or was already used</h1>", 400);
  await env.OAUTH_KV.delete(PARK_PREFIX + t.parkId);
  const parsed = JSON.parse(raw) as AuthRequest;
  const clear = { "set-cookie": parkCookie("", 0), "cache-control": "no-store" };
  if (decision !== "approve") {
    const r = new URL(parsed.redirectUri); r.searchParams.set("error", "access_denied"); if (parsed.state) r.searchParams.set("state", parsed.state);
    return new Response(null, { status: 302, headers: { location: r.toString(), ...clear } });
  }
  const still = await env.DB.prepare("SELECT id FROM principal WHERE id = ?").bind(t.principalId).first<{ id: string }>();
  if (!still) return html("<h1>Your sign-in could not be confirmed</h1>", 400);
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: parsed, userId: t.principalId, metadata: { client_id: parsed.clientId, granted_at: new Date().toISOString() },
    scope: [OAUTH_SCOPE], props: { principal_id: t.principalId, client_id: parsed.clientId } satisfies OAuthProps,
  });
  return new Response(null, { status: 302, headers: { location: redirectTo, ...clear } });
}

/** MCP/HTTP logout for an OAuth-delegated caller = revoke this user's grants for this client. Returns grants revoked. */
export async function revokeOAuthGrants(env: OAuthEnv, userId: string, clientId: string): Promise<number> {
  if (!env.OAUTH_PROVIDER) return 0;
  let n = 0, cursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(userId, cursor ? { cursor } : undefined);
    for (const g of page.items) if (g.clientId === clientId) { await env.OAUTH_PROVIDER.revokeGrant(g.id, userId); n++; }
    cursor = page.cursor;
  } while (cursor);
  return n;
}
