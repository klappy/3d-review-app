/**
 * Internal T06 report input snapshots. There is deliberately no public handler:
 * Steve's pinned executable source is the scoring gold standard; differences
 * from historical drafts are tracked as tensions, not a blanket build hold.
 * D7 disclosure remains held. IDs, hashes and snapshot cadence cannot leak
 * through viewer routes while differencing policy remains undecided.
 */
import type { Ctx } from "./handlers/types";
import { gate, newId, nowIso, roleAt, sha256 } from "./handlers/common";
import { notVisible } from "./handlers/errors";

export const SNAPSHOT_ALGORITHM_VERSION = "source-input-with-template-v2";
export const SNAPSHOT_POLICY_VERSION = "D7-held";
export const PINNED_SOURCE = "klappy/3d-quality-review@f042cde553761a6a7f24132cef7802f956378ee0";

export interface ResponseInput {
  id: string;
  template_id: string;
  template_version: number;
  selected_template_id: string;
  selected_template_version: number;
  source_ref: string | null;
  answers_json: string;
  submitted_at: string;
  items_json: string;
  perspective: string;
}

export interface SnapshotRow {
  id: string;
  assessment_id: string;
  input_hash: string;
  algorithm_version: string;
  policy_version: string;
  state: "held" | "incompatible" | "insufficient";
  evidence_json: string;
  created_at: string;
  created_by: string | null;
}

async function assessmentAccess(ctx: Ctx, aid: string, min: "viewer" | "member") {
  const row = await ctx.db.prepare("SELECT id FROM assessment WHERE id = ?").bind(aid).first<{ id: string }>();
  if (!row) throw notVisible("assessment");
  gate(await roleAt(ctx, "assessment", aid), min, "assessment");
}

function stateFor(rows: readonly ResponseInput[]): SnapshotRow["state"] {
  if (!rows.length) return "insufficient";
  // No historical one-question synthetic fixture may enter a real scored run,
  // nor may a response silently switch away from the presented template.
  if (rows.some(row => row.template_id !== row.selected_template_id || row.template_version !== row.selected_template_version ||
      row.template_version !== 2 || !row.source_ref?.startsWith(PINNED_SOURCE))) return "incompatible";
  return "held"; // disclosure state, not a scoring-implementation stop
}

/** Durable, idempotent snapshot of exact append-only response inputs. */
export async function captureReportSnapshot(ctx: Ctx, aid: string): Promise<{ snapshot: SnapshotRow; rows: readonly Readonly<ResponseInput>[] }> {
  await assessmentAccess(ctx, aid, "member");
  const { results } = await ctx.db.prepare(`SELECT r.id, r.template_id, r.template_version,
      s.template_id AS selected_template_id, s.template_version AS selected_template_version,
      t.source_ref, r.answers_json, r.submitted_at, t.items_json, t.perspective
    FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id
    JOIN survey_template t ON t.id = s.template_id AND t.version = s.template_version
    WHERE s.assessment_id = ? ORDER BY r.id`).bind(aid).all<ResponseInput>();
  const rows = Object.freeze((results ?? []).map(row => Object.freeze(row)));
  // Answers enter the hash, never evidence_json, receipts, traces or logs.
  const inputHash = await sha256(JSON.stringify(rows.map(row => [row.id, row.template_id,
    row.template_version, row.selected_template_id, row.selected_template_version,
    row.source_ref, row.answers_json, row.submitted_at, row.items_json, row.perspective])));
  const state = stateFor(rows);
  const evidence = {
    response_ids: rows.map(row => row.id),
    templates: [...new Set(rows.map(row => `${row.template_id}@${row.template_version}`))].sort(),
    source_refs: [...new Set(rows.map(row => row.source_ref))].sort(),
    input_contract: "exact append-only response set; no score calculation",
  };
  await ctx.db.prepare(`INSERT OR IGNORE INTO report_snapshot
    (id, assessment_id, input_hash, algorithm_version, policy_version, state, evidence_json, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId("rsnap"), aid, inputHash, SNAPSHOT_ALGORITHM_VERSION, SNAPSHOT_POLICY_VERSION,
      state, JSON.stringify(evidence), nowIso(ctx), ctx.principal.id).run();
  const snapshot = await ctx.db.prepare(`SELECT * FROM report_snapshot WHERE assessment_id = ?
    AND input_hash = ? AND algorithm_version = ? AND policy_version = ?`)
    .bind(aid, inputHash, SNAPSHOT_ALGORITHM_VERSION, SNAPSHOT_POLICY_VERSION).first<SnapshotRow>();
  if (!snapshot) throw new Error("snapshot insert/readback failed");
  return { snapshot, rows };
}

export async function buildReportSnapshot(ctx: Ctx, aid: string): Promise<SnapshotRow> {
  return (await captureReportSnapshot(ctx, aid)).snapshot;
}

/** Internal-only lookup. Do not expose IDs/list cadence until D7 is decided. */
export async function getReportSnapshot(ctx: Ctx, id: string): Promise<SnapshotRow> {
  const row = await ctx.db.prepare("SELECT * FROM report_snapshot WHERE id = ?").bind(id).first<SnapshotRow>();
  if (!row) throw notVisible("report");
  await assessmentAccess(ctx, row.assessment_id, "viewer");
  return row;
}

/** Internal-only list, exact assessment grant and no inherited project role. */
export async function listReportSnapshots(ctx: Ctx, aid: string): Promise<SnapshotRow[]> {
  await assessmentAccess(ctx, aid, "viewer");
  const { results } = await ctx.db.prepare("SELECT * FROM report_snapshot WHERE assessment_id = ? ORDER BY created_at DESC, id DESC")
    .bind(aid).all<SnapshotRow>();
  return results ?? [];
}
