// @vitest-environment jsdom
// UI Next (v4) explore lane screens of the screens fanout (status: provisional): Explore, Feedback, Help and their /next/ routes.
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md (lane explore).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Explore.dc.html, ExplorePhone.dc.html, ExploreFiltersPhone.dc.html,
// Feedback.dc.html, FeedbackPhone.dc.html, Help.dc.html, HelpPhone.dc.html; nesting design-system.md 8.1; dialogs "Dialog and sheet states".
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import Explore from "../ui-next/src/screens/explore/Explore.svelte";
import Feedback from "../ui-next/src/screens/explore/Feedback.svelte";
import Help from "../ui-next/src/screens/explore/Help.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import lane from "../ui-next/src/screens/explore/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { levelOf, stagePill, responsesText, exploreRows, phoneRows, feedbackAllowed, STAGE_PILL } from "../ui-next/src/screens/explore/explore-data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { TOPICS, FAQ, INTRO } from "../ui-next/src/screens/explore/help-copy.js";
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
  it("each screen refuses a state its boards do not draw", () => {
    expect(() => render(Explore, { props: { state: "cards" } })).toThrow(/unknown state/);
    expect(() => render(Explore, { props: { state: "filters" } })).toThrow(/phone board/);
    expect(() => render(Feedback, { props: { state: "busy" } })).toThrow(/one state/);
    expect(() => render(Help, { props: { state: "search" } })).toThrow(/one state/);
  });
});

