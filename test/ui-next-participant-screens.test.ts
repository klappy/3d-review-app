// @vitest-environment jsdom
// UI Next (v4) participant lane screens + their /next/ routes (status: provisional).
// Screens fanout, participant lane (3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md). Boards: cookbook
// design/2026-10-15-glass-redesign/canvas PWelcome, PCode, PCodeError, PPassage, PAbout, PQuestion, PReview, PReceipt, PProblem, PProblemBusy (390x844).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { DATA, welcome, passage, about, question, review, problem, choices, go } from "../ui-next/src/screens/participant/data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { UI_EN, SURVEYOR_EN } from "../ui/participate/i18n.js";
// @ts-expect-error -- plain .js module, no type declarations
import { lintText } from "../scripts/ui-next-lint.mjs";
import PWelcome from "../ui-next/src/screens/participant/PWelcome.svelte";
import PCode from "../ui-next/src/screens/participant/PCode.svelte";
import PPassage from "../ui-next/src/screens/participant/PPassage.svelte";
import PAbout from "../ui-next/src/screens/participant/PAbout.svelte";
import PQuestion from "../ui-next/src/screens/participant/PQuestion.svelte";
import PReview from "../ui-next/src/screens/participant/PReview.svelte";
import PReceipt from "../ui-next/src/screens/participant/PReceipt.svelte";
import PProblem from "../ui-next/src/screens/participant/PProblem.svelte";

