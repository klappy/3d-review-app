/**
 * Cloudflare Access email-code sign-in (OF-7 ruling: "Cloudflare email code").
 * Cloudflare Access (one-time PIN identity provider) guards exactly one path — GET /v2/auth/access — on each
 * hostname. A browser that reaches this route has already proven its email to Cloudflare; Access forwards a
 * signed JWT in `Cf-Access-Jwt-Assertion`. We verify it (RS256 against the team's published keys, audience =
 * this hostname's Access application), take the email, upsert the principal, mint OUR session, and hand the
 * browser back to the UI. No code is ever seen or stored by this app; Access owns delivery and expiry.
 *
 *   ACCESS_TEAM_DOMAIN  klappy.cloudflareaccess.com          (wrangler.toml vars)
 *   ACCESS_AUD          per-hostname application audience     (wrangler.toml vars, not secret)
 */
import type { Env } from "./handlers/types";
import { CapError } from "./handlers/types";

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
let jwksCache: { at: number; keys: Jwk[] } | null = null;
/** test hook */
export function resetAccessKeyCache(): void { jwksCache = null; }

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function keys(teamDomain: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60e3) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new CapError("NOT_AUTHENTICATED", "identity provider keys unavailable", "retry sign-in");
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), keys: body.keys ?? [] };
  return jwksCache.keys;
}

export interface AccessIdentity { email: string; sub: string; exp: number }

/** Verify an Access JWT: signature (RS256, kid), iss = https://<team>, aud contains ACCESS_AUD, not expired. */
export async function verifyAccessJwt(env: Env, jwt: string | undefined): Promise<AccessIdentity> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  if (!teamDomain || !aud) throw new CapError("RESERVED_NOT_BUILT", "Cloudflare Access is not configured for this environment", "ACCESS_TEAM_DOMAIN / ACCESS_AUD");
  if (!jwt) throw new CapError("NOT_AUTHENTICATED", "no Access assertion", "this route must sit behind Cloudflare Access");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new CapError("NOT_AUTHENTICATED", "malformed assertion");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0]))) as { alg: string; kid: string };
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as { iss: string; aud: string | string[]; exp: number; email?: string; sub?: string };
  if (header.alg !== "RS256") throw new CapError("NOT_AUTHENTICATED", "unexpected assertion algorithm");
  const jwk = (await keys(teamDomain)).find((k) => k.kid === header.kid);
  if (!jwk) throw new CapError("NOT_AUTHENTICATED", "unknown signing key", "retry sign-in");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new CapError("NOT_AUTHENTICATED", "assertion signature invalid");
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== `https://${teamDomain}` || !auds.includes(aud)) throw new CapError("NOT_AUTHENTICATED", "assertion is for another application");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) throw new CapError("NOT_AUTHENTICATED", "assertion expired", "sign in again");
  if (!payload.email) throw new CapError("NOT_AUTHENTICATED", "assertion carries no email");
  return { email: payload.email.toLowerCase(), sub: payload.sub ?? "", exp: payload.exp };
}
