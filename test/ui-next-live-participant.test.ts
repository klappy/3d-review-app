// UI Next (v4) live participant store (status: provisional): the journey's form -> the lane's survey model, required-answer check,
// phase -> screen mapping. Cookbook work/active/2026-10-21-ui-next-demo-wiring/HANDOFF-wiring-2315.md step 5.
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { model, screenFor, answer, other, snapshot } from "../ui-next/src/app/participant.js";
// @ts-expect-error -- plain .js module, no type declarations
import { choices, question, review } from "../ui-next/src/screens/participant/data.js";

const form = { template: { id: "tpl_written", version: 2, perspective: "Community" }, language: "Hindi", format: "written", assessment: "Mark 1–4 draft", passages: [{ kind: "reference", reference: "Mark 1–4" }],
  items: [{ id: "Q1", type: "single", required: true, text: "Easy?", options: [{ code: "a", text: "Yes" }, { code: "b", label: "No" }] }, { id: "Q2", type: "multi", required: false, text: "Why?", options: [{ code: "x", text: "Words" }, { code: "none", text: "No problems", exclusive: true }] }, { id: "Q3", type: "text", required: true, text: "More?" }] };

describe("model(state)", () => {
  it("maps the live form to the survey model the screens draw, without the fixture's I-don't-know row", () => {
    const d = model({ phase: "form", form, notice: "" });
    expect(d.live).toBe(true);
    expect(d.survey.perspective).toBe("Community");
    expect(d.form.items[0].options[1].text).toBe("No");
    expect(choices(d.form.items[0], d).map((o: { code: string }) => o.code)).toEqual(["a", "b"]);
    expect(choices(d.form.items[1], d).some((o: { exclusive: boolean }) => o.exclusive)).toBe(true);
    expect(question(2, d).of).toMatch(/2 of 3/);
    expect(review(true, d).rows).toHaveLength(3);
  });
  it("tolerates a receipt or an unavailable state that arrived before any form", () => {
    expect(model({ phase: "receipt", receipt: { response_id: "resp_1" } }).receipt).toBe("resp_1");
    expect(model({ phase: "unavailable", rateLimited: true, retryAfter: 42 }).rateLimited).toBe(true);
    expect(model(null)).toBeNull();
  });
});

describe("screenFor(state)", () => {
  it("lands each phase on its screen; a server-asked wait lands on the one problem board (busy state retired, cookbook PR 198)", () => {
    expect(screenFor({ phase: "form" })).toEqual(["p-welcome", {}]);
    expect(screenFor({ phase: "review" })).toEqual(["p-review", {}]);
    expect(screenFor({ phase: "receipt" })).toEqual(["p-receipt", {}]);
    expect(screenFor({ phase: "unavailable" })).toEqual(["p-problem", {}]);
    expect(screenFor({ phase: "unavailable", rateLimited: true })).toEqual(["p-problem", {}]);
    expect(screenFor({ phase: "opening" })).toEqual([null, {}]);
    expect(screenFor(null)).toEqual(["p-code", {}]);
  });
});

describe("answers the live journey keeps (Codex P1/P2 on PR 575)", () => {
  it("a scale item is a question the screen can answer (not an empty choice list), and an Other description rides under _other for that item only", () => {
    const d = model({ phase: "form", form: { ...form, items: [...form.items, { id: "S1", type: "scale", text: "How clear?", scale: { min: 1, max: 5 } }, { id: "O1", type: "single", text: "Why?", options: [{ code: "a", text: "A" }, { code: "other", text: "Other (please describe)" }] }] }, notice: "" });
    const sc = question(4, d); expect(sc.item.type).toBe("scale"); expect(sc.item.scale).toEqual({ min: 1, max: 5 }); expect(sc.options).toEqual([]);
    answer("S1", 4); answer("O1", "other"); other("O1", "because");
    const snap = snapshot(); expect(snap.draft.S1).toBe(4); expect(snap.draft._other).toEqual({ O1: "because" });
    other("O1", "   "); expect(snapshot().draft._other).toEqual({});
  });
});