type P = Record<string, unknown>;
type C = typeof PWelcome;
const mount = (Comp: C, props: P) => render(Comp, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

// [board, screen name, ?state=, component, key copy rows (board text, word for word), primary label (null = none drawn)]
const BOARDS: [string, string, string | undefined, C, string[], string | null][] = [
  ["PWelcome", "p-welcome", undefined, PWelcome, ["Hindi · Mark 1–4, printed draft booklet", "We'd like your perspective", "There are no wrong answers, and \"I don't know\" is fine.", "Your perspective: Community", "13 questions · about 5 minutes", "Your answers are confidential"], "Start"],
  ["PCode", "p-code", undefined, PCode, ["Have a survey code?", "It is printed on your paper survey, or the person who invited you can read it to you.", "Or point your camera at the QR code on the paper or the screen."], "Open my survey"],
  ["PCodeError", "p-code", "error", PCode, ["Have a survey code?", "We don't recognise that code. Check each letter and number against your paper, or ask the person who invited you to read it again."], "Try again"],
  ["PPassage", "p-passage", undefined, PPassage, ["Before you answer", "Please read Mark 1–4 first", "Take your time. The questions are about this passage.", "Page 1 of 6", "Listen", "Open as PDF"], "I've read it"],
  ["PAbout", "p-about", undefined, PAbout, ["About you · 2 questions, both optional", "A little about you", "Nothing here names you.", "Your age", "Under 18", "18–30", "31–50", "Over 50", "Prefer not to say"], "Next"],
  ["PQuestion", "p-question", undefined, PQuestion, ["Question 3 of 13", "Community", "How does this translation sound to us?", "It sounds like our language — natural and beautiful", "Some parts sound good, some parts don't sound that good", "It does not sound very good. This is not how our language sounds.", "This is not our dialect", "I don't know"], "Next"],
  ["PReview", "p-review", undefined, PReview, ["Check your answers", "You can change any answer before you send.", "Most of it is easy, but some parts are hard", "Some words are unfamiliar or strange", "We use it occasionally", "Show all 13 answers"], "Send my answers"],
  ["PReceipt", "p-receipt", undefined, PReceipt, ["Thank you", "Your answers were received. Your perspective helps the translation grow.", "Receipt", "R-2048-731", "Keep this in case the person who invited you asks for it.", "You can close this page.", "Interview another person"], null],
  ["PProblem", "p-problem", undefined, PProblem, ["We couldn't confirm your answers were received", "sending twice won't count twice.", "Other things that can happen", "This survey has closed", "Collection ended on 31 Oct.", "This link doesn't work", "You already answered", "your receipt was R-2048-731"], "Try sending again"],
  ["PProblemBusy", "p-problem", "busy", PProblem, ["A lot of people are opening this at once", "If you are in a room with many people on the same Wi-Fi, this is normal.", "Retrying in 12 s · attempt 2 of 5", "If it keeps happening", "Switch to mobile data", "Ask for a paper copy", "Show this screen to the facilitator", "RL_HTTP_ANON · 429 · 22:41:07"], "Try now"],
];

describe("participant screens render as the boards draw them", () => {
  for (const [board, , state, Comp, rows, primary] of BOARDS) {
    for (const [mode, props] of [["phone", { phone: true }], ["desktop", {}], ["phone dark", { phone: true, theme: "dark" }]] as [string, P][]) {
      it(`${board} (${mode}): renders, key copy, at most one .btn-primary, participant header`, () => {
        const a = mount(Comp, { ...props, state });
        expect(a).not.toBeNull();
        expect(a.getAttribute("data-theme")).toBe(props.theme ?? "light");
        for (const r of rows) expect(text(a)).toContain(r);
        const prim = a.querySelectorAll(".btn-primary");
        expect(prim.length).toBeLessThanOrEqual(1);
        if (primary) expect(text(prim[0])).toBe(primary);
        else expect(prim.length).toBe(0);
        expect(a.querySelectorAll("h1").length).toBe(1);
        const h = a.querySelector("header.phone-top[data-shell=participant]") as HTMLElement;
        expect(h).not.toBeNull();
        expect(h.querySelector("a.brand")).toBeNull(); // brand is plain text for a participant (DS Phone chrome)
        expect(h.querySelector("[aria-label='Language: English']")).not.toBeNull();
        expect(h.querySelector(".av, .menu-btn")).toBeNull();
        if (props.phone) {
          expect(a.getAttribute("data-w")).toBe("phone");
          const bar = a.querySelector(".phone-bar") as HTMLElement;
          expect(bar).not.toBeNull();
          if (primary) expect(bar.querySelector(".btn-primary")).not.toBeNull(); // the phone's primary lives in the bar
          expect(a.querySelector("main")!.querySelector(".btn-primary")).toBeNull(); // Back/Next never above the question
        } else {
          expect(a.querySelector(".phone-bar")).toBeNull();
          expect(a.querySelector(".l-page[data-w=read]")).not.toBeNull();
        }
      });
    }
  }
});

describe("participant screens: fields, states and data wiring", () => {
  it("PCode: label/for, no error until submitted; ?state=error marks the field invalid with a colour-free alert in describedby", () => {
    const ok = mount(PCode, { phone: true });
    const inp = ok.querySelector("input.in") as HTMLInputElement;
    expect(ok.querySelector(`label.lbl[for='${inp.id}']`)).not.toBeNull();
    expect(inp.getAttribute("aria-invalid")).toBeNull();
    expect(inp.placeholder).toBe("K7Q 4F2");
    expect(ok.querySelector("[role=alert]")).toBeNull();
    const bad = mount(PCode, { phone: true, state: "error" });
    const binp = bad.querySelector("input.in") as HTMLInputElement;
    expect(binp.getAttribute("aria-invalid")).toBe("true");
    expect(binp.value).toBe("K7Q 4F3");
    const err = bad.querySelector(`#${binp.getAttribute("aria-describedby")}`) as HTMLElement;
    expect(err.matches("p.field-error[role=alert]")).toBe(true);
    expect(err.querySelector("svg[aria-hidden=true]")).not.toBeNull();
  });
  it("unknown ?state= values throw (PCode error only; PProblem busy only)", () => {
    expect(() => render(PCode, { props: { state: "busy" } })).toThrow(/unknown state/);
    expect(() => render(PProblem, { props: { state: "error" } })).toThrow(/unknown state/);
  });
  it("PQuestion: one fieldset, legend h1 = the item text, radio rows from the app instrument + I don't know last, current answer checked", () => {
    const a = mount(PQuestion, { phone: true });
    const q = question();
    expect(q.item.id).toBe("CW-Q3");
    const fs = a.querySelectorAll("fieldset.opts");
    expect(fs.length).toBe(1);
    expect(text(fs[0].querySelector("legend h1")!)).toBe(q.item.text);
    const rows = [...a.querySelectorAll("label.row-opt")];
    expect(rows.map(text)).toEqual([...q.item.options.map((o: { text: string }) => o.text), "I don't know"]);
    expect(rows.every((r) => r.querySelector("input.rd[type=radio]"))).toBe(true);
    expect((a.querySelector("input:checked") as HTMLInputElement).value).toBe("mixed");
    const bar = a.querySelector("[role=progressbar]") as Element;
    expect([bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuemax")]).toEqual(["3", "13"]);
    expect(bar.querySelector("rect")!.getAttribute("width")).toBe(`${(100 * 3) / 13}%`);
  });
  it("PAbout: shown fields come from the app's aboutFields gate; 31–50 checked", () => {
    const a = mount(PAbout, { phone: true });
    expect(a.querySelector("legend.lbl")!.textContent).toBe("Your age");
    expect((a.querySelector("input:checked") as HTMLInputElement).value).toBe("31_50");
    expect(about({ ...DATA, form: { ...DATA.form, demographics_enabled: false } }).fields).toEqual([]);
  });
  it("PReview: four rows, answers through ui/present.js reviewAnswer, Change links back to the question, rules between rows", () => {
    const a = mount(PReview, { phone: true });
    const r = review();
    expect(r.rows.map((x: { a: string }) => x.a)).toEqual(["Most of it is easy, but some parts are hard", "Some words are unfamiliar or strange", "Some parts sound good, some parts don't sound that good", "We use it occasionally"]);
    expect(a.querySelectorAll("hr.hr").length).toBe(4);
    const links = [...a.querySelectorAll("a.link")];
    expect(links.map(text)).toEqual(Array(4).fill(UI_EN.change));
    expect(links.every((l) => l.getAttribute("href") === "?screen=p-question&w=phone")).toBe(true);
  });
  it("PReceipt: the bar holds one secondary (SURVEYOR_EN.interviewAnother), no primary, as drawn", () => {
    const a = mount(PReceipt, { phone: true });
    const btns = [...a.querySelectorAll(".phone-bar .btn")];
    expect(btns.map(text)).toEqual([SURVEYOR_EN.interviewAnother]);
    expect(btns[0].classList.contains("btn-lg")).toBe(true);
    expect(btns[0].classList.contains("btn-block")).toBe(true);
  });
  it("PProblem: the fixture's error picks the board through ui/rate-limit.js; busy carries the retry line and the diagnostic", () => {
    expect(problem(undefined).busy).toBe(false);
    expect(problem(undefined, { ...DATA, problem: { ...DATA.problem, error: { status: 429, code: "RATE_LIMITED" } } }).busy).toBe(true);
    expect(problem("busy").retry).toBe("Retrying in 12 s · attempt 2 of 5");
    const a = mount(PProblem, { phone: true, state: "busy" });
    expect(a.querySelector("[role=progressbar]")).not.toBeNull();
    expect(a.querySelectorAll(".l-card[data-pad=hero]").length).toBe(2);
  });
  it("copy that exists in the app modules is read from them, not retyped", () => {
    expect(question().of).toBe(UI_EN.questionOf.replace("{n}", "3").replace("{total}", "13"));
    for (const k of ["start", "back", "next", "change"]) expect(typeof UI_EN[k]).toBe("string");
    expect(welcome().eyebrow).toBe("Hindi · Mark 1–4, printed draft booklet");
    expect(passage().title).toBe("Please read Mark 1–4 first");
    expect(choices(DATA.form.items[5])).toEqual([]); // a text item has no rows
  });
  it("the flow links keep the phone twin", () => {
    expect(go("p-passage", true)).toBe("?screen=p-passage&w=phone");
    expect(go("p-problem", false, "busy")).toBe("?screen=p-problem&state=busy");
    const a = mount(PWelcome, { phone: true });
    expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?screen=p-passage&w=phone");
  });
});

describe("participant screens are registered and routed under the flag", () => {
  const NAMES = ["p-welcome", "p-code", "p-passage", "p-about", "p-question", "p-review", "p-receipt", "p-problem"];
  it("the lane registers exactly its eight screens, all in the merged registry", () => {
    expect(Object.keys(LANES.participant).sort()).toEqual([...NAMES].sort());
    for (const n of NAMES) expect(REGISTRY[n]).toBe(LANES.participant[n]);
  });
  for (const [board, name, state] of BOARDS) {
    it(`${board}: /next/?ui_next=on&screen=${name}&w=phone${state ? `&state=${state}` : ""} routes to it`, () => {
      const q = new URLSearchParams(`?ui_next=on&screen=${name}&w=phone${state ? `&state=${state}` : ""}`);
      expect(route(q, store(), Object.keys(REGISTRY))).toEqual({ view: name, props: { phone: true, theme: "light", state } });
    });
  }
  it("lane files pass the ui-next lint (no inline style, no <style>, one primary)", () => {
    const dir = resolve(__dirname, "../ui-next/src/screens/participant");
    for (const f of readdirSync(dir)) expect([f, lintText(f, readFileSync(resolve(dir, f), "utf8"))]).toEqual([f, []]);
  });
});
