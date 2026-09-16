import { describe, expect, it } from "vitest";
import { crossLensReference, rollupReference, type ScoredRow } from "../src/reference-rollup";
import model from "../src/pinned-report-model.json";

const include = new Set(model.subdimensions.filter(row => row.included_in_lens_score)
  .map(row => JSON.stringify([row.lens, row.sub_dimension])));

describe("pinned Steve 04_aggregate reference arithmetic (internal only)", () => {
  it("loads all pinned lens and cross-lens definitions without inventing a composite", () => {
    expect(model.commit).toBe("f042cde553761a6a7f24132cef7802f956378ee0");
    expect(model.subdimensions).toHaveLength(17);
    expect(model.constructs).toHaveLength(8);
    expect(model.constructs.find(c => c.code === "translation-type-agreement")?.categorical).toBe(true);
    expect(model.constructs.find(c => c.code === "impact-use")?.item_ids)
      .toEqual(["CW-Q9", "CW-Q10", "CA-Q9", "CA-Q10", "CV-Q9", "CV-Q10", "CHCP-Q12", "CHCP-Q13"]);
  });
  it("averages scored response rows, then included subdimensions, not items first", () => {
    const rows: ScoredRow[] = [
      ...[85, 85, 85].map(score => ({ assessment_id: "a1", item_id: "TR-Q9",
        lens: "Translation Team", sub_dimension: "Understanding the Source", score })),
      { assessment_id: "a1", item_id: "TR-Q10", lens: "Translation Team", sub_dimension: "Understanding the Source", score: 55 },
      { assessment_id: "a1", item_id: "TR-Q14", lens: "Translation Team", sub_dimension: "Consistency", score: 50 },
      { assessment_id: "a1", item_id: "ML-Q10", lens: "Translation Team", sub_dimension: "Understanding the Source",
        score: 40, standalone_indicator: true },
      { assessment_id: "a1", item_id: "TR-Q9", lens: "Translation Team", sub_dimension: "Understanding the Source", score: null },
    ];
    const result = rollupReference(rows, include);
    expect(result.subdimensions).toContainEqual({ assessment_id: "a1", lens: "Translation Team",
      sub_dimension: "Understanding the Source", score: 77.5, n_items_included: 2 });
    expect(result.lenses).toContainEqual({ assessment_id: "a1", lens: "Translation Team",
      score: 63.75, n_subdims_included: 2 });
    expect(result.indicators).toEqual([{ assessment_id: "a1", item_id: "ML-Q10", score: 40, n_responses: 1 }]);
  });
  it("keeps source raw-range agreement null for one lens", () => {
    const rows: ScoredRow[] = [
      { assessment_id: "a1", item_id: "TR-Q9", lens: "Translation Team", sub_dimension: "Understanding the Source", score: 67 },
      { assessment_id: "a1", item_id: "CHCP-Q7", lens: "Church", sub_dimension: "Confidence in the Translation", score: 100 },
      { assessment_id: "a2", item_id: "TR-Q9", lens: "Translation Team", sub_dimension: "Understanding the Source", score: 67 },
    ];
    expect(crossLensReference(rows, { "source-understanding": ["TR-Q9", "CHCP-Q7"] }))
      .toEqual([{ assessment_id: "a1", construct_code: "source-understanding", triangulated_mean: 83.5,
        agreement_range: 33, n_lenses_included: 2,
        per_lens: [{ lens: "Church", score: 100 }, { lens: "Translation Team", score: 67 }] },
        { assessment_id: "a2", construct_code: "source-understanding", triangulated_mean: 67,
          agreement_range: null, n_lenses_included: 1,
          per_lens: [{ lens: "Translation Team", score: 67 }] }]);
  });
});
