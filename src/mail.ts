/** Outbound mail via Cloudflare Email Sending. No inbox, forwarding, API key or retry.
 * Synthetic recipients and environment/DEV allowlist checks run before the binding.
 * Accepted means provider acceptance only. Unknown errors/timeouts remain unconfirmed;
 * callers preserve their existing intent de-duplication and uncertain-invitation lifecycle.
 */
import type { Env } from "./handlers/types";
import { sha256 } from "./handlers/common";

export type MailEnv = Env;
export type MailReason =
  | "invalid_address" | "duplicate_recent" | "duplicate_uncertain" | "not_configured"
  | "not_allowed_env" | "not_allowlisted" | "synthetic_recipient"
  | "provider_error" | "provider_unreachable";
/** What actually happened to the request. "unconfirmed" is NOT "not delivered" — see the header comment. */
export type DeliveryState = "accepted" | "refused" | "unconfirmed" | "not_sent";
export interface MailResult { delivered: boolean; state: DeliveryState; provider?: "cloudflare"; provider_message_id?: string; reason?: MailReason; provider_status?: number }
export interface MailMessage { to: string; subject: string; text: string; html?: string; idempotencyKey: string }

/** One plain ASCII mailbox: letters, digits and . _ % + - in the local part (no leading/trailing/double dots); hostname labels
 *  that do not start or end with '-'; alphabetic or punycode TLD. Deliberately stricter than RFC 5322: quoted local parts and
 *  characters like ' / = are refused LOUDLY (INVALID_PARAMS) rather than sent and bounced. No display names, lists, whitespace. */
const ADDRESS = /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+([A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;
/** Reserved / non-routable: RFC 2606 + RFC 6761 names and any subdomain of them. */
const RESERVED_TLD = /\.(invalid|test|example|localhost|local)$/i;
const RESERVED_DOMAIN = /(^|\.)example\.(com|net|org)$/i;
/** Normalised address, or null when it is not exactly one plain mailbox. Handlers validate with this BEFORE doing anything. */
export function normalizeAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const a = raw.trim().toLowerCase();
  return a.length <= 254 && ADDRESS.test(a) ? a : null;
}
export const isSyntheticAddress = (normalized: string): boolean => { const d = normalized.slice(normalized.lastIndexOf("@") + 1); return RESERVED_TLD.test("." + d) || RESERVED_DOMAIN.test(d); };
export const mailConfigured = (env: MailEnv) => typeof env.EMAIL?.send === "function" && !!normalizeAddress(env.MAIL_FROM);

const HEX64 = /^[0-9a-f]{64}$/;
/** The dev allowlist, or null when it is missing, empty or malformed. ONE bad entry invalidates the WHOLE list: a typo must
 *  close the door, not silently shrink it. Entries are sha256 hex of the normalised address — no address sits in config.
 *  EVERY comma-separated entry, after trimming, must be exactly 64 lowercase hex — an EMPTY entry (a trailing or doubled
 *  comma, or whitespace alone) is malformed too and closes the list, rather than being quietly dropped.
 *  Note: an absent/blank value is handled by envRefusal (DEV then sends to any address); this parser only judges a non-empty list. */
export function parseMailAllowlist(raw: unknown): Set<string> | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length === 0 || !parts.every((p) => HEX64.test(p))) return null;
  return new Set(parts);
}
/** Fail-closed environment policy. Returns null when sending is permitted, otherwise the refusal reason.
 *  DEV sends to ANY address when MAIL_ALLOWLIST_SHA256 is absent/empty (team testing); a non-empty list is still enforced
 *  and a malformed one still closes the door. Production is unchanged; every other environment is refused. */
async function envRefusal(env: MailEnv, normalizedTo: string): Promise<MailReason | null> {
  if (env.ENVIRONMENT === "production") return null;
  if (env.ENVIRONMENT !== "dev") return "not_allowed_env";
  const raw = env.MAIL_ALLOWLIST_SHA256;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const allow = parseMailAllowlist(raw);
  if (!allow) return "not_allowlisted";
  return allow.has(await sha256(normalizedTo)) ? null : "not_allowlisted";
}

const notSent = (reason: MailReason): MailResult => ({ delivered: false, state: "not_sent", reason });

