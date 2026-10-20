export type Role = "owner" | "member" | "viewer";
export type ScopeType = "workspace" | "project" | "assessment" | "survey" | "platform";
export interface Principal {
  kind: "user" | "participant" | "support" | "anonymous";
  id: string;
  email?: string;
  provisioned?: boolean;
  delegatedBy?: string;
  supportActor?: string;
  superAdmin?: boolean;
  accessMode?: "my" | "global";
  participantSurveyId?: string;
  respondentId?: string;
  /** sha256 of the presented session credential (cookie or bearer) — what logout revokes; never client-supplied. */
  sessionTokenHash?: string;
  /** set when the caller presented a provider-issued OAuth token (src/oauth.ts); logout revokes that client's grants. */
  oauthClientId?: string;
}
export interface Env { ROADMAP_PUBLISHER_IDS?: string; ROADMAP_VERIFIER_IDS?: string; ROADMAP_SUMMARY_REVIEWER_IDS?: string; DB: D1Database; SESSION_SECRET: string; CODE_ESCROW_SECRET?: string; ENVIRONMENT?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string;
  /** Default-off production report admission; exact "enabled" only after policy approval. */
  PARTICIPANT_REPORTS?: string;
  /** Workers Rate Limiting bindings (wrangler.toml [[ratelimits]]) — see src/ratelimit.ts. */
  RL_MCP_ANON?: RateLimit; RL_HTTP_ANON?: RateLimit; RL_AUTH?: RateLimit; RL_REDEEM?: RateLimit; RL_MCP_CEILING?: RateLimit; RL_PER_KEY?: RateLimit; RL_PER_LINK?: RateLimit; RL_GLOBAL?: RateLimit;
  /** Native Cloudflare Email Sending; no API secret or inbound routing required. */
  EMAIL?: SendEmail;
  MAIL_FROM?: string; MAIL_ALLOWLIST_SHA256?: string; PUBLIC_ORIGIN?: string;
  /** B38 email sign-in link (src/magic-link.ts): "on" enables it; TTL in minutes (5–60, default 30). */
  MAGIC_LINK?: string; MAGIC_LINK_TTL_MINUTES?: string;
  /** OAuth provider storage + helpers (src/worker.ts); absent in unit tests that drive the Hono app directly. */
  OAUTH_KV?: KVNamespace; OAUTH_PROVIDER?: import("@cloudflare/workers-oauth-provider").OAuthHelpers;
  /** Dynamic translation proxy (src/translate.ts): upstream URL (var) and optional bearer (secret). Unset URL → English only. */
  TRANSLATE_UPSTREAM_URL?: string; TRANSLATE_UPSTREAM_KEY?: string }
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
interface ImpactBase {
  affected: unknown[];
  irreversible: boolean;
  retention?: string;
  compensating_control?: string;
}
/** A no-op impact (noop: true) names no effect: nothing is released (0.35.16). Every other impact names its effect
 *  (0.35.17, cookbook work/active/2026-10-18-3d-grant-noop-followups-2 DoD (b)): the union keeps that check at compile time. */
export type Impact = ImpactBase & ({ noop: true; effect?: never } | { noop?: never; effect: "external" | "disclosure" | "destructive" });
export interface HandlerResult {
  result: Record<string, unknown>;
  scope?: { type: ScopeType; id: string };
  priorState?: Record<string, unknown>;
  impact?: Impact;
  /** The call changed nothing; dispatch marks its receipt no-op (0.35.17 DoD (c)). Separate from any user-facing result field. */
  noop?: true;
  /** dry_run only: the state the preview was computed from. Dispatch binds its hash into the confirm token, and the handler
   *  refuses an execute whose own read differs (requireConfirmedState), so a preview never confirms a different change (0.35.17 DoD (a)). */
  confirmState?: Record<string, unknown>;
}
/** confirmedState: set by dispatch on a confirmed execute — the state hash the confirm token carries (null when it carries none). */
export interface HandlerOpts { dryRun?: boolean; confirmedState?: string | null }
export type Handler = (ctx: Ctx, params: Record<string, any>, opts?: HandlerOpts) => Promise<HandlerResult>;

export { CapError, notVisible } from "./errors";
export const id = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
export { sha256Hex as sha256 } from "../crypto";
