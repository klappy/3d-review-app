// @vitest-environment jsdom
// UI Next (v4) explore lane screens of the screens fanout (status: provisional): Explore, Feedback, Help and their /next/ routes.
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md (lane explore).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Explore.dc.html, ExplorePhone.dc.html, ExploreFiltersPhone.dc.html,
// Feedback.dc.html, FeedbackPhone.dc.html, Help.dc.html, HelpPhone.dc.html; nesting design-system.md 8.1; dialogs "Dialog and sheet states".
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLevelMinimum } from "../ui-next/src/screens/results/data.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import Explore from "../ui-next/src/screens/explore/Explore.svelte";
import Feedback, { cancelTo } from "../ui-next/src/screens/explore/Feedback.svelte";
import Help from "../ui-next/src/screens/explore/Help.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import lane from "../ui-next/src/screens/explore/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { levelOf, stagePill, responsesText, exploreRows, phoneRows, matchCounts, LENS_KEYS, STAGE_PILL } from "../ui-next/src/screens/explore/explore-data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { modal, backdropClose, closeTo } from "../ui-next/src/screens/explore/dialog.js";
// @ts-expect-error -- plain .js module, no type declarations
import { TOPICS, FAQ, INTRO, faqFor, topicsFor } from "../ui-next/src/screens/explore/help-copy.js";
// @ts-expect-error -- plain .js module, no type declarations
import { v3ScoreBand } from "../ui/assess/v3-assessment.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";
import explore from "../ui-next/fixtures/explore/explore.json";
import feedback from "../ui-next/fixtures/explore/feedback.json";

