// @vitest-environment jsdom
// UI Next (v4) results lane screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Results, ResultsPhone, ResultsAnswers, ResultsAnswersPhone,
// ResultsGaps, ResultsGapsPhone, ResultsHeld, ResultsHeldPhone, Report, ReportDetailed, ReportPhone; unit
// work/active/2026-10-21-ui-next-screens-fanout. Data: ui-next/fixtures/results/*.json through screens/results/data.js.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { OUT } from "../ui-next/src/screens/results/links.js";
// @ts-expect-error -- plain .js module, no type declarations
import results from "../ui-next/src/screens/results/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REPORT, lensCards, bandRow, bandRows, scoreRows, comparedRows, radar, heldLines, levelOf, pct, answerView, withNotes, gapLead, responsesFor, countWord, detailedPages, lensKey, canonicalPayload, responsesText, LENS_ORDER, sentLenses, fmtScore, gapRows, useLevelMinimum, currentLevelMin, levelMinimumOf, footPrivacy } from "../ui-next/src/screens/results/data.js";
// The fixtures are DEV-like reviews: they band at the DEV level minimum of 1, set explicitly (the live app reads the served value).
beforeEach(() => { useLevelMinimum(1); });
import { LENSES } from "../ui/lens-surveys.js";
import synthetic from "./fixtures/synthetic-report-renderer-v1.json";
// @ts-expect-error -- plain .js module, no type declarations
import { liveReport } from "../ui-next/src/app/data.js";
import Results from "../ui-next/src/screens/results/Results.svelte";
import ResultsAnswers from "../ui-next/src/screens/results/ResultsAnswers.svelte";
import ResultsGaps from "../ui-next/src/screens/results/ResultsGaps.svelte";
import ResultsHeld from "../ui-next/src/screens/results/ResultsHeld.svelte";
import Report from "../ui-next/src/screens/results/Report.svelte";
import ReportDetailed from "../ui-next/src/screens/results/ReportDetailed.svelte";
import LensCard from "../ui-next/src/screens/results/LensCard.svelte";
import BandBar from "../ui-next/src/screens/results/BandBar.svelte";
import { G } from "../ui-next/src/screens/results/icons.js";

