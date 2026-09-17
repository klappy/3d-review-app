/**
 * Abuse dampening at the edge (captain ruling 2026-09-16 20:10 ET: "it would be terrible if everyone could hammer it
 * without logging in"). Borrowed substrate: the Cloudflare Workers Rate Limiting binding (`[[ratelimits]]` in
 * wrangler.toml) — no hand-rolled counters, no D1 writes on the hot path.
 *
 * Honest limits of the borrow: counters are per Cloudflare location and eventually consistent, so this is a dampener,
 * not a lockout. The secrets it shields are not guessable at these rates (access codes are 8 chars of a 32-symbol
 * alphabet ≈ 1.1e12; sessions are 24 random bytes). Windows are 60 s because the binding only offers 10 s or 60 s.
 *
 *   RL_MCP_ANON  anonymous POST /mcp — one unit per JSON-RPC message        key ip           30 / 60 s
 *   RL_AUTH      cap.auth.request_link + cap.auth.consume_link             key ip, email    10 / 60 s each
 *   RL_REDEEM    cap.participant.redeem_code + cap.participant.open_link   key ip           60 / 60 s
 *                (60 because a whole workshop room shares one NAT address — 18-I phase C: 50 concurrent participants)
 *
 * Failure posture: binding absent → allowed ONLY when ENVIRONMENT is exactly "dev" (local + unit tests); anywhere
 * else an absent binding refuses (fail closed — a production Worker without its limiter is a misdeploy, not a pass).
 * A binding that throws at runtime is allowed through and logged: availability of the survey beats a dampener outage.
 */
import type { Ctx, Env } from "./handlers/types";
import { CapError } from "./handlers/types";
import { sha256 } from "./handlers/common";

export type LimiterName = "RL_MCP_ANON" | "RL_AUTH" | "RL_REDEEM";
export const RATE_LIMIT_WINDOW_SECONDS = 60;
/** Largest JSON-RPC batch any caller may POST to /mcp; an anonymous batch spends one RL_MCP_ANON unit per message. */
export const MCP_MAX_BATCH = 10;

const CAP_LIMITER: Record<string, LimiterName> = {
  "cap.auth.request_link": "RL_AUTH",
  "cap.auth.consume_link": "RL_AUTH",
  "cap.participant.redeem_code": "RL_REDEEM",
  "cap.participant.open_link": "RL_REDEEM",
};

export const clientIp = (req: Request): string => req.headers.get("cf-connecting-ip") ?? "unknown";

/** true = allowed. */
export async function allow(env: Env, name: LimiterName, key: string): Promise<boolean> {
  const binding = env[name];
  if (!binding) return env.ENVIRONMENT === "dev";
  try { return (await binding.limit({ key })).success; }
  catch (e) { console.error("ratelimit.binding_failed", name, String(e)); return true; }
}

const limited = (capabilityId: string) => new CapError("RATE_LIMITED", "too many attempts — slow down",
  `wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds and try again`, capabilityId);

/** Called by execute() for both faces, before authorization and before any storage access. */
export async function enforceCapabilityLimit(ctx: Ctx, capabilityId: string, params: Record<string, unknown>): Promise<void> {
  const name = CAP_LIMITER[capabilityId];
  if (!name) return;
  if (!(await allow(ctx.env, name, `ip:${ctx.clientIp ?? "unknown"}`))) throw limited(capabilityId);
  if (name === "RL_AUTH" && typeof params.email === "string" && params.email) {
    const eh = (await sha256(params.email.toLowerCase())).slice(0, 32);
    if (!(await allow(ctx.env, name, `em:${eh}`))) throw limited(capabilityId);
  }
}
