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
 *   RL_HTTP_ANON anonymous request on ANY capability HTTP twin (src/index.ts) key ip           60 / 60 s
 *                spent after credential resolution and before the body is parsed; a refusal writes nothing
 *   RL_AUTH      cap.auth.request_link                                      key email        10 / 60 s per email
 *                (the per-ADDRESS sign-in key moved to `au:` below: 10 / 60 s per address refused a room of facilitators)
 *   RL_MCP_CEILING  every well-shaped bearer on /mcp, and /token (src/worker.ts)  key ip          600 / 60 s
 *                also POST /v2/translate from a caller with a LIVE participant bearer or session (src/translate.ts)
 *                key tr:<kind>:<principal> — per principal, so a room behind one NAT never shares a bucket (audit W2)
 *   (none)       GET /v2/passages/:pid/file with a VALID signature; a missing/tampered/expired one spends RL_HTTP_ANON
 *   RL_REDEEM    cap.participant.redeem_code + cap.participant.open_link   key ip, sk       wrangler.toml
 *                ip: one workshop room shares one NAT address (ticket 2026-10-15-3d-workshop-same-ip: 200 participants +
 *                20 facilitators on one address); sk:<sha256(link token | access code)> bounds the opens of ONE link or
 *                code from any number of addresses (each open mints a respondent session row).
 *
 * Non-IP keys (workshop-same-ip DoD 3) — KEY_ROUTE below is the one place that says which binding counts which key:
 *   sign-in address  `au:<ip>`   request_link + consume_link + POST /v2/auth/email (RL_HTTP_ANON today; a dedicated
 *                                binding later makes the sign-in per-address number a one-line wrangler.toml change)
 *   sign-in global   `g:auth`    request_link + POST /v2/auth/email — every link/code issuance, per Cloudflare location
 *   per principal    `pr:<kind>:<id>` every capability call by a signed-in user or a participant bearer (both faces):
 *                                bounds write floods per session/account whatever address they come from
 *   per email        `em:<hash>` request_link (RL_AUTH); POST /v2/auth/email counts per email durably in D1
 *
 * Failure posture: binding absent → allowed ONLY when ENVIRONMENT is exactly "dev" (local + unit tests); anywhere
 * else an absent binding refuses (fail closed — a production Worker without its limiter is a misdeploy, not a pass).
 * A binding that throws at runtime is allowed through and logged: availability of the survey beats a dampener outage.
 */
import type { Ctx, Env } from "./handlers/types";
import { CapError } from "./handlers/types";
import { normalizeEmail, sha256 } from "./handlers/common";

/** Every limiter binding this Worker expects. wrangler.toml must bind each one at top level AND under
 *  [env.production.ratelimits] with its own namespace_id (test/limiter-boundary.test.ts parses the file and checks). */
export const LIMITER_NAMES = ["RL_MCP_ANON", "RL_HTTP_ANON", "RL_AUTH", "RL_REDEEM", "RL_MCP_CEILING"] as const;
export type LimiterName = (typeof LIMITER_NAMES)[number];
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
  if (!binding) {
    if (env.ENVIRONMENT === "dev") return true;
    // Distinct from a throttle: a production Worker without its limiter is a misdeploy. Logged so the operator can
    // tell "everyone is 429" apart from "everyone is hammering" (review #12-8).
    console.error("ratelimit.binding_absent", name, "refusing (fail closed) — bind it in wrangler.toml");
    return false;
  }
  try { return (await binding.limit({ key })).success; }
  catch (e) { console.error("ratelimit.binding_failed", name, String(e)); return true; }
}

const limited = (capabilityId: string) => new CapError("RATE_LIMITED", `rate limit reached — try again in ${RATE_LIMIT_WINDOW_SECONDS} seconds`,
  `wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds and try again`, capabilityId);

/** Which binding counts which non-IP key. One place: moving a key to another (or a new) binding is one line here. */
export const KEY_ROUTE = {
  signInAddress: "RL_HTTP_ANON",   // au:<ip>  — sign-in steps per address (60 / 60 s today)
  signInGlobal: "RL_MCP_CEILING",  // g:auth   — sign-in issuance per Cloudflare location (600 / 60 s today)
  principal: "RL_MCP_CEILING",     // pr:<kind>:<id> — every capability call by a credential holder (600 / 60 s today)
  secret: "RL_REDEEM",             // sk:<hash> — opens of one link / redemptions of one code
} as const satisfies Record<string, LimiterName>;

