// @vitest-environment jsdom
// UI Next (v4) results lane screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Results, ResultsPhone, ResultsAnswers, ResultsAnswersPhone,
// ResultsGaps, ResultsGapsPhone, ResultsHeld, ResultsHeldPhone, Report, ReportDetailed, ReportPhone; unit
// work/active/2026-10-21-ui-next-screens-fanout. Data: ui-next/fixtures/results/*.json through screens/results/data.js.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import results from "../ui-next/src/screens/results/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REPORT, lensCards, bandRow, scoreRows, radar, heldLines, levelOf, pct } from "../ui-next/src/screens/results/data.js";
import Results from "../ui-next/src/screens/results/Results.svelte";
import ResultsAnswers from "../ui-next/src/screens/results/ResultsAnswers.svelte";
import ResultsGaps from "../ui-next/src/screens/results/ResultsGaps.svelte";
import ResultsHeld from "../ui-next/src/screens/results/ResultsHeld.svelte";
import Report from "../ui-next/src/screens/results/Report.svelte";
import ReportDetailed from "../ui-next/src/screens/results/ReportDetailed.svelte";

type Props = Record<string, unknown>;
const mount = (C: unknown, props: Props = {}) => render(C as never, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const all = (a: Element, s: string) => [...a.querySelectorAll(s)].map(text);
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

// [board, screen name, component, props, primary label, document view (paper sheets in the shell's main)]
const BOARDS: [string, string, unknown, Props, string, boolean][] = [
  ["Results", "results", Results, {}, "Plan the next step", false],
  ["ResultsPhone", "results", Results, { phone: true }, "Plan the next step", false],
  ["ResultsAnswers", "results-answers", ResultsAnswers, {}, "Plan the next step", false],
  ["ResultsAnswersPhone", "results-answers", ResultsAnswers, { phone: true }, "Plan the next step", false],
  ["ResultsGaps", "results-gaps", ResultsGaps, {}, "Plan the next step", false],
  ["ResultsGapsPhone", "results-gaps", ResultsGaps, { phone: true }, "Plan the next step", false],
  ["ResultsHeld", "results-held", ResultsHeld, {}, "Reopen collection", false],
  ["ResultsHeldPhone", "results-held", ResultsHeld, { phone: true }, "Reopen collection", false],
  ["Report", "report", Report, {}, "Download this report (PDF)", true],
  ["ReportDetailed", "report-detailed", ReportDetailed, {}, "Download this report (PDF)", true],
  ["ReportPhone", "report", Report, { phone: true }, "Download the overview (PDF)", false],
];

describe("data adapter: levels through the current UI's pure modules (board values)", () => {
  it("perspective and area levels come from v3ScoreBand (Results board)", () => {
    const cards = lensCards(REPORT.desktop.payload, REPORT.desktop.counts);
    expect(cards.map((c: { level: string }) => c.level)).toEqual(["growing", "support", "growing"]);
    expect(cards[0].rows.map((r: { name: string; level: string }) => `${r.name}:${r.level}`)).toEqual([
      "Translation process & brief:strong", "Understanding the source:growing", "External review:support", "Consistency:growing", "Governance:more"]);
    expect(levelOf(90, 2)).toBe("more"); // under the minimum: More input needed, never a low result
  });
  it("band barbell: band centres, shared bands spread in lens order, red span at two bands or more (ResultsGaps board)", () => {
    const D = REPORT.desktop;
    const clarity = bandRow(D, D.counts, "Clarity / naturalness");
    expect(clarity.dots.map((d: { x: number }) => d.x)).toEqual([87.5, 12.5, 62.5]);
    expect(clarity.verdict).toBe("3 bands apart — talk about this");
    expect(clarity.span).toEqual({ from: 12.5, to: 87.5 });
    const impact = bandRow(D, D.counts, "Impact / use");
    expect(impact.dots.map((d: { x: number }) => d.x)).toEqual([60, 12.5, 65]);
    const brief = bandRow(D, D.counts, "Brief & perceived fidelity");
    expect([brief.verdict, brief.notAsked, brief.span]).toEqual(["same band", ["Community"], null]);
  });
  it("numeric barbell and radar (ReportDetailed board): biggest tensions by spread, five shared spokes", () => {
    const D = REPORT.desktop;
    expect(scoreRows(D, D.counts).slice(0, 3).map((r: { name: string; spread: number }) => `${r.name} ${r.spread}`)).toEqual(["Clarity / naturalness 58", "Impact / use 54", "Understanding of the source 14"]);
    const shape = radar(D, D.radar);
    expect(shape.spokes.map((s: { name: string }) => s.name)).toEqual(D.radar);
    expect(shape.lenses.map((l: { lens: string; marks: unknown[] }) => `${l.lens}:${l.marks.length}`)).toEqual(["team:5", "community:3", "church:5"]);
    expect(shape.lenses[0].marks[0].xy).toEqual(["210.0", "81.2"]); // team 88 on Clarity, the board's point
  });
  it("held lines and answer bars", () => {
    expect(heldLines(REPORT.held.counts).map((l: { text: string }) => l.text)).toEqual(["Translation team 6 — ready", "Community 8 — ready", "Church 1 — needs 2 more"]);
    expect([pct(1, 8), pct(3, 8), pct(0, 8)]).toEqual([12, 37, 0]);
  });
});

describe("each board renders as a screen", () => {
  it("Results: head, tabs on Understand, legend, three perspective cards, disagreement card, report buttons", () => {
    const a = mount(Results);
    expect(text(a.querySelector("h1.title-page"))).toBe("Mark 1–4 draft");
    expect(text(a.querySelector(".pill[data-stage=closed]"))).toBe("Collection closed");
    expect(all(a, ".tab")).toEqual(["Prepare", "Collect", "3UnderstandNow", "4Improve"]);
    expect(text(a.querySelector(".tab[aria-current=page]"))).toBe("3UnderstandNow");
    expect(all(a, ".glass[data-lens] .h2")).toEqual(["Translation team", "Community", "Church"]);
    expect(all(a, ".glass[data-lens=church] .lvl-name")).toEqual(["Growing", "Growing", "Needs support", "Strong", "Strong", "Growing", "More input needed"]);
    expect(text(a)).toContain("Where the perspectives disagree");
    expect(all(a, "a.btn")).toEqual(expect.arrayContaining(["Overview report · 1 page", "Detailed report · 4 pages", "Share results with someone"]));
    const del = a.querySelector(".menu button.mi.danger")!;
    expect(del.getAttribute("aria-disabled")).toBe("true");
    expect(text(a.querySelector(".mi-why"))).toBe("Reviews with responses can't be deleted. This one has 18.");
  });
  it("ResultsPhone: root phone header, phone review head, three compact perspective cards, phone-bar primary", () => {
    const a = mount(Results, { phone: true });
    expect(a.querySelector(".phone-top[data-state=root]")).not.toBeNull();
    expect(text(a.querySelector("h1.title-phone"))).toBe("Luke 1–2");
    expect(text(a.querySelector(".pill[data-stage=results]"))).toBe("Results ready");
    expect(all(a, ".glass[data-lens] .h3")).toEqual(["Translation team · 9", "Community · 10", "Church · 5"]);
    expect(all(a, "main > a.link")).toEqual(["See the three biggest gaps", "Share results with someone"]);
  });
  it("ResultsAnswers: perspective switch, split, one card per question with answer rows and bars, their words", () => {
    const a = mount(ResultsAnswers);
    expect((a.querySelector(".seg input:checked")!.parentElement as HTMLElement).textContent).toBe("Community");
    expect(all(a, "select.in option")).toEqual(["Everyone", "Split by age range", "Split by gender", "Split by where people met"]);
    expect(text(a.querySelector("main h2.h2"))).toBe("Community · Written · 8 answers");
    expect(a.querySelectorAll(".ans").length).toBe(3);
    const first = a.querySelector(".ans .r")!;
    expect(text(first)).toBe("Very easy to understand1");
    expect(first.querySelector("svg.bar rect")!.getAttribute("width")).toBe("12%");
    expect(text(a.querySelector(".solid .micro"))).toBe("Other, in their words");
  });
  it("ResultsAnswersPhone: one list card, a native disclosure per question (first open), back to levels", () => {
    const a = mount(ResultsAnswers, { phone: true });
    const ds = [...a.querySelectorAll(".l-card[data-pad=list] details.disc")] as HTMLDetailsElement[];
    expect(ds.map((d) => d.open)).toEqual([true, false, false]);
    expect(text(ds[0].querySelector("summary"))).toBe("As a group, how would we describe how easy or difficult this translation is to understand?");
    expect(text(a.querySelector(".phone-title"))).toBe("The answers");
    expect(all(a, "main > a.link")).toEqual(["Back to levels"]);
  });
  it("ResultsGaps: who each dot is, three biggest gaps then agreement, band barbells with verdicts", () => {
    const a = mount(ResultsGaps);
    expect(all(a, "main h3.h3")).toEqual(["Clarity / naturalness", "Impact / use", "Brief & perceived fidelity", "Trust / readiness"]);
    expect(all(a, "main h2.h2")).toEqual(["The three biggest gaps", "Where everyone agrees", "What this does not tell you"]);
    expect(all(a, "strong").filter((t) => /band/.test(t))).toEqual(["3 bands apart — talk about this", "2 bands apart — talk about this", "same band", "same band"]);
    expect(a.querySelectorAll("svg[data-part=band-barbell] g[role=img]").length).toBe(11);
    expect(a.querySelector("svg[data-part=band-barbell] g[aria-label='Community · Needs urgent attention'] circle")!.getAttribute("cx")).toBe("12.5%");
  });
  it("ResultsGapsPhone: three gap cards with perspective counts", () => {
    const a = mount(ResultsGaps, { phone: true });
    expect(all(a, ".glass .l-row > .small").filter((t) => /perspectives/.test(t))).toEqual(["3 perspectives", "3 perspectives", "2 perspectives"]);
    expect(text(a.querySelector(".phone-title"))).toBe("Biggest gaps");
  });
  it("ResultsHeld: held card names the short perspective; preview cards show More input needed for it", () => {
    const a = mount(ResultsHeld);
    expect(text(a)).toContain("Results are held until every perspective has enough answers");
    expect(text(a)).toContain("Church has 1 of 3.");
    expect(all(a, ".glass-hi .small").filter((t) => / — /.test(t))).toEqual(["Translation team 6 — ready", "Community 8 — ready", "Church 1 — needs 2 more"]);
    expect(all(a, ".glass[data-lens=church] .lvl-name")).toEqual(["More input needed", "More input needed", "More input needed", "More input needed"]);
    expect(text(a.querySelector(".btn-primary"))).toBe("Reopen collection");
  });
  it("ResultsHeldPhone: nested header, closed pill, held card with the two ways on", () => {
    const a = mount(ResultsHeld, { phone: true });
    expect(text(a.querySelector(".phone-title"))).toBe("Luke 1–2");
    expect(a.querySelector(".pill[data-stage=closed]")).not.toBeNull();
    expect(text(a)).toContain("The church survey has 2 answers; we show a perspective at 3 or more so no one can be picked out.");
    expect(all(a, ".glass a.link")).toEqual(["Show results without the church", "See the answers so far"]);
  });
  it("Report: document bar, one paper sheet with levels, gaps, where to look next and the attestation footer", () => {
    const a = mount(Report);
    expect(a.querySelector("header.top[data-variant=document]")).not.toBeNull();
    expect(a.querySelectorAll(".psheet > .paper").length).toBe(1);
    expect(all(a, ".paper .solid[data-lens] .lvl-name")).toEqual(["Growing", "Needs support", "Growing"]);
    expect(all(a, ".paper ol li")).toEqual(["Community · Impactful — Needs urgent attention", "Community · Understandable — Needs urgent attention", "Translation team · External review — Needs support"]);
    expect(text(a.querySelector(".pfoot"))).toContain("1 of 1");
  });
  it("ReportDetailed: four sheets, radar, numeric barbells, evidence tables", () => {
    const a = mount(ReportDetailed);
    expect(all(a, ".pfoot span:last-child")).toEqual(["1 of 4", "2 of 4", "3 of 4", "4 of 4"]);
    expect(a.querySelector("svg[role=img][aria-label^='Radar']")).not.toBeNull();
    expect(a.querySelectorAll("svg[data-part=score-barbell]").length).toBe(3 + 7);
    expect(all(a, "table").length).toBe(3);
    expect(all(a, "th.th")).toContain("Observation");
    expect(() => render(ReportDetailed as never, { props: { phone: true } })).toThrow(/desktop only/);
  });
  it("ReportPhone: two report cards and the preview", () => {
    const a = mount(Report, { phone: true });
    expect(all(a, ".glass .h3")).toEqual(["Overview · 1 page", "Detailed · 4 pages"]);
    expect(text(a.querySelector(".phone-title"))).toBe("Reports");
  });
});

describe("nesting (8.1), no inline style, one .btn-primary, dark theme", () => {
  for (const [board, , C, props, primary, doc] of BOARDS) {
    it(`${board}: primitives nest under a level; no [style]; exactly one .btn-primary "${primary}"`, () => {
      const a = mount(C, { ...props, theme: "dark" });
      expect(a.getAttribute("data-theme")).toBe("dark");
      const main = a.querySelector(":scope > .layer.l-shell > main")!;
      expect(main).not.toBeNull();
      if (!props.phone && !doc) expect(main.querySelector(":scope > .l-page")).not.toBeNull();
      const roots = doc ? ".l-card, .l-page, .l-phone, .l-section, details.disc, .psheet, main.l-main" : ".l-card, .l-page, .l-phone, .l-section, details.disc";
      for (const el of a.querySelectorAll(".l-stack, .l-row, .l-grid, .l-card")) expect(el.parentElement!.closest(roots), el.className).not.toBeNull();
      expect(a.querySelector("[style]")).toBeNull();
      const p = a.querySelectorAll(".btn-primary");
      expect(p.length).toBe(1);
      expect(text(p[0])).toBe(primary);
      if (props.phone) expect(p[0].closest(".phone-bar")).not.toBeNull();
    });
  }
  it("screens refuse an unknown ?state=", () => {
    for (const C of [Results, ResultsAnswers, ResultsGaps, ResultsHeld, Report, ReportDetailed]) expect(() => render(C as never, { props: { state: "x" } })).toThrow(/no board states/);
  });
});

describe("/next/ routes for the results lane", () => {
  const p = (s: string) => new URLSearchParams(s);
  const on = () => { const s = store(); s.setItem("ui_next", "on"); return s; };
  it("registers six kebab-case screens in the lane index, all merged into the registry", () => {
    expect(Object.keys(results)).toEqual(["results", "results-answers", "results-gaps", "results-held", "report", "report-detailed"]);
    for (const name of Object.keys(results)) expect(REGISTRY[name]).toBe(results[name]);
  });
  for (const [board, name, C, props] of BOARDS) {
    const q = `?screen=${name}${props.phone ? "&w=phone" : ""}`;
    it(`${board} is reachable at /next/?ui_next=on&${q.slice(1)}`, () => {
      const r = route(p(q), on(), Object.keys(REGISTRY));
      expect(r).toEqual({ view: name, props: { phone: !!props.phone, theme: "light", state: undefined } });
      expect(REGISTRY[r.view]).toBe(C);
    });
  }
  it("flag off: the gallery, never a lane screen", () => {
    expect(route(p("?screen=results"), undefined, Object.keys(REGISTRY)).view).toBe("components");
  });
});
