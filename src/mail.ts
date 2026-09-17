/**
 * Outbound mail (OF-3). 6B: BORROW Resend's HTTP API with one fetch — no SDK (it would add Node-shaped dependencies to a
 * Worker for a single POST), no hand-rolled SMTP. BUILD = this adapter only.
 *
 * Captain gate (HUMAN-ONLY: secret): the captain verifies a sending domain in Resend, creates a SENDING-ONLY key and sets
 *   RESEND_API_KEY  (Worker secret)      MAIL_FROM  e.g. "3D Review <no-reply@…>" (var)
 * on the Worker. No seat ever handles the key. Until both exist every send answers
 *   { delivered:false, state:"not_sent", reason:"not_configured" }  — never a pretend success.
 *
 * Rules that hold regardless of configuration:
 *   - a mailbox is contacted ONLY when (a) ENVIRONMENT === "production", or (b) ENVIRONMENT === "dev" AND the recipient's
 *     sha256(trim+lowercase(address)) is listed in MAIL_ALLOWLIST_SHA256. Fail-closed: any other or missing ENVIRONMENT, a
 *     missing/empty/malformed allowlist, or an unlisted recipient never reaches the provider (accepted plan 14c5715401704).
 *   - reserved synthetic domains (*.invalid, *.test, *.example, example.com/net/org) are never sent to, anywhere, and that
 *     refusal is decided BEFORE any environment or configuration check — a dev allowlist cannot re-enable them.
 *   - the address never reaches a log, a span or a result; callers log a state/reason at most.
 *   - the caller passes an Idempotency-Key; de-duplication of the INTENT (same scope + invitee) is the handler's job —
 *     see grant.invite: one live invitation per scope+invitee per 10 minutes, 30 invitations per inviter per hour.
 *
 * Delivery truth (accepted plan 14c5715401704): `delivered` is true ONLY on a provider 2xx, which means the provider
 * ACCEPTED the message — never that it reached an inbox. `state` says which kind of outcome this was:
 *   "accepted"    provider returned 2xx (delivered:true)
 *   "refused"     provider returned non-2xx (provider_status carries it)
 *   "unconfirmed" the request timed out or the provider was unreachable — it MAY have been accepted remotely. Never retried,
 *                 never replayed; the caller must not send a second invitation on the strength of it.
 *   "not_sent"    every pre-fetch refusal (address shape, synthetic recipient, environment, allowlist, configuration)
 */
import type { Env } from "./handlers/types";
import { sha256 } from "./handlers/common";

export type MailEnv = Env & { RESEND_API_KEY?: string; MAIL_FROM?: string; PUBLIC_ORIGIN?: string; MAIL_ALLOWLIST_SHA256?: string };
export type MailReason =
  | "invalid_address" | "duplicate_recent" | "not_configured"
  | "not_allowed_env" | "not_allowlisted" | "synthetic_recipient"
  | "provider_error" | "provider_unreachable";
/** What actually happened to the request. "unconfirmed" is NOT "not delivered" — see the header comment. */
export type DeliveryState = "accepted" | "refused" | "unconfirmed" | "not_sent";
export interface MailResult { delivered: boolean; state: DeliveryState; provider?: "resend"; provider_message_id?: string; reason?: MailReason; provider_status?: number }
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
export const mailConfigured = (env: MailEnv) => !!(env.RESEND_API_KEY && env.MAIL_FROM);

const HEX64 = /^[0-9a-f]{64}$/;
/** The dev allowlist, or null when it is missing, empty or malformed. ONE bad entry invalidates the WHOLE list: a typo must
 *  close the door, not silently shrink it. Entries are sha256 hex of the normalised address — no address sits in config. */
export function parseMailAllowlist(raw: unknown): Set<string> | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return null;
  if (!parts.every((p) => HEX64.test(p))) return null;
  return new Set(parts);
}
/** Fail-closed environment policy. Returns null when sending is permitted, otherwise the refusal reason. */
async function envRefusal(env: MailEnv, normalizedTo: string): Promise<MailReason | null> {
  if (env.ENVIRONMENT === "production") return null;
  if (env.ENVIRONMENT !== "dev") return "not_allowed_env";
  const allow = parseMailAllowlist(env.MAIL_ALLOWLIST_SHA256);
  if (!allow) return "not_allowlisted";
  return allow.has(await sha256(normalizedTo)) ? null : "not_allowlisted";
}

const notSent = (reason: MailReason): MailResult => ({ delivered: false, state: "not_sent", reason });

export async function sendMail(env: MailEnv, m: MailMessage): Promise<MailResult> {
  const to = normalizeAddress(m.to);
  if (!to) return notSent("invalid_address");
  // Unconditional and first: no environment and no allowlist can authorise a reserved synthetic mailbox.
  if (isSyntheticAddress(to)) return notSent("synthetic_recipient");
  const refusal = await envRefusal(env, to);
  if (refusal) return notSent(refusal);
  if (!mailConfigured(env)) return notSent("not_configured");
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": m.idempotencyKey },
      signal: AbortSignal.timeout(8000), // a provider stall must not stall the capability
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}) }),
    });
  } catch {
    // The request may have been accepted on the far side. We do not know, so we do not retry and we do not claim either way.
    return { delivered: false, state: "unconfirmed", provider: "resend", reason: "provider_unreachable" };
  }
  if (!res.ok) return { delivered: false, state: "refused", provider: "resend", reason: "provider_error", provider_status: res.status };
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  // "delivered" here means: the provider ACCEPTED the message for delivery. Inbox arrival is the provider's to report.
  return { delivered: true, state: "accepted", provider: "resend", provider_message_id: body.id };
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
    "To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.",
    "",
    link,
    "",
    `The invitation expires in ${expiresDays} days and only works for this email address. If you were not expecting it, you can ignore this message.`,
  ].join("\n");
  const html = `<p>You have been invited to join a ${esc(scopeType)} in 3D Review as <b>${esc(role)}</b>.</p><p>To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.</p><p><a href="${esc(link)}">Accept the invitation</a></p><p style="color:#57606a;font-size:14px">The invitation expires in ${expiresDays} days and only works for this email address. If you were not expecting it, you can ignore this message.</p>`;
  return { subject, text, html, link };
}
