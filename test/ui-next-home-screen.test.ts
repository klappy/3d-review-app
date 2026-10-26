// @vitest-environment jsdom
// UI Next (v4) Home screen + /next/ router (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Home.dc.html, HomeFirst.dc.html, HomePhone.dc.html;
// nesting design-system.md 8.1; copy: sources/rachel-copy-2026-10-19/app-copy-edits.txt (C01-C12).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import Home, { COPY } from "../ui-next/src/screens/Home.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { route, flagOn } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";

const home = (props: Record<string, unknown>) => render(Home, { props }).container.querySelector(".app") as HTMLElement;
const STATES: [string, Record<string, unknown>][] = [["first", { state: "first" }], ["reviews", { state: "reviews" }], ["phone", { phone: true }]];
const LEVELS = new Set(["l-page", "l-section", "l-card", "l-stack", "l-row", "l-grid"]);
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("Home renders each state", () => {
  it("first run (HomeFirst): welcome, four phases, invitations card, old-site notice, no stage chips", () => {
    const a = home({ state: "first" });
    expect(a.querySelector("header.top")).not.toBeNull();
    expect(a.querySelector("h1.title-page")!.textContent).toBe("Your reviews");
    expect(a.querySelector(".display")!.textContent).toBe("Your first 3D Review takes about ten minutes to set up.");
    expect([...a.querySelectorAll(".num")].map((n) => n.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(a.textContent).toContain("Invited to a project already?");
    expect(a.textContent).toContain("Coming from the old 3D Review site?");
    expect(a.querySelector(".chip")).toBeNull();
    expect(a.querySelector(".pill")).toBeNull();
  });
  it("with reviews (Home): invitation, stage chips, three stage sections in need-you-first order, practice, completed hidden", () => {
    const a = home({ state: "reviews" });
    expect(a.textContent).toContain("Andy invited you to Odia New Testament");
    expect([...a.querySelectorAll("section.l-section > h2.h2")].map((h) => h.textContent)).toEqual(["Results ready", "Collecting", "Setting up", "Completed"]);
    expect([...a.querySelectorAll(".pill")].map((p) => p.getAttribute("data-stage"))).toEqual(["results", "collecting", "setup"]);
    expect([...a.querySelectorAll("a.card-link.glass")].map((c) => c.querySelector(".btn")!.textContent)).toEqual(["Read the results", "Share the survey", "Continue setup"]);
    // every action link ends in the arrow glyph, desktop (.btn) and phone (.link), as the boards draw "Share the survey →" (parity R60)
    const ph = home({ state: "reviews", phone: true });
    const links = [...ph.querySelectorAll("a.card-link span.link")];
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.lastElementChild?.querySelector("path")?.getAttribute("d")).toBe("M5 12h14M13 6l6 6-6 6");
    for (const b of a.querySelectorAll("a.card-link.glass .btn")) expect(b.lastElementChild?.tagName.toLowerCase()).toBe("svg");
    expect([...a.querySelectorAll(".lvl-name")].map((l) => l.textContent)).toEqual(["Growing", "Needs support", "Growing"]);
    // Codex P2 on 992b610: each level carries its respondent count, so a low-evidence level never shows bare
    expect([...a.querySelectorAll(".lvl-pair [data-coverage] [data-short]")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())).toEqual(["Well filled · 9", "Well filled · 10", "Filling up · 5"]);
    expect(a.querySelector("main .tag")!.textContent).toBe("Not yet reviewed");
    expect([...a.querySelectorAll("input.cb")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, true, false]);
    expect(a.querySelector("details:not(.dd)")!.hasAttribute("open")).toBe(false);
  });
  it("phone (HomePhone): phone header, cards in phone order, phone-bar holds the primary, no top bar", () => {
    const a = home({ phone: true });
    expect(a.getAttribute("data-w")).toBe("phone");
    expect(a.querySelector("header.top")).toBeNull();
    expect(a.querySelector(".phone-top[data-state=root]")).not.toBeNull();
    expect(a.querySelector("h1.title-phone")!.textContent).toBe("Your reviews");
    expect([...a.querySelectorAll(".pill")].map((p) => p.getAttribute("data-stage"))).toEqual(["collecting", "setup", "results"]);
    expect(a.querySelector(".phone-bar .btn-primary")!.textContent).toBe("Start a 3D Review");
    expect(() => render(Home, { props: { phone: true, state: "first" } })).toThrow(/phone board/);
  });
  it("dark theme sets data-theme on the shell; unknown state throws", () => {
    expect(home({ theme: "dark" }).getAttribute("data-theme")).toBe("dark");
    expect(() => render(Home, { props: { state: "empty" } })).toThrow(/unknown state/);
  });
});

describe("signed-in home keeps the public website home one visible link away (cookbook work/active/2026-10-26-3d-logged-in-home)", () => {
  it.each(STATES)("%s: a visible link to the public website home (#landing, the router's /welcome)", (_, props) => {
    const a = home(props);
    const link = a.querySelector("[data-website-home] a.link") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("#landing");
    expect(link.textContent).toBe("See the public website home");
  });
  it("the router resolves #landing to the public website home, and Home stays the signed-in root", async () => {
    // @ts-expect-error -- plain .js module, no type declarations
    const { parse } = await import("../ui-next/src/app/router.js");
    expect(parse("#landing").name).toBe("landing");
    expect(parse("#/").name).toBe("home");
  });
});

describe("nesting rule (8.1) and one primary per page", () => {
  for (const [name, props] of STATES) {
    it(`${name}: AppShell > Page > Section > Card > Stack/Row/Grid; no inline style; exactly one .btn-primary`, () => {
      const a = home(props);
      expect(a.matches(".app")).toBe(true);
      const main = a.querySelector(":scope > .layer.l-shell > main")!;
      expect(main).not.toBeNull();
      if (!props.phone) expect(main.querySelector(":scope > .l-page")).not.toBeNull();
      for (const s of a.querySelectorAll("section.l-section")) expect(s.parentElement!.classList.contains("l-page")).toBe(true);
      for (const c of a.querySelectorAll(".l-card")) {
        const up = c.parentElement!.closest(".l-page, .l-phone, .l-section, .l-grid, .l-stack")!;
        expect(up).not.toBeNull();
        expect(c.hasAttribute("style")).toBe(false);
      }
      // every layout element's parent level is a layout level or the shell main (no stray wrappers between levels)
      for (const el of a.querySelectorAll(".l-stack, .l-row, .l-grid")) expect(el.closest(".l-card, .l-page, .l-phone")).not.toBeNull();
      expect(a.querySelector("[style]")).toBeNull();
      expect(a.querySelectorAll(".btn-primary").length).toBe(1);
      expect(a.querySelector(".btn-primary")!.textContent).toBe("Start a 3D Review");
      expect([...a.querySelectorAll("div")].every((d) => [...d.classList].some((k) => LEVELS.has(k) || /^(app|layer|aurora|glass|glass-hi|menu|top-end|mi-head|phone-bar|l-shell)$/.test(k)) || d.closest("header, .menu"))).toBe(true);
    });
  }
});

describe("copy rows present verbatim (C01-C12)", () => {
  const src = readFileSync(resolve(__dirname, "fixtures/rachel-app-copy-edits.txt"), "utf8");
  const paras = src.split(/\n\s*\n/).map((p) => p.trim());
  it("the pinned source copy is Rachel's text (cookbook sources/rachel-copy-2026-10-19/app-copy-edits.txt)", () => {
    expect(paras[0]).toBe("Three perspectives. One useful next step.");
    expect(paras.length).toBe(16);
  });
  it("every pinned row is a source paragraph word for word; Home draws no Learn more (boards have none; Landing/About carry it)", () => {
    for (const k of ["C02", "C04", "C05", "C10", "C11"] as const) expect(paras).toContain(COPY[k]);
    for (const [, , cap] of COPY.C03) expect(paras.some((p) => p.endsWith(cap))).toBe(true);
    for (const k of ["C06", "C07", "C08"] as const) expect(paras).toContain(COPY[k].join(" "));
    expect(paras).toContain(COPY.C09[0]); expect(paras).toContain(COPY.C09[1]); expect(paras).toContain(COPY.C12[0]);
    for (const state of ["first", "reviews"]) {
      const a = home({ state });
      expect(a.querySelector("details.learn-more")).toBeNull();
      expect(a.textContent!).not.toContain(COPY.C02);
    }
  });
  it("C12 ships in full with the trajectory sentence (cookbook current-ui-copy RULING option 2); C01 is Landing's hero, not on Home", () => {
    const t = home({ state: "first" }).textContent!;
    expect(paras).toContain(COPY.C12[1]);
    expect(COPY.C12[1]).toMatch(/to create a trajectory$/);
    expect(t).not.toContain("Three perspectives. One useful next step.");
  });
});

describe("/next/ router and the ui_next flag", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("live by default (captain's ruling 2026-10-22, demo): bare /next/ is Home, with or without storage", () => {
    expect(route(p(""), store()).view).toBe("home");
    expect(route(p(""), undefined).view).toBe("home");
  });
  it("?ui_next=off stores the opt-out and shows the gallery; it persists; ?ui_next=on clears it", () => {
    const s = store();
    expect(route(p("?ui_next=off"), s).view).toBe("components");
    expect(route(p(""), s).view).toBe("components");
    expect(route(p("?ui_next=on"), s)).toEqual({ view: "home", props: { state: "reviews", phone: false, theme: "light" } });
    expect(route(p(""), s).view).toBe("home");
  });
  it("localStorage.ui_next === 'off' turns the gallery on; other values keep Home", () => {
    const s = store(); s.setItem("ui_next", "off"); expect(route(p(""), s).view).toBe("components");
    s.setItem("ui_next", "yes"); expect(route(p(""), s).view).toBe("home");
  });
  it("gallery pages stay reachable; state, phone and theme pass through", () => {
    const s = store();
    expect(route(p("?page=components"), s).view).toBe("components");
    expect(route(p("?page=layouts"), s).view).toBe("layouts");
    expect(route(p("?page=home"), s).view).toBe("home-parts");
    expect(route(p("?state=first&theme=dark"), s).props).toEqual({ state: "first", phone: false, theme: "dark" });
    expect(route(p("?w=phone&state=first"), s).props).toEqual({ state: "reviews", phone: true, theme: "light" });
  });
  it("explicit queries control this navigation without available persistence", () => {
    for (const unavailable of [undefined, null]) {
      expect(route(p("?ui_next=on&w=phone&theme=dark"), unavailable)).toEqual({
        view: "home", props: { state: "reviews", phone: true, theme: "dark" },
      });
      expect(flagOn(p("?ui_next=off"), unavailable)).toBe(false);
      expect(route(p(""), unavailable).view).toBe("home");
    }
    const ignoredWrites = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    expect(route(p("?ui_next=off"), ignoredWrites).view).toBe("components");
    expect(route(p(""), ignoredWrites).view).toBe("home");
    const stale = { getItem: () => "off", setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    expect(flagOn(p("?ui_next=on"), stale)).toBe(true);
  });
  it("a storage that throws falls back to the query alone", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    expect(route(p("?ui_next=on"), bad).view).toBe("home");
    expect(route(p(""), bad).view).toBe("home");
  });
});

describe("lint", () => {
  it("ui-next/ (screens and fixtures included) has zero violations", () => {
    expect(lintDir(resolve(__dirname, "../ui-next")).size).toBe(0);
  });
});
