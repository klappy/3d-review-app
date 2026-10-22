// @vitest-environment jsdom
// UI Next (v4) participant lane screens + their /next/ routes (status: provisional).
// Screens fanout, participant lane (3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md). Boards: cookbook
// design/2026-10-15-glass-redesign/canvas PWelcome, PCode, PCodeError, PPassage, PAbout, PQuestion, PReview, PReceipt, PProblem (390x844; PProblemBusy retired, cookbook PR 198).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent } from "@testing-library/svelte";
import { flushSync } from "svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { DATA, welcome, passage, about, aboutLine, question, qParam, review, problem, choices, pick, hasAbout, skipAbout, pickState, surveyLens, lensOf, exclusionNote } from "../ui-next/src/screens/participant/data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { itemError } from "../ui/participant-view.js";
// @ts-expect-error -- plain .js module, no type declarations
import { UI_EN, SURVEYOR_EN } from "../ui/participate/i18n.js";
// @ts-expect-error -- plain .js module, no type declarations
import { lintText } from "../scripts/ui-next-lint.mjs";
import { renderItems, type TemplateItem } from "../src/handlers/common";
import PWelcome from "../ui-next/src/screens/participant/PWelcome.svelte";
import PCode from "../ui-next/src/screens/participant/PCode.svelte";
import PPassage from "../ui-next/src/screens/participant/PPassage.svelte";
import PAbout from "../ui-next/src/screens/participant/PAbout.svelte";
import PQuestion from "../ui-next/src/screens/participant/PQuestion.svelte";
import PReview from "../ui-next/src/screens/participant/PReview.svelte";
import PReceipt from "../ui-next/src/screens/participant/PReceipt.svelte";
import PProblem from "../ui-next/src/screens/participant/PProblem.svelte";
import Chip from "../ui-next/src/screens/participant/Chip.svelte";
import ProgressBar from "../ui-next/src/screens/participant/ProgressBar.svelte";
import ParticipantActions from "../ui-next/src/screens/participant/ParticipantActions.svelte";

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
  ["PAbout", "p-about", undefined, PAbout, ["About you · 1 question, optional", "A little about you", "Nothing here names you.", "Your age", "Under 18", "18–30", "31–50", "Over 50", "Prefer not to say"], "Next"],
  ["PQuestion", "p-question", undefined, PQuestion, ["Question 3 of 13", "Community", "How does this translation sound to us?", "It sounds like our language — natural and beautiful", "Some parts sound good, some parts don't sound that good", "It does not sound very good. This is not how our language sounds.", "This is not our dialect", "I don't know"], "Next"],
  ["PReview", "p-review", undefined, PReview, ["Check your answers", "You can change any answer before you send.", "Most of it is easy, but some parts are hard", "Some words are unfamiliar or strange", "We use it occasionally", "Show all 13 answers"], "Send my answers"],
  ["PReceipt", "p-receipt", undefined, PReceipt, ["Thank you", "Your answers were received. Your perspective helps the translation grow.", "Receipt", "R-2048-731", "Keep this in case the person who invited you asks for it.", "You can close this page.", "Interview another person"], null],
  ["PProblem", "p-problem", undefined, PProblem, ["We couldn't confirm your answers were received", "sending twice won't count twice.", "Other things that can happen", "This survey has closed", "Collection ended on 31 Oct.", "This link doesn't work", "You already answered", "your receipt was R-2048-731"], "Try sending again"],
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
  it("an unknown ?state= renders the default state, never throws (PCode, PProblem, PReview), one h1 each", () => {
    for (const [Comp, bogus] of [[PCode, "busy"], [PProblem, "error"], [PReview, "bogus"], [PCode, ""]] as [C, string][]) {
      const a = mount(Comp, { phone: true, state: bogus });
      const d = mount(Comp, { phone: true });
      expect(text(a)).toBe(text(d));
      expect(a.querySelectorAll("h1").length).toBe(1);
    }
    expect(pickState("error", ["error"])).toBe("error");
    expect(pickState("nope", ["error"])).toBeUndefined();
    expect(problem("nope").busy).toBe(false);
  });
  it("PQuestion: one fieldset, legend h1 = the item text, radio rows from the app instrument + I don't know last, current answer checked", () => {
    const a = mount(PQuestion, { phone: true });
    const q = question();
    expect(q.item.id).toBe("CW-Q3");
    const fs = a.querySelectorAll("fieldset.opts");
    expect(fs.length).toBe(1);
    expect(text(fs[0].querySelector("legend h1")!)).toBe(q.item.text);
    const rows = [...a.querySelectorAll("label.row-opt.answer")];
    expect(rows.map(text)).toEqual([...q.item.options.map((o: { text: string }) => o.text), "I don't know"]);
    expect(rows.every((r) => r.querySelector("input.rd[type=radio]"))).toBe(true);
    expect((a.querySelector("input:checked") as HTMLInputElement).value).toBe("mixed");
    const bar = a.querySelector("[role=progressbar]") as Element;
    expect([bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuemax")]).toEqual(["3", "13"]);
    expect(bar.querySelector("rect")!.getAttribute("width")).toBe(`${(100 * 3) / 13}%`);
    const bar2 = a.querySelector(".phone-bar")!;
    expect([...bar2.querySelectorAll("a.btn")].map((l) => l.getAttribute("href"))).toEqual(["?ui_next=on&screen=p-question&q=2", "?ui_next=on&screen=p-question&q=4"]);
  });
  it("PQuestion: ?q=<n> picks the question; text items (3 of 13) render the question h1 labelling a textarea.in; Back/Next walk the flow", () => {
    expect(DATA.form.items.filter((i: { type: string }) => i.type === "text").length).toBe(3);
    for (const [i, it] of DATA.form.items.entries()) {
      const a = mount(PQuestion, { phone: true, q: String(i + 1) });
      expect(a.querySelectorAll("h1").length).toBe(1);
      expect(text(a.querySelector("h1")!)).toBe(it.text);
      expect(text(a)).toContain(`Question ${i + 1} of 13`);
      if (it.type === "text") {
        const ta = a.querySelector("textarea.in") as HTMLTextAreaElement;
        expect(ta).not.toBeNull();
        expect(ta.getAttribute("aria-labelledby")).toBe(a.querySelector("h1")!.id);
        expect(a.querySelector("fieldset")).toBeNull();
      } else {
        expect(a.querySelectorAll("label.row-opt.answer").length).toBe(it.options.length + 1);
        expect(a.querySelector("textarea")).toBeNull();
      }
    }
    const first = [...mount(PQuestion, { phone: true, q: "1" }).querySelectorAll(".phone-bar a.btn")].map((l) => l.getAttribute("href"));
    expect(first).toEqual(["?ui_next=on&screen=p-about", "?ui_next=on&screen=p-question&q=2"]);
    const last = [...mount(PQuestion, { phone: true, q: "13" }).querySelectorAll(".phone-bar a.btn")].map((l) => l.getAttribute("href"));
    expect(last).toEqual(["?ui_next=on&screen=p-question&q=12", "?ui_next=on&screen=p-review"]);
    for (const bad of ["0", "14", "x", "2.5", ""]) expect(question(bad).n).toBe(3);
    expect(qParam("?ui_next=on&screen=p-question&q=7")).toBe("7");
    expect(qParam("")).toBeUndefined();
  });
  it("PAbout: shown fields come from the app's aboutFields gate; 31–50 checked", () => {
    const a = mount(PAbout, { phone: true });
    expect(a.querySelector("legend.lbl")!.textContent).toBe("Your age");
    expect((a.querySelector("input:checked") as HTMLInputElement).value).toBe("31_50");
    expect(about({ ...DATA, form: { ...DATA.form, demographics_enabled: false } }).fields).toEqual([]);
    expect(a.querySelectorAll("label.row-opt.answer").length).toBe(5);
  });
  it("PAbout: the eyebrow counts the fields drawn and says 1 question in the singular", () => {
    expect(about().eyebrow).toBe("About you · 1 question, optional");
    expect([aboutLine(1), aboutLine(2), aboutLine(3)]).toEqual(["About you · 1 question, optional", "About you · 2 questions, both optional", "About you · 3 questions, all optional"]);
    const f = DATA.form.context_fields[0];
    const two = { ...DATA, form: { ...DATA.form, context_fields: [f, { ...f, key: "gender", label: "Gender" }] } };
    expect(about(two).eyebrow).toBe("About you · 2 questions, both optional");
  });
  it("PReview: four rows, answers through ui/present.js reviewAnswer, Change links back to the question, rules between rows", () => {
    const a = mount(PReview, { phone: true });
    const r = review();
    expect(r.rows.map((x: { a: string }) => x.a)).toEqual(["Most of it is easy, but some parts are hard", "Some words are unfamiliar or strange", "Some parts sound good, some parts don't sound that good", "We use it occasionally"]);
    expect(a.querySelectorAll("hr.hr").length).toBe(4);
    const links = [...a.querySelectorAll("a.link")];
    expect(links.map(text)).toEqual(Array(4).fill(UI_EN.change));
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["?ui_next=on&screen=p-question&q=1", "?ui_next=on&screen=p-question&q=2", "?ui_next=on&screen=p-question&q=3", "?ui_next=on&screen=p-question&q=7"]);
    const all = a.querySelector("a.btn.btn-quiet[href*='state=all']") as HTMLElement;
    expect(text(all)).toBe("Show all 13 answers");
    expect(all.getAttribute("href")).toBe("?ui_next=on&screen=p-review&state=all");
  });
  it("PReview ?state=all: every answer (13 rows, skipped ones in the app's word), each Change link to its own question, no Show all", () => {
    const a = mount(PReview, { phone: true, state: "all" });
    expect(a.querySelectorAll("hr.hr").length).toBe(13);
    const links = [...a.querySelectorAll("a.link")].map((l) => l.getAttribute("href"));
    expect(links).toEqual(DATA.form.items.map((_: unknown, i: number) => `?ui_next=on&screen=p-question&q=${i + 1}`));
    expect(text(a)).toContain("Skipped");
    expect(text(a)).not.toContain("Show all");
    expect(a.querySelectorAll("h1").length).toBe(1);
  });
  it("PReceipt: the bar holds one secondary (SURVEYOR_EN.interviewAnother), no primary, as drawn", () => {
    const a = mount(PReceipt, { phone: true });
    const btns = [...a.querySelectorAll(".phone-bar .btn")];
    expect(btns.map(text)).toEqual([SURVEYOR_EN.interviewAnother]);
    expect(btns[0].classList.contains("btn-lg")).toBe(true);
    expect(btns[0].classList.contains("btn-block")).toBe(true);
  });
  it("PProblem: one problem board; the former busy (rate-limited, automatic retry) state is retired (cookbook PR 198; RULING-2026-10-16-scrap-app-ratelimit)", () => {
    expect(problem(undefined).busy).toBe(false);
    expect(problem("busy").busy).toBe(false);
    expect(problem(undefined, { ...DATA, problem: { ...DATA.problem, error: { status: 429, code: "RATE_LIMITED" } } }).busy).toBe(false);
    const a = mount(PProblem, { phone: true, state: "busy" });
    expect(a.textContent).toContain("We couldn't confirm your answers were received");
    expect(a.textContent).not.toMatch(/A lot of people are opening this at once|Retrying in|RL_HTTP_ANON|mobile data|Wi-Fi/);
    expect(a.querySelectorAll(".btn-primary").length).toBe(1);
    // live: a server-asked wait (an upstream 429 passed through) is stated, never auto-retried
    const live = { ...DATA, live: true, notice: "", receipt: "", rateLimited: true, retryAfter: 30 };
    expect(problem(undefined, live)).toMatchObject({ busy: false, retryAfter: 30 });
  });
  it("chips: the PIN's .icn[data-size] rows; fact and list chips wear the survey's lens (Community), the problem head and the code page are neutral", () => {
    expect(surveyLens()).toBe("community");
    expect([lensOf("Translation Team"), lensOf("Church"), lensOf("Community"), lensOf("Other")]).toEqual(["team", "church", "community", null]);
    const w = mount(PWelcome, { phone: true });
    const facts = [...w.querySelectorAll("ul.facts > li.l-row > .icn")];
    expect(facts.map((c) => [c.getAttribute("data-size"), c.getAttribute("data-lens")])).toEqual(Array(3).fill(["36", "community"]));
    expect(w.querySelector(".icn-lens, .icn[data-lens=team]")).toBeNull();
    expect(w.querySelector("h1.display.display-hero")).not.toBeNull();
    expect(w.querySelector("p.lead-16")).not.toBeNull();
    const pr = mount(PProblem, { phone: true });
    const head = pr.querySelector(".icn[data-size='56']")!;
    expect([head.getAttribute("data-tone"), head.getAttribute("data-lens")]).toEqual(["neutral", null]);
    expect(pr.querySelectorAll(".icn[data-size='32'][data-lens=community]").length).toBe(3);
    expect(mount(PReceipt, { phone: true }).querySelector(".icn[data-size='64'][data-lens=community]")).not.toBeNull();
    expect([...w.querySelectorAll(".icn > svg")].map((s) => s.getAttribute("width"))).toEqual(["18", "18", "18"]); // the boards glyph: half the chip
    expect(mount(PCode, { phone: true }).querySelector(".icn[data-size='36'][data-tone=neutral]")).not.toBeNull();
  });
  it("adopted §9 participant rows: code input, receipt, passage frame, page line on its own line", () => {
    expect(mount(PCode, { phone: true }).querySelector("input.in.kbd.code")).not.toBeNull();
    expect(mount(PReceipt, { phone: true }).querySelector(".kbd.receipt")!.textContent).toBe("R-2048-731");
    const p = mount(PPassage, { phone: true });
    const frame = p.querySelector(".solid.passage")!;
    expect(frame.querySelector(":scope > .passage-text")).not.toBeNull();
    const foot = frame.querySelector(":scope > .passage-foot")!;
    expect(foot.children.length).toBe(1); // one stack: the page line, then the buttons row
    const st = foot.children[0];
    expect(text(st.children[0])).toBe("Page 1 of 6");
    expect([...st.children[1].querySelectorAll(".btn")].map(text)).toEqual(["Listen", "Open as PDF"]);
  });
  it("copy that exists in the app modules is read from them, not retyped", () => {
    expect(question().of).toBe(UI_EN.questionOf.replace("{n}", "3").replace("{total}", "13"));
    for (const k of ["start", "back", "next", "change"]) expect(typeof UI_EN[k]).toBe("string");
    expect(welcome().eyebrow).toBe("Hindi · Mark 1–4, printed draft booklet");
    expect(passage().title).toBe("Please read Mark 1–4 first");
    expect(choices(DATA.form.items[5])).toEqual([]); // a text item has no rows
  });
  it("the flow links go through the shared href(): ui_next, the phone twin and the theme carry", () => {
    const before = window.location.href;
    try {
      window.history.replaceState(null, "", "/next/?ui_next=on&screen=p-welcome&w=phone&theme=dark");
      const a = mount(PWelcome, { phone: true, theme: "dark" });
      expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=p-passage&w=phone&theme=dark");
      window.history.replaceState(null, "", "/next/?ui_next=on&screen=p-review&w=phone&theme=dark");
      const r = mount(PReview, { phone: true, theme: "dark" });
      expect(r.querySelector("a.link")!.getAttribute("href")).toBe("?ui_next=on&screen=p-question&w=phone&theme=dark&q=1");
    } finally {
      window.history.replaceState(null, "", before);
    }
    const dir = resolve(__dirname, "../ui-next/src/screens/participant");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".svelte"))) expect([f, /href=\{?["'`]\?/.test(readFileSync(resolve(dir, f), "utf8"))]).toEqual([f, false]); // no hand-written ?screen= links
  });
});

