// @vitest-environment jsdom
// UI Next (v4) shared slice 2: the round-3 validator yellows the lanes handed back to the shared files (status: provisional).
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/ (VALIDATION-participant-r3.md N1, VALIDATION-explore-r3.md R3-2,
// VALIDATION-setup-r3.md N2 N7 N8 DL-8; RESULTS-shared.md § Slice 2). Contract: design-system.md section 9 phone-bar, section 2 Disclosure,
// Field and button states (R16).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import Home from "../ui-next/src/screens/Home.svelte";
import About from "../ui-next/src/screens/About.svelte";
import Landing from "../ui-next/src/screens/Landing.svelte";

const read = (p: string) => readFileSync(resolve(process.cwd(), "ui-next", p), "utf8");
const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** Every [selector, declarations] pair of a flat stylesheet (rules inside @media included). */
const rules = (css: string) => [...noComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const).filter(([s]) => !s.startsWith("@"));

describe("B2. the phone bar stays in the thumb zone on every phone screen (section 9 phone-bar; participant N1, explore R3-2, setup DL-8)", () => {
  // The position rule is main's (638275c: phone.css .phone-bar sticky + .app.l-screen overflow clip, asserted in
  // test/ui-next-about-landing.test.ts); slice 2's position:fixed rule was dropped in the main sync. Sticky bottom:0 holds the bar
  // at the viewport foot only while it is the last in-flow child after the scrolling content, so the shell structure is pinned here.
  it("phone.css fixes .phone-bar and nothing else (design-system.md §9 phone-bar: fixed; no sticky rule left)", () => {
    expect(rules(read("components/phone.css")).filter(([, d]) => /position:\s*fixed/.test(d)).map(([s]) => s)).toEqual([".phone-bar"]);
    expect(rules(read("components/phone.css")).filter(([, d]) => /position:\s*sticky/.test(d))).toEqual([]);
    const main = read("src/main.js");
    expect(main.indexOf(`"../components/phone.css"`)).toBeGreaterThan(main.indexOf(`"../components/base.css"`));
  });
  const SCREENS: [string, () => unknown][] = [
    ["Landing phone", () => render(Landing, { props: { phone: true } })],
    ["Home phone", () => render(Home, { props: { phone: true } })],
    ["Home reviews phone", () => render(Home, { props: { phone: true, state: "reviews" } })],
    ["About phone", () => render(About, { props: { phone: true } })],
  ];
  it("each phone screen renders .app.l-screen[data-w=phone] > .layer.l-shell > main.l-phone + one .phone-bar, the bar last", () => {
    for (const [name, mount] of SCREENS) {
      mount();
      const bars = document.querySelectorAll(".phone-bar");
      expect(bars.length, name).toBe(1);
      const bar = bars[0];
      expect(bar.parentElement!.matches(".app.l-screen[data-w=phone] > .layer.l-shell"), name).toBe(true);
      expect(bar.previousElementSibling!.matches("main.l-page.l-phone"), name).toBe(true);
      expect(bar.nextElementSibling, name).toBeNull();
      expect(bar.querySelectorAll(".btn-primary").length, name).toBe(1);
      document.body.innerHTML = "";
    }
  });
  it("short pages: the phone screen is a viewport-tall flex column and the shell grows, so the bar lands at the foot (VALIDATION-integration B1)", () => {
    const phone = rules(read("components/phone.css"));
    const decl = (sel: string) => phone.filter(([s]) => s === sel).map(([, d]) => d).join(";");
    expect(decl(".app.l-screen[data-w=phone]")).toMatch(/(^|;)display:flex(;|$)/);
    expect(decl(".app.l-screen[data-w=phone]")).toMatch(/(^|;)flex-direction:column(;|$)/);
    expect(decl(".app.l-screen[data-w=phone]")).toMatch(/(^|;)min-height:100dvh(;|$)/);
    expect(decl(".app.l-screen[data-w=phone]>.l-shell")).toMatch(/(^|;)flex:1 0 auto(;|$)/);
    // phone only: no phone.css rule gives a desktop screen a flex or min-height shell (desktop pixels unchanged)
    expect(phone.filter(([s, d]) => /\.app\.l-screen(?!\[data-w=phone\])/.test(s) && /(display|min-height|flex)/.test(d))).toEqual([]);
    // what the bar's place rests on in the generated helmet: the shell is a column and main.l-phone takes the free space
    const base = rules(read("components/base.css"));
    expect(base.find(([s]) => s === ".l-shell")?.[1]).toMatch(/display:flex;flex-direction:column/);
    expect(base.find(([s]) => s === ".l-phone")?.[1]).toMatch(/flex-grow:1/);
    // the phone rule (0,3,0) outweighs type.css's .app.l-screen{min-height:100vh} (0,2,0), which loads after it
    expect(rules(read("components/type.css")).find(([s]) => s === ".app.l-screen")?.[1]).toMatch(/min-height:100vh/);
  });
  it("desktop screens render no phone bar", () => {
    for (const C of [Landing, Home, About]) {
      render(C, {});
      expect(document.querySelectorAll(".phone-bar").length).toBe(0);
      document.body.innerHTML = "";
    }
  });
});

/** Specificity (a, b, c) of one simple selector as these sheets write them; :where(...) counts zero. */
const spec = (sel: string): [number, number, number] => {
  const s = sel.replace(/:where\([^)]*\)/g, "").replace(/::[\w-]+/g, "");
  const a = (s.match(/#[\w-]+/g) ?? []).length;
  const b = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!where)[\w-]+(\([^)]*\))?/g) ?? []).length;
  const c = (s.replace(/\[[^\]]+\]/g, "").match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return [a, b, c];
};
const cmp = (x: number[], y: number[]) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

