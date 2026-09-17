import type { Env, Principal } from "./handlers/types";
import { sha256 } from "./handlers/types";

function cookie(req: Request, name: string): string | undefined {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1];
}

/**
 * Shape of every credential this code mints: mintSession → `st_`/`pt_` + 32 hex; randomToken("pt") (participant
 * open_link) → `pt_` + 32 base64url chars. Anything else cannot be a live row, so it is refused with ZERO storage access
 * (Otto P1 5706955103, auditor 5707673911 #3): a malformed or provider-shaped (`a:b:c`) bearer costs no D1 read.
 * Residual R1, recorded in INTERFACE.md: a WELL-FORMED unknown token costs the two indexed lookups on EVERY request,
 * including ones a limiter then refuses — reads are unbounded per address; only writes are bounded (anonymous budget).
 */
export const FIRST_PARTY_TOKEN = /^(st|pt)_[A-Za-z0-9_-]{32}$/;

/** Resolve the caller. Session cookie (UI), Bearer (delegated agent, phase 0 = same token), participant token. Stateless: re-read every call. */
export async function resolvePrincipal(req: Request, env: Env): Promise<Principal> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || cookie(req, "session");
  if (!token) return { kind: "anonymous", id: "anon" };
  if (!FIRST_PARTY_TOKEN.test(token)) return { kind: "anonymous", id: "anon" }; // shape gate: no lookup for what we never minted
  const h = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT s.principal_id, s.kind, s.delegated_by, s.expires_at, s.participant_survey_id, s.respondent_id, p.email_hash, p.provisioned, p.support FROM session s LEFT JOIN principal p ON p.id = s.principal_id WHERE s.token_hash = ?"
  ).bind(h).first<any>();
  if (row && (!row.expires_at || row.expires_at >= Date.now())) {
    if (row.kind === "participant") return { kind: "participant", id: row.principal_id, participantSurveyId: row.participant_survey_id, respondentId: row.respondent_id, sessionTokenHash: h };
    if (row.kind === "support" || row.support) return { kind: "support", id: row.principal_id, supportActor: row.delegated_by ?? undefined, provisioned: true, sessionTokenHash: h };
    return { kind: "user", id: row.principal_id, provisioned: !!row.provisioned, delegatedBy: bearer ? row.delegated_by ?? undefined : undefined, sessionTokenHash: h };
  }
  // Participant tokens are separate, survey-scoped credentials. A user-session
  // cookie never becomes participant authority; only an explicit bearer can.
  if (bearer) {
    const participant = await env.DB.prepare(
      "SELECT respondent_id, assessment_survey_id, expires_at, revoked_at FROM participant_session WHERE token_hash = ?"
    ).bind(h).first<{ respondent_id: string; assessment_survey_id: string; expires_at: string; revoked_at: string | null }>();
    if (participant && !participant.revoked_at && participant.expires_at > new Date().toISOString())
      return { kind: "participant", id: participant.respondent_id, participantSurveyId: participant.assessment_survey_id, respondentId: participant.respondent_id };
  }
  return { kind: "anonymous", id: "anon" };
}

export async function mintSession(env: Env, principalId: string, kind: "user" | "participant" | "support", extra: Record<string, unknown> = {}, ttlMs = 12 * 3600e3): Promise<string> {
  const token = `${kind === "participant" ? "pt" : "st"}_${crypto.randomUUID().replace(/-/g, "")}`;
  await env.DB.prepare(
    "INSERT INTO session (token_hash, principal_id, kind, delegated_by, participant_survey_id, respondent_id, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(await sha256(token), principalId, kind, (extra.delegated_by as string) ?? null, (extra.participant_survey_id as string) ?? null, (extra.respondent_id as string) ?? null, Date.now() + ttlMs, Date.now()).run();
  return token;
}

export async function revokeSession(env: Env, token: string) {
  await revokeSessionByHash(env, await sha256(token));
}
export async function revokeSessionByHash(env: Env, tokenHash: string): Promise<number> {
  const r = await env.DB.prepare("DELETE FROM session WHERE token_hash = ?").bind(tokenHash).run();
  return r.meta.changes ?? 0;
}
