/**
 * Worker entry. The Hono app (src/index.ts) is unchanged and stays the default handler; this file only puts the
 * borrowed OAuth 2.1 provider in front of POST /mcp — see src/oauth.ts for the 6B record.
 *
 *   /mcp without a valid credential → 401 + WWW-Authenticate (connectors then start discovery → DCR → PKCE)
 *   /mcp with a provider-issued token → principal rebuilt from D1 per call, delegated_by = "oauth:<client_id>"
 *   /mcp with a first-party bearer (web session token, participant token) → resolveExternalToken → today's path
 */
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import app from "./index";
import { resolvePrincipal } from "./auth";
import { allow, clientIp, RATE_LIMIT_WINDOW_SECONDS } from "./ratelimit";
import { OAUTH_SCOPE, oauthPrincipals, principalFromProps, type OAuthEnv, type OAuthProps, type ExternalProps } from "./oauth";

const apiHandler = {
  async fetch(request: Request, env: OAuthEnv, ctx: ExecutionContext & { props?: OAuthProps | ExternalProps }): Promise<Response> {
    const props = ctx.props;
    if (!props || !("external" in props && props.external)) {
      const principal = props ? await principalFromProps(env, props as OAuthProps) : null;
      if (!principal) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="OAuth", error="invalid_token"' } });
      oauthPrincipals.set(request, principal);
    }
    return app.fetch(request, env, ctx);
  },
};

const provider = new OAuthProvider<OAuthEnv>({
  apiRoute: "/mcp",
  apiHandler: apiHandler as any,
  defaultHandler: { fetch: (request: Request, env: OAuthEnv, ctx: ExecutionContext) => app.fetch(request, env, ctx) } as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: [OAUTH_SCOPE],
  accessTokenTTL: 3600,
  // First-party credentials (the web session token used as Bearer, participant tokens) keep working on /mcp.
  resolveExternalToken: async ({ token, request, env }) => {
    const principal = await resolvePrincipal(new Request(request.url, { headers: { authorization: `Bearer ${token}` } }), env);
    return principal.kind === "anonymous" ? null : { props: { external: true } satisfies ExternalProps };
  },
});

// Pre-auth metering (src/ratelimit.ts). Review #15-1: a junk bearer must not dodge the dampener and still buy storage reads.
//   - no credential, or a bearer that cannot be ours BY SHAPE  → RL_MCP_ANON (30/60 s per address), refused before any storage
//   - a well-shaped bearer (may still be unknown)              → RL_MCP_CEILING (600/60 s per address) — a ceiling, not a
//     dampener: hosted connectors reach us from a few shared addresses, so it is generous; it bounds a well-shaped-junk
//     flood at 10 lookups/s per address per location. /token rides the same ceiling (legitimate refresh traffic is shared too).
//   - /register, /authorize, /oauth/consent are rare human-paced steps → RL_MCP_ANON.
const FIRST_PARTY = /^(st|pt)_[A-Za-z0-9_-]{32}$/;                       // src/auth.ts mintSession, handlers/common.ts randomToken
const PROVIDER_TOKEN = /^[^:\s]{1,128}:[^:\s]{1,128}:[A-Za-z0-9_-]{16,256}$/; // workers-oauth-provider: userId:grantId:secret
const ANON_PATHS = new Set(["/register", "/authorize", "/oauth/consent"]);
const tooMany = () => new Response(JSON.stringify({ error: "rate_limited", error_description: "too many requests — wait up to 60 seconds" }),
  { status: 429, headers: { "content-type": "application/json", "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) } });

export default {
  async fetch(request: Request, env: OAuthEnv, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method !== "OPTIONS") {
      const key = `ip:${clientIp(request)}`;
      const isMcp = path === "/mcp" || path.startsWith("/mcp/");
      if (isMcp) {
        const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
        const plausible = !!bearer && (FIRST_PARTY.test(bearer) || PROVIDER_TOKEN.test(bearer));
        if (!(await allow(env, plausible ? "RL_MCP_CEILING" : "RL_MCP_ANON", key))) return tooMany();
        // A bearer that cannot be ours never reaches a storage lookup.
        if (bearer && !plausible) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="OAuth", error="invalid_token"' } });
      } else if (path === "/token") { if (!(await allow(env, "RL_MCP_CEILING", key))) return tooMany(); }
      else if (ANON_PATHS.has(path) && !(await allow(env, "RL_MCP_ANON", key))) return tooMany();
    }
    return provider.fetch(request, env, ctx);
  },
};