describe("B3. the phone disclosure padding never ties a generated row (setup N2: Setup4Phone inset; design-system.md 8.10)", () => {
  const disc = rules(read("components/disclosure.css"));
  const phone = disc.filter(([s]) => s.includes("data-w=phone"));
  it("the phone padding is written under :where() at (0,2,1), the desktop rule's weight, and comes after it", () => {
    expect(phone.map(([s]) => s)).toEqual([".app:where([data-w=phone]) details.disc"]);
    expect(spec(phone[0][0])).toEqual([0, 2, 1]);
    expect(spec(".app details.disc")).toEqual([0, 2, 1]);
    expect(disc.findIndex(([s]) => s === ".app details.disc")).toBeLessThan(disc.indexOf(phone[0]));
  });
  it("every base.css row that sets a details.disc padding out-weighs it, so the import order (base.css first) no longer decides", () => {
    const rows = rules(read("components/base.css")).filter(([s, d]) => /details\.disc(?![\w-])/.test(s) && /(^|;)\s*padding\s*:/.test(d)).flatMap(([s]) => s.split(","));
    expect(rows).toContain(".app .su-ctx details.disc");
    for (const r of rows) expect(cmp(spec(r.trim()), spec(phone[0][0])), r).toBeGreaterThan(0);
  });
  it("in a phone shell both selectors match the setup group disclosure; on desktop the phone rule does not", () => {
    document.body.innerHTML = `<div class="app" data-w="phone"><div class="su-ctx"><details class="disc"><summary class="disc-sum">x</summary></details></div></div><div class="app"><details class="disc"></details></div>`;
    const [ph, desk] = [...document.querySelectorAll("details.disc")];
    expect(ph.matches(phone[0][0]) && ph.matches(".app .su-ctx details.disc")).toBe(true);
    expect(desk.matches(phone[0][0])).toBe(false);
    document.body.innerHTML = "";
  });
});

describe("B5. the account menu's About link keeps theme and w (setup N8: Project dark lost theme=dark)", () => {
  it("TopBar renders the About row with href() from location.search", async () => {
    const { default: TopBar } = await import("../ui-next/src/TopBar.svelte");
    const before = location.href;
    history.replaceState(null, "", "?ui_next=on&screen=project&theme=dark");
    try {
      const top = render(TopBar, { props: { accountOpen: true } }).container;
      const about = [...top.querySelectorAll("a")].find((a) => a.textContent!.includes("Why 3D Review exists"))!;
      expect(about.getAttribute("href")).toBe("?ui_next=on&screen=about&theme=dark");
      expect(top.querySelector("a[href='?screen=about']")).toBeNull();
    } finally { history.replaceState(null, "", before); document.body.innerHTML = ""; }
  });
  it("no shared (non-lane) file under ui-next/src carries a literal ?screen= link", () => {
    expect(read("src/icons.js")).not.toMatch(/["'`]\?screen=/);
  });
});
