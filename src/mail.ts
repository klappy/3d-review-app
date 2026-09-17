/**
 * Outbound mail (OF-3). 6B: BORROW Resend's HTTP API with one fetch — no SDK (it would add Node-shaped dependencies to a
 * Worker for a single POST), no hand-rolled SMTP. BUILD = this adapter only.
 *
 * Captain gate (HUMAN-ONLY: secret): the captain verifies a sending domain in Resend, creates a SENDING-ONLY key and sets
 *   RESEND_API_KEY  (Worker secret)      MAIL_FROM  e.g. "3D Review <no-reply@…>" (Worker secret or var)
 * on the production Worker. No seat ever handles the key. Until both exist every send answers
 *   { delivered:false, reason:"not_configured" }  — never a pretend success.
 *
 * Rules that hold regardless of configuration:
 *   - only ENVIRONMENT === "production" sends. The dev sandbox never contacts a mailbox (access-boundary ruling, #14).
 *   - reserved synthetic domains (*.invalid, *.test, *.example, example.com/net/org) are never sent to, anywhere.
 *   - the address never reaches a log, a span or a result; callers log a hash prefix at most.
 *   - the caller passes an Idempotency-Key; de-duplication of the INTENT (same scope + invitee) is the handler's job —
 *     see grant.invite: one live invitation per scope+invitee per 10 minutes, 30 invitations per inviter per hour.
 */
import type { Env } from "./handlers/types";

export type MailEnv = Env & { RESEND_API_KEY?: string; MAIL_FROM?: string; PUBLIC_ORIGIN?: string };
export type MailReason = "invalid_address" | "duplicate_recent" | "not_configured" | "not_production" | "synthetic_recipient" | "provider_error" | "provider_unreachable";
export interface MailResult { delivered: boolean; provider?: "resend"; provider_message_id?: string; reason?: MailReason; provider_status?: number }
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

export async function sendMail(env: MailEnv, m: MailMessage): Promise<MailResult> {
  const to = normalizeAddress(m.to);
  if (!to) return { delivered: false, reason: "invalid_address" };
  if (isSyntheticAddress(to)) return { delivered: false, reason: "synthetic_recipient" };
  if (env.ENVIRONMENT !== "production") return { delivered: false, reason: "not_production" };
  if (!mailConfigured(env)) return { delivered: false, reason: "not_configured" };
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": m.idempotencyKey },
      signal: AbortSignal.timeout(8000), // a provider stall must not stall the capability
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}) }),
    });
  } catch { return { delivered: false, provider: "resend", reason: "provider_unreachable" }; }
  if (!res.ok) return { delivered: false, provider: "resend", reason: "provider_error", provider_status: res.status };
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  // "delivered" here means: the provider ACCEPTED the message for delivery. Inbox arrival is the provider's to report.
  return { delivered: true, provider: "resend", provider_message_id: body.id };
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