describe("participant screens: round 3 (validator N2-N4, N6; every screen's unknown ?state=)", () => {
  const item = (id: string) => DATA.form.items.find((i: { id: string }) => i.id === id);
  const withDemographics = <T,>(on: boolean, f: () => T): T => {
    const was = DATA.form.demographics_enabled;
    DATA.form.demographics_enabled = on;
    try { return f(); } finally { DATA.form.demographics_enabled = was; }
  };
  const barLinks = (a: Element) => [...a.querySelectorAll(".phone-bar a.btn")].map((l) => l.getAttribute("href"));

  it("N2: an \"I don't know\" answer reads \"I don't know\" on the review (single and multi), never \"Unrecognized option\"", () => {
    const answers = { ...DATA.answers, "CW-Q1": "dont-know", "CW-Q2": ["dont-know"] };
    const r = review(false, { ...DATA, answers });
    expect(r.rows.slice(0, 2).map((x: { a: string }) => x.a)).toEqual(["I don't know", "I don't know"]);
    expect(review(true, { ...DATA, answers }).rows.map((x: { a: string }) => x.a)).not.toContain("Unrecognized option");
  });
  it("N3: on a multi item \"I don't know\" is exclusive (pick), and the result passes the app's own itemError exclusion check", () => {
    const q2 = item("CW-Q2");
    expect(choices(q2).at(-1)).toEqual({ code: "dont-know", text: "I don't know", exclusive: true });
    expect(pick(q2, ["unfamiliar-words", "long-sentences"], "dont-know", true)).toEqual(["dont-know"]);
    expect(pick(q2, ["dont-know"], "long-sentences", true)).toEqual(["long-sentences"]);
    expect(pick(q2, ["unfamiliar-words"], "long-sentences", true)).toEqual(["unfamiliar-words", "long-sentences"]);
    expect(pick(q2, ["unfamiliar-words", "long-sentences"], "unfamiliar-words", false)).toEqual(["long-sentences"]);
    expect(pick(item("CW-Q3"), "mixed", "dont-know", true)).toBe("dont-know");
    const shown = { ...q2, options: choices(q2) };
    for (const v of [["dont-know"], ["unfamiliar-words", "long-sentences"]]) expect(itemError(shown, new URLSearchParams(v.map((c) => ["CW-Q2", c])))).toBeNull();
    expect(itemError(shown, new URLSearchParams([["CW-Q2", "dont-know"], ["CW-Q2", "long-sentences"]]))).toMatch(/cannot be combined/); // what pick never produces
  });
  it("N3: on the multi screens (q=2, q=8) ticking \"I don't know\" clears the other boxes and ticking a box clears it", () => {
    for (const n of ["2", "8"]) {
      const a = mount(PQuestion, { phone: true, q: n });
      const boxes = () => [...a.querySelectorAll("input.cb[type=checkbox]")] as HTMLInputElement[];
      const checked = () => boxes().filter((b) => b.checked).map((b) => b.value);
      const box = (code: string) => boxes().find((b) => b.value === code)!;
      const first = boxes()[0].value, second = boxes()[1].value;
      if (!box(first).checked) { fireEvent.click(box(first)); flushSync(); }
      if (!box(second).checked) { fireEvent.click(box(second)); flushSync(); }
      expect(checked()).toEqual([first, second]);
      fireEvent.click(box("dont-know")); flushSync();
      expect(checked()).toEqual(["dont-know"]);
      fireEvent.click(box(second)); flushSync();
      expect(checked()).toEqual([second]);
    }
  });
  it("N4: Skip clears the About choices before it leaves; Next keeps them; both go to question 1", () => {
    const a = mount(PAbout, { phone: true });
    expect(barLinks(a)).toEqual(["?ui_next=on&screen=p-question&q=1", "?ui_next=on&screen=p-question&q=1"]);
    const radio = (code: string) => a.querySelector(`input.rd[value='${code}']`) as HTMLInputElement;
    fireEvent.click(radio("18_30")); flushSync();
    expect((a.querySelector("input:checked") as HTMLInputElement).value).toBe("18_30");
    const stay = (e: Event) => e.preventDefault(); // jsdom does not navigate; keep the page to read it after the click
    window.addEventListener("click", stay);
    try {
      fireEvent.click(a.querySelector(".phone-bar .btn-primary")!); flushSync();
      expect((a.querySelector("input:checked") as HTMLInputElement).value).toBe("18_30");
      fireEvent.click(a.querySelector(".phone-bar .btn-quiet")!); flushSync();
      expect(a.querySelector("input:checked")).toBeNull();
    } finally { window.removeEventListener("click", stay); }
    expect(skipAbout()).toEqual({});
  });
  it("N4: with demographics off the flow skips About (passage -> question 1 -> back to the passage) and no line says 0 questions", () => {
    expect(hasAbout()).toBe(true);
    expect(aboutLine(0)).toBeNull();
    withDemographics(false, () => {
      expect(hasAbout()).toBe(false);
      expect(barLinks(mount(PPassage, { phone: true }))).toEqual(["?ui_next=on&screen=p-welcome", "?ui_next=on&screen=p-question&q=1"]);
      expect(barLinks(mount(PQuestion, { phone: true, q: "1" }))).toEqual(["?ui_next=on&screen=p-passage", "?ui_next=on&screen=p-question&q=2"]);
      const a = mount(PAbout, { phone: true });
      expect(text(a)).not.toMatch(/0 questions/);
      expect(a.querySelector(".phone-bar .btn-quiet")).toBeNull(); // nothing to skip
      expect(a.querySelectorAll("h1").length).toBe(1);
    });
    expect(barLinks(mount(PPassage, { phone: true }))).toEqual(["?ui_next=on&screen=p-welcome", "?ui_next=on&screen=p-about"]);
  });
  it("N6: the prop checks run again when a prop changes after mount (Chip, ProgressBar, ParticipantActions)", async () => {
    const chip = render(Chip, { props: { icon: "check", size: 36, lens: "community" } });
    await expect(chip.rerender({ icon: "check", size: 99, lens: "community" })).rejects.toThrow(/size must be/);
    const bar = render(ProgressBar, { props: { value: 1, max: 4, label: "Question 1 of 4" } });
    await expect(bar.rerender({ value: 1, max: 0, label: "Question 1 of 4" })).rejects.toThrow(/max > 0/);
    const acts = render(ParticipantActions, { props: { phone: true, label: "Next", href: "?ui_next=on&screen=p-review" } });
    await expect(acts.rerender({ phone: true, label: " ", href: "?ui_next=on&screen=p-review" })).rejects.toThrow(/needs a label/);
  });
  it("every lane screen: an unknown ?state= renders the default state, never throws, one h1", () => {
    for (const Comp of [PWelcome, PCode, PPassage, PAbout, PQuestion, PReview, PReceipt, PProblem]) {
      for (const bogus of ["zzz", "", "ALL", "busy2"]) {
        const a = mount(Comp, { phone: true, state: bogus });
        expect(text(a)).toBe(text(mount(Comp, { phone: true })));
        expect(a.querySelectorAll("h1").length).toBe(1);
      }
    }
  });
});

