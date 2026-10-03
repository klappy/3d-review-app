/**
 * The signed-in account's own display name (captain ruling a1, 2026-10-02; cookbook
 * work/queued/2026-09-29-3d-train22-audit-backlog/RULING-2026-10-02-greet-alias.md). Optional: NULL means "not set" and
 * every greeting falls back to the email. Only the caller's OWN principal row is ever read or written: there is no id
 * parameter, so no one can set or see anyone else's name through this row. A connector (OAuth) or delegated session acts
 * as the person who granted it, so it sets that person's own name, never another's. Participants have no account.
 */
import type { Ctx, Handler } from "./types";
import { CapError } from "./errors";
import { requireUser } from "./common";

export const DISPLAY_NAME_MAX = 60;
// C0/C1 controls, line/paragraph separators and bidi overrides/isolates: a name is one plain line that cannot reorder
// the text around it on screen.
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/;

/** Normalizes a requested name: null/"" (after trim) clears it; otherwise NFC, inner whitespace runs → one space, ≤ 60 characters. */
export function cleanDisplayName(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string") throw new CapError("INVALID_PARAMS", "display_name must be a string or null", "send null or an empty string to clear it", "cap.me.update");
  if (FORBIDDEN.test(v)) throw new CapError("INVALID_PARAMS", "display_name must be one plain line", "no line breaks, control or direction characters", "cap.me.update");
  const s = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if ([...s].length > DISPLAY_NAME_MAX) throw new CapError("INVALID_PARAMS", `display_name is at most ${DISPLAY_NAME_MAX} characters`, `shorten it to ${DISPLAY_NAME_MAX} characters or fewer`, "cap.me.update");
  return s;
}

const missingColumn = (e: unknown) => /no such column/i.test(String((e as Error)?.message ?? e));

/** The caller's own display name, or null (not set, not an account, or migration 0015 not yet applied). */
export async function ownDisplayName(ctx: Ctx): Promise<string | null> {
  const pr = ctx.principal;
  if (pr.kind !== "user" && pr.kind !== "support") return null;
  try {
    const row = await ctx.db.prepare("SELECT display_name FROM principal WHERE id = ?").bind(pr.id).first<{ display_name: string | null }>();
    return typeof row?.display_name === "string" && row.display_name ? row.display_name : null;
  } catch (e) {
    if (missingColumn(e)) return null; // code may reach an environment before its step-0 migration; greet by email meanwhile
    throw e;
  }
}

/** cap.me.update — set or clear the caller's own display name. write.reversible; undo restores the prior value. */
export const meUpdate: Handler = async (ctx, params) => {
  const actor = requireUser(ctx);
  for (const k of Object.keys(params)) if (k !== "display_name") throw new CapError("INVALID_PARAMS", `unknown field ${k}`, "allowed:display_name — it always names your own account", "cap.me.update");
  if (!("display_name" in params)) throw new CapError("INVALID_PARAMS", "display_name is required", "send a name, or null to clear it", "cap.me.update");
  const next = cleanDisplayName(params.display_name);
  const prior = await ownDisplayName(ctx);
  let changed;
  try {
    changed = await ctx.db.prepare("UPDATE principal SET display_name = ? WHERE id = ?").bind(next, actor).run();
  } catch (e) {
    if (missingColumn(e)) throw new CapError("RESERVED_NOT_BUILT", "display names are not available in this environment yet", "migration 0015_display_name has not been applied here", "cap.me.update");
    throw e;
  }
  if (!changed.meta.changes) throw new CapError("NOT_AUTHENTICATED", "no account for this sign-in", "sign in again");
  return { result: { display_name: next }, scope: { type: "platform", id: actor }, priorState: { display_name: prior } };
};

export const handlers: Record<string, Handler> = { "cap.me.update": meUpdate };
