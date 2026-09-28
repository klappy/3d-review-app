// C01 (captain 2026-09-28): "Other (please describe)" carries a short free-text description, stored additively in
// answers_json under "_other" — no migration. Legacy / Lovable items (code "other") count the same as flag "other".
import { describe, expect, it } from "vitest";
import { validateAnswers } from "../src/handlers/response";
import { isOtherOption, OTHER_TEXT_KEY, renderItems, type TemplateItem } from "../src/handlers/common";
import legacyItems from "../src/legacy/mid-level-v1.items.json";

const single: TemplateItem = { id: "CHCP-Q1", group: "g", type: "single", text: "Which approach?", options: [
  { code: "a", text: "Approach A" }, { code: "other", text: "Other (please describe)", flag: "other" }] } as TemplateItem;
const multi: TemplateItem = { id: "M1", group: "g", type: "multi", text: "Pick", options: [
  { code: "x", text: "X" }, { code: "o9", text: "Something else", flag: "other" }] } as TemplateItem;
const items = [single, multi];

describe("C01 other text", () => {
  it("keeps the description when Other is chosen (single and multi)", () => {
    const out = validateAnswers(items, { "CHCP-Q1": "other", M1: ["x", "o9"], [OTHER_TEXT_KEY]: { "CHCP-Q1": "  Oral drafting first  ", M1: "Church elders" } });
    expect(out["CHCP-Q1"]).toBe("other");
    expect(out[OTHER_TEXT_KEY]).toEqual({ "CHCP-Q1": "Oral drafting first", M1: "Church elders" });
  });
  it("drops the description when Other is not the chosen answer, and omits the key when empty", () => {
    const out = validateAnswers(items, { "CHCP-Q1": "a", M1: ["x"], [OTHER_TEXT_KEY]: { "CHCP-Q1": "stale text", M1: "   " } });
    expect(out).toEqual({ "CHCP-Q1": "a", M1: ["x"] });
  });
  it("answers without descriptions keep the old shape exactly", () => {
    expect(validateAnswers(items, { "CHCP-Q1": "a", M1: ["x"] })).toEqual({ "CHCP-Q1": "a", M1: ["x"] });
  });
  it("rejects bad descriptions and still rejects unknown answer keys", () => {
    expect(() => validateAnswers(items, { "CHCP-Q1": "other", M1: ["x"], [OTHER_TEXT_KEY]: "text" })).toThrow(/other text must be an object/);
    expect(() => validateAnswers(items, { "CHCP-Q1": "other", M1: ["x"], [OTHER_TEXT_KEY]: { NOPE: "t" } })).toThrow(/unknown other-text item/);
    expect(() => validateAnswers(items, { "CHCP-Q1": "other", M1: ["x"], [OTHER_TEXT_KEY]: { "CHCP-Q1": "x".repeat(501) } })).toThrow(/invalid other text/);
    expect(() => validateAnswers(items, { "CHCP-Q1": "a", M1: ["x"], extra: 1 })).toThrow(/unknown answer item extra/);
  });
  it("marks Other options for the participant form, including legacy / Lovable items (code \"other\")", () => {
    const rendered = renderItems(items, "en") as any[];
    expect(rendered[0].options.map((o: any) => !!o.other)).toEqual([false, true]);
    expect(rendered[1].options.map((o: any) => !!o.other)).toEqual([false, true]);
    const legacy = renderItems(legacyItems as unknown as TemplateItem[], "en") as any[];
    const marked = legacy.filter(i => i.options?.some((o: any) => o.other));
    expect(marked.length).toBeGreaterThan(0);
    for (const i of marked) expect(i.options.find((o: any) => o.other).code).toBe("other");
    expect(isOtherOption({ code: "o1", flag: null })).toBe(false);
  });
});
