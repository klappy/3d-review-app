import type { Env, Principal } from "./handlers/types";
import { sha256 } from "./handlers/types";

function cookie(req: Request, name: string): string | undefined {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1];
}

/** Resolve the caller. Session cookie (UI), Bearer (delegated agent, phase 0 = same token), participant token. Stateless: re-read every call. */
export async function resolvePrincipal(req: Request, env: Env): Promise<Principal> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || cookie(req, "session");
  if (!token) return { kind: "anonymous", id: "anon" };
  const h = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT s.principal_id, s.kind, s.delegated_by, s.expires_at, s.participant_survey_id, s.respondent_id, p.email_hash, p.provisioned, p.support FROM session s LEFT JOIN principal p ON p.id = s.principal_id WHERE s.token_hash = ?"
  ).bind(h).first<any>();
  if (row && (!row.expires_at || row.expires_at >= Date.now())) {
    if (row.kind === "participant") return { kind: "participant", id: row.principal_id, participantSurveyId: row.participant_survey_id, respondentId: row.respondent_id };
    if (row.kind === "support" || row.support) return { kind: "support", id: row.principal_id, supportActor: row.delegated_by ?? undefined, provisioned: true };
    return { kind: "user", id: row.principal_id, provisioned: !!row.provisioned, delegatedBy: bearer ? row.delegated_by ?? undefined : undefined };
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
  await env.DB.prepare("DELETE FROM session WHERE token_hash = ?").bind(await sha256(token)).run();
}