describe("every board renders: light DOM, no inline style, one .btn-primary at most, nesting 8.1", () => {
  for (const [board, , C, props, primary] of BOARDS) {
    for (const theme of ["light", "dark"]) {
      it(`${board} (${theme})`, () => {
        const a = mount(C, { ...props, theme });
        expect(a.dataset.theme).toBe(theme);
        expect(a.dataset.w).toBe(props.phone ? "phone" : undefined);
        expect(a.querySelector("[style]")).toBeNull();
        expect(a.querySelector(props.phone ? "header.phone-top" : "header.top")).not.toBeNull();
        const primaries = [...a.querySelectorAll(".btn-primary")];
        expect(primaries.length).toBe(primary ? 1 : 0);
        if (primary) expect(text(primaries[0])).toBe(primary);
        if (primary && props.phone) expect(primaries[0].closest(".phone-bar")).not.toBeNull();
        for (const s of a.querySelectorAll("section.l-section")) expect(s.parentElement!.classList.contains("l-page")).toBe(true);
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
    expect([...a.querySelectorAll(".seg label")].map(text)).toEqual(["Cards", "Table"]);
    expect((a.querySelector(".seg input:checked") as HTMLInputElement).value).toBe("table");
    expect([...a.querySelectorAll(".chip")].map(text)).toEqual(["Workspace · BCS India", "Region · South Asia", "Stage · Collecting, Results ready", "Date · Last 12 months"]);
    expect([...a.querySelectorAll(".chip button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Remove Workspace filter", "Remove Region filter", "Remove Stage filter", "Remove Date filter"]);
    expect((a.querySelector("select[aria-label='Group by']") as HTMLSelectElement).value).toBe("Stage");
    expect([...a.querySelectorAll("th.th")].map(text)).toEqual(["Review", "Project", "Language", "Region", "Organisations", "Stage", "Responses", "Team", "Community", "Church", "Updated"]);
    const rows = [...a.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map(text));
    expect(rows.map((r) => r[0])).toEqual(["Mark 1–4 draft", "Luke 1–2 community review", "Workshop 2 · Luke 1", "Workshop 2 · Luke 1", "Mark 2 signed", "Genesis audio check"]);
    expect(rows.map((r) => r[5])).toEqual(["Collecting", "Results ready", "Collecting", "Collecting", "Results ready", "Setting up"]);
    expect(rows.map((r) => r[6])).toEqual(["18 / 30", "24", "9 / 24", "11 / 24", "15", "—"]);
    expect(rows.map((r) => r.slice(7, 10))).toEqual([["—", "—", "—"], ["Growing", "Needs support", "Growing"], ["—", "—", "—"], ["—", "—", "—"], ["Strong", "Growing", "More input needed"], ["—", "—", "—"]]);
    expect(rows.map((r) => r[10])).toEqual(["today", "12 Sep", "3 days ago", "3 days ago", "28 Sep", "26 Sep"]);
    expect(text(a)).toContain("6 of 23 reviews match · 3 projects · 4 languages");
    expect(text(a)).toContain("Nothing here identifies a participant.");
    expect([...a.querySelectorAll("button.mi")].map((b) => text(b.firstElementChild!))).toEqual(["Project", "Language", "Cluster", "Organisation involved", "Translation format", "Facilitator"]);
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
    const rows = [...a.querySelectorAll("a.card-link")];
    expect(rows.map((r) => text(r.querySelector(".h3")!))).toEqual(["Luke 1–2 community review", "Genesis audio check", "Mark 1–4 draft", "Acts listening review", "Psalms reading group"]);
    expect(rows.map((r) => text(r.querySelector(".lvl-name")!))).toEqual(["Growing", "Needs support", "More input needed", "Growing", "Strong"]);
    expect(rows.map((r) => text(r.querySelector(".small")!))).toEqual(["Hindi NT · Sep 2026", "Lao OT · Sep 2026", "Hindi NT · Oct 2026", "Hindi NT · Aug 2026", "Lao OT · Jul 2026"]);
    expect(text(a)).toContain("Save this view");
    expect(text(a)).toContain("Download CSV");
    expect(a.querySelector("dialog")).toBeNull();
    expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?screen=explore&w=phone&state=filters");
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
    expect(exploreRows(explore.reviews).map((r: { pill: string }) => r.pill)).toEqual(["collecting", "results", "collecting", "collecting", "results", "setup"]);
    expect(phoneRows(explore.phone.rows).map((r: { level: string }) => r.level)).toEqual(["growing", "support", "more", "growing", "strong"]);
  });
});

describe("Feedback (Feedback.dc.html dialog, FeedbackPhone.dc.html page)", () => {
  it("desktop: a native <dialog> named by its h2, three kinds, the first field focused, the optional feel group, the page line, Cancel and Send", () => {
    const a = mount(Feedback, {});
    const d = a.querySelector("dialog") as HTMLDialogElement;
    expect(d.open).toBe(true);
    expect(d.classList.contains("glass-hi")).toBe(true);
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`)!)).toBe("Send app feedback");
    expect(d.querySelector("a[aria-label='Close']")).not.toBeNull();
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
    expect(text(d)).toContain("Collect · Mark 1–4 draft · 0.30.5");
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
    expect(text(a.querySelector(".row-opt")!)).toBe("Include the screen name and app version");
    expect([...a.querySelectorAll(".phone-bar .btn")].map(text)).toEqual(["Cancel", "Send"]);
  });
  it("the fixture session passes the current UI's feedback gate (ui/assess/feedback.js load); the sample tour does not", async () => {
    expect(await feedbackAllowed(feedback.session)).toBe(true);
    expect(await feedbackAllowed({ ...feedback.session, demo: true })).toBe(false);
    expect(await feedbackAllowed({ demo: false, state: { principal: { kind: "anonymous" } } })).toBe(false);
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
    expect(qs.map((d) => text(d.querySelector(".disc-body")!))).toEqual(FAQ.map(([, ans]: string[]) => ans));
    expect(qs.every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
    expect(text(a)).toContain("Still stuck? Send app feedback, or read why 3D Review exists.");
    expect(a.querySelector("a[href='?screen=feedback']")).not.toBeNull();
    expect(a.querySelector("a[href='?screen=about']")).not.toBeNull();
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
    expect(about.getAttribute("href")).toBe("?screen=about&w=phone");
    expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?screen=feedback&w=phone");
  });
});

describe("rows from cookbook #191 (design-system.md 8.7) already on the markup, inert until a PIN bump brings them into base.css", () => {
  it("Explore: applied chips, inline view switch, compact group-by, scrolling table wrapper, trailing menu values; the sheet's menu padding, handle and title", () => {
    const a = mount(Explore, {});
    expect(a.querySelectorAll(".chip[data-on]").length).toBe(4);
    expect(a.querySelector(".seg[data-inline]")).not.toBeNull();
    expect(a.querySelector(".sel[data-size=compact] select")).not.toBeNull();
    expect(a.querySelector(".l-card .tbl-wrap > table.tbl")).not.toBeNull();
    expect(a.querySelectorAll("button.mi > .mi-end").length).toBe(6);
    const p = mount(Explore, { phone: true, state: "filters" });
    expect(p.querySelector(".chip[data-on]")).toBeNull();
    const d = p.querySelector("dialog.sheet[data-pad=menu]")!;
    expect(d.querySelector(".sheet-handle")!.getAttribute("aria-hidden")).toBe("true");
    expect(d.querySelector(".sheet-title")!.id).toBe(d.getAttribute("aria-labelledby"));
    expect(d.querySelectorAll("a.mi[data-size=lg]").length).toBe(10);
  });
  it("Feedback and Help: the dialog row and the 24px heading row", () => {
    expect(mount(Feedback, {}).querySelector("dialog.glass-hi.dialog h2.h2.t-24")).not.toBeNull();
    expect(mount(Help, {}).querySelectorAll("section.l-section[id] > h2.t-24").length).toBe(8);
  });
});

describe("lint: the explore lane's files are clean", () => {
  it("ui-next-lint finds nothing in screens/explore", () => {
    expect([...lintDir(resolve(__dirname, "../ui-next/src/screens/explore"))]).toEqual([]);
  });
});
