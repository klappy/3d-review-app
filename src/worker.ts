/**
 * Worker entry. The Hono app (src/index.ts) is unchanged and stays the default handler; this file only puts the
 * borrowed OAuth 2.1 provider in front of POST /mcp — see src/oauth.ts for the 6B record.
 *
 *   /mcp without a valid credential → 401 + WWW-Authenticate (connectors then start discovery → DCR → PKCE)
 *   /mcp with a provider-issued token → principal rebuilt from D1 per call, delegated_by = "oauth:<client_id>"
 *   /mcp with a first-party bearer (web session token, participant token) → resolveExternalToken → today's path
 *
 * The provider is built PER ENV (WeakMap below): its tokenExchangeCallback receives no env, and the callback needs
 * env.DB for the authorization-code redemption record (fix/pr15-auth-hardening A2).
 */
import OAuthProvider, { OAuthError, type OAuthProviderOptions } from "@cloudflare/workers-oauth-provider";
import app from "./index";
import { resolvePrincipal } from "./auth";
import { allow, clientIp, RATE_LIMIT_WINDOW_SECONDS } from "./ratelimit";
import { OAUTH_SCOPE, oauthPrincipals, principalFromProps, type OAuthEnv, type OAuthProps, type ExternalProps } from "./oauth";

const apiHandler = {
  async fetch(request: Request, env: OAuthEnv, ctx: ExecutionContext & { props?: OAuthProps | ExternalProps }): Promise<Response> {
    const props = ctx.props;
    if (!props || !("external" in props && props.external)) {
      const principal = props ? await principalFromProps(env, props as OAuthProps) : null;
      if (!principal) return invalidToken(request);
      oauthPrincipals.set(request, principal);
    }
    return app.fetch(request, env, ctx);
  },
};

/** SQLite constraint failure as D1 reports it (miniflare and production both surface the SQLite text). */
const CONSTRAINT = /UNIQUE constraint failed|PRIMARY KEY constraint failed|SQLITE_CONSTRAINT/i;
/** Provider options for one env (module-private; the WeakMap factory below is the only builder). */
function providerOptions(env: OAuthEnv): OAuthProviderOptions<OAuthEnv> {
  const options: OAuthProviderOptions<OAuthEnv> = {
    apiRoute: "/mcp",
    apiHandler: apiHandler as any,
    defaultHandler: { fetch: (request: Request, env: OAuthEnv, ctx: ExecutionContext) => app.fetch(request, env, ctx) } as any,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    scopesSupported: [OAUTH_SCOPE],
    // RFC 9728: the protected-resource document and every WWW-Authenticate challenge advertise the scope (review #15-11).
    resourceMetadata: { scopes_supported: [OAUTH_SCOPE] },
    accessTokenTTL: 3600,
    // First-party credentials (the web session token used as Bearer, participant tokens) keep working on /mcp.
    resolveExternalToken: async ({ token, request, env }) => {
      const principal = await resolvePrincipal(new Request(request.url, { headers: { authorization: `Bearer ${token}` } }), env);
      return principal.kind === "anonymous" ? null : { props: { external: true } satisfies ExternalProps };
    },
    // Review #15 finding 2: the provider's "code already used" check is a KV read→check→write (not atomic), so N truly
    // concurrent redemptions of one code all minted tokens. This callback runs AFTER the provider's client + PKCE checks and
    // BEFORE its KV write; the D1 PRIMARY KEY on grant_id (1:1 with the code) is the atomic gate. A wrong verifier never
    // reaches it, so it does not burn the code. A concurrent loser is refused and does NOT revoke the grant (plan recheck
    // NEW-2: a revoke here would race the winner's own KV write); sequential reuse is refused AND revoked by the provider
    // itself before this callback runs. Asymmetry recorded in INTERFACE.md.
    tokenExchangeCallback: async ({ grantType, grantId, userId }) => {
      if (grantType !== "authorization_code") return;
      try {
        await env.DB.prepare("INSERT OR FAIL INTO oauth_code_redemption (grant_id, user_id, redeemed_at) VALUES (?, ?, ?)").bind(grantId, userId, new Date().toISOString()).run();
      } catch (e) {
        // Only a PRIMARY KEY / UNIQUE conflict means the code was redeemed. Any other D1 failure (outage, missing table,
        // bind error) must not look like invalid_grant — a client treats that as terminal and discards a code that was never
        // burnt. The provider has not written the grant yet, so after a 503 the same code is still redeemable (Bugbot
        // 4032844495; review 5708128737).
        const msg = `${e instanceof Error ? e.message : String(e)} ${e instanceof Error && e.cause instanceof Error ? e.cause.message : ""}`;
        if (CONSTRAINT.test(msg)) throw new OAuthError("invalid_grant", { description: "Authorization code already used" });
        throw new OAuthError("temporarily_unavailable", { description: "authorization storage is temporarily unavailable", statusCode: 503 });
      }
    },
  };
  return options;
}

