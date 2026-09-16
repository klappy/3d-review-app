// cap.support.unlock_participant — KCS reissues an access code: the old code is revoked (unless redeemed), a new one is issued on the same survey.
// The new code VALUE is never returned here (CON-PRIV-005); it is disclosed only through the confirmed cap.survey.export_codes path. Lane B (Fable).
// cap.support.acts_as stays 501 (HUMAN-ONLY provisioning + audit design is Lane A's escrow/receipt work).
import type { Handler } from "./types";
import { CapError, notVisible } from "./errors";
import { auditRow, newId, nowIso, randomCode, reqStr, requireSupport, sha256 } from "./common";

export const unlock_participant: Handler = async (ctx, p) => {
  requireSupport(ctx);
  if (p.reason === undefined) throw new CapError("INVALID_PARAMS", "reason required", "support actions carry a reason for the audit row");
  const codeId = reqStr(p, "code_id");
  const old = await ctx.db.prepare("SELECT id, assessment_survey_id, redeemed_at FROM access_code WHERE id = ?").bind(codeId).first<{ id: string; assessment_survey_id: string; redeemed_at: string | null }>();
  if (!old) throw notVisible("code");
  const survey = await ctx.db.prepare("SELECT id, assessment_id FROM assessment_survey WHERE id = ?").bind(old.assessment_survey_id).first<{ id: string; assessment_id: string }>();
  if (!survey) throw notVisible("survey");
  const newId_ = newId("code"); const value = randomCode();
  const stmts = [ctx.db.prepare("INSERT INTO access_code (id, assessment_survey_id, code_hash, created_at) VALUES (?,?,?,?)").bind(newId_, survey.id, await sha256(value), nowIso(ctx))];
  if (!old.redeemed_at) stmts.push(ctx.db.prepare("DELETE FROM access_code WHERE id = ?").bind(old.id));
  await ctx.db.batch(stmts);
  const scope = { type: "assessment" as const, id: survey.assessment_id };
  const audit = await auditRow(ctx, "cap.support.unlock_participant", scope, { old_code: old.id, new_code: newId_, old_was_redeemed: !!old.redeemed_at, support_actor: ctx.principal.supportActor ?? ctx.principal.id });
  return { result: { old_code: old.id, old_revoked: !old.redeemed_at, new_code_id: newId_, sid: survey.id, aid: survey.assessment_id, value_via: "cap.survey.export_codes (confirmed disclosure)", audit }, scope };
};

// HELD as RESERVED_NOT_BUILT until Lane A's keyed-digest + encrypted escrow lands (Astra audit c5704769544): a SHA-256-only code is offline-guessable and this value could never be exported.
export const handlers: Record<string, Handler> = {};
