// @vitest-environment jsdom
// UI Next (v4) results lane screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Results, ResultsPhone, ResultsAnswers, ResultsAnswersPhone,
// ResultsGaps, ResultsGapsPhone, ResultsHeld, ResultsHeldPhone, Report, ReportDetailed, ReportPhone; unit
// work/active/2026-10-21-ui-next-screens-fanout. Data: ui-next/fixtures/results/*.json through screens/results/data.js.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { OUT } from "../ui-next/src/screens/results/links.js";
// @ts-expect-error -- plain .js module, no type declarations
import results from "../ui-next/src/screens/results/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REPORT, lensCards, bandRow, scoreRows, radar, heldLines, levelOf, pct, answerView, withNotes } from "../ui-next/src/screens/results/data.js";
import Results from "../ui-next/src/screens/results/Results.svelte";
import ResultsAnswers from "../ui-next/src/screens/results/ResultsAnswers.svelte";
import ResultsGaps from "../ui-next/src/screens/results/ResultsGaps.svelte";
import ResultsHeld from "../ui-next/src/screens/results/ResultsHeld.svelte";
import Report from "../ui-next/src/screens/results/Report.svelte";
import ReportDetailed from "../ui-next/src/screens/results/ReportDetailed.svelte";
import BandBar from "../ui-next/src/screens/results/BandBar.svelte";

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
    expect(withNotes(brief.verdict, brief)).toBe("same band · Community not asked");
  });
  it("band barbell: a perspective under the minimum gets no dot and no part in the verdict; it is named instead (N3)", () => {
    const D = REPORT.desktop, H = REPORT.held.counts; // church 1 of 3: More input needed
    const clarity = bandRow(D, H, "Clarity / naturalness");
    expect(clarity.dots.map((d: { lens: string; x: number }) => `${d.lens}:${d.x}`)).toEqual(["team:87.5", "community:12.5"]);
    expect(clarity.dots.every((d: { x: unknown }) => typeof d.x === "number")).toBe(true);
    expect([clarity.verdict, clarity.more, clarity.notes]).toEqual(["3 bands apart — talk about this", ["Church"], ["Church more input needed"]]);
    const brief = bandRow(D, H, "Brief & perceived fidelity"); // team and church asked; church under the minimum
    expect([brief.dots.length, brief.verdict, brief.span]).toEqual([1, "too few perspectives to compare", null]);
    expect(withNotes(brief.verdict, brief)).toBe("too few perspectives to compare · Church more input needed · Community not asked");
    for (const name of [...D.gaps.biggest, ...D.gaps.agree]) {
      const row = bandRow(D, H, name);
      expect(row.dots.some((d: { lens: string }) => d.lens === "church"), name).toBe(false);
    }
    const tense = scoreRows(D, H, ["Clarity / naturalness"])[0];
    expect([tense.dots.map((d: { lens: string }) => d.lens), tense.notes]).toEqual([["community", "team"], ["Church more input needed"]]);
  });
  it("band barbell SVG: every point has a numeric cx, held counts included (N3: never cx=undefined%)", () => {
    const D = REPORT.desktop;
    const { container } = render(BandBar as never, { props: { row: bandRow(D, REPORT.held.counts, "Clarity / naturalness") } });
    const cx = [...container.querySelectorAll("circle")].map((c) => c.getAttribute("cx"));
    expect(cx.length).toBe(4);
    for (const v of cx) expect(v).toMatch(/^\d+(\.\d+)?%$/);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe("Clarity / naturalness: 3 bands apart — talk about this · Church more input needed");
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
  it("answers: counted from the anonymous rows, the community counts are the board's (ResultsAnswers)", () => {
    type Q = { n: number; options: [string, number][]; groups: { label: string; n: number }[] };
    const c = answerView("community");
    expect([c.label, c.answers, c.focus.area, c.focus.level]).toEqual(["Community", 8, "Understandable", "urgent"]);
    expect(c.questions.map((q: Q) => q.options.map(([, k]) => k))).toEqual([[1, 4, 2, 0, 1], [6, 3, 2, 1, 1, 0], [0, 2, 3, 3, 0]]);
    expect(c.questions.map((q: Q) => q.n)).toEqual([8, 8, 8]);
    const t = answerView("team");
    expect([t.label, t.answers, t.focus.area, t.focus.level, t.questions.length]).toEqual(["Translation team", 6, "Translation process & brief", "strong", 3]);
    expect(answerView("church").focus).toEqual({ area: "Confidence in the translation", level: "growing" });
    expect(answerView("nobody").lens).toBe("community"); // an unknown perspective is the default
  });
  it("answers split: a question splits only when every group meets the minimum (complementary suppression, N1)", () => {
    type Q = { held: boolean; n: number; options: [string, number][]; groups: { label: string; n: number }[] };
    const g = answerView("community", "gender"); // Women 5, Men 3 on every question: the split shows
    expect(g.questions.map((q: Q) => q.groups.map((x) => `${x.label} ${x.n}`).join(", "))).toEqual(Array(3).fill("Women 5, Men 3"));
    expect(g.questions.map((q: Q) => q.held)).toEqual([false, false, false]);
    // 18–30 and 51+ have 2 each: hiding only them would leave Everyone minus 31–50 = their answers, so no age group shows
    const a = answerView("community", "age");
    expect(a.questions.map((q: Q) => [q.held, q.groups.length])).toEqual([[true, 0], [true, 0], [true, 0]]);
    expect(a.questions[0].options.map(([, k]: [string, number]) => k)).toEqual([1, 4, 2, 0, 1]); // Everyone instead
    expect(answerView("community", "shoe-size").split).toBe("everyone");
  });
  it("answers split: church by gender gives no way back to the one woman's answers (N1, validator case)", () => {
    type Q = { held: boolean; n: number; options: [string, number][]; groups: unknown[] };
    const c = answerView("church", "gender"); // Men 3, Women 1
    expect(c.questions.map((q: Q) => [q.held, q.groups.length, q.n])).toEqual([[true, 0, 4], [true, 0, 4]]);
    expect(c.questions[0].options.map(([, k]: [string, number]) => k)).toEqual([3, 1, 0, 0, 0]); // Everyone only, no Men 3,0,0,0,0 beside it
    expect(answerView("team", "gender").questions.every((q: Q) => q.held)).toBe(true); // Men 4, Women 2
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
    expect(a.querySelector("summary.btn.btn-icon > svg")).not.toBeNull(); // the shared 44x44 icon summary, no .icn stand-in
    expect(a.querySelector(".l-page > .l-row[data-split][data-align=start] h1")).not.toBeNull(); // head row top-aligned (8.7)
    expect(a.querySelector(".seg[data-size=wide][aria-label='Show levels as']")).not.toBeNull(); // F1: contract .seg width
    expect(a.querySelectorAll(".glass[data-lens=team] .lvl-row").length).toBe(5); // 8.11 area rows
  });
  it("Results: Refresh with new answers is a no-op that says so", async () => {
    const a = mount(Results);
    const btn = [...a.querySelectorAll("button.btn")].find((b) => text(b) === "Refresh with new answers")!;
    expect(text(a.querySelector("[role=status]"))).toBe("Report built 31 Oct from 18 responses.");
    await fireEvent.click(btn);
    expect(text(a.querySelector("[role=status]"))).toBe("Report built 31 Oct from 18 responses. No new answers since this report was built.");
    const p = mount(Results, { phone: true });
    await fireEvent.click(p.querySelector("button[aria-label='Refresh with new answers']")!);
    expect(text(p.querySelector("[role=status]"))).toBe("No new answers since this report was built.");
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
    expect(a.querySelector(".seg[data-grow][role=radiogroup]")).not.toBeNull(); // F1: the switch takes the row's free width
    expect(all(a, "select.in option")).toEqual(["Everyone", "Split by age range", "Split by gender", "Split by where people met"]);
    expect(text(a.querySelector("main h2.h2"))).toBe("Community · Written · 8 answers");
    expect(a.querySelectorAll(".ans").length).toBe(3);
    const first = a.querySelector(".ans .r")!;
    expect(text(first)).toBe("Very easy to understand1");
    expect(first.querySelector("svg.bar rect")!.getAttribute("width")).toBe("12%");
    expect(text(a.querySelector(".solid .micro"))).toBe("Other, in their words");
  });
  it("ResultsAnswers: the perspective switch and the split drive the heading, counts and bars (F2)", async () => {
    const a = mount(ResultsAnswers);
    const team = [...a.querySelectorAll(".seg input")].find((i) => text(i.parentElement) === "Translation team") as HTMLInputElement;
    await fireEvent.click(team);
    expect(text(a.querySelector("main h2.h2"))).toBe("Translation team · Written · 6 answers");
    expect(text(a.querySelector("main h2.h2 + .l-row"))).toBe("Translation process & brief · Strong");
    expect(all(a, "main h3.h3")[0]).toBe("Does your team have a translation brief or plan that defines what kind of translation you are aiming for?");
    expect(a.querySelector(".ans svg.bar")!.getAttribute("data-lens")).toBe("team");
    expect(all(a, ".ans")[0]).toBe("Yes, we have a documented brief that defines our translation type and goals2Yes, we have a shared understanding as a team of what we are aiming for, but it is not documented4We are still working on defining our translation type and goals0Other (please describe)0");
    expect(a.querySelector(".solid .micro")).toBeNull(); // no "in their words" for the team
    const community = [...a.querySelectorAll(".seg input")].find((i) => text(i.parentElement) === "Community") as HTMLInputElement;
    await fireEvent.click(community);
    const sel = a.querySelector("select.in") as HTMLSelectElement;
    sel.value = "age";
    await fireEvent.change(sel);
    expect(text(a.querySelector("main h2.h2"))).toBe("Community · Written · 8 answers · by age range");
    expect(a.querySelectorAll(".ans").length).toBe(3); // 18–30 and 51+ are under 3, so every question shows Everyone (N1)
    expect(all(a, ".l-card .micro").filter((t) => / answers$/.test(t))).toEqual([]);
    expect(all(a, ".l-card p.small")[0]).toBe("Showing everyone: split by age range, a group has fewer than 3 answers to this question.");
    sel.value = "gender";
    await fireEvent.change(sel);
    expect(a.querySelectorAll(".ans").length).toBe(6);
    expect(all(a, ".l-card .micro").slice(0, 2)).toEqual(["Women · 5 answers", "Men · 3 answers"]);
    expect(all(a, ".l-card .l-row > .small").filter((t) => / answers$/.test(t))).toEqual([]); // no question n beside a split
  });
  it("ResultsAnswers: church split by gender shows Everyone only, never Men beside the total (N1, browser case)", async () => {
    const a = mount(ResultsAnswers, { state: "church" });
    const sel = a.querySelector("select.in") as HTMLSelectElement;
    sel.value = "gender";
    await fireEvent.change(sel);
    expect(text(a)).not.toContain("Men ·");
    expect(a.querySelectorAll(".ans").length).toBe(2);
    expect(all(a, ".l-card .l-row > .small")).toEqual(["4 answers", "4 answers"]);
    expect(all(a, ".l-card p.small")).toEqual(Array(2).fill("Showing everyone: split by gender, a group has fewer than 3 answers to this question."));
  });
  it("ResultsAnswers: ?state= picks the perspective; an unknown value is the default", () => {
    expect(text(mount(ResultsAnswers, { state: "church" }).querySelector("main h2.h2"))).toBe("Church · Written · 4 answers");
    expect(text(mount(ResultsAnswers, { state: "x" }).querySelector("main h2.h2"))).toBe("Community · Written · 8 answers");
  });
  it("ResultsAnswersPhone: one list card, a native disclosure per question (first open), back to levels", () => {
    const a = mount(ResultsAnswers, { phone: true });
    const ds = [...a.querySelectorAll(".l-card[data-pad=list] details.disc")] as HTMLDetailsElement[];
    expect(ds.map((d) => d.open)).toEqual([true, false, false]);
    expect(text(ds[0].querySelector("summary"))).toBe("As a group, how would we describe how easy or difficult this translation is to understand?");
    expect(text(a.querySelector(".phone-title"))).toBe("The answers");
    expect(all(a, "main > a.link")).toEqual(["Back to levels"]);
    const lens = a.querySelector("main a.btn.btn-block")!;
    expect(text(lens)).toBe("Community · 8");
    expect(lens.getAttribute("href")).toBe("?ui_next=on&screen=results-answers&state=church"); // steps to the next perspective
    expect(text(mount(ResultsAnswers, { phone: true, state: "team" }).querySelector("main a.btn.btn-block"))).toBe("Translation team · 6");
  });
  it("ResultsGaps: who each dot is, three biggest gaps then agreement, band barbells with verdicts", () => {
    const a = mount(ResultsGaps);
    expect(all(a, "main h3.h3")).toEqual(["Clarity / naturalness", "Impact / use", "Brief & perceived fidelity", "Trust / readiness"]);
    expect(all(a, "main h2.h2")).toEqual(["The three biggest gaps", "Where everyone agrees", "What this does not tell you"]);
    expect(all(a, "strong").filter((t) => /band/.test(t))).toEqual(["3 bands apart — talk about this", "2 bands apart — talk about this", "same band", "same band"]);
    expect(a.querySelectorAll("svg[data-part=band-barbell] g[role=img]").length).toBe(11);
    expect(a.querySelector("svg[data-part=band-barbell] g[aria-label='Community · Needs urgent attention'] circle")!.getAttribute("cx")).toBe("12.5%");
    expect(text(a)).toContain("Translation team Strong · Church Strong · Community not asked"); // N2: space before the middot
    expect(text(a)).not.toMatch(/\S· /);
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
    const grid = a.querySelector(".l-grid[data-state=held]")!; // F4: dimmed by the contract row, and inert
    expect(grid.hasAttribute("inert")).toBe(true);
    expect(grid.querySelectorAll(".glass[data-lens]").length).toBe(3);
    expect(a.querySelector(".glass-hi .icn[data-size='64']")).not.toBeNull();
    expect(text(a.querySelector(".glass-hi h2.h2.t-24"))).toBe("Results are held until every perspective has enough answers");
    // F5: one source for the count: the meta line and the refused delete both say 15
    expect(text(a.querySelector(".l-page > .l-row p.small"))).toContain("· 15 responses");
    expect(text(a.querySelector(".mi-why"))).toBe("Reviews with responses can't be deleted. This one has 15.");
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
    expect(a.querySelectorAll("main > .paper[data-sheet=a4]").length).toBe(1); // 8.11 sheet row, no .l-card padding
    expect(a.querySelector(".paper .l-row[data-split][data-align=start] > svg.mk[width='40']")).not.toBeNull(); // F3: the 40px mark top right
    expect(all(a, ".paper .solid[data-lens] .lvl-name")).toEqual(["Growing", "Needs support", "Growing"]);
    expect(all(a, ".paper ol li")).toEqual(["Community · Impactful — Needs urgent attention", "Community · Understandable — Needs urgent attention", "Translation team · External review — Needs support"]);
    expect(text(a.querySelector(".pfoot"))).toContain("1 of 1");
    // N2: a space on both sides of the middot before "not asked"
    expect(all(a, ".paper .l-grid > span.small:last-child").filter((t) => /not asked/.test(t))).toEqual(["same band · Community not asked"]);
    expect(text(a)).not.toMatch(/\S· /);
  });
  it("ReportDetailed: four sheets, radar, numeric barbells, evidence tables", () => {
    const a = mount(ReportDetailed);
    expect(all(a, ".pfoot span:last-child")).toEqual(["1 of 4", "2 of 4", "3 of 4", "4 of 4"]);
    expect(a.querySelectorAll(".paper[data-sheet=page]").length).toBe(4);
    expect(a.querySelector("svg[role=img][aria-label^='Radar']")).not.toBeNull();
    expect(a.querySelectorAll("svg[data-part=score-barbell]").length).toBe(3 + 7);
    expect(all(a, "table").length).toBe(3);
    expect(all(a, "th.th")).toContain("Observation");
    // N2: the notes after "gap n" keep the space before the middot
    expect(all(a, ".paper .l-grid > span.small:last-child").filter((t) => /not asked/.test(t))).toEqual([
      "gap 14 · Community not asked", "gap 4 · Community not asked", "gap 14 · Community not asked", "gap 9 · Translation team not asked", "gap 4 · Community not asked"]);
    expect(text(a)).not.toMatch(/\S· /);
  });
  it("ReportDetailed on a phone renders the phone's reports list (F6: never a blank page)", () => {
    const a = mount(ReportDetailed, { phone: true });
    expect(text(a.querySelector(".phone-title"))).toBe("Reports");
    expect(all(a, ".glass .h3")).toEqual(["Overview · 1 page", "Detailed · 4 pages"]);
  });
  it("Print prints the report (F7)", async () => {
    const spy = vi.fn();
    vi.stubGlobal("print", spy);
    try {
      const a = mount(Report);
      const btn = [...a.querySelectorAll("header.top button.btn")].find((b) => text(b) === "Print")!;
      await fireEvent.click(btn);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
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
  it("an unknown ?state= renders the default state, never throws (desktop and phone)", () => {
    for (const C of [Results, ResultsAnswers, ResultsGaps, ResultsHeld, Report, ReportDetailed]) {
      for (const phone of [false, true]) {
        const plain = render(C as never, { props: { phone } }).container.innerHTML;
        expect(render(C as never, { props: { phone, state: "x" } }).container.innerHTML).toBe(plain);
      }
    }
  });
  it("every route has exactly one h1", () => {
    for (const [board, , C, props] of BOARDS) expect(mount(C, props).querySelectorAll("h1").length, board).toBe(1);
    expect(mount(ReportDetailed, { phone: true }).querySelectorAll("h1").length).toBe(1);
  });
});

describe("in-screen links (shared href(); cross-lane names as their lanes register them)", () => {
  // Hash links left on purpose: no screen exists for them yet (cookbook receipt debt 8): CSV, PDF download, PDF share.
  const PLACEHOLDERS = ["#csv", "#download", "#share-pdf"];
  // Links this lane sets: the screen body, the phone bar, the document bar, and the shared headers' brand, crumb, back and menu.
  // (The shared TopBar's own workspace/help/account items are its links, not this lane's.)
  const OWN = "main a[href], .phone-bar a[href], header[data-variant=document] a[href], header.top > a.brand, nav.crumb a, .phone-top a[href]";
  // Each test mounts its own boards (no state shared between it() blocks), so any one runs alone (-t) or shuffled (N6).
  const linksOf = (C: unknown, props: Props) => {
    const q = props.phone ? "?ui_next=on&screen=x&w=phone&theme=dark" : "?ui_next=on&screen=x&theme=dark";
    window.history.replaceState(null, "", `/next/${q}`); // href() carries ?w= and ?theme= from location.search
    try {
      return [...mount(C, props).querySelectorAll(OWN)].map((el) => ({ h: el.getAttribute("href")!, label: text(el) }));
    } finally {
      window.history.replaceState(null, "", "/");
    }
  };
  const screenOf = (h: string) => new URLSearchParams(h.slice(1).split("#")[0]).get("screen")!;
  for (const [board, , C, props] of BOARDS) {
    it(`${board}: every link is a href() screen link or a named placeholder (F8: no #next-step/#share/#people/#setup)`, () => {
      const links = linksOf(C, props);
      expect(links.length).toBeGreaterThan(2);
      for (const { h, label } of links) {
        if (PLACEHOLDERS.includes(h)) continue;
        expect(h, label).toMatch(/^\?ui_next=on&screen=[a-z0-9-]+(&[a-z_]+=[^&#]+)*(#[a-z]+)?$/);
        expect(h, label).toContain(props.phone ? "&w=phone&theme=dark" : "&theme=dark");
      }
    });
  }
  it("cross-lane destinations: each OUT name is registered once its owning lane is merged", () => {
    for (const [key, [name, lane]] of Object.entries(OUT as Record<string, [string, string]>)) {
      expect(Object.keys(LANES), key).toContain(lane);
      if (Object.keys(LANES[lane]).length) expect(REGISTRY[name], `${lane} lane registers ${name}`).toBeDefined();
    }
  });
  it("in-lane destinations are registered (every board mounted here)", () => {
    const names = new Set<string>();
    for (const [, , C, props] of BOARDS) for (const { h } of linksOf(C, props)) if (!PLACEHOLDERS.includes(h)) names.add(screenOf(h));
    const outNames = Object.values(OUT as Record<string, [string, string]>).map(([o]) => o);
    const own = [...names].filter((n) => !outNames.includes(n));
    expect(own.sort()).toEqual(["home", "report", "report-detailed", "results", "results-answers", "results-gaps"]);
    for (const n of own) expect([...Object.keys(results), "home"], n).toContain(n);
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