describe("participant screens: round 4 (validator V3, V5, V6)", () => {
  const item = (id: string) => DATA.form.items.find((i: { id: string }) => i.id === id);
  type Opt = { code: string; text: string; exclusive?: boolean };
  it("V5: the fixture's options are what the app serves the participant (renderItems over migrations/0004 tpl_written v2): CW-Q8 none is exclusive", () => {
    const line = readFileSync(resolve(__dirname, "../migrations/0004_pinned_instruments.sql"), "utf8").split("\n").find((l) => l.includes("('tpl_written', 2,"))!;
    const start = line.indexOf("'[{"), end = line.indexOf("]', '", start);
    const served = renderItems(JSON.parse(line.slice(start + 1, end + 1).replace(/''/g, "'")) as TemplateItem[], "en") as { id: string; options?: Opt[] }[];
    const ex = (opts: Opt[] = []) => opts.filter((o) => o.exclusive).map((o) => o.code);
    for (const i of DATA.form.items as { id: string; options?: Opt[] }[]) expect([i.id, ex(i.options)]).toEqual([i.id, ex(served.find((x) => x.id === i.id)!.options)]);
    expect(item("CW-Q8").options).toEqual(served.find((x) => x.id === "CW-Q8")!.options);
    expect(ex(item("CW-Q8").options)).toEqual(["none"]);
  });
  it("V5: on CW-Q8 \"We don't use it\" stands alone like \"I don't know\", and pick's results pass the app's itemError", () => {
    const q8 = item("CW-Q8");
    const shown = { ...q8, options: choices(q8) };
    expect(pick(q8, ["church", "home"], "none", true)).toEqual(["none"]);
    expect(pick(q8, ["none"], "church", true)).toEqual(["church"]);
    expect(pick(q8, ["none"], "dont-know", true)).toEqual(["dont-know"]);
    expect(pick(q8, ["dont-know"], "none", true)).toEqual(["none"]);
    for (const v of [["none"], ["church", "home"], ["dont-know"]]) expect(itemError(shown, new URLSearchParams(v.map((c) => ["CW-Q8", c])))).toBeNull();
    expect(itemError(shown, new URLSearchParams([["CW-Q8", "none"], ["CW-Q8", "church"]]))).toMatch(/cannot be combined/); // what pick never produces
    const a = mount(PQuestion, { phone: true, q: "8" });
    const box = (code: string) => a.querySelector(`input.cb[value='${code}']`) as HTMLInputElement;
    const checked = () => [...a.querySelectorAll("input.cb:checked")].map((b) => (b as HTMLInputElement).value);
    fireEvent.click(box("church")); flushSync();
    fireEvent.click(box("none")); flushSync();
    expect(checked()).toEqual(["none"]);
    fireEvent.click(box("church")); flushSync();
    expect(checked()).toEqual(["church"]);
  });
  it("V3: a multi field with an exclusive row draws the app's UI_EN.exclusionNote under it, describing each exclusive row; others draw none", () => {
    for (const [n, ex] of [["2", ["dont-know"]], ["8", ["none", "dont-know"]]] as [string, string[]][]) {
      const a = mount(PQuestion, { phone: true, q: n });
      const note = a.querySelector("fieldset.opts > p.small.field-help") as HTMLElement;
      expect(text(note)).toBe(UI_EN.exclusionNote);
      expect(note.previousElementSibling?.matches("label.row-opt.answer")).toBe(true); // under the rows, inside the field
      const described = [...a.querySelectorAll(`input[aria-describedby='${note.id}']`)].map((b) => (b as HTMLInputElement).value);
      expect(described).toEqual(ex);
      expect(a.querySelectorAll("h1").length).toBe(1);
    }
    for (const n of ["3", "6"]) expect(mount(PQuestion, { phone: true, q: n }).querySelector(".field-help")).toBeNull(); // single, text
    expect(exclusionNote(item("CW-Q3"))).toBeNull();
    expect(exclusionNote(item("CW-Q6"))).toBeNull();
    expect(exclusionNote(item("CW-Q2"))).toBe(UI_EN.exclusionNote);
  });
  it("V6: code entry is a GET form; submitting it (Enter in the code box) goes where the bar's link goes; the code is not put in the URL", () => {
    for (const state of [undefined, "error"]) {
      const a = mount(PCode, { phone: true, state });
      const form = a.querySelector("form") as HTMLFormElement;
      const inp = form.querySelector("input.in.code") as HTMLInputElement;
      expect(form.method).toBe("get");
      expect(inp.name).toBe("");
      expect(form.querySelector("label.lbl[for='p-code']")).not.toBeNull();
      const link = a.querySelector(".phone-bar a.btn-primary")!.getAttribute("href")!;
      expect(`?${new URLSearchParams(new FormData(form) as unknown as Record<string, string>)}`).toBe(link);
      expect(link).toBe(state ? "?ui_next=on&screen=p-code" : "?ui_next=on&screen=p-welcome");
      expect(form.querySelectorAll("input:not([type=hidden])").length).toBe(1); // one text field: Enter submits it (implicit submission)
    }
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
    // lintText counts .btn-primary only in .html/.svg, so the one-primary rule is checked on the rendered screens: one, or none where none is drawn.
    for (const [board, , state, Comp, , primary] of BOARDS) {
      for (const props of [{ phone: true }, {}] as P[]) {
        const html = mount(Comp, { ...props, state }).outerHTML;
        expect([board, (html.match(/class="[^"]*\bbtn-primary\b/g) ?? []).length]).toEqual([board, primary ? 1 : 0]);
      }
    }
  });
  it("PQuestion: choosing an Other option shows a description field whose input reaches onother; a scale item renders a bounded number input (captain CUA regression: onother was not a prop)", async () => {
    const errors: string[] = []; const onError = (e: ErrorEvent) => errors.push(e.message); window.addEventListener("error", onError);
    const d = { live: true, survey: { language: "", passages: [], medium: "draft", perspective: "Community" }, form: { template: { perspective: "Community" }, items: [{ id: "O1", type: "single", text: "Why?", options: [{ code: "a", text: "A" }, { code: "other", text: "Other (please describe)", other: true }] }, { id: "S1", type: "scale", text: "How clear?", scale: { min: 1, max: 5 } }] }, current: "O1", answers: {}, about: {} };
    const got: Array<[string, unknown]> = []; const other: Array<[string, string]> = [];
    const a = render(PQuestion, { props: { phone: true, d, q: 1, onanswer: (id: string, v: unknown) => { got.push([id, v]); (d.answers as Record<string, unknown>)[id] = v; }, onother: (id: string, t: string) => other.push([id, t]) } }).container;
    const radios = a.querySelectorAll("input.rd"); await fireEvent.click(radios[1]); flushSync();
    const box = a.querySelector('input[name="O1::other"]') as HTMLInputElement | null; expect(box).not.toBeNull();
    await fireEvent.input(box!, { target: { value: "because" } }); flushSync();
    expect(other).toEqual([["O1", "because"]]); expect(errors).toEqual([]);
    const b = render(PQuestion, { props: { phone: true, d: { ...d, current: "S1" }, q: 2, onanswer: (id: string, v: unknown) => got.push([id, v]) } }).container;
    const num = b.querySelector('input[type="number"].in') as HTMLInputElement; expect(num.min).toBe("1"); expect(num.max).toBe("5");
    await fireEvent.input(num, { target: { value: "4" } }); flushSync(); expect(got.at(-1)).toEqual(["S1", 4]);
    window.removeEventListener("error", onError);
  });
});
