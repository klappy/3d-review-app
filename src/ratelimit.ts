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
 *                except a tools/call on one of the four capabilities below with their own limiter (counted there once)
 *   RL_HTTP_ANON anonymous request on any capability HTTP twin (src/index.ts) key ip           60 / 60 s
 *                spent after credential resolution and before the body is parsed; a refusal writes nothing.
 *                NOT spent on the four twins that have their own capability limiter below (RL_AUTH / RL_REDEEM):
 *                each such call is counted once, by the limiter sized for it (DEV shared-IP burst 2026-10-16:
 *                RL_HTTP_ANON refused 142/200 room opens before RL_REDEEM was consulted)
 *   RL_AUTH      cap.auth.request_link + cap.auth.consume_link             key ip, email    10 / 60 s COMBINED per
 *                address (both caps share the `ip:` key on one binding — splitting would double the attacker surface)
 *   RL_MCP_CEILING  every well-shaped bearer on /mcp, and /token (src/worker.ts)  key ip          600 / 60 s
 *                also POST /v2/translate from a caller with a LIVE participant bearer or session (src/translate.ts)
 *                key tr:<kind>:<principal> — per principal, so a room behind one NAT never shares a bucket (audit W2)
 *   (none)       GET /v2/passages/:pid/file with a VALID signature; a missing/tampered/expired one spends RL_HTTP_ANON
 *   RL_REDEEM    cap.participant.redeem_code + cap.participant.open_link   key ip           limit: see wrangler.toml
 *                (sized for a whole room behind one NAT address; the number lives in wrangler.toml, not here)
 *
 *   RL_PER_KEY   (optional) one secret or one mailbox, whatever the address   keys em:, code:   see RATE_LIMITS
 *                request_link per email (falls back to RL_AUTH's em: key while unbound), redeem_code per code —
 *                bounds a flood on one secret when an attacker rotates addresses.
 *   RL_GLOBAL    (optional) one key per secret-guessing limiter across ALL addresses   keys g:RL_AUTH, g:RL_REDEEM
 *                a ceiling for code/link guessing and sign-in spam spread over many IPs (workshop 2026-10-15 DoD 3).
 *   RL_PER_LINK  (optional) one shared link, whatever the address            key link:<hash>      see RATE_LIMITS
 *                a shared link is opened by a whole room, so it needs a room-sized number of its own: not RL_PER_KEY's
 *                (one secret, too small), not RL_REDEEM's per-address one (Bugbot 4290591310), and not RL_GLOBAL's,
 *                where g:RL_REDEEM is spent first on the same number so link: could never be the key that refuses
 *                (Bugbot 4290741302).
 *   RL_MCP_CEILING also meters every write/danger call by a signed-in or link-holding principal    key wr:<kind>:<id>
 *                per session/principal, never per address, so a room behind one NAT never shares a bucket.
 *
 * Optional limiters: absent → skipped (logged once per isolate). They add protection on top of the address key; an
 * unbound optional limiter must not refuse a whole workshop before Otto binds it.
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
/** Limiters that add a non-address key on top of the address limiters above. Absent → skipped, never refused. */
export const OPTIONAL_LIMITER_NAMES = ["RL_PER_KEY", "RL_PER_LINK", "RL_GLOBAL"] as const;
export type OptionalLimiterName = (typeof OPTIONAL_LIMITER_NAMES)[number];
export const RATE_LIMIT_WINDOW_SECONDS = 60;
/** THE one config place for every limit number (requests per RATE_LIMIT_WINDOW_SECONDS per key). Cloudflare reads the
 *  number from wrangler.toml, so wrangler.toml must mirror this table at top level AND under [env.production]
 *  (test/workshop-same-ip.test.ts checks; binding numbers are Otto's to set). Sized for one workshop on ONE address:
 *  200 participants + 20 facilitators, 3+ assessments, everyone in the same minute (captain 2026-10-15 22:36 ET).
 *  If the summit lets everyone sign in, raise RL_AUTH here (and in wrangler.toml) — one line. */
export const RATE_LIMITS: Record<LimiterName | OptionalLimiterName, number> = {
  RL_MCP_ANON: 30,     // anonymous /mcp per address; participants never use /mcp anonymously
  RL_HTTP_ANON: 200,   // anonymous twin calls per address: 20 facilitators' pre-sign-in /v2/me + reloads (×2.5 headroom)
  RL_AUTH: 100,        // sign-in per address: 20 facilitators × 2 units (request + consume) = 40, ×2.5 headroom
  RL_REDEEM: 500,      // link/code opens per address: 200 opens + 20 × 2 email-link check/open = 240, ×2 headroom
  RL_MCP_CEILING: 600, // per bearer address on /mcp, per principal for translate (tr:) and writes (wr:)
  RL_PER_KEY: 10,      // per email / per code, any address
  RL_PER_LINK: 400,    // per shared link, any address: a room of 200 opening one link, ×2 headroom; < RL_GLOBAL
  RL_GLOBAL: 5000,     // all addresses together, per secret-guessing limiter
};
/** The plain refusal every rate limit returns, on every face (DoD 6). */
export const RATE_LIMIT_MESSAGE = "rate limit — try again in a minute";
/** Headers every rate-limit 429 carries. */
export const rateLimitHeaders = (): Record<string, string> => ({ "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) });
/** Largest JSON-RPC batch any caller may POST to /mcp; an anonymous batch spends one RL_MCP_ANON unit per message. */
export const MCP_MAX_BATCH = 10;

const CAP_LIMITER: Record<string, LimiterName> = {
  "cap.auth.request_link": "RL_AUTH",
  "cap.auth.consume_link": "RL_AUTH",
  "cap.participant.redeem_code": "RL_REDEEM",
  "cap.participant.open_link": "RL_REDEEM",
};

/** true when the capability has its own limiter in execute(); the HTTP twin then skips RL_HTTP_ANON (src/index.ts). */
export const hasCapabilityLimiter = (capabilityId: string): boolean => Object.hasOwn(CAP_LIMITER, capabilityId);

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

const absentLogged = new Set<string>();
/** An optional limiter: absent → allowed (logged once per isolate); bound → the same posture as allow(). */
export async function allowOptional(env: Env, name: OptionalLimiterName, key: string): Promise<boolean> {
  const binding = env[name];
  if (!binding) {
    if (!absentLogged.has(name)) { absentLogged.add(name); console.warn("ratelimit.optional_absent", name, "skipped — bind it in wrangler.toml"); }
    return true;
  }
  try { return (await binding.limit({ key })).success; }
  catch (e) { console.error("ratelimit.binding_failed", name, String(e)); return true; }
}

export const rateLimitHint = (what: string) => `this is a rate limit (${what}), not a problem with your request — try again in one minute`;
const limited = (capabilityId: string, what = "too many attempts") => new CapError("RATE_LIMITED", RATE_LIMIT_MESSAGE, rateLimitHint(what), capabilityId);
const secretHash = async (v: string) => (await sha256(v)).slice(0, 32);

/** Per-principal write meter (DoD 3: per-session keys). Every write/danger call by a non-anonymous principal spends one
 *  RL_MCP_CEILING unit on `wr:<kind>:<id>` — never the address, so a room behind one NAT never shares a bucket. */
export async function enforcePrincipalWriteLimit(ctx: Ctx, capabilityId: string, tool: string): Promise<void> {
  if (tool === "read" || ctx.principal.kind === "anonymous") return;
  // An added layer, not a gate: an env without RL_MCP_CEILING (unit fixtures) is not refused here; the /mcp and /token
  // paths that need it still fail closed through allow(), and limiter-boundary.test.ts checks wrangler.toml binds it.
  if (!ctx.env.RL_MCP_CEILING) return;
  if (!(await allow(ctx.env, "RL_MCP_CEILING", `wr:${ctx.principal.kind}:${ctx.principal.id}`))) throw limited(capabilityId, "too many changes from this session");
}

/** Called by execute() for both faces, before authorization and before the capability's handler runs.
 *  (Credential resolution happens earlier: 0 D1 reads for a malformed credential, up to two indexed reads for a
 *  well-formed one; see INTERFACE.md § Rate limits.) */
export async function enforceCapabilityLimit(ctx: Ctx, capabilityId: string, params: Record<string, unknown>): Promise<void> {
  const name = CAP_LIMITER[capabilityId];
  if (!name) return;
  const ip = ctx.clientIp ?? "unknown";
  // The address unit is spent FIRST — before any parameter validation. Validating before spending (review #12-2's
  // first fix) let a non-string email be INVALID_PARAMS with no unit spent and a trace row written per request:
  // an unlimited D1 write path (Bugbot 4032246360, auditor 5707673911 #1). One unit per attempt, whatever its shape.
  if (!(await allow(ctx.env, name, `ip:${ip}`))) throw limited(capabilityId, "too many attempts from this network");
  // Global ceiling across every address (DoD 3): rotating addresses cannot multiply the guessing rate past it.
  if (!(await allowOptional(ctx.env, "RL_GLOBAL", `g:${name}`))) throw limited(capabilityId, "the service is busy");
  if (name === "RL_AUTH" && params.email !== undefined && typeof params.email !== "string")
    throw new CapError("INVALID_PARAMS", "email must be a string", undefined, capabilityId); // a non-string must not dodge the email key (review #12-2)
  // Per-email key on request_link only: stops code-issuance spam at one mailbox from rotating addresses.
  // consume_link is deliberately per-address only. Re-review #12: an email+address key on the same binding can never be the
  // key that refuses (the address key always counts at least as high), and a bare email key lets a stranger lock the victim
  // out. KNOWN RESIDUAL, recorded in INTERFACE.md: there is no per-email guess limit on consume_link; rotating addresses can
  // guess a 6-digit, 10-minute code at 10/min each. It is reachable only where codes exist — dev, which returns the code
  // in-band anyway; production sign-in is Cloudflare Access. The durable fix is an attempts counter on login_code (migration).
  if (capabilityId === "cap.auth.request_link" && typeof params.email === "string" && params.email) {
    const eh = (await sha256(normalizeEmail(params.email))).slice(0, 32); // same normaliser as the handler's email_hash (review #12-11)
    // Own binding once Otto binds RL_PER_KEY (RL_AUTH's per-address number is sized for a room, too loose for one
    // mailbox); until then the em: key stays on RL_AUTH exactly as before.
    const ok = ctx.env.RL_PER_KEY ? await allowOptional(ctx.env, "RL_PER_KEY", `em:${eh}`) : await allow(ctx.env, name, `em:${eh}`);
    if (!ok) throw limited(capabilityId, "too many sign-in requests for this email");
  }
  // Per-secret keys (DoD 3): one code or one link token is bounded whatever address it comes from. A shared link is
  // opened by a whole room (200 people), so its key rides its own optional RL_PER_LINK (skipped while unbound): on RL_REDEEM
  // it would go live at wrangler.toml's per-address number (Bugbot 4290591310); on RL_GLOBAL it shared g:RL_REDEEM's
  // number and was always spent after it, so it could never refuse on its own (Bugbot 4290741302).
  if (capabilityId === "cap.participant.redeem_code" && typeof params.code === "string" && params.code
    && !(await allowOptional(ctx.env, "RL_PER_KEY", `code:${await secretHash(params.code.trim().toUpperCase())}`)))
    throw limited(capabilityId, "too many attempts with this code");
  if (capabilityId === "cap.participant.open_link" && typeof params.token === "string" && params.token
    && !(await allowOptional(ctx.env, "RL_PER_LINK", `link:${await secretHash(params.token)}`)))
    throw limited(capabilityId, "too many opens of this link");
}