type P = Record<string, unknown>;
type C = typeof Explore;
const mount = (C: C, props: P) => render(C, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const p = (q: string) => new URLSearchParams(q);
const src = (f: string) => readFileSync(resolve(__dirname, "../ui-next/src/screens/explore", f), "utf8");

// Closing the filters sheet replaces the address (R3-1): put it back after every test so no test depends on another's order.
afterEach(() => window.history.replaceState(null, "", "/"));

// board -> [screen query, component, props, primary label or null (the board draws none)]
const BOARDS: [string, string, C, P, string | null][] = [
  ["Explore", "screen=explore", Explore, {}, null],
  ["ExplorePhone", "screen=explore&w=phone", Explore, { phone: true }, "Open the filters"],
  ["ExploreFiltersPhone", "screen=explore&w=phone&state=filters", Explore, { phone: true, state: "filters" }, "Open the filters"],
  ["Feedback", "screen=feedback", Feedback, {}, "Send"],
  ["FeedbackPhone", "screen=feedback&w=phone", Feedback, { phone: true }, "Send"],
  ["Help", "screen=help", Help, {}, null],
  ["HelpPhone", "screen=help&w=phone", Help, { phone: true }, "Send app feedback"],
];

describe("explore lane registry and /next/ routes", () => {
  it("registers explore, feedback and help (lowercase kebab, merged into the registry)", () => {
    expect(lane).toEqual({ explore: Explore, feedback: Feedback, help: Help });
    for (const name of Object.keys(lane)) expect(REGISTRY[name]).toBe(lane[name]);
  });
  for (const [board, q, C, props] of BOARDS) {
    it(`${board}: /next/?ui_next=on&${q} is reachable and mounts the lane component with the board's props`, () => {
      const r = route(p(`?ui_next=on&${q}`), store(), Object.keys(REGISTRY));
      expect(r.view).toBe(q.split("&")[0].slice("screen=".length));
      expect(REGISTRY[r.view]).toBe(C);
      expect(r.props).toEqual({ phone: !!props.phone, theme: "light", state: props.state });
      expect(route(p(`?ui_next=on&${q}&theme=dark`), store(), Object.keys(REGISTRY)).props.theme).toBe("dark");
    });
  }
  it("an unknown ?state= renders the default board, never throws; the filters sheet is the phone board's only", () => {
    const plain = (C: C, props: P) => mount(C, props).innerHTML.replace(/ data-theme="[^"]*"/, "");
    expect(plain(Explore, { state: "cards" })).toBe(plain(Explore, {}));
    expect(plain(Explore, { state: "filters" })).toBe(plain(Explore, {}));
    expect(mount(Explore, { phone: true, state: "nope" }).querySelector("dialog")).toBeNull();
    expect(mount(Explore, { phone: true, state: "filters" }).querySelector("dialog.sheet")).not.toBeNull();
    expect(mount(Feedback, { state: "busy" }).querySelector("dialog")).not.toBeNull();
    expect(mount(Help, { state: "search" }).querySelector("h1.title-page")).not.toBeNull();
    for (const q of ["screen=explore&state=%3Cx%3E", "screen=feedback&w=phone&state=1", "screen=help&state="]) {
      const r = route(p(`?ui_next=on&${q}`), store(), Object.keys(REGISTRY));
      expect(() => render(REGISTRY[r.view], { props: r.props })).not.toThrow();
    }
  });
});

describe("every board renders: light DOM, no inline style, one .btn-primary at most, nesting 8.1", () => {
  for (const [board, , C, props, primary] of BOARDS) {
    for (const theme of ["light", "dark"]) {
      it(`${board} (${theme})`, () => {
        const a = mount(C, { ...props, theme });
        expect(a.dataset.theme).toBe(theme);
        expect(a.querySelectorAll("h1").length).toBe(1);
        expect(a.dataset.w).toBe(props.phone ? "phone" : undefined);
        expect(a.querySelector("[style]")).toBeNull();
        expect(a.querySelector(props.phone ? "header.phone-top" : "header.top")).not.toBeNull();
        const primaries = [...a.querySelectorAll(".btn-primary")];
        expect(primaries.length).toBe(primary ? 1 : 0);
        if (primary) expect(text(primaries[0])).toBe(primary);
        if (primary && props.phone) expect(primaries[0].closest(".phone-bar")).not.toBeNull();
        // A Section sits in the Page, or in the Help article Stack the Help board composes (.l-grid[data-tpl=aside-start] > article.l-stack).
        for (const s of a.querySelectorAll("section.l-section")) expect(s.parentElement!.matches(".l-page, article.l-stack.l-measure")).toBe(true);
        for (const c of a.querySelectorAll(".l-card")) expect(c.parentElement!.closest(".l-page, .l-phone, .l-section, .l-grid, .l-stack, main")).not.toBeNull();
        for (const el of a.querySelectorAll(".l-stack, .l-row, .l-grid")) expect(el.closest(".l-card, .l-page, .l-phone, dialog")).not.toBeNull();
        for (const l of a.querySelectorAll("label[for]")) expect(a.querySelector(`#${l.getAttribute("for")}`)).not.toBeNull();
      });
    }
  }
});

describe("Explore (Explore.dc.html, ExplorePhone.dc.html, ExploreFiltersPhone.dc.html)", () => {
  it("desktop: title, the four filter chips, group-by, the eleven columns, six rows with board levels, the match line, the add-filter aside", () => {
    const a = mount(Explore, {});
    expect(text(a.querySelector("h1.title-page")!)).toBe("Explore reviews");
    expect(text(a)).toContain("Every review you can see, as one table. Filter by any cross-section; group or save the view.");
    expect([...a.querySelectorAll("main .seg label")].map(text)).toEqual(["Cards", "Table"]);
    expect((a.querySelector("main .seg input:checked") as HTMLInputElement).value).toBe("table");
    expect([...a.querySelectorAll(".chip")].map(text)).toEqual(["Workspace · BCS India", "Region · South Asia", "Stage · Collecting, Results ready", "Date · Last 12 months"]);
    expect([...a.querySelectorAll(".chip button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Remove Workspace filter", "Remove Region filter", "Remove Stage filter", "Remove Date filter"]);
    // R3-4: the rows are not grouped, so Group by says None rather than the board's "Stage"
    const group = a.querySelector("select[aria-label='Group by']") as HTMLSelectElement;
    expect(group.value).toBe("None");
    expect([...group.options].map((o) => o.text)).toEqual(["None", "Project", "Language", "Region", "Organisation", "Stage"]);
    expect([...a.querySelectorAll("th.th")].map(text)).toEqual(["Review", "Project", "Language", "Region", "Organisations", "Stage", "Responses", "Team", "Community", "Church", "Updated"]);
    const rows = [...a.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map(text));
    expect(rows.map((r) => r[0])).toEqual(["Mark 1–4 draft", "Luke 1–2 community review", "Workshop 2 · Luke 1", "Workshop 2 · Luke 1", "Mark 2 signed", "Genesis audio check"]);
    expect(rows.map((r) => r[5])).toEqual(["Collecting", "Results ready", "Collecting", "Collecting", "Results ready", "Setting up"]);
    expect(rows.map((r) => r[6])).toEqual(["18 / 30", "24", "9 / 24", "11 / 24", "15", "—"]);
    expect(rows.map((r) => r.slice(7, 10))).toEqual([["—", "—", "—"], ["Growing", "Needs support", "Growing"], ["—", "—", "—"], ["—", "—", "—"], ["Strong", "Growing", "More input needed"], ["—", "—", "—"]]);
    expect(rows.map((r) => r[10])).toEqual(["today", "12 Sep", "3 days ago", "3 days ago", "28 Sep", "26 Sep"]);
    expect(text(a)).toContain("6 of 23 reviews match · 4 projects · 5 languages"); // counted from the six rows (N4), not the board's literal
    expect(text(a)).toContain("Nothing here identifies a participant.");
    expect([...a.querySelectorAll("button.mi")].map((b) => text(b.firstElementChild!))).toEqual(["Project", "Language", "Cluster", "Organisation involved", "Translation format", "Facilitator"]);
    expect(text(a.querySelector("aside h2.h3")!)).toBe("Add a filter");
    expect(text(a)).toContain("Workspace and project are filters like any other. The Workspace and Project pages are the same table with those filters saved.");
    expect(a.querySelector("dialog")).toBeNull();
  });
  it("phone: title, count, chips, Filters · 4 / Sort / search, five review rows with their levels, save and download, no sheet", () => {
    const a = mount(Explore, { phone: true });
    expect(text(a.querySelector("h1.title-phone")!)).toBe("Explore");
    expect(text(a)).toContain("All reviews you can see · 23");
    expect([...a.querySelectorAll(".chip")].map(text)).toEqual(["BCS · India", "South Asia", "Results ready", "2026"]);
    expect(text(a)).toContain("Filters · 4");
    expect(a.querySelector("[aria-label='Search reviews']")).not.toBeNull();
    const rows = [...a.querySelectorAll("a.card-link.list-row")];
    expect(rows.map((r) => text(r.querySelector(".list-title")!))).toEqual(["Luke 1–2 community review", "Genesis audio check", "Mark 1–4 draft", "Acts listening review", "Psalms reading group"]);
    expect(rows.map((r) => text(r.querySelector(".lvl-name")!))).toEqual(["Growing", "Needs support", "More input needed", "Growing", "Strong"]);
    expect(rows.map((r) => text(r.querySelector(".small")!))).toEqual(["Hindi NT · Sep 2026", "Lao OT · Sep 2026", "Hindi NT · Oct 2026", "Hindi NT · Aug 2026", "Lao OT · Jul 2026"]);
    expect(text(a)).toContain("Save this view");
    expect(text(a)).toContain("Download CSV");
    expect(a.querySelector("dialog")).toBeNull();
    // live QA Q5: the filters cannot be served yet, so the primary is a disabled button named by the visible reason, never a no-op link
    const prim = a.querySelector(".phone-bar .btn-primary") as HTMLButtonElement;
    expect([prim.tagName, prim.disabled, prim.getAttribute("aria-describedby")]).toEqual(["BUTTON", true, "explore-why"]);
    expect(a.querySelector("#explore-why")!.textContent).toContain("not in the new design yet");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(Array(5).fill("?ui_next=on&screen=results&w=phone"));
  });
  it("filters (ExploreFiltersPhone): the sheet is an open native <dialog>, titled by its micro line, with the ten filter rows", () => {
    const a = mount(Explore, { phone: true, state: "filters" });
    const d = a.querySelector("dialog.sheet") as HTMLDialogElement;
    expect(d).not.toBeNull();
    expect(d.open).toBe(true);
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`)!)).toBe("Filters · tap to change, swipe a row left to remove");
    expect([...d.querySelectorAll("a.mi")].map(text)).toEqual(["Workspace · BCS · India", "Region · South Asia", "Stage · Results ready", "Date · 2026", "Project · any", "Language · any", "Cluster · any", "Organisation involved · any", "Translation format · any", "Facilitator · any"]);
    expect(d.querySelector(".btn-primary")).toBeNull();
  });
  it("filters: only a press that starts and ends on the backdrop closes the sheet; its own padding (F2) and a drag off a row (N3) do not", () => {
    const a = mount(Explore, { phone: true, state: "filters" });
    const d = a.querySelector("dialog.sheet") as HTMLDialogElement;
    d.getBoundingClientRect = () => ({ left: 0, top: 300, right: 390, bottom: 844, width: 390, height: 544, x: 0, y: 300, toJSON: () => ({}) });
    const fire = (el: Element, type: string, x: number, y: number) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    const press = (from: Element, x0: number, y0: number, x1: number, y1: number) => { fire(from, "pointerdown", x0, y0); fire(d, "click", x1, y1); };
    press(d, 195, 302, 195, 302); // the sheet's top padding: the target is the <dialog> itself, but inside its box
    expect(d.open).toBe(true);
    const row = d.querySelector("a.mi")!;
    fire(row, "pointerdown", 195, 340);
    fire(row, "click", 195, 340); // a row: the target is not the dialog
    expect(d.open).toBe(true);
    press(row, 195, 340, 195, 120); // pressed on a row, released over the backdrop: the click lands on the <dialog> outside its box (N3)
    expect(d.open).toBe(true);
    fire(d, "click", 195, 120); // a click with no press on the backdrop before it
    expect(d.open).toBe(true);
    press(d, 195, 120, 195, 120); // pressed and released on the backdrop above the sheet
    expect(d.open).toBe(false);
  });
  it("filters: closing the sheet (backdrop, Escape) replaces the address with the closed state, so Reload or Back does not reopen it (R3-1)", () => {
    const sheetUrl = "/next/?ui_next=on&screen=explore&w=phone&theme=dark&state=filters";
    const closed = "?ui_next=on&screen=explore&w=phone&theme=dark";
    window.history.replaceState(null, "", sheetUrl);
    try {
      const a = mount(Explore, { phone: true, state: "filters", theme: "dark" });
      const d = a.querySelector("dialog.sheet") as HTMLDialogElement;
      d.getBoundingClientRect = () => ({ left: 0, top: 300, right: 390, bottom: 844, width: 390, height: 544, x: 0, y: 300, toJSON: () => ({}) });
      const fire = (type: string) => d.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 195, clientY: 120 }));
      fire("pointerdown");
      fire("click"); // a press that starts and ends on the backdrop
      expect(d.open).toBe(false);
      expect(window.location.search).toBe(closed);
      window.history.replaceState(null, "", sheetUrl);
      d.dispatchEvent(new Event("close")); // Escape: the native cancel closes the dialog, which fires close
      expect(window.location.search).toBe(closed);
    } finally { window.history.replaceState(null, "", "/"); }
    const replace = vi.fn();
    closeTo("?ui_next=on&screen=explore", replace)();
    expect(replace).toHaveBeenCalledExactlyOnceWith("?ui_next=on&screen=explore");
    expect(src("Explore.svelte")).toMatch(/onclose=\{closeTo\(SELF\)\}/);
  });
  it("dialog.js: one modal() and one backdrop closer for both screens; neither screen keeps its own copy (N6)", () => {
    const box = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10 }), close: vi.fn() };
    const c = backdropClose();
    c.onpointerdown({ target: box, currentTarget: box, clientX: 50, clientY: 50 });
    expect(c.onclick({ target: box, currentTarget: box, clientX: 50, clientY: 50 })).toBe(true);
    expect(box.close).toHaveBeenCalledOnce();
    expect(c.onclick({ target: box, currentTarget: box, clientX: 50, clientY: 50 })).toBe(false); // each close needs its own press
    const el = document.createElement("dialog");
    el.showModal = () => { throw new Error("not connected"); };
    modal(el);
    expect(el.hasAttribute("open")).toBe(true);
    for (const f of ["Explore.svelte", "Feedback.svelte"]) {
      expect(src(f)).toMatch(/import \{[^}]*\bmodal\b[^}]*\} from "\.\/dialog\.js"/);
      expect(src(f)).not.toMatch(/const modal\s*=|\.showModal\(/);
    }
    expect(src("Explore.svelte")).toMatch(/\{#each LENS_KEYS as k\}/);
    expect(src("Explore.svelte")).not.toMatch(/\["team",\s*"community",\s*"church"\]/);
    expect(LENS_KEYS).toEqual(["team", "community", "church"]);
  });
  it("links carry the viewer's theme through the shared href() helper (screens/href.js)", () => {
    window.history.replaceState(null, "", "/next/?ui_next=on&screen=explore&w=phone&theme=dark");
    try {
      const a = mount(Explore, { phone: true, theme: "dark" });
      expect(a.querySelector("a.list-row")!.getAttribute("href")).toBe("?ui_next=on&screen=results&w=phone&theme=dark");
    } finally { window.history.replaceState(null, "", "/"); }
  });
});

describe("Explore data adapts through the current UI's level function (ui/assess/v3-assessment.js v3ScoreBand)", () => {
  it("levelOf maps v3ScoreBand's band words onto the Level keys; no report is null (the board's dash)", () => {
    expect(levelOf({ score: 75, responses: 3 })).toBe("strong");
    expect(levelOf({ score: 60, responses: 3 })).toBe("growing");
    expect(levelOf({ score: 40, responses: 3 })).toBe("support");
    expect(levelOf({ score: 39, responses: 3 })).toBe("urgent");
    expect(levelOf({ score: 90, responses: 2 })).toBe("more");
    expect(levelOf({ score: null, responses: 9 })).toBe("more");
    expect(levelOf(null)).toBeNull();
    for (const r of explore.reviews) for (const k of ["team", "community", "church"] as const) {
      const l = (r.lenses as Record<string, { score: number; responses: number }> | null)?.[k];
      if (l) expect({ strong: "Strong", growing: "Growing", support: "Needs support", urgent: "Needs urgent attention", more: "More input needed" }[levelOf(l) as string]).toBe(v3ScoreBand(l.score, l.responses));
    }
  });
  it("app stage ids map onto the Stage pill; responses read n / expected only when an expected count exists", () => {
    expect(STAGE_PILL).toEqual({ prepare: "setup", collect: "collecting", understand: "results", improve: "reviewed" });
    expect(() => stagePill("collecting")).toThrow(/unknown app stage/);
    expect([responsesText({ n: 18, expected: 30 }), responsesText({ n: 24 }), responsesText(null)]).toEqual(["18 / 30", "24", "—"]);
    expect([responsesText({ n: 0 }), responsesText({ n: 0, expected: 30 }), responsesText({ n: 1, expected: 30 })]).toEqual(["—", "—", "1 / 30"]); // N7: a dash before any response
    expect(exploreRows(explore.reviews).map((r: { pill: string }) => r.pill)).toEqual(["collecting", "results", "collecting", "collecting", "results", "setup"]);
    expect(phoneRows(explore.phone.rows).map((r: { level: string }) => r.level)).toEqual(["growing", "support", "more", "growing", "strong"]);
  });
  it("the match line counts the rows the table shows: reviews, distinct projects, distinct languages (N4)", () => {
    expect(matchCounts(exploreRows(explore.reviews))).toEqual({ reviews: 6, projects: 4, languages: 5 });
    expect(matchCounts([])).toEqual({ reviews: 0, projects: 0, languages: 0 });
    expect(explore).not.toHaveProperty("match");
  });
  it("the fixtures carry no provenance notes into the public /next/ bundle (N8): provenance lives in explore-data.js comments", () => {
    for (const f of [explore, feedback]) {
      expect(f).not.toHaveProperty("_");
      expect(JSON.stringify(f)).not.toMatch(/cookbook|RESULTS-|\.dc\.html|canvas/);
    }
    expect(src("explore-data.js")).toContain("ui-next/fixtures/explore/explore.json");
  });
});

describe("Feedback (Feedback.dc.html dialog, FeedbackPhone.dc.html page)", () => {
  it("desktop: a native <dialog> named by the route's one h1, three kinds, the first field focused, the optional feel group, the page line, Cancel and Send", () => {
    const a = mount(Feedback, {});
    const d = a.querySelector("dialog") as HTMLDialogElement;
    expect(d.open).toBe(true);
    expect(d.classList.contains("glass-hi")).toBe(true);
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`)!)).toBe("Send app feedback");
    expect(a.querySelector(`#${d.getAttribute("aria-labelledby")}`)!.matches("h1.h2.t-24")).toBe(true);
    expect(d.querySelector("a[aria-label='Close']")!.getAttribute("href")).toBe("?ui_next=on&screen=home");
    expect(text(d)).toContain("Tell us what happened and what would help. It reaches the team with the page you were on.");
    const segs = [...d.querySelectorAll(".seg")];
    expect([...segs[0].querySelectorAll("label")].map(text)).toEqual(["Something is wrong", "Something is confusing", "An idea"]);
    expect((segs[0].querySelector("input:checked") as HTMLInputElement).value).toBe("Something is wrong");
    expect(text(d.querySelector("label[for='feedback-what']")!)).toBe("What happened?");
    expect(d.querySelector("#feedback-what")!.getAttribute("placeholder")).toBe("I tried to … and …");
    expect(d.querySelector("#feedback-what")!.hasAttribute("autofocus")).toBe(true);
    const feel = d.querySelector("[role=group]")!;
    expect(text(a.querySelector(`#${feel.getAttribute("aria-labelledby")}`)!)).toBe("How did it feel? (optional)");
    expect([...segs[1].querySelectorAll("label")].map(text)).toEqual(["Frustrating", "Confusing", "Fine", "Helpful"]);
    expect((segs[1].querySelector("input:checked") as HTMLInputElement).value).toBe("Confusing");
    expect(text(d)).toContain("Collect · Mark 1–4 draft");
    expect(text(d)).toContain("Cancel");
    expect(text(d.querySelector(".btn-primary")!)).toBe("Send");
  });
  it("phone: a full page (no dialog) with the note, what it is about, the include line, and Cancel + Send in the phone-bar", () => {
    const a = mount(Feedback, { phone: true });
    expect(a.querySelector("dialog")).toBeNull();
    expect(text(a.querySelector(".phone-title")!)).toBe("Send app feedback");
    expect(text(a.querySelector("h1.title-phone")!)).toBe("App feedback");
    expect(text(a.querySelector("label[for='feedback-note']")!)).toBe("What happened, or what would help?");
    expect(a.querySelector("#feedback-note")!.getAttribute("placeholder")).toBe("Tell us in your own words");
    expect(text(a.querySelector("label[for='feedback-about']")!)).toBe("What is it about?");
    expect([...a.querySelectorAll("#feedback-about option")].map(text)).toEqual(["This screen", "Results", "Sharing and paper", "Something else"]);
    expect((a.querySelector(".row-opt input.cb") as HTMLInputElement).checked).toBe(true);
    expect(text(a.querySelector(".row-opt")!)).toBe("Include the screen name");
    expect([...a.querySelectorAll(".phone-bar .btn")].map(text)).toEqual(["Cancel", "Send"]);
  });
  it("Escape (the dialog's cancel) goes Home like Close and Cancel, instead of leaving an empty page (F3)", () => {
    const nav = vi.fn();
    const e = new Event("cancel", { cancelable: true });
    cancelTo("?ui_next=on&screen=home", nav)(e);
    expect(e.defaultPrevented).toBe(true);
    expect(nav).toHaveBeenCalledWith("?ui_next=on&screen=home");
    expect(src("Feedback.svelte")).toMatch(/<dialog class="glass-hi"[^>]*oncancel=\{cancelTo\(HOME\)\}/);
  });
  it("no version string on screen (design-lens@1 rule 5; N2): the page line names the page and review only, and nothing imports package.json", () => {
    for (const props of [{}, { phone: true }]) expect(text(mount(Feedback, props))).not.toMatch(/\d+\.\d+\.\d+/);
    expect(JSON.stringify(feedback)).not.toMatch(/\d+\.\d+\.\d+/);
    for (const f of ["explore-data.js", "Feedback.svelte", "Explore.svelte", "Help.svelte"]) expect(src(f)).not.toMatch(/package\.json"|version\.(generated|ts)|APP_VERSION/);
  });
  it("the feedback gate is not imported into the /next/ bundle until a board draws its not-allowed state (F4)", () => {
    expect(src("explore-data.js")).not.toMatch(/import[^;]*ui\/assess\/feedback\.js/);
  });
});