/** Sign-in steps per address (shared by the capability twins and the email-link route). true = allowed. */
export const allowSignInAddress = (env: Env, ip: string) => allow(env, KEY_ROUTE.signInAddress, `au:${ip}`);
/** Global sign-in issuance ceiling (codes and email links), per Cloudflare location. true = allowed. */
export const allowSignInGlobal = (env: Env) => allow(env, KEY_ROUTE.signInGlobal, "g:auth");

/** Called by execute() for both faces, before authorization and before the capability's handler runs.
 *  (Credential resolution happens earlier: 0 D1 reads for a malformed credential, up to two indexed reads for a
 *  well-formed one; see INTERFACE.md § Rate limits.) */
export async function enforceCapabilityLimit(ctx: Ctx, capabilityId: string, params: Record<string, unknown>): Promise<void> {
  // Per principal: a signed-in user or a participant bearer spends its OWN unit on every call, so a write flood is bounded
  // per session/account whatever address it comes from — and a room behind one NAT never shares this bucket.
  const p = ctx.principal;
  if (p && p.kind !== "anonymous" && p.id && !(await allow(ctx.env, KEY_ROUTE.principal, `pr:${p.kind}:${p.id}`)))
    throw limited(capabilityId);
  const name = CAP_LIMITER[capabilityId];
  if (!name) return;
  const ip = ctx.clientIp ?? "unknown";
  // The address unit is spent FIRST — before any parameter validation. Validating before spending (review #12-2's
  // first fix) let a non-string email be INVALID_PARAMS with no unit spent and a trace row written per request:
  // an unlimited D1 write path (Bugbot 4032246360, auditor 5707673911 #1). One unit per attempt, whatever its shape.
  if (name === "RL_AUTH") {
    if (!(await allowSignInAddress(ctx.env, ip))) throw limited(capabilityId);
  } else if (!(await allow(ctx.env, name, `ip:${ip}`))) throw limited(capabilityId);
  if (name === "RL_REDEEM") {
    // Per secret: one link (or one code) opened from any number of addresses still has one budget.
    const secret = capabilityId === "cap.participant.open_link" ? params.token : params.code;
    if (typeof secret === "string" && secret) {
      const norm = capabilityId === "cap.participant.redeem_code" ? secret.trim().toUpperCase() : secret; // the handler's normaliser
      if (!(await allow(ctx.env, KEY_ROUTE.secret, `sk:${(await sha256(norm)).slice(0, 32)}`))) throw limited(capabilityId);
    }
    return;
  }
  if (name === "RL_AUTH" && params.email !== undefined && typeof params.email !== "string")
    throw new CapError("INVALID_PARAMS", "email must be a string", undefined, capabilityId); // a non-string must not dodge the email key (review #12-2)
  // Per-email key on request_link only: stops code-issuance spam at one mailbox from rotating addresses.
  // consume_link is deliberately per-address only. Re-review #12: an email+address key on the same binding can never be the
  // key that refuses (the address key always counts at least as high), and a bare email key lets a stranger lock the victim
  // out. KNOWN RESIDUAL, recorded in INTERFACE.md: there is no per-email guess limit on consume_link; rotating addresses can
  // guess a 6-digit, 10-minute code at the sign-in address rate each. It is reachable only where codes exist — dev, which
  // returns the code in-band anyway; production sign-in is the email link. The durable fix is an attempts counter on
  // login_code (migration).
  if (capabilityId === "cap.auth.request_link") {
    if (typeof params.email === "string" && params.email) {
      const eh = (await sha256(normalizeEmail(params.email))).slice(0, 32); // same normaliser as the handler's email_hash (review #12-11)
      if (!(await allow(ctx.env, name, `em:${eh}`))) throw limited(capabilityId);
    }
    if (!(await allowSignInGlobal(ctx.env))) throw limited(capabilityId);
  }
}