const providers = new WeakMap<OAuthEnv, OAuthProvider<OAuthEnv>>();
function providerFor(env: OAuthEnv): OAuthProvider<OAuthEnv> {
  let p = providers.get(env);
  if (!p) { p = new OAuthProvider<OAuthEnv>(providerOptions(env)); providers.set(env, p); }
  return p;
}

// Pre-auth metering (src/ratelimit.ts). Review #15-1: a junk bearer must not dodge the dampener and still buy storage reads.
//   - no credential, or a bearer that cannot be ours BY SHAPE  → RL_MCP_ANON (30/60 s per address), refused before any storage
//   - a well-shaped bearer (may still be unknown)              → RL_MCP_CEILING (600/60 s per address) — a ceiling, not a
//     dampener: hosted connectors reach us from a few shared addresses, so it is generous; it bounds a well-shaped-junk
//     flood at 10 lookups/s per address per location. /token rides the same ceiling (legitimate refresh traffic is shared too).
//   - /register, /authorize, /oauth/consent are rare human-paced steps → RL_MCP_ANON.
const FIRST_PARTY = /^(st|pt)_[A-Za-z0-9_-]{32}$/;                       // src/auth.ts mintSession, handlers/common.ts randomToken
// workers-oauth-provider: userId:grantId:secret — grantId = generateRandomString(16), secret = TOKEN_LENGTH 32, both [A-Za-z0-9_-]
const PROVIDER_TOKEN = /^[^:\s]{1,128}:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{32}$/;
const ANON_PATHS = new Set(["/register", "/authorize", "/oauth/consent"]);
/** Exactly the provider's own parse (dist handleApiRequest): `Bearer ` + token, case-sensitive, one space, no trimming. */
const bearerOf = (authorization: string) => authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
/** 401 carrying the RFC 9728 discovery pointer, byte-compatible with what the provider itself answers for this path. */
const invalidToken = (request: Request) => {
  const url = new URL(request.url);
  return new Response(JSON.stringify({ error: "invalid_token", error_description: "Invalid access token" }), { status: 401,
    headers: { "content-type": "application/json", "www-authenticate": `Bearer realm="OAuth", resource_metadata="${url.origin}/.well-known/oauth-protected-resource${url.pathname}", error="invalid_token", scope="${OAUTH_SCOPE}"` } });
};
const tooMany = () => new Response(JSON.stringify({ error: "rate_limited", error_description: "too many requests — wait up to 60 seconds" }),
  { status: 429, headers: { "content-type": "application/json", "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) } });
/** Mis-deploy without OAUTH_KV: a clean refusal instead of the provider's TypeError (review #15-8). */
const notConfigured = () => new Response(JSON.stringify({ error: "temporarily_unavailable", error_description: "authorization storage is not configured" }),
  { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default {
  async fetch(request: Request, env: OAuthEnv, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method !== "OPTIONS") {
      const key = `ip:${clientIp(request)}`;
      const isMcp = path.startsWith("/mcp"); // EXACTLY the provider's apiRoute match (prefix) — /mcpx, /mcp.json must not slip past (re-review #15)
      if (isMcp) {
        const authorization = request.headers.get("authorization");
        const credential = authorization ? bearerOf(authorization) : "";
        const providerShaped = PROVIDER_TOKEN.test(credential);
        const plausible = !!authorization && (FIRST_PARTY.test(credential) || providerShaped);
        if (!(await allow(env, plausible ? "RL_MCP_CEILING" : "RL_MCP_ANON", key))) return tooMany();
        // ANY Authorization header that is not exactly one plausible token (junk, two tokens, another scheme) stops here:
        // no storage lookup, and the same discovery pointer the provider would send.
        if (authorization && !plausible) return invalidToken(request);
        if (providerShaped && !env.OAUTH_KV) return notConfigured();
      } else if (path === "/token") { if (!(await allow(env, "RL_MCP_CEILING", key))) return tooMany(); if (!env.OAUTH_KV) return notConfigured(); }
      else if (path === "/register") { if (!(await allow(env, "RL_MCP_ANON", key))) return tooMany(); if (!env.OAUTH_KV) return notConfigured(); }
      else if (ANON_PATHS.has(path) && !(await allow(env, "RL_MCP_ANON", key))) return tooMany();
    }
    return providerFor(env).fetch(request, env, ctx);
  },
};
