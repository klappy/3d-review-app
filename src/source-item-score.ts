/**
 * Internal per-item source projection only. This is not a report, lens mean,
 * agreement metric or D7-safe disclosure. It follows pinned rubric item rules
 * as Steve's executable scoring_rules.py in pinned f042cde. Narrative tensions
 * remain recorded separately; this does not ratify a new policy or disclose.
 */
import type { TemplateItem } from "./handlers/common";

type SourceOption = NonNullable<TemplateItem["options"]>[number] & { source_score?: number | null };
export type SourceItem = Omit<TemplateItem, "options"> & { options?: SourceOption[] };
export type ItemScore = {
  item_id: string;
  status: "scored" | "missing" | "categorical" | "held";
  score: number | null;
  standalone_indicator: boolean;
  rule: string;
};

function result(item: SourceItem, status: ItemScore["status"], score: number | null, rule: string): ItemScore {
  return { item_id: item.id, status, score, standalone_indicator: !!item.standalone_indicator, rule };
}

/** Never call this on an unpinned template or return its result through a route. */
export function scoreSourceItem(item: SourceItem, answer: unknown): ItemScore {
  if (answer === null || answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length))
    return result(item, "missing", null, "blank-is-unknown");
  if (item.source_type === "ordinal-scored") {
    const option = item.options?.find(o => o.code === answer);
    if (!option) throw new Error(`unrecognized option for ${item.id}`);
    if (option.flag === "missing" || option.flag === "other" || option.source_score == null)
      return result(item, "missing", null, "source-missing-option");
    return result(item, "scored", option.source_score, "pinned-ordinal-option");
  }
  if (item.source_type === "multi-capability-scored") {
    if (!Array.isArray(answer) || !answer.length || new Set(answer).size !== answer.length)
      throw new Error(`invalid multi answer for ${item.id}`);
    const options = item.options ?? [];
    if (!answer.every(code => typeof code === "string" && options.some(o => o.code === code)))
      throw new Error(`unrecognized option for ${item.id}`);
    const selected = options.filter(o => answer.includes(o.code));
    const exclusion = selected.some(o => o.flag === "exclusion");
    if (exclusion && selected.length > 1) throw new Error(`mixed exclusion for ${item.id}`);
    if (exclusion) return result(item, "scored", 0, "pinned-capability-exclusion");
    // Source narrative FIX-02 supersedes the CSV's nonzero Other weight.
    const actual = selected.filter(o => o.flag !== "other");
    if (!actual.length) return result(item, "missing", null, "capability-other-only");
    const possible = options.filter(o => o.flag !== "other" && o.flag !== "exclusion");
    const denominator = possible.reduce((n, o) => n + (o.weight ?? 0), 0);
    if (denominator <= 0) return result(item, "held", null, "invalid-source-denominator");
    const numerator = actual.reduce((n, o) => n + (o.weight ?? 0), 0);
    return result(item, "scored", Math.min(100, numerator / denominator * 100), "pinned-capability-weights-other-excluded");
  }
  if (item.source_type === "multi-problem-scored") {
    if (!Array.isArray(answer) || !answer.length || new Set(answer).size !== answer.length)
      throw new Error(`invalid multi answer for ${item.id}`);
    const options = item.options ?? [];
    if (!answer.every(code => typeof code === "string" && options.some(o => o.code === code)))
      throw new Error(`unrecognized option for ${item.id}`);
    const denominator = options.filter(o => o.flag === "problem").length;
    if (!denominator) return result(item, "held", null, "invalid-source-denominator");
    const selected = options.filter(o => answer.includes(o.code));
    const numerator = selected.filter(o => o.flag === "problem" || o.flag === "other-problem").length;
    // Exact pinned executable baseline: Other counts in numerator, not
    // denominator. The draft's qualitative-review tension is not resolved.
    return result(item, "scored", Math.max(0, 100 - numerator / denominator * 100),
      "pinned-multi-problem-reference");
  }
  if (item.source_type === "descriptive")
    return result(item, "categorical", null, "source-descriptive-not-scored");
  return result(item, "categorical", null, "source-open-text-not-scored");
}
