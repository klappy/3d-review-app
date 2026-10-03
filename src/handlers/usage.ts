/** cap.ops.usage — app-wide totals for super admin (the existing principal.support switch). Roles S: policy.authorize refuses
 *  every non-support caller before this runs. Counts and dates only: no names, ids, answers, codes or addresses leave here. */
import type { Handler } from "./types";
import { CapError } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DAYS = 30;

function day(v: unknown, name: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)
    throw new CapError("INVALID_PARAMS", `${name} must be a YYYY-MM-DD day`, "e.g. {from:'2026-09-18', to:'2026-10-02'}", "cap.ops.usage");
  return v;
}

const n = (v: unknown) => Number(v ?? 0);

export const opsUsage: Handler = async (ctx, p) => {
  const extra = Object.keys(p ?? {}).filter((k) => k !== "from" && k !== "to");
  if (extra.length) throw new CapError("INVALID_PARAMS", `unknown params: ${extra.join(", ")}`, "only from and to are accepted", "cap.ops.usage");
  const now = ctx.now();
  const to = day(p.to, "to") ?? now.toISOString().slice(0, 10);
  const from = day(p.from, "from") ?? new Date(Date.parse(`${to}T00:00:00Z`) - (DEFAULT_DAYS - 1) * 86400e3).toISOString().slice(0, 10);
  if (from > to) throw new CapError("INVALID_PARAMS", "from is after to", undefined, "cap.ops.usage");
  // Half-open ISO window over the inclusive UTC days: [from 00:00, to+1 00:00).
  const lo = `${from}T00:00:00.000Z`;
  const hi = new Date(Date.parse(`${to}T00:00:00Z`) + 86400e3).toISOString();

  const db = ctx.db;
  const [totals, stages, perDay, writes] = await db.batch([
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM principal) AS accounts,
      (SELECT COUNT(*) FROM principal WHERE support = 1) AS super_admin,
      (SELECT COUNT(*) FROM workspace) AS workspaces,
      (SELECT COUNT(*) FROM project) AS projects,
      (SELECT COUNT(*) FROM language) AS languages,
      (SELECT COUNT(*) FROM assessment) AS assessments,
      (SELECT COUNT(*) FROM assessment_survey WHERE state = 'selected') AS surveys_selected,
      (SELECT COUNT(*) FROM assessment_survey WHERE state = 'selected' AND collection_status = 'open') AS surveys_open,
      (SELECT COUNT(*) FROM invitation WHERE scope_type = 'survey') AS links_issued,
      (SELECT COUNT(*) FROM invitation i WHERE i.scope_type = 'survey' AND EXISTS (SELECT 1 FROM participant_session s WHERE s.invitation_id = i.id)) AS links_opened,
      (SELECT COUNT(*) FROM participant_session) AS participant_sessions,
      (SELECT COUNT(*) FROM response) AS responses`),
    db.prepare("SELECT stage, COUNT(*) AS c FROM assessment GROUP BY stage"),
    db.prepare(`SELECT substr(t.at, 1, 10) AS day,
        SUM(CASE WHEN t.actor = 'anon' THEN 1 ELSE 0 END) AS not_signed_in,
        SUM(CASE WHEN t.actor <> 'anon' AND p.id IS NOT NULL THEN 1 ELSE 0 END) AS signed_in,
        SUM(CASE WHEN t.actor <> 'anon' AND p.id IS NULL THEN 1 ELSE 0 END) AS participant,
        COUNT(*) AS total
      FROM trace t LEFT JOIN principal p ON p.id = t.actor
      WHERE t.at >= ?1 AND t.at < ?2 GROUP BY day ORDER BY day`).bind(lo, hi),
    db.prepare("SELECT capability, COUNT(*) AS c FROM receipt WHERE at >= ?1 AND at < ?2 GROUP BY capability ORDER BY c DESC, capability").bind(lo, hi),
  ]);
  const t = (totals.results[0] ?? {}) as Record<string, unknown>;
  const by_stage = { prepare: 0, collect: 0, understand: 0, improve: 0 };
  for (const r of stages.results as { stage: keyof typeof by_stage; c: number }[]) if (r.stage in by_stage) by_stage[r.stage] = n(r.c);

  return {
    result: {
      as_of: now.toISOString(),
      range: { from, to },
      accounts: { total: n(t.accounts), super_admin: n(t.super_admin) },
      workspaces: n(t.workspaces),
      projects: n(t.projects),
      languages: n(t.languages),
      assessments: { total: n(t.assessments), by_stage },
      surveys: { selected: n(t.surveys_selected), open: n(t.surveys_open) },
      survey_links: { issued: n(t.links_issued), opened: n(t.links_opened) },
      participant_sessions: n(t.participant_sessions),
      responses: n(t.responses),
      requests_per_day: (perDay.results as Record<string, unknown>[]).map((r) => ({
        day: String(r.day), signed_in: n(r.signed_in), not_signed_in: n(r.not_signed_in), participant: n(r.participant), total: n(r.total),
      })),
      writes_by_capability: (writes.results as Record<string, unknown>[]).map((r) => ({ capability: String(r.capability), count: n(r.c) })),
    },
  };
};