type Props = Record<string, unknown>;
const mount = (C: unknown, props: Props = {}) => render(C as never, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const all = (a: Element, s: string) => [...a.querySelectorAll(s)].map(text);
// A built report without the church perspective at all (R3-3), plus a "look next" and a gap area the payload does not have.
type Payload = { lenses: { lens: string }[]; cross_lens_multi: { lens_scores: { lens: string }[] }[]; evidence: { label: string }[] };
const withoutChurch = () => {
  const D = JSON.parse(JSON.stringify(REPORT.desktop)) as { payload: Payload; counts: Record<string, number>; lookNext: string[][]; gaps: { biggest: string[]; agree: string[] } };
  D.payload.lenses = D.payload.lenses.filter((l) => l.lens !== "church");
  for (const a of D.payload.cross_lens_multi) a.lens_scores = a.lens_scores.filter((s) => s.lens !== "church");
  D.payload.evidence = D.payload.evidence.filter((e) => !e.label.startsWith("church"));
  delete D.counts.church;
  D.lookNext = [...D.lookNext, ["church", "Readiness"], ["team", "No such area"]];
  D.gaps = { biggest: [...D.gaps.biggest, "No such area"], agree: D.gaps.agree };
  return D;
};
type Built = { payload: Payload & { cross_lens_multi: unknown[] }; counts?: Record<string, number>; review: Record<string, string> };
const copy = () => JSON.parse(JSON.stringify(REPORT.desktop)) as Built;
// A built report whose own evidence holds church at n (snapshot first, Codex P1 on 992b610: a report's levels rest on its own
// evidence counts, never on live counts passed beside it). heldReport: church 0 in the report and in the live counts.
const churchAt = <T extends Built>(D: T, n: number) => { D.payload.evidence = D.payload.evidence.map((e) => (e.label.startsWith("church") ? { ...e, n } : e)); return D; };
const heldReport = () => { const D = churchAt(copy(), 0) as Built & typeof REPORT.desktop; D.counts = { ...REPORT.held.counts }; return D; }; // church 0 (no response): More input needed
// R4-1: two areas whose placed perspectives (team, community) are both 20 apart; church (0 of 1, held) differs. Payload order
// Zeal then Accord, so neither the hidden score nor the alphabet can be what orders them.
const tieProbe = (zeal: number, accord: number) => {
  const D = churchAt(copy(), 0);
  D.counts = { ...REPORT.held.counts };
  D.payload.cross_lens_multi = [
    { construct_name: "Zeal", question: "Zeal?", lens_scores: [{ lens: "team", score: 50 }, { lens: "community", score: 70 }, { lens: "church", score: zeal }] },
    { construct_name: "Accord", question: "Accord?", lens_scores: [{ lens: "team", score: 40 }, { lens: "community", score: 60 }, { lens: "church", score: accord }] },
  ];
  return D;
};
// R4-2: the live payload carries evidence n and no `counts`; churchN is church's evidence count.
const noCounts = (churchN: number) => {
  const D = copy();
  delete D.counts;
  D.payload.evidence = D.payload.evidence.map((e) => (e.label.startsWith("church") ? { ...e, n: churchN } : e));
  return D;
};
// R4-3: malformed entries (null, a number, no scored perspective) beside two areas with a blank and a numeric name.
const oddReport = () => {
  const D = copy();
  D.payload.cross_lens_multi = [null, ...D.payload.cross_lens_multi, 7, { construct_name: "No scores", lens_scores: [] },
    { construct_name: "  ", lens_scores: [{ lens: "team", score: 50 }, { lens: "community", score: 56 }] },
    { construct_name: 42, lens_scores: [{ lens: "team", score: 60 }, { lens: "church", score: 68 }] }];
  return D;
};
// Paper sheet contents (design-system.md §8.11 row @697c974d): a sheet's title and section heads are the board's divs carrying the
// heading role (level 1 / 2), so a level-1 heading is an h1 or [role=heading][aria-level="1"].
const H1 = "h1, [role=heading][aria-level='1']";
const SHEET_H2 = ".paper [role=heading][aria-level='2']";
// R4-5: a sheet heading followed by nothing (or only the page foot) is an empty section.
const emptyHeadings = (a: Element) => [...a.querySelectorAll(SHEET_H2)].filter((h) => !h.nextElementSibling || h.nextElementSibling.matches(".pfoot")).map(text);
const attrs = (a: Element) => [...a.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((x) => x.value)).join(" ");
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
    expect(levelOf(90, 0)).toBe("more"); // under the minimum (no response): More input needed, never a low result
    expect(levelOf(90, 1)).toBe("strong"); // one response is enough for a level (cookbook 2026-10-26-3d-report-threshold-coverage); the drops show it is few
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
    const D = heldReport(), H = D.counts; // church 0 (no response): More input needed
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
    const { container } = render(BandBar as never, { props: { row: bandRow(heldReport(), REPORT.held.counts, "Clarity / naturalness") } });
    const cx = [...container.querySelectorAll("circle")].map((c) => c.getAttribute("cx"));
    expect(cx.length).toBe(4);
    for (const v of cx) expect(v).toMatch(/^\d+(\.\d+)?%$/);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe("Clarity / naturalness: 3 bands apart — talk about this · Church more input needed");
  });
  it("numeric barbell and radar (ReportDetailed board): biggest tensions by spread, five shared spokes", () => {
    const D = REPORT.desktop;
    expect(scoreRows(D, D.counts).slice(0, 3).map((r: { name: string; spread: number }) => `${r.name} ${r.spread}`)).toEqual(["Clarity / naturalness 58", "Impact / use 54", "Understanding of the source 14"]);
    const shape = radar(D, D.radar, D.counts);
    expect(shape.spokes.map((s: { name: string }) => s.name)).toEqual(D.radar);
    expect(shape.lenses.map((l: { lens: string; marks: unknown[] }) => `${l.lens}:${l.marks.length}`)).toEqual(["team:5", "community:3", "church:5"]);
    expect(shape.lenses[0].marks[0].xy).toEqual(["210.0", "81.2"]); // team 88 on Clarity, the board's point
    expect([shape.legend.map((l: { lens: string }) => l.lens), shape.notes]).toEqual([["team", "community", "church"], []]);
  });
  it("held counts: a perspective under the minimum feeds no spread, tensions order, radar point or table score (R3-1)", () => {
    const D = heldReport(), H = D.counts; // church 0 in the report's own evidence
    type R = { name: string; spread: number | null; dots: { lens: string; score: number }[]; notes: string[] };
    const rows: R[] = scoreRows(D, H);
    for (const r of rows) {
      expect(r.dots.some((d) => d.lens === "church"), r.name).toBe(false);
      const placed = r.dots.map((d) => d.score);
      expect(r.spread, r.name).toBe(placed.length < 2 ? null : Math.max(...placed) - Math.min(...placed));
    }
    // Biggest tensions: placed spreads only (Brief was "gap 4" and Understanding "gap 14" through church's score); one-score areas
    // last, in payload order, not in the order church's hidden score gave them (R4-1)
    expect(rows.map((r) => `${r.name} ${r.spread}`)).toEqual(["Clarity / naturalness 58", "Impact / use 54", "Trust / readiness 2",
      "Brief & perceived fidelity null", "Understanding of the source null", "Appeal / beauty null", "Consistency null"]);
    const brief = rows.find((r) => r.name === "Brief & perceived fidelity")!;
    expect(withNotes(gapLead(brief), brief)).toBe("too few perspectives to compare · Church more input needed · Community not asked");
    expect(bandRow(D, H, "Understanding of the source").spread).toBeNull();
    const shape = radar(D, D.radar, H); // church has no polygon, point or title; its areas need two placed perspectives to be spokes
    expect(shape.lenses.map((l: { lens: string }) => l.lens)).toEqual(["team", "community"]);
    expect(shape.spokes.map((s: { name: string }) => s.name)).toEqual(["Clarity / naturalness", "Impact / use", "Trust / readiness"]);
    expect([shape.legend.map((l: { lens: string }) => l.lens), shape.notes]).toEqual([["team", "community"], ["Church more input needed"]]);
    const church = lensCards(D.payload, H).find((c: { lens: string }) => c.lens === "church");
    expect(church.rows.map((r: { score: unknown; level: string }) => `${r.level}:${r.score}`)).toEqual(Array(6).fill("more:null"));
  });
  it("tensions ties break on payload order, never on a held perspective's score (R4-1)", () => {
    const names = (D: Built) => scoreRows(D, D.counts).map((r: { name: string; spread: number | null }) => `${r.name} ${r.spread}`);
    // lensSpreadRows' full spread puts Zeal first in the first probe (50 vs 20) and Accord first in the second (20 vs 50)
    expect(names(tieProbe(20, 60))).toEqual(["Zeal 20", "Accord 20"]);
    expect(names(tieProbe(60, 10))).toEqual(["Zeal 20", "Accord 20"]);
    // and the same held perspective's score in the fixture: swapping church's scores between areas moves nothing
    const D = heldReport(), E = copy() as Built & { payload: { cross_lens_multi: { lens_scores: { lens: string; score: number }[] }[] } };
    const church = E.payload.cross_lens_multi.map((a) => a.lens_scores.find((s) => s.lens === "church"));
    const scores = church.map((s) => s?.score).reverse();
    church.forEach((s, i) => { if (s) s.score = scores[i] ?? s.score; });
    churchAt(E, 0); E.counts = { ...REPORT.held.counts };
    expect(names(E)).toEqual(names(D as Built));
  });
  it("one response-count resolver: a report without counts places and hides by its evidence n (R4-2)", () => {
    const D = REPORT.desktop, H = REPORT.held.counts;
    const r = responsesFor(noCounts(4).payload, undefined);
    expect(["team", "community", "church", "nobody"].map(r)).toEqual([6, 8, 4, null]);
    expect(responsesFor(D.payload, { church: 9 })("church")).toBe(4); // snapshot first: the report's own evidence n, never a live count
    expect(responsesFor({ lenses: [] }, { church: 9 })("church")).toBe(9); // a payload with no count: the live count stands in
    expect(responsesFor(D.payload, { church: 9 }, { prefer: "live" })("church")).toBe(9); // the held preview reads the collection as it stands
    // evidence n equal to the counts: every helper reads the same as with counts
    const live = noCounts(4);
    expect(lensCards(live.payload, live.counts)).toEqual(lensCards(D.payload, D.counts));
    expect(scoreRows(live, live.counts)).toEqual(scoreRows(D, D.counts));
    expect(radar(live, D.radar, live.counts)).toEqual(radar(D, D.radar, D.counts));
    // church at 0 in the evidence, no counts: hidden everywhere exactly as with the held live counts beside it
    const held = noCounts(0), HR = heldReport();
    expect(lensCards(held.payload, held.counts)).toEqual(lensCards(HR.payload, H));
    expect(scoreRows(held, held.counts)).toEqual(scoreRows(HR, H));
    expect(comparedRows(held, held.counts)).toEqual(comparedRows(HR, H));
    expect(bandRows(held, held.counts, D.gaps.biggest)).toEqual(bandRows(HR, H, D.gaps.biggest));
    expect(radar(held, D.radar, held.counts)).toEqual(radar(HR, D.radar, H));
    // live counts never move a built report's levels: church 0 live beside a report that used 4 keeps church's level and drops
    expect(lensCards(D.payload, H)).toEqual(lensCards(D.payload, D.counts));
    expect(lensCards(held.payload, held.counts).find((c: { lens: string }) => c.lens === "church").rows.every((x: { score: unknown }) => x.score === null)).toBe(true);
    // no count anywhere: More input needed, never a level or a score
    const none = noCounts(1);
    none.payload.evidence = [];
    expect(lensCards(none.payload, none.counts).map((c: { n: unknown; level: string }) => `${c.n}:${c.level}`)).toEqual(["null:more", "null:more", "null:more"]);
    expect(scoreRows(none, none.counts).every((x: { dots: unknown[] }) => x.dots.length === 0)).toBe(true);
    expect(radar(none, D.radar, none.counts)).toBeNull();
  });
  it("malformed cross-perspective entries are skipped; blank and numeric names still list (R4-3)", () => {
    const D = oddReport(), F = REPORT.desktop;
    expect(bandRows(D, D.counts, F.gaps.biggest)).toEqual(bandRows(F, F.counts, F.gaps.biggest));
    expect(bandRow(D, D.counts, "Clarity / naturalness").question).toBe("Is the text easy to follow?");
    expect(scoreRows(D, D.counts).slice(0, 3)).toEqual(scoreRows(F, F.counts).slice(0, 3));
    expect(comparedRows(D, D.counts).map((r: { name: string; spread: number | null }) => `${r.name} ${r.spread}`).slice(-2)).toEqual(["— 6", "42 8"]);
    expect(comparedRows(D, D.counts).length).toBe(F.payload.cross_lens_multi.length + 2);
    expect(radar(D, F.radar, D.counts)).toEqual(radar(F, F.radar, F.counts));
  });
  it("count words and detailed pages follow the report (R4-5)", () => {
    expect([countWord(2), countWord(3), countWord(9)]).toEqual(["two", "three", "9"]);
    const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ lens: String(i), rows: [{ name: "Area" }] }));
    expect([0, 1, 2, 3].map((n) => detailedPages(cards(n)))).toEqual([2, 3, 3, 4]);
    // a perspective with no areas (sent out, no response at build time) has no evidence table, so no sheet
    expect(detailedPages([...cards(2), { lens: "x", rows: [] }])).toBe(3);
  });
  it("a payload without a perspective or an area: cards iterate, unknown areas are skipped, never thrown (R3-3)", () => {
    const D = withoutChurch();
    expect(lensCards(D.payload, D.counts).map((c: { lens: string }) => c.lens)).toEqual(["team", "community"]);
    expect(bandRows(D, D.counts, D.gaps.biggest).map((r: { name: string }) => r.name)).toEqual(["Clarity / naturalness", "Impact / use", "Brief & perceived fidelity"]);
    expect(() => bandRow(D, D.counts, "No such area")).toThrow(TypeError);
    const shape = radar(D, (REPORT.desktop as { radar: string[] }).radar, D.counts);
    expect([shape.legend.map((l: { lens: string }) => l.lens), shape.notes]).toEqual([["team", "community"], ["Church not asked"]]);
    expect(radar(D, ["Clarity / naturalness"], D.counts)).toBeNull(); // under radarModel's three spokes: no shape
  });
  it("held lines and answer bars", () => {
    expect(heldLines(REPORT.held.counts).map((l: { text: string }) => l.text)).toEqual(["Translation team 6 — ready", "Community 8 — ready", "Church 0 — needs 1 more"]);
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
    expect(all(a, ".glass[data-lens=church] .lvl-word")).toEqual(["Growing", "Growing", "Needs support", "Strong", "Strong", "Growing", "More input needed"]);
    expect(text(a)).toContain("Where the perspectives disagree");
    expect(all(a, "a.btn")).toEqual(expect.arrayContaining(["Overview report · 1 page", "Detailed report · 4 pages", "Share results with someone"]));
    const del = a.querySelector(".menu button.mi.danger")!;
    expect(del.getAttribute("aria-disabled")).toBe("true");
    expect(text(a.querySelector(".mi-why"))).toBe("Reviews with responses can't be deleted. This one has 18.");
    expect(a.querySelector("summary.btn.btn-icon > svg")).not.toBeNull(); // the shared 44x44 icon summary, no .icn stand-in
    expect(a.querySelector(".l-page > .l-row[data-split][data-align=start] h1")).not.toBeNull(); // head row top-aligned (8.7)
    // §8.11 compact level legend: .glass.lvl-legend, the note at the end, the compact switch (no 320px wide stand-in)
    const legend = a.querySelector(".glass.lvl-legend[aria-label=Levels]")!;
    expect([legend.querySelectorAll(":scope > .lvl").length, legend.querySelector(":scope > .small.mi-end") !== null, legend.querySelector(":scope > .seg[data-size=compact][aria-label='Show levels as']") !== null]).toEqual([5, true, true]);
    expect(a.querySelector(".seg[data-size=wide]")).toBeNull();
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
    expect(all(a, ".glass[data-lens] .h3")).toEqual(["Translation team", "Community", "Church"]);
    expect(all(a, ".glass[data-lens] [data-coverage]")).toEqual(["Well filled · 9 responses", "Well filled · 10 responses", "Filling up · 5 responses"]);
    // Q15: counted by the gaps drawn; the fixture's third listed area (Brief & perceived fidelity, Strong / Strong) is one band, not a gap
    expect(all(a, "main > a.link")).toEqual(["See the two biggest gaps", "Share results with someone"]);
  });
  it("phone-bar 'Plan the next step' draws the boards' trailing arrow (ResultsPhone, ResultsAnswersPhone, ResultsGapsPhone; integration N3)", () => {
    for (const C of [Results, ResultsAnswers, ResultsGaps]) {
      const p = mount(C, { phone: true }).querySelector(".phone-bar .btn-primary")!;
      expect(text(p)).toBe("Plan the next step");
      const kids = [...p.childNodes].filter((n) => n.nodeType === 1 || (n.textContent ?? "").trim());
      expect(kids.map((n) => (n.nodeType === 1 ? (n as Element).tagName.toLowerCase() : "label"))).toEqual(["label", "svg"]);
      expect(p.querySelector("svg path")!.getAttribute("d")).toBe("M5 12h14M13 6l6 6-6 6");
    }
    // Reopen collection: the board's leading QR icon, no trail (ResultsHeldPhone)
    const held = mount(ResultsHeld, { phone: true }).querySelector(".phone-bar .btn-primary")!;
    expect(text(held)).toBe("Reopen collection");
    const hk = [...held.childNodes].filter((n) => n.nodeType === 1 || (n.textContent ?? "").trim());
    expect(hk.map((n) => (n.nodeType === 1 ? (n as Element).tagName.toLowerCase() : "label"))).toEqual(["svg", "label"]);
    expect(held.querySelector("svg path")!.getAttribute("d")).toBe(G.qr);
  });
  it("board ports (ResultsHeld §8.11 held card, compact legend on both legend screens, ResultsPhone 44px project link, ReportDetailed page 2 copy)", () => {
    const held = mount(ResultsHeld);
    const card = held.querySelector("section.glass-hi.held-card[aria-label='Results are held']")!;
    const kids = [...card.children];
    expect(kids.map((k) => `${k.tagName.toLowerCase()}.${[...k.classList].join(".")}`)).toEqual(["span.icn", "div.l-stack", "div.l-stack"]);
    expect([kids[0].getAttribute("data-size"), kids[0].querySelector("svg")!.getAttribute("width"), kids[1].getAttribute("data-gap"), kids[2].getAttribute("data-gap")]).toEqual(["64", "30", "2", "2"]);
    expect([kids[1].querySelector("h2.h2.t-24") !== null, kids[1].querySelector("p.small.t-15") !== null, kids[1].querySelector(".l-row.held-lines[data-gap='5']")!.children.length]).toEqual([true, true, 3]);
    expect(card.hasAttribute("style")).toBe(false);
    expect(held.querySelector("[data-pad=work]")).toBeNull();
    for (const el of [held, mount(Results)]) expect(el.querySelectorAll(".glass.lvl-legend .seg[data-size=compact]").length).toBe(1);
    const link = mount(Results, { phone: true }).querySelector("a.link.small.crumb-hit")!;
    expect(link.textContent).toBe(REPORT.phone.review.project);
    expect([link.parentElement!.tagName, link.parentElement!.className, link.nextElementSibling!.querySelector("h1.title-phone") !== null]).toEqual(["DIV", "", true]); // gap 0: a plain block column (no inherited --g)
    expect(mount(ResultsGaps, { phone: true }).querySelector(".crumb-hit")).toBeNull(); // nested boards keep the plain link, gap 4
    // ?state=newer (the boards' "Newer responses" state): only the church card names 3 newer responses, desktop and phone
    for (const phone of [false, true]) expect(all(mount(Results, { phone, state: "newer" }), "[data-newer]")).toEqual(["3 newer responses not in this report yet"]);
    expect(mount(Results).querySelector("[data-newer]")).toBeNull();
    // §8.11 phone perspective card: section.lens-card[data-gap=1] > head (name, level) · cue · [newer] · area rows as direct children
    for (const state of [undefined, "newer"]) {
      const cards = [...mount(Results, { phone: true, state }).querySelectorAll("section.glass.l-card.l-stack.lens-card[data-lens][data-gap='1']")];
      expect(cards.length).toBe(3);
      for (const c of cards) {
        const k = [...c.children];
        expect(k[0].matches("div.lens-card-head") && k[0].children[0].matches("span.h3") && k[0].children[1].matches(".lvl")).toBe(true);
        expect(k[1].matches(".lvl-pair.small[data-coverage]")).toBe(true);
        const rest = k.slice(2), newer = rest.filter((e) => e.matches("span.small[data-newer]"));
        expect(newer.length).toBe(state === "newer" && c.getAttribute("data-lens") === "church" ? 1 : 0);
        expect(rest.slice(newer.length).every((e) => e.matches("div.lvl-row") && e.children[0].matches("span.small") && e.children[1].matches(".lvl"))).toBe(true);
        expect(rest.length - newer.length).toBeGreaterThan(0);
      }
    }
    expect(text(mount(ReportDetailed))).toContain("the drops beside each perspective show how many answered (a few drops is little evidence, not a low result)");
  });
  it("ResultsAnswers: perspective switch, split, one card per question with answer rows and bars, their words", () => {
    const a = mount(ResultsAnswers);
    expect((a.querySelector("main .seg input:checked")!.parentElement as HTMLElement).textContent).toBe("Community");
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
  it("ResultsGaps: who each dot is, the gaps (counted) then the areas that share a band, band barbells with verdicts", () => {
    const a = mount(ResultsGaps);
    // Q13/Q15: the fixture lists Brief & perceived fidelity (Strong / Strong) as a gap; one band is never drawn as a gap
    expect(all(a, "main h3.h3")).toEqual(["Clarity / naturalness", "Impact / use", "Trust / readiness"]);
    // the screen card is div.glass.barbell-row (design-system.md barbell rows @186fab0a), one per area, named for the group
    expect([...a.querySelectorAll("main .glass.barbell-row")].map((r) => r.getAttribute("aria-label"))).toEqual(["Clarity / naturalness", "Impact / use", "Trust / readiness"]);
    expect(a.querySelector("main .l-grid[data-tpl=barbell]")).toBeNull();
    expect(all(a, "main h2.h2")).toEqual(["The two biggest gaps", "Where the perspectives share a band", "What this does not tell you"]);
    expect(all(a, "strong").filter((t) => /band/.test(t))).toEqual(["3 bands apart — talk about this", "2 bands apart — talk about this", "same band"]);
    expect(a.querySelectorAll("svg[data-part=band-barbell] g[role=img]").length).toBe(9);
    expect(a.querySelector("svg[data-part=band-barbell] g[aria-label='Community · Needs urgent attention'] circle")!.getAttribute("cx")).toBe("12.5%");
    expect(a.querySelector("[data-agree-none]")).toBeNull();
    expect(text(a)).toContain("Every placed perspective on the area sits in the same band.");
    expect(text(a)).not.toMatch(/everyone agrees|three biggest/i);
    expect(text(a)).not.toMatch(/\S· /);
  });
  it("ResultsGapsPhone: the gap cards with perspective counts, counted intro, count-free header", () => {
    const a = mount(ResultsGaps, { phone: true });
    expect(all(a, ".glass .l-row > .small").filter((t) => /perspectives/.test(t))).toEqual(["3 perspectives", "3 perspectives"]);
    expect(text(a.querySelector("[data-gap-lead]"))).toBe("The two biggest gaps between how the perspectives see the same thing.");
    expect(text(a.querySelector(".phone-title"))).toBe("Gaps");
  });
  it("ResultsHeld: held card names the short perspective; preview cards show More input needed for it", () => {
    const a = mount(ResultsHeld);
    expect(text(a)).toContain("Results are held until every perspective has enough answers");
    expect(text(a)).toContain("Church has 0 of 1.");
    expect(all(a, ".glass-hi .small").filter((t) => / — /.test(t))).toEqual(["Translation team 6 — ready", "Community 8 — ready", "Church 0 — needs 1 more"]);
    expect(all(a, ".glass[data-lens=church] .lvl-word")).toEqual(["More input needed", "More input needed", "More input needed", "More input needed"]);
    expect(text(a.querySelector(".btn-primary"))).toBe("Reopen collection");
    const grid = a.querySelector(".l-grid[data-state=held]")!; // F4: dimmed by the contract row, and inert
    expect(grid.hasAttribute("inert")).toBe(true);
    expect(grid.querySelectorAll(".glass[data-lens]").length).toBe(3);
    expect(a.querySelector(".glass-hi .icn[data-size='64']")).not.toBeNull();
    expect(text(a.querySelector(".glass-hi h2.h2.t-24"))).toBe("Results are held until every perspective has enough answers");
    // F5: one source for the count: the meta line and the refused delete both say 14, and the fixture's total is its
    // perspective lines' sum (6 + 8 + 0; Codex P2 on 992b610: the total was 15 beside lines that add to 14)
    const total = Object.values(REPORT.held.counts as Record<string, number>).reduce((n, k) => n + k, 0);
    expect([REPORT.held.review.closedResponses, total]).toEqual([14, 14]);
    expect(text(a.querySelector(".l-page > .l-row p.small"))).toContain("· 14 responses");
    expect(text(a.querySelector(".mi-why"))).toBe("Reviews with responses can't be deleted. This one has 14.");
  });
  it("ResultsHeldPhone: nested header, closed pill, held card with the two ways on", () => {
    const a = mount(ResultsHeld, { phone: true });
    expect(text(a.querySelector(".phone-title"))).toBe("Luke 1–2");
    expect(a.querySelector(".pill[data-stage=closed]")).not.toBeNull();
    expect(text(a)).toContain("The church survey has 0 answers; a perspective shows its level from its first answer.");
    expect(all(a, ".glass a.link")).toEqual(["Show results without the church", "See the answers so far"]);
  });
  it("Report: document bar, one paper sheet with levels, gaps, where to look next and the attestation footer", () => {
    // the overview draws the gaps then the first area that shares a band; listing Brief & perceived fidelity (Strong / Strong, Community
    // not asked) first among the agreeing areas puts its not-asked note on the sheet (N2 below)
    const a = mount(Report, { report: { ...REPORT.desktop, gaps: { ...REPORT.desktop.gaps, agree: ["Brief & perceived fidelity", ...REPORT.desktop.gaps.agree] } } });
    expect(all(a, ".paper .barbell-row > .bb-label")).toEqual(["Clarity / naturalness", "Impact / use", "Brief & perceived fidelity"]);
    expect(a.querySelector("header.top[data-variant=document]")).not.toBeNull();
    expect(a.querySelectorAll("main > .paper[data-sheet=a4]").length).toBe(1); // 8.11 sheet row, no .l-card padding
    expect(a.querySelector(".paper .paper-title-row > svg.mk[width='40']")).not.toBeNull(); // F3: the 40px mark top right (.paper-title-row, §8.11)
    expect(all(a, ".paper .sheet-tile[data-lens] .sheet-tile-level .lvl-word")).toEqual(["Growing", "Needs support", "Growing"]);
    expect(all(a, ".paper ol li")).toEqual(["Community · Impactful — Needs urgent attention", "Community · Understandable — Needs urgent attention", "Translation team · External review — Needs support"]);
    expect(text(a.querySelector(".pfoot"))).toContain("1 of 1");
    // Q14: the counter is its own unbroken column; the full privacy clause sits in the flexible wrapping one
    expect(text(a.querySelector(".pfoot > span.pn"))).toBe("1 of 1");
    expect(text(a.querySelector(".pfoot > span.pf-text"))).toContain(footPrivacy());
    expect(a.querySelectorAll(".pfoot > span").length).toBe(2);
    // N2: a space on both sides of the middot before "not asked"
    expect(all(a, ".paper .barbell-row > span.bb-verdict").filter((t) => /not asked/.test(t))).toEqual(["same band · Community not asked"]);
    // design-system.md barbell rows @186fab0a: the paper row is div.barbell-row (label · band-axis · verdict), never the screen Grid template
    expect([...a.querySelectorAll(".paper .barbell-row")].every((r) => r.tagName === "DIV" && !r.hasAttribute("data-kind") && r.children.length === 3 && r.children[1].matches(".band-axis"))).toBe(true);
    expect(a.querySelector(".paper .l-grid[data-tpl=barbell]")).toBeNull();
    // its label and verdict are span.bb-label / span.bb-verdict (13px 600 / 12px, design-system.md:747 @c9dfe1ff): never .small on paper
    expect([...a.querySelectorAll(".paper .barbell-row")].every((r) => r.children[0].matches("span.bb-label") && r.children[2].matches("span.bb-verdict"))).toBe(true);
    // the only .small in a paper row is the board's not-asked note, span.small.bb-na inside the verdict (design-system.md:861 @697c974d)
    expect(a.querySelectorAll(".paper .barbell-row .small:not(.bb-na)").length).toBe(0);
    expect([...a.querySelectorAll(".paper .bb-na")].map((n) => [n.tagName, n.parentElement!.className, text(n)])).toEqual([["SPAN", "bb-verdict", "· Community not asked"]]);
    expect(text(a)).not.toMatch(/\S· /);
  });
  it("ReportDetailed: four sheets, radar, numeric barbells, evidence tables", () => {
    { // §8.11 evidence table: .ev-card > .ev-head + table.ev-table; Score and Evidence end-aligned, Score .tab-n, Evidence .ev-muted
      const ev = mount(ReportDetailed).querySelector(".ev-card[data-lens=team]")!;
      expect([...ev.children].map((k) => k.className)).toEqual(["ev-head", "ev-table"]);
      expect([...ev.querySelectorAll("thead th")].map((th) => `${text(th)}:${th.getAttribute("data-align") ?? ""}`)).toEqual(["Area:", "Level:", "Score:end", "Evidence:end", "Observation:"]);
      const td = ev.querySelector("tbody tr")!.children;
      expect([td[2].className, td[2].getAttribute("data-align"), td[3].className, td[3].getAttribute("data-align")]).toEqual(["tab-n", "end", "ev-muted", "end"]);
      expect(mount(ReportDetailed).querySelector(".ev-card .tbl, .ev-card .th, .ev-card .td")).toBeNull();
    }
    const a = mount(ReportDetailed);
    expect(all(a, ".pfoot span:last-child")).toEqual(["1 of 4", "2 of 4", "3 of 4", "4 of 4"]);
    expect(a.querySelectorAll(".paper[data-sheet=page]").length).toBe(4);
    expect(a.querySelector("svg[role=img][aria-label^='Radar']")).not.toBeNull();
    expect(a.querySelectorAll(".paper .score-track").length).toBe(3 + 7);
    expect(all(a, "table").length).toBe(3);
    expect(all(a, ".ev-table th")).toContain("Observation");
    // N2: the notes after "gap n" keep the space before the middot
    expect(all(a, ".paper .barbell-row > span.bb-verdict").filter((t) => /not asked/.test(t))).toEqual([
      "gap 14 · Community not asked", "gap 4 · Community not asked", "gap 14 · Community not asked", "gap 9 · Translation team not asked", "gap 4 · Community not asked"]);
    expect(text(a)).not.toMatch(/\S· /);
  });
  it("ReportDetailed with held counts: church's score reaches no gap, tensions order, radar or table cell (R3-1)", () => {
    const a = mount(ReportDetailed, { report: heldReport() });
    expect(a.querySelectorAll(".score-track > .pt[data-lens=church]").length).toBe(0);
    const radarSvg = a.querySelector("svg[role=img][aria-label^='Radar']")!;
    expect(radarSvg.getAttribute("aria-label")).toBe("Radar of Translation team, Community across 3 shared areas");
    expect(radarSvg.querySelectorAll("[data-lens=church]").length).toBe(0);
    expect(all(radarSvg, "title").filter((t) => /Church/.test(t))).toEqual([]);
    expect(text(a)).toContain("Church more input needed");
    expect(text(a)).not.toContain("church stay wide"); // the fixture's three-shape reading needs every perspective drawn
    const sheets = [...a.querySelectorAll(".paper[data-sheet=page]")];
    expect(all(sheets[0], ".barbell-row > span.bb-label")).toEqual(["Clarity / naturalness", "Impact / use", "Trust / readiness"]);
    const churchTable = a.querySelector(".ev-card[data-lens=church] table.ev-table")!;
    expect([...churchTable.querySelectorAll("tbody tr")].map((tr) => text(tr.children[2]))).toEqual(Array(6).fill("—"));
    const leads = all(a, ".paper .barbell-row > span.bb-verdict");
    expect(leads).toContain("too few perspectives to compare · Church more input needed · Community not asked");
    expect(text(a)).not.toMatch(/gap null|undefined|NaN/);
    expect(attrs(a)).not.toMatch(/gap null|undefined|NaN/);
    expect(a.querySelectorAll(H1).length).toBe(1);
  });
  it("Report and ReportDetailed render a payload without a perspective or area (R3-3: never a blank page)", () => {
    const D = withoutChurch();
    const r = mount(Report, { report: D });
    expect(r.querySelectorAll(H1).length).toBe(1);
    expect(all(r, ".paper .sheet-tile[data-lens] > .sheet-tile-name")).toEqual(["Translation team", "Community"]);
    expect(all(r, ".paper ol li")).toEqual(["Community · Impactful — Needs urgent attention", "Community · Understandable — Needs urgent attention", "Translation team · External review — Needs support"]);
    expect(r.querySelectorAll(".paper .band-track").length).toBe(3); // the two gaps and the first area in one band (Q13)
    const d = mount(ReportDetailed, { report: D });
    expect(d.querySelectorAll(H1).length).toBe(1);
    // two perspectives: three sheets, no empty "(continued)" page; their words close page 3 (R4-5)
    expect(d.querySelectorAll(".paper[data-sheet=page]").length).toBe(3);
    expect(all(d, ".pfoot span:last-child")).toEqual(["1 of 3", "2 of 3", "3 of 3"]);
    expect(text(d.querySelector("header[data-variant=document]"))).toContain("Detailed report · 3 pages");
    expect(text(d)).not.toContain("(continued)");
    expect(all(d, ".paper[data-sheet=page]:last-child [role=heading][aria-level='2']")).toEqual(["Every area, with evidence", "In their words"]);
    expect(all(d, SHEET_H2)[0]).toBe("The two perspectives as one shape");
    expect(emptyHeadings(d)).toEqual([]);
    expect(text(r.querySelector("header[data-variant=document]"))).toContain("Open the detailed report · 3 pages");
    expect(all(d, ".ev-card[data-lens] > .ev-head strong")).toEqual(["Translation team", "Community"]);
    expect(text(d)).toContain("Church not asked");
    for (const el of [r, d]) {
      expect(text(el)).not.toMatch(/gap null|undefined|NaN/);
      expect(attrs(el)).not.toMatch(/undefined|NaN/);
    }
  });
  it("ReportDetailed: the tensions order and every sheet are the same whatever the held perspective's score (R4-1)", () => {
    const a = mount(ReportDetailed, { report: tieProbe(20, 60) }), b = mount(ReportDetailed, { report: tieProbe(60, 10) });
    const tense = (el: Element) => all(el.querySelectorAll(".paper[data-sheet=page]")[0], ".barbell-row > span.bb-label");
    expect(tense(a)).toEqual(["Zeal", "Accord"]);
    expect(tense(b)).toEqual(["Zeal", "Accord"]);
    expect(a.innerHTML).toBe(b.innerHTML); // nothing on any sheet moves with church's hidden score
    expect(text(a)).toContain("The two areas where the perspectives are furthest apart.");
  });
  it("Report and ReportDetailed without counts hide a perspective under the minimum as held counts do (R4-2)", () => {
    for (const C of [Report, ReportDetailed]) {
      expect(mount(C, { report: noCounts(0) }).innerHTML).toBe(mount(C, { report: heldReport() }).innerHTML);
      expect(mount(C, { report: noCounts(4) }).innerHTML).toBe(mount(C).innerHTML);
    }
    const a = mount(ReportDetailed, { report: noCounts(0) });
    expect(a.querySelectorAll(".score-track > .pt[data-lens=church], svg[aria-label^='Radar'] [data-lens=church]").length).toBe(0);
    expect([...a.querySelector(".ev-card[data-lens=church] table.ev-table")!.querySelectorAll("tbody tr")].map((tr) => text(tr.children[2]))).toEqual(Array(6).fill("—"));
    const none = noCounts(1);
    none.payload.evidence = [];
    const z = mount(ReportDetailed, { report: none });
    expect(all(z, ".ev-card[data-lens] > .ev-head .small")).toEqual(Array(3).fill("responses not counted"));
    expect(text(z)).not.toMatch(/null|undefined|NaN/);
  });
  it("Report and ReportDetailed render malformed entries; blank and numeric names list in All areas compared (R4-3)", () => {
    const D = oddReport();
    const r = mount(Report, { report: D });
    expect(r.querySelectorAll(H1).length).toBe(1);
    expect(r.querySelectorAll(".paper .band-track").length).toBe(mount(Report).querySelectorAll(".paper .band-track").length);
    const d = mount(ReportDetailed, { report: D });
    expect(d.querySelectorAll(H1).length).toBe(1);
    const page2 = d.querySelectorAll(".paper[data-sheet=page]")[1];
    expect(all(page2, ".barbell-row > span.bb-label").slice(-2)).toEqual(["—", "42"]);
    expect([...page2.querySelectorAll(".barbell-row")].every((r) => r.getAttribute("data-kind") === "score")).toBe(true);
    expect(all(page2, ".barbell-row > span.bb-verdict").slice(-2)).toEqual(["gap 6 · Church not asked", "gap 8 · Community not asked"]);
    expect(d.querySelectorAll(".paper .score-track").length).toBe(3 + 9);
    expect(text(d)).not.toMatch(/gap null|undefined|NaN/);
  });
  it("ReportDetailed copy counts what it draws; no sheet has a heading without content (R4-5)", () => {
    const def = mount(ReportDetailed), held = mount(ReportDetailed, { report: heldReport() });
    expect(all(def, SHEET_H2)[0]).toBe("The three perspectives as one shape");
    expect(text(def)).toContain("The three areas where the perspectives are furthest apart.");
    expect(all(held, SHEET_H2)[0]).toBe("The two perspectives as one shape");
    expect(text(held)).toContain("The three areas where the perspectives are furthest apart.");
    const one = copy();
    one.payload.cross_lens_multi = one.payload.cross_lens_multi.slice(0, 1);
    const o = mount(ReportDetailed, { report: one });
    expect(all(o, SHEET_H2)[0]).toBe("The perspectives as one shape");
    expect(text(o)).toContain("The area where the perspectives are furthest apart. Every area");
    for (const el of [def, held, o, mount(ReportDetailed, { report: withoutChurch() }), mount(ReportDetailed, { report: noCounts(1) }), mount(ReportDetailed, { report: oddReport() })]) {
      expect(emptyHeadings(el)).toEqual([]);
      expect(el.querySelectorAll(H1).length).toBe(1);
    }
  });
  it("ReportPhone reads the report prop; the fixture is only the default (R4-4)", () => {
    expect(all(mount(Report, { phone: true }), "main > a.link")[0]).toBe("Luke 1–2 · results");
    const P = JSON.parse(JSON.stringify(REPORT.phone));
    P.review.title = "Acts 3";
    P.payload.lenses = P.payload.lenses.filter((l: { lens: string }) => l.lens !== "church");
    const a = mount(Report, { phone: true, report: P });
    expect(all(a, "main > a.link")[0]).toBe("Acts 3 · results");
    expect(all(a, ".glass .h3")).toEqual(["Overview · 1 page", "Detailed · 3 pages"]);
    expect(a.querySelectorAll(H1).length).toBe(1);
    // the phone detailed view reads the same prop: its sheets carry the report's own title
    expect(text(mount(ReportDetailed, { phone: true, report: { ...REPORT.desktop, review: { ...REPORT.desktop.review, title: "Acts 3" } } }).querySelector(".paper .paper-title[role=heading][aria-level='1']"))).toBe("Acts 3");
  });
  it("live QA N2 (design-system.md Phone report reading): hub → overview view → detailed view, each the desktop sheets scaled to the width", () => {
    const hub = mount(Report, { phone: true });
    const btn = (el: Element, label: string) => [...el.querySelectorAll("a.btn")].find((b) => text(b) === label)!;
    expect(btn(hub, "Preview").getAttribute("href")).toBe("?ui_next=on&screen=report&state=overview");
    expect(btn(hub, "Read").getAttribute("href")).toBe("?ui_next=on&screen=report-detailed");
    for (const [C, props, micro, sheets, other, back, dl] of [
      [Report, { phone: true, state: "overview" }, "Overview · 1 page · A4 scaled to the width; pinch to zoom", 1, "Open the detailed report", "Reports", "Download the overview (PDF)"],
      [ReportDetailed, { phone: true }, "Detailed · 4 pages · A4 scaled to the width; pinch to zoom", 4, "Back to the overview", "Overview", "Download this report (PDF)"],
    ] as const) {
      const a = mount(C, props as Props);
      expect(text(a.querySelector("main > span.micro"))).toBe(micro);
      expect(text(a.querySelector("main > p.small[id=pdf-why]"))).toBe("PDF export is not in the new design yet; the current design's report page downloads it.");
      const ps = [...a.querySelectorAll("main > .report-sheets > .psheet[data-fit=a4]")];
      expect(ps.length).toBe(sheets);
      for (const p of ps) expect(p.firstElementChild!.matches(".paper[data-sheet]")).toBe(true);
      expect(text([...a.querySelectorAll("main > a.link")].pop()!)).toBe(other);
      expect(a.querySelector(".phone-top [aria-label^='Back']")!.getAttribute("aria-label")).toContain(back);
      const bar = a.querySelector(".phone-bar .btn-primary") as HTMLButtonElement;
      expect([bar.tagName, bar.disabled, bar.getAttribute("aria-describedby"), text(bar), bar.classList.contains("btn-block")]).toEqual(["BUTTON", true, "pdf-why", dl, true]);
    }
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
      // §8.11 Data geometry (Paper sheet contents @697c974d): the only inline styles are value-driven left/width percentages on the
      // paper barbells' spans, and nothing else anywhere
      for (const el of a.querySelectorAll("[style]")) {
        expect(el.closest(".paper .band-track, .paper .score-track"), el.outerHTML).not.toBeNull();
        expect(el.getAttribute("style"), el.outerHTML).toMatch(/^(?:(?:left|width): -?\d+(?:\.\d+)?%;\s?)+$/);
      }
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
  it("Paper sheet contents (design-system.md:861 @697c974d): no .small, .h3 or inline type inside a sheet; the board's classes", () => {
    const views = [mount(Report), mount(Report, { phone: true, state: "overview" }), mount(ReportDetailed), mount(ReportDetailed, { phone: true })];
    for (const v of views) {
      const sheets = [...v.querySelectorAll(".paper")];
      expect(sheets.length).toBeGreaterThan(0);
      for (const sh of sheets) {
        // the coverage cue (.lvl-pair.small, §2 Coverage cue) and the not-asked note (span.small.bb-na) are the board's own .small
        expect([...sh.querySelectorAll(".small")].filter((e) => !e.matches(".lvl-pair, .bb-na")).map((e) => e.outerHTML)).toEqual([]);
        expect(sh.querySelectorAll(".h3, h2, h3, .title-page").length).toBe(0);
        for (const el of sh.querySelectorAll("[style]")) expect(el.getAttribute("style")).toMatch(/^(?:(?:left|width): -?\d+(?:\.\d+)?%;\s?)+$/);
        for (const l of sh.querySelectorAll(".lvl")) expect(l.querySelector(":scope > .lvl-word")).not.toBeNull();
      }
    }
    const [o, , d] = views;
    expect([...o.querySelectorAll(".paper > .paper-title-row > div > *")].map((e) => e.className)).toEqual(["paper-title", "sheet-meta"]);
    expect([...o.querySelectorAll(".sheet-tiles > .sheet-tile[data-lens]")].map((t) => [...t.children].map((c) => c.matches("[data-coverage]") ? "cue" : c.className))).toEqual(Array(3).fill(["sheet-tile-name", "cue", "sheet-tile-level"]));
    expect(o.querySelectorAll(".paper p.sheet-text[data-v='14'], .paper p.sheet-lead, .paper ol.sheet-list").length).toBe(3);
    expect([...o.querySelectorAll(".paper .bb-legend > *")].map((e) => e.className)).toEqual(["legend-item", "legend-item", "legend-item", "bb-legend-note"]);
    expect(o.querySelectorAll(".bb-legend .legend-item > i.bb-legend-dot[data-lens]").length).toBe(3);
    const radarRow = d.querySelector(".paper .radar-row")!;
    expect([...radarRow.children].map((e) => e.tagName.toLowerCase() + "." + e.getAttribute("class"))).toEqual(["svg.svg-visible", "div.radar-side"]);
    expect(radarRow.querySelectorAll("text.radar-label").length).toBe(5);
    expect(radarRow.querySelectorAll("text:not(.radar-label), [font-size]").length).toBe(0);
    expect(radarRow.querySelectorAll(".radar-side > .radar-legend > .legend-item > i.radar-dot[data-lens]").length).toBe(3);
    const score = d.querySelector(".paper .score-track")!;
    expect([...new Set([...score.children].map((e) => e.className))]).toEqual(["score-line", "score-band", "score-val", "pt"]);
    expect(d.querySelectorAll(".paper .bb-verdict > span.nowrap").length).toBe(5);
    expect([...d.querySelectorAll(".paper .sheet-head")].map((h) => h.getAttribute("data-v"))).toEqual(["4", "2", "2", "8", "0", "0", null]); // the board's 4/2 · 2/8 · 0 · 0 + In their words
  });
  it("every route has exactly one h1", () => {
    for (const [board, , C, props] of BOARDS) expect(mount(C, props).querySelectorAll(H1).length, board).toBe(1);
    expect(mount(ReportDetailed, { phone: true }).querySelectorAll(H1).length).toBe(1);
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
  it("opted out: the gallery, never a lane screen", () => {
    expect(route(p("?screen=results&ui_next=off"), undefined, Object.keys(REGISTRY)).view).toBe("components");
  });
});

// Validator round 5 (VALIDATION-results-r5.md): R5-1 the live built report's lens spelling, R5-2 singular counts, R5-3 page
// counts, R5-5 the phone overview line counts what the sheet draws.
describe("results round 5: a live payload renders; counts read right", () => {
  type Ctx = { lenses: { lens: string }[]; cross_lens_multi: { construct_name: string; lens_scores: { lens: string; score: number }[] }[]; evidence: { label: string; n: number }[] };
  const contexts = (synthetic as unknown as { contexts: Record<string, Ctx> }).contexts;
  const ctx = contexts["assess_syn_earning-trust-2026-01"];
  it("lensKey maps every LENSES spelling and the short ids to team | community | church, anything else to null", () => {
    expect((LENSES as string[]).map((l) => lensKey(l))).toEqual(["team", "church", "community"]);
    for (const k of LENS_ORDER) expect([lensKey(k), lensKey(k.toUpperCase()), lensKey(` ${k} `)]).toEqual([k, k, k]);
    expect([lensKey("translation team"), lensKey("Consultant"), lensKey(""), lensKey(undefined), lensKey(3)]).toEqual(["team", null, null, null, null]);
  });
  it("R5-1: the synthetic built report (live spelling) gives three cards, counts from its evidence and areas on both sides", () => {
    expect(ctx.lenses.map((l) => l.lens)).toEqual(["Church", "Community", "Translation Team"]); // the live spelling, not the ids
    const cards = lensCards(ctx);
    expect(cards.map((c) => [c.lens, c.label, c.n])).toEqual([["team", "Translation team", 4], ["community", "Community", 6], ["church", "Church", 2]]);
    expect(cards.every((c) => c.rows.length > 0 && c.rows.every((r) => typeof r.items === "number"))).toBe(true);
    const n = responsesFor(ctx);
    expect([n("team"), n("community"), n("church")]).toEqual([4, 6, 2]);
    const names = ctx.cross_lens_multi.map((a) => a.construct_name);
    const rows = bandRows({ payload: ctx }, undefined, names);
    expect(rows.length).toBe(names.length);
    for (const r of rows) expect(r.perspectives).toBe(2);
    expect(rows.flatMap((r) => r.notes).filter((x) => x.endsWith("not asked")).length).toBe(names.length); // one lens not asked per area, not all three
    // Every context in the fixture renders a card for each lens it carries.
    for (const c of Object.values(contexts)) {
      const keys = c.lenses.map((l) => lensKey(l.lens)).filter(Boolean);
      expect(lensCards(c).map((x) => x.lens).sort()).toEqual([...keys].sort());
    }
    // The input is not changed; the canonical payload is cached per object.
    expect(ctx.lenses[0].lens).toBe("Church");
    expect(canonicalPayload(ctx)).toBe(canonicalPayload(ctx));
    expect(canonicalPayload(ctx).evidence.map((e: { label: string }) => e.label.split(" — ")[0]).sort()).toEqual(["church", "community", "team"]);
  });
  it("R5-1: Report and ReportDetailed render the live payload: three perspective cards with their counts", () => {
    const names = ctx.cross_lens_multi.map((a) => a.construct_name);
    const live = { ...REPORT.desktop, payload: ctx, counts: undefined, gaps: { biggest: names.slice(0, 3), agree: [] }, radar: names, lookNext: [] };
    const d = mount(ReportDetailed, { report: live });
    expect(all(d, ".paper .ev-card[data-lens] > .ev-head .small")).toEqual(["Filling up · 4 responses", "Well filled · 6 responses", "A few drops · 2 responses"]);
    expect(text(d)).not.toMatch(/null|undefined|NaN/);
    const r = mount(Report, { report: live });
    expect(r.querySelectorAll(".paper .sheet-tile[data-lens]").length).toBe(3);
    // CHECK-0940 P3: the paper head carries the coverage cue (drops + count) on each lens, not the bare count.
    expect(all(r, ".paper .sheet-tile[data-lens] > [data-coverage]")).toEqual(["Filling up · 4 responses", "Well filled · 6 responses", "A few drops · 2 responses"]);
    expect(all(d, ".paper .sheet-tile[data-lens] > [data-coverage]")).toEqual(["Filling up · 4 responses", "Well filled · 6 responses", "A few drops · 2 responses"]);
    expect(r.querySelectorAll(".paper .band-track").length).toBe(3);
  });
  it("R5-2: one response, singular, on the cards and the report heads", () => {
    expect([responsesText(1), responsesText(6), responsesText(null)]).toEqual(["1 response", "6 responses", "responses not counted"]);
    const D = churchAt(copy(), 1);
    D.counts = { ...D.counts, church: 1 };
    const cards = lensCards(D.payload, D.counts);
    const desk = render(LensCard as never, { props: { card: cards.find((c) => c.lens === "church") } }).container;
    expect(text(desk)).toContain("1 response");
    expect(text(desk)).not.toContain("1 responses");
    const none = render(LensCard as never, { props: { card: { ...cards[0], n: null }, phone: true } }).container;
    expect(text(none.querySelector(".h3"))).toBe("Translation team");
    expect(text(none.querySelector("[data-coverage]"))).toBe("responses not counted");
  });
  it("Codex P1 on 992b610: a built report's level and drops come from its own evidence; newer live answers are said apart", () => {
    const D = copy(); // the report used 6 / 8 / 4; since then the live surveys read 6 / 8 / 7
    D.counts = { team: 6, community: 8, church: 7 };
    const church = lensCards(D.payload, D.counts).find((c: { lens: string }) => c.lens === "church");
    expect([church.n, church.newer]).toEqual([4, 3]);
    const card = render(LensCard as never, { props: { card: church } }).container;
    expect(text(card.querySelector("[data-coverage]"))).toBe("Filling up · 4 responses");
    expect(text(card.querySelector("[data-newer]"))).toBe("3 newer responses not in this report yet");
    const res = mount(Results, { report: D });
    expect(all(res, ".glass[data-lens=church] [data-coverage]")).toEqual(["Filling up · 4 responses"]);
    expect(all(res, ".glass[data-lens=church] [data-newer]")).toEqual(["3 newer responses not in this report yet"]);
    // the printed report is the snapshot: its paper head counts what it used and never names the newer answers
    const rep = mount(Report, { report: D });
    expect(all(rep, ".paper .sheet-tile[data-lens=church] [data-coverage]")).toEqual(["Filling up · 4 responses"]);
    expect(text(rep)).not.toContain("newer response");
    // a live count no larger than the report's: nothing to say
    expect(lensCards(D.payload, REPORT.desktop.counts).every((c: { newer: number }) => c.newer === 0)).toBe(true);
    expect(render(LensCard as never, { props: { card: lensCards(D.payload, REPORT.desktop.counts)[0] } }).container.querySelector("[data-newer]")).toBeNull();
  });
  it("level minimum: the server's value decides; absent or unknown is the safe 3, never 1", () => {
    expect([useLevelMinimum(undefined), useLevelMinimum(null), useLevelMinimum("1"), useLevelMinimum(0), useLevelMinimum(1.5)]).toEqual([3, 3, 3, 3, 3]);
    // production-like (served 3): a perspective at 1 or 2 responses is held; at 3 it shows its level
    useLevelMinimum(3);
    expect([levelOf(80, 1), levelOf(80, 2), levelOf(80, 3)]).toEqual(["more", "more", "strong"]);
    expect(heldLines({ team: 1, community: 3, church: 0 }).map((l: { text: string }) => l.text)).toEqual(["Translation team 1 — needs 2 more", "Community 3 — ready", "Church 0 — needs 3 more"]);
    const D = churchAt(copy(), 2);
    expect(lensCards(D.payload, D.counts).find((c: { lens: string }) => c.lens === "church").level).toBe("more");
    const held = mount(ResultsHeld);
    expect(text(held)).toContain("Levels need at least 3 answers from a perspective. Church has 0 of 3.");
    // DEV (served 1): one response shows its level
    useLevelMinimum(1);
    expect([currentLevelMin(), levelOf(80, 1), levelOf(80, 0)]).toEqual([1, "strong", "more"]);
    expect(levelMinimumOf(undefined)).toBe(3);
  });
  it("Codex P2 4381562605: DEV, one response, three perspectives sent, two at zero: all three show; never-sent ones stay hidden", () => {
    // the built payload carries the one response-backed perspective only (the capture keeps response-backed members)
    const D = copy();
    D.payload.lenses = D.payload.lenses.filter((l) => l.lens === "team");
    D.payload.evidence = D.payload.evidence.filter((e) => e.label.startsWith("team")).map((e) => ({ ...e, n: 1 }));
    D.payload.cross_lens_multi = [];
    const R = { ...D, counts: { team: 1, community: 0, church: 0 }, sent: ["team", "community", "church"] };
    const cards = lensCards(R.payload, R.counts, { sent: R.sent });
    expect(cards.map((c: { lens: string; n: number; level: string; rows: unknown[] }) => `${c.lens}:${c.n}:${c.level}:${c.rows.length}`)).toEqual(["team:1:growing:5", "community:0:more:0", "church:0:more:0"]);
    // Results cards, the overview and detailed paper heads: the two at zero read More input needed beside "No drops yet · 0 responses"
    const res = mount(Results, { report: R });
    expect(all(res, ".glass[data-lens] [data-coverage]")).toEqual(["A few drops · 1 response", "No drops yet · 0 responses", "No drops yet · 0 responses"]);
    expect(all(res, ".glass[data-lens=church] .lvl-word")).toEqual(["More input needed"]);
    for (const C of [Report, ReportDetailed]) expect(all(mount(C, { report: R }), ".paper .sheet-tile[data-lens] > [data-coverage]")).toEqual(["A few drops · 1 response", "No drops yet · 0 responses", "No drops yet · 0 responses"]);
    // no score anywhere for them; the detailed report draws no empty evidence table
    const det = mount(ReportDetailed, { report: R });
    expect(det.querySelectorAll(".ev-card").length).toBe(1);
    // answers since the build are said apart on the Results card only
    expect(lensCards(R.payload, { team: 1, community: 2, church: 0 }, { sent: R.sent }).map((c: { newer: number }) => c.newer)).toEqual([0, 2, 0]);
    // a perspective never sent out stays hidden; without a survey list (fixtures, a static report) nothing is added
    expect(lensCards(R.payload, R.counts, { sent: ["team", "community"] }).map((c: { lens: string }) => c.lens)).toEqual(["team", "community"]);
    expect(lensCards(R.payload, R.counts).map((c: { lens: string }) => c.lens)).toEqual(["team"]);
    expect(sentLenses([{ perspective: "Translation Team", state: "selected" }, { perspective: "Community", state: "selected", archived_at: "2026-10-01" }, { perspective: "Church", state: "proposed" }])).toEqual(["team"]);
  });
  it("design-system.md §8.3 report frame: main.l-main[data-rhythm=report] holds the paper sheets as direct children (no Stack)", () => {
    for (const C of [Report, ReportDetailed]) {
      const main = mount(C).querySelector("main.l-main[data-rhythm=report]")!;
      const kids = [...main.children];
      expect(kids.length).toBeGreaterThan(0);
      expect(kids.every((k) => k.matches(".paper[data-sheet]"))).toBe(true);
    }
    expect(mount(Report, { phone: true }).querySelector("[data-rhythm=report]")).toBeNull(); // the phone Reports page is not paper
  });
  it("live QA Q1: the legend's radios set one shared imagery state on .app[data-imagery], persisted per viewer", async () => {
    const { imagery, setImagery } = await import("../ui-next/src/imagery.svelte.js");
    setImagery("bars");
    const a = mount(Results);
    expect(a.getAttribute("data-imagery")).toBe("bars");
    const faces = a.querySelector(".lvl-legend input[value=faces]") as HTMLInputElement;
    await fireEvent.change(faces, { target: { checked: true } });
    expect([imagery.skin, localStorage.getItem("ui_next_imagery")]).toEqual(["faces", "faces"]);
    await Promise.resolve();
    expect(a.getAttribute("data-imagery")).toBe("faces");
    expect(mount(ReportDetailed).getAttribute("data-imagery")).toBe("faces"); // one state for every screen
    expect(() => setImagery("dots")).toThrow(TypeError);
    setImagery("bars");
  });
  it("live QA Q2: scores and spreads show as whole numbers; the raw values keep the geometry", () => {
    expect([fmtScore(71.4286), fmtScore(70.5), fmtScore(0), fmtScore(null), fmtScore("x")]).toEqual(["71", "71", "0", "—", "—"]);
    const D = copy() as Built & { payload: { cross_lens_multi: { lens_scores: { lens: string; score: number }[] }[]; lenses: { sub_dimensions: { score: number }[] }[] } };
    D.payload.cross_lens_multi[0].lens_scores[0].score = 87.6667; D.payload.lenses[0].sub_dimensions[0].score = 83.25;
    const det = mount(ReportDetailed, { report: D });
    expect(text(det)).not.toMatch(/\d\.\d{2}/);
    expect(det.querySelector(".score-track > .pt[style='left: 87.6667%;']")).not.toBeNull(); // geometry keeps the raw value
  });
  it("live QA Q3 (design-system.md V-29): a perspective that skips a spoke is open lines per adjacent run, never a shape across the skip", () => {
    const shape = radar(REPORT.desktop, (REPORT.desktop as { radar: string[] }).radar, REPORT.desktop.counts);
    const com = shape.lenses.find((l: { lens: string }) => l.lens === "community");
    const team = shape.lenses.find((l: { lens: string }) => l.lens === "team");
    expect([team.closed, team.runs, com.closed, com.points]).toEqual([true, [], false, ""]);
    expect(com.skipped.length + com.marks.length).toBe(shape.spokes.length);
    for (const r of com.runs) expect(r.split(" ").length).toBeGreaterThan(1);
    // the runs join only adjacent scored spokes (wrapping past the last); a lone scored spoke is a marker only
    const idx = (xy: string) => com.marks.findIndex((m: { xy: string[] }) => m.xy.join(",") === xy);
    for (const r of com.runs) { const at = r.split(" ").map(idx).map((i: number) => shape.spokes.findIndex((sp: { name: string }) => sp.name === com.marks[i].area)); for (let j = 1; j < at.length; j++) expect((at[j] - at[j - 1] + shape.spokes.length) % shape.spokes.length).toBe(1); }
    const d = mount(ReportDetailed);
    const svg = d.querySelector("svg[role=img][aria-label^='Radar']")!;
    expect([svg.querySelectorAll("polygon[data-lens=community]").length, svg.querySelectorAll("polyline[data-lens=community]").length]).toEqual([0, com.runs.length]);
    expect(svg.querySelectorAll("polygon[data-lens=team]").length).toBe(1);
    expect(text(d.querySelector("p[data-skip=community]"))).toBe(`Community has no score for ${com.skipped.join(", ")}.`);
  });
  it("live QA Q10: no answer CSV yet; both CSV buttons are disabled and name the visible reason (no row-level disclosure)", () => {
    for (const phone of [false, true]) {
      const a = mount(ResultsAnswers, { phone });
      const why = a.querySelector("[id=csv-why]")!;
      expect(why.textContent).toContain("does not release answer-by-answer rows");
      const btns = [...a.querySelectorAll(".btn")].filter((b) => /CSV/.test(b.textContent ?? ""));
      expect(btns.length).toBe(1);
      for (const b of btns) expect([b.tagName, (b as HTMLButtonElement).disabled, b.getAttribute("aria-describedby")]).toEqual(["BUTTON", true, "csv-why"]);
      expect(a.querySelector("a[href='#csv']")).toBeNull();
    }
  });
  it("live QA Q11 (design-system.md Band-barbell label row): an HTML label row with the four full words under a 40px / 32px track", () => {
    const card = render(BandBar as never, { props: { row: bandRow(REPORT.desktop, REPORT.desktop.counts, "Clarity / naturalness") } }).container;
    const axis = card.querySelector("div.band-axis")!;
    expect([...axis.children].map((k) => k.className)).toEqual(["band-track", "band-labels"]);
    expect(axis.querySelector(".band-track > svg[data-part=band-barbell]")).not.toBeNull();
    expect(axis.querySelector(".band-labels")!.getAttribute("aria-hidden")).toBe("true");
    expect(all(axis, ".band-labels > span")).toEqual(["Needs urgent attention", "Needs support", "Growing", "Strong"]);
    expect(card.querySelector("svg text")).toBeNull(); // no SVG text ticks, so the words can wrap
    expect(card.querySelector("[style]")).toBeNull(); // no inline style on the box
    expect(card.querySelector("svg circle")!.getAttribute("cy")).toBe("20");
    const paper = render(BandBar as never, { props: { row: bandRow(REPORT.desktop, REPORT.desktop.counts, "Clarity / naturalness"), size: "paper" } }).container;
    // paper: the board's spans (design-system.md:861 @697c974d), .band-track > .band-line, three .band-sep, the .band-span, a .pt per placed perspective
    const track = paper.querySelector(".band-axis > .band-track")!;
    expect([...track.children].map((k) => k.className)).toEqual(["band-line", "band-sep", "band-sep", "band-sep", "band-span", "pt", "pt", "pt"]);
    expect([...track.querySelectorAll(".band-sep")].map((k) => k.getAttribute("style"))).toEqual(["left: 25%;", "left: 50%;", "left: 75%;"]);
    expect(paper.querySelector("svg")).toBeNull();
  });
  it("Codex P1 4382475714: report copy says what the served minimum makes true (footer clause, How to read the scores)", () => {
    for (const [min, foot, read] of [
      [1, "nothing here names a person; where one person from a perspective has answered, its level and scores reflect that person's answers", "Nothing in this report names a person, but while only one person from a perspective has answered, its level and scores reflect that person's answers."],
      [3, "nothing here identifies a person: a perspective shows only with at least 3 answers", "Nothing in this report identifies a person: a perspective's level and scores show only once at least 3 people from it have answered."],
    ] as const) {
      useLevelMinimum(min);
      expect(text(mount(Report).querySelector(".pfoot span"))).toContain(`levels are bands, not scores · ${foot}`);
      const d = mount(ReportDetailed);
      expect(text(d.querySelector(".pfoot span"))).toContain(`which are bands · ${foot}`);
      expect(text(d)).toContain(read);
    }
    useLevelMinimum(1);
  });
  it("live QA N4: one gap order everywhere; a same-band pair is never called a gap", () => {
    const D = REPORT.desktop;
    const rows = gapRows(D, D.counts);
    expect(rows.every((r: { apart: number; dots: unknown[] }) => r.apart >= 1 && r.dots.length >= 2)).toBe(true);
    expect(rows.map((r: { name: string }) => r.name)).toEqual(scoreRows(D, D.counts).filter((r: { spread: number | null; name: string }) => r.spread !== null && rows.some((g: { name: string }) => g.name === r.name)).map((r: { name: string }) => r.name));
    // a report whose shared areas all sit in one band: Results never calls one the most useful gap
    const flat = copy() as Built & { payload: { cross_lens_multi: { lens_scores: { score: number }[] }[] } };
    for (const a of flat.payload.cross_lens_multi) for (const sc of a.lens_scores) sc.score = 66;
    expect(gapRows(flat, flat.counts)).toEqual([]);
    const res = mount(Results, { report: flat });
    expect(text(res)).toContain("The perspectives sit in the same band on every area they share");
    expect(text(res)).not.toContain("most useful");
  });
  it("live QA N3: the disabled PDF reason never wraps out of the document bar; the bar does not print", () => {
    const src = readFileSync(resolve(__dirname, "../ui-next/src/screens/results/DocBar.svelte"), "utf8");
    expect(src).toContain('<span class="sr-only" id="doc-pdf-why">');
    expect(src).not.toContain('<span class="small" id="doc-pdf-why">');
    expect(readFileSync(resolve(__dirname, "../ui-next/components/topbar.css"), "utf8")).toContain("@media print{.app header.top[data-variant=document]{display:none}}");
  });
  it("R5-3 + R5-5: Results counts the detailed report's pages; the phone overview line counts the gaps the sheet draws, no radar", () => {
    expect(text([...mount(Results).querySelectorAll("a.btn")].find((a) => text(a).startsWith("Detailed report")) ?? null)).toBe(`Detailed report · ${detailedPages(lensCards(REPORT.desktop.payload, REPORT.desktop.counts))} pages`);
    expect(mount(Report, { phone: true }).textContent).toContain("Levels, the two biggest gaps."); // Brief & perceived fidelity is one band (Q15)
    const one = { ...REPORT.phone, gaps: { biggest: REPORT.phone.gaps.biggest.slice(0, 1), agree: [] } };
    expect(mount(Report, { phone: true, report: one }).textContent).toContain("Levels, the biggest gap.");
    const none = { ...REPORT.phone, gaps: { biggest: [], agree: [] } };
    const t = mount(Report, { phone: true, report: none }).textContent ?? "";
    expect(t).toContain("Levels.");
    expect(t).not.toMatch(/radar/i);
  });
});


// PR576 owner comment 6433135477 (QA-LIVE 2026-10-26 Q13, Q14, Q15): agreement is the same band among two or more placed perspectives;
// the gap headings count the gaps drawn; the paper counter is one unbroken column beside the full privacy clause.
describe("Q13–Q15: agreement, counted gaps, the paper counter", () => {
  type Area = { construct_name: string; lens_scores: { lens: string; score: number }[] };
  const area = (name: string, s: Record<string, number>): Area => ({ construct_name: name, lens_scores: Object.entries(s).map(([lens, score]) => ({ lens, score })) });
  const live = (cross: Area[], counts: Record<string, number>) => {
    const payload = { lenses: LENS_ORDER.map((lens) => ({ lens, score: 60, sub_dimensions: [] })), cross_lens_multi: cross };
    return liveReport({ review: { ...REPORT.desktop.review, title: "R" }, counts, payload }, { phone: false, screen: "results-gaps" });
  };
  const steve = (synthetic as unknown as { contexts: Record<string, unknown> }).contexts["assess_syn_strong-team-unconvinced-community-2026-09"];
  it("the Steve oracle (minimum 1): every compared area disagrees, so no agreement row and the neutral line; no row a band or more apart sits under agreement", () => {
    const r = liveReport({ review: { ...REPORT.desktop.review }, counts: undefined, payload: steve }, { phone: false, screen: "results-gaps" });
    expect(r.gaps.agree).toEqual([]);
    expect(r.gaps.biggest).toEqual(["Trust / Readiness", "Brief Process & Perceived Fidelity", "Clarity / Naturalness"]);
    const a = mount(ResultsGaps, { report: r });
    expect(all(a, "main h2.h2")).toEqual(["The three biggest gaps", "Where the perspectives share a band", "What this does not tell you"]);
    expect(text(a.querySelector("[data-agree-none]"))).toBe("No compared area has every placed perspective in the same band.");
    expect(a.querySelectorAll("main .glass.barbell-row").length).toBe(3);
    expect(text(a)).not.toContain("Understanding of the Source"); // 2 bands apart: the fourth gap, never an agreement row
  });
  it("mixed: only same-band areas with two or more placed perspectives agree; one band apart is a gap, not agreement; no >3-area minimum", () => {
    const r = live([area("Wide", { team: 85, community: 30 }), area("One band", { team: 76, community: 70 }), area("Same", { team: 62, community: 70 })], { team: 5, community: 5, church: 0 });
    expect(r.gaps).toEqual({ biggest: ["Wide", "One band"], agree: ["Same"] });
    const a = mount(ResultsGaps, { report: r });
    expect(all(a, "main h2.h2")).toEqual(["The two biggest gaps", "Where the perspectives share a band", "What this does not tell you"]);
    expect([...a.querySelectorAll("main .glass.barbell-row")].map((x) => x.getAttribute("aria-label"))).toEqual(["Wide", "One band", "Same"]);
    expect(a.querySelector("[data-agree-none]")).toBeNull();
  });
  it("exactly one gap: singular heading, phone intro and Results link; none: a count-free heading and the neutral lines", () => {
    const one = live([area("Wide", { team: 85, community: 30 }), area("Same", { team: 62, community: 70 })], { team: 5, community: 5, church: 0 });
    expect(all(mount(ResultsGaps, { report: one }), "main h2.h2")[0]).toBe("The biggest gap");
    expect(text(mount(ResultsGaps, { report: one, phone: true }).querySelector("[data-gap-lead]"))).toBe("The biggest gap between how the perspectives see the same thing.");
    expect(all(mount(Results, { report: one, phone: true }), "main > a.link")[0]).toBe("See the biggest gap");
    expect(text([...mount(Results, { report: one }).querySelectorAll("a.btn")].find((x) => /gap|Compare/.test(text(x))) ?? null)).toBe("See the biggest gap");
    const none = live([area("Same", { team: 62, community: 70 })], { team: 5, community: 5, church: 0 });
    const a = mount(ResultsGaps, { report: none });
    expect(all(a, "main h2.h2")[0]).toBe("Gaps between perspectives");
    expect(text(a.querySelector("[data-gap-none]"))).toBe("No compared area has two placed perspectives a band or more apart.");
    expect(a.querySelectorAll("main .glass.barbell-row").length).toBe(1);
    expect(all(mount(Results, { report: none, phone: true }), "main > a.link")[0]).toBe("Compare the perspectives");
  });
  it("held and unasked perspectives are not counted as agreement after suppression", () => {
    useLevelMinimum(3);
    try {
      // church has 1 answer (held): "Held pair" has one placed perspective (team) beside the held church in the same raw band; "Visible"
      // has team and community in one band with church held two bands away. Only "Visible" agrees, and church is never a dot.
      const r = live([area("Held pair", { team: 70, church: 72 }), area("Visible", { team: 62, community: 70, church: 10 }), area("Gap", { team: 90, community: 20 })], { team: 5, community: 5, church: 1 });
      expect(r.gaps).toEqual({ biggest: ["Gap"], agree: ["Visible"] });
      const a = mount(ResultsGaps, { report: r });
      const rows = [...a.querySelectorAll("main .glass.barbell-row")];
      expect(rows.map((x) => x.getAttribute("aria-label"))).toEqual(["Gap", "Visible"]);
      expect(rows[1].querySelectorAll("g[aria-label^='Church']").length).toBe(0);
      expect(text(rows[1])).toContain("Church more input needed");
    } finally { useLevelMinimum(1); }
  });
  it("the paper counter has its own nowrap class beside the full privacy text, on the overview and every detailed page", () => {
    const base = readFileSync(resolve(__dirname, "../ui-next/components/base.css"), "utf8");
    expect(base).toContain(".paper .pfoot .pn{flex:none;white-space:nowrap}");
    expect(base).toContain(".paper .pfoot .pf-text{flex:1 1 0;min-width:0}");
    const r = liveReport({ review: { ...REPORT.desktop.review }, counts: undefined, payload: steve }, { phone: false, screen: "report" });
    for (const el of [mount(Report, { report: r }), mount(ReportDetailed, { report: r })]) {
      const feet = [...el.querySelectorAll(".paper .pfoot")];
      expect(feet.length).toBeGreaterThan(0);
      for (const f of feet) {
        expect(f.querySelector(":scope > span.pn")).not.toBeNull();
        expect(text(f.querySelector(":scope > span.pn"))).toMatch(/^\d+ of \d+$/);
        expect(text(f.querySelector(":scope > span.pf-text"))).toContain(footPrivacy(1)); // the full minimum-1 clause, never shortened
      }
    }
  });
});

// lens-design-1332 HOLD (PR576 comment 6449509139): the document bar keeps a long title, the full status line and every control on
// one line inside the bar; only the title gives way (ellipsis), and its full text stays in its title attribute.
describe("document top bar fit (design-system.md Top bar variants · document bar fit)", () => {
  it("the title carries its full text as a title attribute; the status, switch, PDF and Print sit in .top-end; the contract CSS is in base.css", () => {
    const long = "Overview report · 1 page · Strong Team, Unconvinced Community — cycle 2026-09";
    const a = mount(Report, { report: { ...REPORT.desktop, review: { ...REPORT.desktop.review, title: "Strong Team, Unconvinced Community — cycle 2026-09" } } });
    const bar = a.querySelector("header.top[data-variant=document]")!;
    const h3 = bar.querySelector(":scope > .h3")!;
    expect(text(h3)).toBe(long);
    expect(h3.getAttribute("title")).toBe(long);
    expect(all(bar, ".top-end > span.small")).toEqual(["Two reports, built from the same answers."]);
    expect(all(bar, ".top-end .btn")).toEqual(["Open the detailed report · 4 pages", "Download this report (PDF)", "Print"]);
    const base = readFileSync(resolve(__dirname, "../ui-next/components/base.css"), "utf8");
    expect(base).toContain(".top[data-variant=document]>.h3{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}");
    expect(base).toContain(".top[data-variant=document] .top-end>*{flex:none;white-space:nowrap}");
    expect(base).not.toMatch(/(^|\})\.top>\.h3\{|(^|\})\.top \.h3\{[^}]*ellipsis/m); // scoped to the document variant only
  });
});