describe("Help (Help.dc.html, HelpPhone.dc.html)", () => {
  const TITLES = ["What 3D Review is", "The three perspectives", "Running a review", "Sharing and paper surveys", "Reading results", "Privacy", "What changed"];
  it("desktop: title, intro, section nav whose links all land, video, seven topics with the board's words, eleven questions, the closing links", () => {
    const a = mount(Help, {});
    expect(text(a.querySelector("h1.title-page")!)).toBe("Help and FAQ");
    expect(text(a)).toContain(INTRO);
    const nav = [...a.querySelectorAll("nav[aria-label='Help sections'] a")];
    expect(nav.map(text)).toEqual([...TITLES, "Common questions"]);
    for (const l of nav) expect(a.querySelector(l.getAttribute("href")!)).not.toBeNull();
    expect(text(a.querySelector(".l-media")!)).toContain("What 3D Review is · 2:10");
    expect(text(a.querySelector(".l-media")!)).toContain("Also: The three perspectives (1:40) · Running a review (3:05)");
    expect([...a.querySelectorAll("section.l-section[id] > h2")].map(text)).toEqual([...TITLES, "Common questions"]);
    expect([...a.querySelectorAll("#h2 strong")].map(text)).toEqual(["translation team", "community", "church"]);
    for (const [id, , runs] of TOPICS) expect(text(a.querySelector(`#${id} p`)!)).toBe(runs.join(""));
    const qs = [...a.querySelectorAll("#h8 details.disc")];
    expect(qs.map((d) => text(d.querySelector("summary")!))).toEqual(FAQ.map(([q]: string[]) => q));
    expect(qs.map((d) => text(d.querySelector(".disc-body")!))).toEqual(faqFor().map(([, ans]: string[]) => ans));
    // The answers-needed FAQ follows the served level minimum: absent (this test) is the safe 3; DEV 1 reads "its first answer";
    // no "nobody can be picked out" promise either way
    const need = (rows: string[][]) => rows.find(([q]) => q === "How many answers do we need?")![1];
    const TAIL = " The drops beside each level show how much evidence it rests on: a few drops is little evidence, not a low result. Answer-by-answer splits are not shown.";
    expect(need(FAQ)).toBe(`A perspective shows its level once it has at least 3 answers.${TAIL}`);
    expect(need(faqFor(3))).toBe(`A perspective shows its level once it has at least 3 answers.${TAIL}`);
    expect(need(faqFor(5))).toBe(`A perspective shows its level once it has at least 5 answers.${TAIL}`);
    expect(need(faqFor(1))).toBe(`A perspective shows its level from its first answer.${TAIL}`);
    useLevelMinimum(1);
    const dev = [...mount(Help, {}).querySelectorAll("#h8 details.disc")].map((d) => text(d.querySelector(".disc-body")!));
    expect(dev).toContain(`A perspective shows its level from its first answer.${TAIL}`);
    useLevelMinimum(undefined);
    expect(FAQ.flat().join(" ")).not.toMatch(/At least 3 from each perspective|picked out/);
    // design-system.md section 4 Privacy topic: the minimum-1 and minimum >= 3 variants, by the served minimum (Codex P1 4381711859)
    const priv = (rows: unknown[][]) => (rows.find((t) => t[0] === "h6")![3] as string);
    expect(priv(topicsFor(1))).toBe("Your answers are confidential. Results never show names. A perspective's level shows from its first answer, so while only one person from a perspective has answered, its level and the detailed report's scores reflect that one person's answers. Printed surveys and QR codes carry nothing personal.");
    expect(priv(topicsFor(3))).toBe("Your answers are confidential. When fewer than 3 people from one perspective have answered, their results are hidden and the page says so; no number is shown that could point to someone. Printed surveys and QR codes carry nothing personal.");
    expect(priv(TOPICS as unknown[][])).toBe(priv(topicsFor(3)));
    expect([...faqFor(1), ...faqFor(3)].flat().join(" ")).not.toMatch(/splits (still )?wait|splits with|unlock/);
    useLevelMinimum(1);
    const hm = mount(Help, {});
    const h6 = [...hm.querySelectorAll("section")].find((x) => x.id === "h6")?.querySelector("p") ?? null;
    useLevelMinimum(undefined);
    expect(h6 && text(h6)).toBe(priv(topicsFor(1)));
    expect(qs.every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
    expect(text(a)).toContain("Still stuck? Send app feedback, or read why 3D Review exists.");
    const hrefs = [...a.querySelectorAll("main a.link")].map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("?ui_next=on&screen=feedback");
    expect(hrefs).toContain("?ui_next=on&screen=about");
  });
  it("phone: chip nav, seven topic rows (the first open) with the phone words, Common questions · 11, the about link, Send app feedback in the bar", () => {
    const a = mount(Help, { phone: true });
    expect(text(a.querySelector(".phone-title")!)).toBe("Help and FAQ");
    expect(text(a.querySelector("h1.title-phone")!)).toBe("Help and FAQ");
    const nav = [...a.querySelectorAll("nav[aria-label='Help sections'] a.chip")];
    expect(nav.map(text)).toEqual([...TITLES, "Common questions"]);
    for (const l of nav) expect(a.querySelector(l.getAttribute("href")!)).not.toBeNull();
    const topics = TOPICS.map(([id]: string[]) => a.querySelector(`#${id} details.disc`) as HTMLDetailsElement);
    expect(topics.map((d) => text(d.querySelector("summary")!))).toEqual(TITLES);
    expect(topics.map((d) => d.open)).toEqual([true, false, false, false, false, false, false]);
    expect(topics.map((d) => text(d.querySelector(".disc-body")!))).toEqual(TOPICS.map(([, , , phone]: string[]) => phone));
    expect(text(a.querySelector("h2#h8.micro")!)).toBe("Common questions · 11");
    expect(a.querySelectorAll("details.disc").length).toBe(7 + 11);
    const about = [...a.querySelectorAll("a.link")].find((l) => text(l) === "Read why 3D Review exists")!;
    expect(about.getAttribute("href")).toBe("?ui_next=on&screen=about&w=phone");
    expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=feedback&w=phone");
  });
});

describe("the pinned 8.7 Explore-lane rows (ui-next/design-source/PIN a594830, base.css) carry the layout (F1 and the pending #191 rows)", () => {
  const css = readFileSync(resolve(__dirname, "../ui-next/components/base.css"), "utf8");
  it("base.css at the PIN has every row the lane composes with", () => {
    for (const r of [".l-grid[data-tpl=aside-end]{grid-template-columns:minmax(0,1fr) 300px", ".l-grid[data-tpl=aside-start]{grid-template-columns:260px minmax(0,1fr)", ".l-measure{max-width:720px}", ".side-nav{position:sticky", ".l-card[data-pad=table]{", ".tbl-wrap{overflow-x:auto}", ".tbl-foot{", ".l-card[data-pad=bar]{", ".l-card[data-pad=rows]{", ".list-row{", ".list-title{", ".menu[data-flow]{", ".mi-end{margin-left:auto}", ".chip[data-on]{", ".sel[data-size=compact]{", ".seg[data-inline]{", ".l-media[data-dir=row]{", ".app .t-24", "dialog.glass-hi{", "dialog.glass-hi::backdrop{", "dialog.glass-hi.sheet{", ".sheet[data-pad=menu],dialog.glass-hi.sheet[data-pad=menu]{", ".sheet-handle{", ".mi[data-size=lg]{"]) expect(css, r).toContain(r);
  });
  it("live QA Q5: every control the explore model cannot serve is disabled and names the visible reason; the table stays live", () => {
    const a = mount(Explore, {});
    const why = a.querySelector("#explore-why")!;
    expect(why.textContent).toContain("not in the new design yet");
    const ctl = [...a.querySelectorAll("button, select, input[value=cards]")].filter((e) => !e.closest("header"));
    expect(ctl.length).toBeGreaterThan(5);
    for (const c of ctl) expect([(c as HTMLButtonElement).disabled, c.getAttribute("aria-describedby") ?? c.closest("[aria-describedby]")?.getAttribute("aria-describedby")]).toEqual([true, "explore-why"]);
    expect(a.querySelectorAll("table.tbl tbody tr").length).toBeGreaterThan(0);
  });
  it("Explore desktop: table + 300px aside grid; the bar and table cards; the table scrolls inside its card (.tbl-wrap), its foot inside it", () => {
    const a = mount(Explore, {});
    const grid = a.querySelector(".l-page > .l-grid[data-tpl=aside-end]")!;
    expect([...grid.children].map((c) => c.tagName.toLowerCase())).toEqual(["div", "aside"]);
    expect(grid.querySelector(".glass.l-card.l-row[data-pad=bar][data-split][data-wrap]")).not.toBeNull();
    const card = grid.querySelector("section.glass.l-card.tbl-wrap[data-pad=table]")!;
    expect(card.getAttribute("tabindex")).toBe("0");
    expect(card.querySelector(":scope > table.tbl")).not.toBeNull();
    expect(text(card.querySelector(":scope > .l-row.tbl-foot")!)).toContain("Nothing here identifies a participant.");
    expect(a.querySelectorAll(".chip[data-on]").length).toBe(4);
    expect(a.querySelector(".seg[data-inline]")).not.toBeNull();
    expect(a.querySelector(".sel[data-size=compact] select")).not.toBeNull();
    expect(a.querySelectorAll("aside .glass-hi.menu[data-flow] > button.mi > .mi-end").length).toBe(6);
    expect(a.querySelector("[role=menu], [role=menuitem]")).toBeNull(); // V-44: an in-page list of buttons, not a menu widget
    expect(a.querySelector("td > b")).toBeNull(); // the first column's weight is the .tbl row's
    expect(a.querySelectorAll("td .micro").length).toBe(12);
  });
  it("Explore phone: the rows card (.l-card[data-pad=rows]) of list rows; the sheet's menu padding, handle, title and 52px rows", () => {
    const a = mount(Explore, { phone: true });
    const rows = [...a.querySelectorAll("section.glass.l-card[data-pad=rows] > a.card-link.list-row")];
    expect(rows.length).toBe(5);
    for (const r of rows) expect([...r.children].map((c) => c.className)).toEqual(["icn icn-row", "list-body", "lvl"]);
    expect(a.querySelectorAll(".l-row > .btn.btn-block").length).toBe(3);
    const d = mount(Explore, { phone: true, state: "filters" }).querySelector("dialog.glass-hi.sheet[data-pad=menu]")!;
    expect(d.querySelector(".sheet-handle")!.getAttribute("aria-hidden")).toBe("true");
    expect(d.querySelector(".sheet-title")!.id).toBe(d.getAttribute("aria-labelledby"));
    expect(d.querySelectorAll("a.mi[data-size=lg]").length).toBe(10);
  });
  it("Help desktop: sticky side nav + 720 article on .l-grid[data-tpl=aside-start]; the row-form media card; 24px headings", () => {
    const a = mount(Help, {});
    const grid = a.querySelector(".l-page > .l-grid[data-tpl=aside-start][data-gap='7']")!;
    expect([...grid.children].map((c) => `${c.tagName.toLowerCase()}.${c.className}`)).toEqual(["nav.glass side-nav", "article.l-stack l-measure"]);
    const nav = [...grid.querySelectorAll("nav.side-nav > a.link")];
    expect(nav.length).toBe(8);
    expect(nav.map((l) => l.getAttribute("aria-current"))).toEqual(["location", null, null, null, null, null, null, null]); // no hash: the top, the first topic
    expect(a.querySelector("article > .glass-hi.l-media[data-dir=row] > .l-media-frame")).not.toBeNull();
    expect(a.querySelectorAll("article > section.l-section[id] > h2.h2.t-24").length).toBe(8);
    expect(a.querySelector(".chip")).toBeNull();
  });
  it("Help desktop: the side nav's aria-current follows the address (hashchange), not the first link for ever (N5)", () => {
    window.history.replaceState(null, "", "/next/?ui_next=on&screen=help#h3");
    try {
      const a = mount(Help, {});
      const cur = () => [...a.querySelectorAll("nav.side-nav > a[aria-current=location]")].map((l) => l.getAttribute("href"));
      expect(cur()).toEqual(["#h3"]);
      window.history.replaceState(null, "", "/next/?ui_next=on&screen=help#h8");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      flushSync();
      expect(cur()).toEqual(["#h8"]);
      window.history.replaceState(null, "", "/next/?ui_next=on&screen=help#not-a-section");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      flushSync();
      expect(cur()).toEqual(["#h1"]);
    } finally { window.history.replaceState(null, "", "/"); }
  });
  it("Help phone: two rows cards of V-12 Disclosures (details.disc, not the menu's .dd)", () => {
    const a = mount(Help, { phone: true });
    const cards = [...a.querySelectorAll("section.glass.l-card[data-pad=rows]")];
    expect(cards.map((c) => c.querySelectorAll("details.disc").length)).toEqual([7, 11]);
    expect(a.querySelector("details.dd")).toBeNull();
  });
  it("Feedback: the shared dialog row and the 24px heading row", () => {
    expect(mount(Feedback, {}).querySelector("dialog.glass-hi h1.h2.t-24")).not.toBeNull();
  });
});

describe("lint: the explore lane's files are clean", () => {
  it("ui-next-lint finds nothing in screens/explore", () => {
    expect([...lintDir(resolve(__dirname, "../ui-next/src/screens/explore"))]).toEqual([]);
  });
});
