// UI Next (v4) live participant store (status: provisional): the journey's form -> the lane's survey model, required-answer check,
// phase -> screen mapping. Cookbook work/active/2026-10-21-ui-next-demo-wiring/HANDOFF-wiring-2315.md step 5.
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { model, screenFor, answer, other, snapshot, setLanguage, loadTranslations } from "../ui-next/src/app/participant.js";
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

describe("participant language (ui/participate/i18n.js reused)", () => {
  it("a chosen offered language translates questions, options and UI words through /v2/translate (ids, codes and answers unchanged); English restores the served form", async () => {
    const served = { ...form, template: { ...form.template, id: "tpl_x" }, languages: [{ code: "hi", name: "Hindi", endonym: "हिन्दी" }] };
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init }); const body = JSON.parse(String(init.body)); const translated: Record<string, string> = {};
      for (const k of Object.keys(body.sourceTexts)) translated[k] = `HI:${body.sourceTexts[k]}`;
      return new Response(JSON.stringify({ translated }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const en = model({ phase: "form", form: served, notice: "" })!;
      expect(en.lang).toBe("en"); expect(en.languages.map((l: { code: string }) => l.code)).toEqual(["hi"]); expect(en.form.items[0].text).toBe(form.items[0].text);
      setLanguage("hi"); await loadTranslations(served);
      const hi = model({ phase: "form", form: served, notice: "" })!;
      expect(hi.lang).toBe("hi"); expect(hi.dir).toBe("ltr");
      expect(hi.form.items[0].text).toBe(`HI:${form.items[0].text}`); expect(hi.form.items[0].id).toBe(form.items[0].id);
      expect(hi.form.items[0].options[0].code).toBe(form.items[0].options[0].code); expect(hi.form.items[0].options[0].text).toMatch(/^HI:/);
      expect(hi.t("next")).toBe("HI:Next");
      expect(calls.length).toBeGreaterThan(0); expect(calls.every((c) => c.url === "/v2/translate" && c.init.credentials === "omit")).toBe(true);
      setLanguage("en"); await loadTranslations(served);
      expect(model({ phase: "form", form: served, notice: "" })!.form.items[0].text).toBe(form.items[0].text);
    } finally { globalThis.fetch = realFetch; setLanguage("en"); }
  });
  it("a failed /v2/translate ends as a failure, never as a 'Translating' line that a late sibling progress callback restores (root RESULTS 2026-10-22: 97 of 97 forever on real 502s)", async () => {
    const served = { ...form, template: { ...form.template, id: "tpl_y" }, languages: [{ code: "es", name: "Spanish", endonym: "Español" }] };
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("bad gateway", { status: 502 })) as typeof fetch;
    try {
      setLanguage("es"); await loadTranslations(served);
      await new Promise((r) => setTimeout(r, 20)); // let any straggling callbacks fire
      const m = model({ phase: "form", form: served, notice: "" })!;
      expect(m.translating).toBeNull(); expect(m.translateFailed).toBeTruthy(); expect(m.form.items[0].text).toBe(form.items[0].text);
    } finally { globalThis.fetch = realFetch; setLanguage("en"); }
  });
});
