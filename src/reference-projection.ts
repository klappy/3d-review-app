/**
 * D1 adapter for Steve's pinned scoring reference. Internal ONLY: callers
 * must not expose these unsuppressed values while D7 disclosure is held.
 * Public HTTP/MCP report handlers remain 501 until contract/suppression gates.
 */
import type { Ctx } from "./handlers/types";
import type { SourceItem } from "./source-item-score";
import { scoreSourceItem } from "./source-item-score";
import { buildReportSnapshot, PINNED_SOURCE } from "./report-snapshot";
import { crossLensReference, REFERENCE_ROLLUP_VERSION, rollupReference,
  translationTypeReference, type ScoredRow, type TranslationTypeResponse } from "./reference-rollup";
import model from "./pinned-report-model.json";

interface InputRow {
  id: string;
  answers_json: string;
  template_id: string;
  template_version: number;
  selected_template_id: string;
  selected_template_version: number;
  items_json: string;
  perspective: string;
  source_ref: string | null;
}

/** Exact assessment-granted, version-bound private projection; never a route. */
export async function projectReferenceAssessment(ctx: Ctx, aid: string) {
  const snapshot = await buildReportSnapshot(ctx, aid); // exact member grant + immutable input fingerprint
  if (snapshot.state !== "held") return { status: snapshot.state, snapshot_id: snapshot.id,
    source_commit: model.commit, algorithm_version: REFERENCE_ROLLUP_VERSION,
    item_scores: [], subdimensions: [], lenses: [], indicators: [], cross_lens: [], translation_type: [] };
  const { results } = await ctx.db.prepare(`SELECT r.id, r.answers_json, r.template_id, r.template_version,
      s.template_id AS selected_template_id, s.template_version AS selected_template_version,
      t.items_json, t.perspective, t.source_ref
    FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id
    JOIN survey_template t ON t.id = s.template_id AND t.version = s.template_version
    WHERE s.assessment_id = ? ORDER BY r.id`).bind(aid).all<InputRow>();
  const scoredRows: ScoredRow[] = [];
  const categoricalRows: TranslationTypeResponse[] = [];
  const item_scores: Array<{ response_id: string; item_id: string; score: number | null; status: string; rule: string }> = [];
  for (const row of results ?? []) {
    if (row.template_id !== row.selected_template_id || row.template_version !== row.selected_template_version ||
        row.template_version !== 2 || !row.source_ref?.startsWith(PINNED_SOURCE))
      throw new Error("report input changed after snapshot");
    const items = JSON.parse(row.items_json) as SourceItem[];
    const answers = JSON.parse(row.answers_json) as Record<string, unknown>;
    const itemIds = new Set(items.map(item => item.id));
    if (Object.keys(answers).some(id => !itemIds.has(id))) throw new Error("unknown stored response item");
    for (const item of items) {
      const answer = answers[item.id] ?? null;
      const scored = scoreSourceItem(item, answer);
      item_scores.push({ response_id: row.id, item_id: item.id, score: scored.score,
        status: scored.status, rule: scored.rule });
      scoredRows.push({ assessment_id: aid, item_id: item.id, lens: row.perspective,
        sub_dimension: item.group, score: scored.score,
        standalone_indicator: scored.standalone_indicator });
      if (item.id === "TR-Q2" || item.id === "ML-Q2" || item.id === "CHIP-Q1" ||
          item.id === "CHCP-Q1" || item.id === "CHDL-Q1")
        categoricalRows.push({ assessment_id: aid, item_id: item.id,
          option_codes: typeof answer === "string" ? [answer] : Array.isArray(answer) ?
            answer.filter((code): code is string => typeof code === "string") : null });
    }
  }
  const included = new Set(model.subdimensions.filter(row => row.included_in_lens_score)
    .map(row => JSON.stringify([row.lens, row.sub_dimension])));
  const rollup = rollupReference(scoredRows, included);
  const constructs = Object.fromEntries(model.constructs.filter(row => !row.categorical)
    .map(row => [row.code, row.item_ids]));
  return { status: "reference_unpublished" as const, snapshot_id: snapshot.id,
    source_commit: model.commit, algorithm_version: REFERENCE_ROLLUP_VERSION,
    item_scores, ...rollup, cross_lens: crossLensReference(scoredRows, constructs),
    translation_type: translationTypeReference(categoricalRows) };
}
