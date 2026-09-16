import { describe, expect, it } from "vitest";
import { scoreSourceItem, type SourceItem } from "../src/source-item-score";

// Hand-computed examples from pinned rubric f042cde; no aggregate policy.
const capability: SourceItem = { id: "TR-Q14", group: "Consistency", text: "Tools", type: "multi",
  source_type: "multi-capability-scored", options: [
    { code: "paratext", text: "Paratext", weight: 3 },
    { code: "shared-glossary", text: "Shared glossary", weight: 2 },
    { code: "printed-list", text: "Printed reference list", weight: 1 },
    { code: "no-tools", text: "No tools", weight: 0, flag: "exclusion" },
    { code: "other", text: "Other", weight: 1, flag: "other" },
  ] };

describe("pinned source per-item projection, never public aggregates", () => {
  it("keeps capability Other null and out of both numerator and denominator", () => {
    expect(scoreSourceItem(capability, ["other"])).toMatchObject({ status: "missing", score: null });
    expect(scoreSourceItem(capability, ["paratext"]).score).toBe(50); // 3 / (3 + 2 + 1)
    expect(scoreSourceItem(capability, ["paratext", "other"]).score).toBe(50);
    expect(scoreSourceItem(capability, ["no-tools"])).toMatchObject({ status: "scored", score: 0 });
    expect(() => scoreSourceItem(capability, ["no-tools", "paratext"])).toThrow(/mixed exclusion/);
  });
  it("keeps ML-Q10 multi-capability standalone, with zero distinct from missing", () => {
    const indicator: SourceItem = { id: "ML-Q10", group: "Understanding the Source", text: "Source", type: "multi",
      source_type: "multi-capability-scored", standalone_indicator: true, options: [
        { code: "consult-trained", text: "Consult trained", weight: 4 },
        { code: "research-resources", text: "Research", weight: 3 },
        { code: "team-discuss", text: "Discuss", weight: 2 },
        { code: "follow-others", text: "Other translations", weight: 1 },
        { code: "leave-it", text: "Leave it", weight: 0 },
        { code: "other", text: "Other", weight: 1, flag: "other" },
      ] };
    expect(scoreSourceItem(indicator, ["consult-trained"])).toMatchObject({ status: "scored", score: 40, standalone_indicator: true });
    expect(scoreSourceItem(indicator, ["leave-it"])).toMatchObject({ status: "scored", score: 0, standalone_indicator: true });
    expect(scoreSourceItem(indicator, ["other"])).toMatchObject({ status: "missing", score: null });
  });
  it("reproduces pinned executable multi-problem Other behavior, without ratifying the draft", () => {
    const problem: SourceItem = { id: "CW-Q2", group: "Challenges", text: "Problems", type: "multi",
      source_type: "multi-problem-scored", options: [
        { code: "unfamiliar-words", text: "Unfamiliar", flag: "problem" },
        { code: "long-sentences", text: "Long", flag: "problem" },
        { code: "wrong-dialect", text: "Dialect", flag: "problem" },
        { code: "unnatural-speech", text: "Speech", flag: "problem" },
        { code: "other", text: "Other", flag: "other-problem" },
      ] };
    expect(scoreSourceItem(problem, ["other"])).toMatchObject({ status: "scored", score: 75 });
    expect(scoreSourceItem(problem, ["unfamiliar-words", "other"])).toMatchObject({ status: "scored", score: 50 });
    expect(scoreSourceItem(problem, null)).toMatchObject({ status: "missing", score: null });
  });
});
