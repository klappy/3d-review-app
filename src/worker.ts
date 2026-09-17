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

// Unauthenticated authorization-server traffic shares the anonymous dampener (src/ratelimit.ts).
const LIMITED = new Set(["/register", "/token", "/authorize", "/oauth/consent"]);

export default {
  async fetch(request: Request, env: OAuthEnv, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    const unauthenticatedMcp = path === "/mcp" && !request.headers.get("authorization");
    if ((LIMITED.has(path) || unauthenticatedMcp) && request.method !== "OPTIONS" && !(await allow(env, "RL_MCP_ANON", `ip:${clientIp(request)}`)))
      return new Response(JSON.stringify({ error: "rate_limited", error_description: "too many requests — wait up to 60 seconds" }), { status: 429, headers: { "content-type": "application/json", "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) } });
    return provider.fetch(request, env, ctx);
  },
};
