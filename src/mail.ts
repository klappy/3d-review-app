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
 *   - one Idempotency-Key per logical message, so a retried request cannot mail twice.
 */
import type { Env } from "./handlers/types";

export type MailEnv = Env & { RESEND_API_KEY?: string; MAIL_FROM?: string; PUBLIC_ORIGIN?: string };
export type MailReason = "not_configured" | "not_production" | "synthetic_recipient" | "provider_error" | "provider_unreachable";
export interface MailResult { delivered: boolean; provider?: "resend"; provider_message_id?: string; reason?: MailReason; provider_status?: number }
export interface MailMessage { to: string; subject: string; text: string; html?: string; idempotencyKey: string }

const SYNTHETIC = /(\.invalid|\.test|\.example|@example\.(com|net|org))$/i;
export const mailConfigured = (env: MailEnv) => !!(env.RESEND_API_KEY && env.MAIL_FROM);

export async function sendMail(env: MailEnv, m: MailMessage): Promise<MailResult> {
  if (SYNTHETIC.test(m.to.trim())) return { delivered: false, reason: "synthetic_recipient" };
  if (env.ENVIRONMENT !== "production") return { delivered: false, reason: "not_production" };
  if (!mailConfigured(env)) return { delivered: false, reason: "not_configured" };
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": m.idempotencyKey },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}) }),
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
  const link = `${origin}/?invite=${encodeURIComponent(token)}`;
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
