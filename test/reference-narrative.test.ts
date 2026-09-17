import { describe, expect, it } from "vitest";
import { buildReferenceNarrative, buildReferenceTrendNarrative } from "../src/reference-narrative";

const lens = (name: string, score: number | null, sub_dimensions: { sub_dimension: string; score: number | null; n_items_included: number }[] = []) =>
  ({ lens: name, score, sub_dimensions });

describe("pinned source deterministic narrative", () => {
  it("preserves relative lens, weak subdimension, raw range, and evidence wording", () => {
    const notes = buildReferenceNarrative([
      lens("Translation Team", 58, [{ sub_dimension: "Consistency", score: 80, n_items_included: 3 },
        { sub_dimension: "Clarity", score: 40, n_items_included: 1 }]),
      lens("Community", 81), lens("Church", 70),
    ], [{ construct_name: "Trust", agreement: 25,
      lens_scores: [{ lens: "Translation Team", score: 80 }, { lens: "Church", score: 55 }] }],
    [{ form_type: "Translator", n: 3 }, { form_type: "Pastor", n: 2 }]);
    expect(notes).toEqual([
      "Of the 3 lenses with data this cycle, Community scored highest at 81; Translation Team was lowest at 58 — a 23-point spread.",
      "Within Translation Team, Clarity scored lowest at 40 (a single-item indicator, not a full sub-dimension score).",
      "For Trust, Translation Team (80) and Church (55) see it differently — high divergence (25-point gap).",
      "These results are based on 5 submissions across 2 form types.",
    ]);
  });

  it("keeps source no-data/tie/one-lens/close-agreement states distinct", () => {
    expect(buildReferenceNarrative([lens("Church", null)], [], [])[0]).toBe("No lens has scored data yet this cycle.");
    expect(buildReferenceNarrative([lens("Church", 70)], [], [])[0]).toBe("Only the Church lens has scored data this cycle, at 70.");
    expect(buildReferenceNarrative([lens("Church", 70), lens("Community", 70)], [], [])[0])
      .toBe("All lenses with data this cycle scored the same: 70.");
    expect(buildReferenceNarrative([], [{ construct_name: "Trust", agreement: 4,
      lens_scores: [{ lens: "Church", score: 66 }, { lens: "Team", score: 70 }] }], []))
      .toContain("Where lenses overlap, they agree closely on every shared construct this cycle.");
    expect(buildReferenceNarrative([], [], [{ n: 1 }])).toContain("These results are based on 1 submission across 1 form type.");
  });

  it("uses Python half-even whole-number display, including ties", () => {
    expect(buildReferenceNarrative([lens("Community", 80.5), lens("Church", 57.5)], [], [])[0])
      .toContain("Community scored highest at 80; Church was lowest at 58");
  });

  it("reproduces source trend thresholds and sharp-drop note", () => {
    const notes = buildReferenceTrendNarrative({
      "Translation Team": [
        { cycle_date: "2026-01", score: 85 }, { cycle_date: "2026-07", score: 87 },
        { cycle_date: "2027-01", score: 49 }, { cycle_date: "2027-07", score: 68 },
      ],
      Church: [{ cycle_date: "2026-01", score: 55 }, { cycle_date: "2026-07", score: 61 }],
    });
    expect(notes).toEqual([
      "Church held steady across 2 cycles (55 → 61).",
      "Translation Team fell from 85 to 68 over 4 cycles (2026-01 → 2027-07, -17).",
      "Translation Team dropped sharply between 2026-07 and 2027-01 (87 → 49) — worth investigating what changed.",
    ]);
    expect(buildReferenceTrendNarrative({ Community: [{ cycle_date: "2026-01", score: 60 }] }))
      .toEqual(["Not enough scored cycles yet on any lens to describe a trend."]);
  });
});
