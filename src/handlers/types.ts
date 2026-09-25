export type Role = "owner" | "member" | "viewer";
export type ScopeType = "workspace" | "project" | "assessment" | "survey" | "platform";
export interface Principal {
  kind: "user" | "participant" | "support" | "anonymous";
  id: string;
  email?: string;
  provisioned?: boolean;
  delegatedBy?: string;
  supportActor?: string;
  participantSurveyId?: string;
  respondentId?: string;
  /** sha256 of the presented session credential (cookie or bearer) — what logout revokes; never client-supplied. */
  sessionTokenHash?: string;
  /** set when the caller presented a provider-issued OAuth token (src/oauth.ts); logout revokes that client's grants. */
  oauthClientId?: string;
}
export interface Env { ROADMAP_PUBLISHER_IDS?: string; ROADMAP_VERIFIER_IDS?: string; ROADMAP_SUMMARY_REVIEWER_IDS?: string; DB: D1Database; SESSION_SECRET: string; CODE_ESCROW_SECRET?: string; ENVIRONMENT?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string;
  /** Workers Rate Limiting bindings (wrangler.toml [[ratelimits]]) — see src/ratelimit.ts. */
  RL_MCP_ANON?: RateLimit; RL_HTTP_ANON?: RateLimit; RL_AUTH?: RateLimit; RL_REDEEM?: RateLimit; RL_MCP_CEILING?: RateLimit;
  /** Native Cloudflare Email Sending; no API secret or inbound routing required. */
  EMAIL?: SendEmail;
  MAIL_FROM?: string; MAIL_ALLOWLIST_SHA256?: string; PUBLIC_ORIGIN?: string;
  /** B38 email sign-in link (src/magic-link.ts): "on" enables it; TTL in minutes (5–60, default 30). */
  MAGIC_LINK?: string; MAGIC_LINK_TTL_MINUTES?: string;
  /** OAuth provider storage + helpers (src/worker.ts); absent in unit tests that drive the Hono app directly. */
  OAUTH_KV?: KVNamespace; OAUTH_PROVIDER?: import("@cloudflare/workers-oauth-provider").OAuthHelpers }
export interface Ctx {
  env: Env;
  db: D1Database;
  principal: Principal;
  /** cf-connecting-ip of the caller; rate-limit key only, never persisted. */
  clientIp?: string;
  cookieAuthenticated?: boolean; requestOrigin?: string; requestUrlOrigin?: string;
  traceId: string;
  now: () => Date;
  log: (span: string, data?: Record<string, unknown>) => void;
}
export interface Impact {
  affected: unknown[];
  irreversible: boolean;
  effect: "external" | "disclosure" | "destructive";
  retention?: string;
  compensating_control?: string;
}
export interface HandlerResult {
  result: Record<string, unknown>;
  scope?: { type: ScopeType; id: string };
  priorState?: Record<string, unknown>;
  impact?: Impact;
}
export type Handler = (ctx: Ctx, params: Record<string, any>, opts?: { dryRun?: boolean }) => Promise<HandlerResult>;

export { CapError, notVisible } from "./errors";
export const id = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
export async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