// Explicit documented rejections only. Internal/unknown errors are deliberately excluded.
const REFUSAL_CODES = new Set([
  "E_VALIDATION_ERROR", "E_FIELD_MISSING", "E_TOO_MANY_RECIPIENTS", "E_TOO_MANY_ATTACHMENTS",
  "E_SENDER_NOT_VERIFIED", "E_RECIPIENT_NOT_ALLOWED", "E_RECIPIENT_SUPPRESSED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE", "E_CONTENT_TOO_LARGE", "E_DELIVERY_FAILED",
  "E_RATE_LIMIT_EXCEEDED", "E_DAILY_LIMIT_EXCEEDED", "E_HEADER_NOT_ALLOWED",
  "E_HEADER_USE_API_FIELD", "E_HEADER_VALUE_INVALID", "E_HEADER_VALUE_TOO_LONG",
  "E_HEADER_NAME_INVALID", "E_HEADERS_TOO_LARGE", "E_HEADERS_TOO_MANY",
]);

export async function sendMail(env: MailEnv, m: MailMessage): Promise<MailResult> {
  const to = normalizeAddress(m.to);
  if (!to) return notSent("invalid_address");
  // Unconditional and first: no environment and no allowlist can authorise a reserved synthetic mailbox.
  if (isSyntheticAddress(to)) return notSent("synthetic_recipient");
  const refusal = await envRefusal(env, to);
  if (refusal) return notSent(refusal);
  if (!mailConfigured(env)) return notSent("not_configured");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The binding has no abort or documented idempotency API. This header correlates
    // an intent only; handler-level de-duplication remains the protection against replay.
    const result = await Promise.race([
      env.EMAIL!.send({
        from: { email: normalizeAddress(env.MAIL_FROM)!, name: "3D Review" },
        to, subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}),
        headers: { "X-3D-Review-Intent": m.idempotencyKey },
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("mail timeout")), 8000); }),
    ]);
    // A malformed result is not evidence of acceptance. Never expose provider error text.
    if (!result || typeof result.messageId !== "string" || !result.messageId)
      return { delivered: false, state: "unconfirmed", provider: "cloudflare", reason: "provider_unreachable" };
    return { delivered: true, state: "accepted", provider: "cloudflare", provider_message_id: result.messageId };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (typeof code === "string" && REFUSAL_CODES.has(code))
      return { delivered: false, state: "refused", provider: "cloudflare", reason: "provider_error" };
    // Unknown/internal failures and timeouts may already have sent. No retry, even
    // after the deadline: the binding operation cannot be cancelled.
    return { delivered: false, state: "unconfirmed", provider: "cloudflare", reason: "provider_unreachable" };
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Where links in mail point. Set per environment in wrangler.toml; absent → no link can be built → caller must not send. */
export const publicOrigin = (env: MailEnv): string | null => (env.PUBLIC_ORIGIN ? env.PUBLIC_ORIGIN.replace(/\/+$/, "") : null);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Collaborator invitation. Plain, short, no tracking, no images. Names no project contents — the scope name is disclosed only after accept. */
export function invitationMessage(origin: string, token: string, role: string, scopeType: string, expiresDays: number) {
  const link = `${origin}/#invite=${encodeURIComponent(token)}`; // fragment, like /#session= — never sent to a server, never in edge logs
  const subject = "You have been invited to 3D Review";
  const text = [
    `You have been invited to join a ${scopeType} in 3D Review as ${role}.`,
    "",
    "To accept, open this link and sign in with this email address. You will get a sign-in email — there is no password.",
    "",
    link,
    "",
    `The invitation expires in ${expiresDays} days and only works for this email address. If you were not expecting it, you can ignore this message.`,
  ].join("\n");
  const html = `<p>You have been invited to join a ${esc(scopeType)} in 3D Review as <b>${esc(role)}</b>.</p><p>To accept, open this link and sign in with this email address. You will get a sign-in email — there is no password.</p><p><a href="${esc(link)}">Accept the invitation</a></p><p style="color:#57606a;font-size:14px">The invitation expires in ${expiresDays} days and only works for this email address. If you were not expecting it, you can ignore this message.</p>`;
  return { subject, text, html, link };
}
