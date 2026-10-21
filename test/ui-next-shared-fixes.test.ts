// @vitest-environment jsdom
// UI Next (v4) shared-file fixes the screens fanout lanes reported (status: provisional).
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/ (RESULTS-<lane>.md app-line findings; RESULTS-shared.md).
// Contract: design-system.md section 2 (Button row, Field and button states) and 8.1-8.2 (Page row, --sp-* steps).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import Menu from "../ui-next/src/Menu.svelte";
import Page from "../ui-next/src/Page.svelte";
import App from "../ui-next/src/App.svelte";
import Layouts from "../ui-next/src/Layouts.svelte";
import HomeParts from "../ui-next/src/HomeParts.svelte";
import Home from "../ui-next/src/screens/Home.svelte";
import About from "../ui-next/src/screens/About.svelte";
import Landing from "../ui-next/src/screens/Landing.svelte";

const read = (p: string) => readFileSync(resolve(process.cwd(), "ui-next", p), "utf8");
const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** Every [selector, declarations] pair of a flat stylesheet (rules inside @media included). */
const rules = (css: string) => [...noComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const).filter(([s]) => !s.startsWith("@"));
const dots = createRawSnippet(() => ({ render: () => `<svg data-i="dots"></svg>` }));

describe("a. type.css: an icon-only summary keeps the 44x44 target", () => {
  const type = rules(read("components/type.css"));
  const shrink = type.filter(([, d]) => /width:\s*max-content/.test(d)).map(([s]) => s);
  it("the max-content rule exists and never reaches .btn-icon (lanes: collect, people, actions, results)", () => {
    expect(shrink.length).toBeGreaterThan(0);
    const app = render(Menu, { props: { id: "m", summaryClass: "btn btn-icon", label: "More for this review", summary: dots, items: [] } }).container;
    const host = document.createElement("div"); host.className = "app"; host.append(...app.childNodes); document.body.append(host);
    try {
      const icon = host.querySelector("details > summary.btn.btn-icon")!;
      expect(icon).not.toBeNull();
      for (const s of shrink) expect(icon.matches(s), s).toBe(false);
      const text = document.createElement("details"); text.innerHTML = `<summary class="link small">Completed · 3</summary>`; host.append(text);
      expect(shrink.some((s) => text.querySelector("summary")!.matches(s))).toBe(true); // Home's text summary still shrinks to its label
    } finally { host.remove(); }
  });
  it("the helmet's .btn-icon width is the --target (44) and stays unbeaten", () => {
    expect(read("components/base.css")).toContain(".btn-icon{width:var(--target);padding:0}");
    expect(read("tokens.css")).toMatch(/--target:\s*44px/);
  });
});

describe("b. gallery.css applies to the gallery pages only (lanes explore, setup, results, actions)", () => {
  const gallery = rules(read("src/gallery.css"));
  /** Top-level selector list split (commas inside :where()/:has() stay). */
  const split = (sel: string) => { const out: string[] = []; let depth = 0, cur = ""; for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch; } return [...out, cur.trim()]; };
  const selectors = gallery.flatMap(([s]) => split(s));
  const SCREENS: [string, () => unknown][] = [
    ["Home", () => render(Home, { props: { state: "first" } })], ["Home reviews", () => render(Home, { props: { state: "reviews" } })], ["Home phone", () => render(Home, { props: { phone: true } })],
    ["About", () => render(About, {})], ["About phone", () => render(About, { props: { phone: true } })],
    ["Landing", () => render(Landing, {})], ["Landing phone", () => render(Landing, { props: { phone: true } })],
  ];
  it("no gallery.css selector matches anything on a screen (body included)", () => {
    expect(selectors.length).toBeGreaterThan(40);
    for (const [name, mount] of SCREENS) {
      mount();
      for (const s of selectors) expect(document.querySelectorAll(s).length, `${name}: ${s}`).toBe(0);
      document.body.innerHTML = "";
    }
  });
  it("screens get the contract: .small, .chip and .h2 have no gallery override, so a.link.small keeps .link's --primary (helmet order)", () => {
    for (const [s, d] of gallery) if (/(^|[\s,])\.app \.(chip|small|h2|h3|micro|kbd)\b/.test(s)) throw new Error(`unscoped gallery stand-in: ${s}{${d}}`);
    const helmet = noComments(read("components/base.css"));
    expect(helmet.indexOf("\n.small{")).toBeGreaterThan(0);
    expect(helmet.indexOf("\n.link{")).toBeGreaterThan(helmet.indexOf("\n.small{")); // same specificity, .link later: --primary wins
  });
  it("the gallery pages keep every stand-in: each scoped selector matches what the old .app prefix matched there", () => {
    const scoped = selectors.filter((s) => s.startsWith(".app:where(.gx-sheet, .gx-lay .app) "));
    expect(scoped.map((s) => s.split(" ").pop())).toEqual([".chip", ".h2", ".h3", ".small", ".micro", ".kbd"]);
    let hits = 0;
    for (const C of [App, Layouts, HomeParts]) for (const phone of [false, true]) {
      render(C, { props: { phone } });
      expect(document.querySelectorAll("body:has(.gx-bar)").length).toBe(1);
      for (const s of scoped) {
        const old = s.replace(".app:where(.gx-sheet, .gx-lay .app) ", ".app ");
        expect([...document.querySelectorAll(s)], s).toEqual([...document.querySelectorAll(old)]);
        hits += document.querySelectorAll(s).length;
      }
      document.body.innerHTML = "";
    }
    expect(hits).toBeGreaterThan(0);
  });
});

describe("d. Page gap={n} reads the --sp-n step (lane setup; design-system.md 8.1 Page row, 8.2)", () => {
  const css = noComments(read("components/base.css")) + noComments(read("components/layout.css"));
  const pageRules = rules(css).filter(([s]) => /^\.l-page(\[data-gap\])?$/.test(s));
  it(".l-page keeps --sp-5 by default and reads --g when the Page sets data-gap", () => {
    expect(pageRules.map(([s, d]) => [s, d.match(/gap:([^;}]+)/)?.[1]])).toEqual([[".l-page", "var(--sp-5)"], [".l-page[data-gap]", "var(--g)"]]);
    for (let n = 1; n <= 8; n++) expect(css).toContain(`[data-gap="${n}"]{--g:var(--sp-${n})}`);
  });
  it("layout.css loads after base.css, so the (0,2,0) data-gap rule is the one that applies", () => {
    const main = read("src/main.js");
    expect(main.indexOf(`"../components/layout.css"`)).toBeGreaterThan(main.indexOf(`"../components/base.css"`));
  });
  it("Page gap={7} renders data-gap=7 and matches the rule; a Page without gap does not", () => {
    for (const [props, gap] of [[{ gap: 7 }, "7"], [{ gap: 5 }, "5"], [{}, null]] as const) {
      const el = render(Page, { props }).container.querySelector(".l-page")!;
      expect(el.getAttribute("data-gap")).toBe(gap);
      expect(el.matches(".l-page[data-gap]")).toBe(gap !== null);
    }
  });
});

// c and e need no app change: the contract decides them (RESULTS-shared.md).
describe("c. breadcrumb separator stays the contract's \u203a (design-system.md section 2 R12 .crumb anatomy; boards still draw / until R3)", () => {
  it("topbar.css draws \u203a in --ink-3 from CSS and no / separator (R12; the boards' / waits on R3)", () => {
    const top = noComments(read("components/topbar.css"));
    expect(top).toContain('.crumb li+li::before{content:"\u203a";color:var(--ink-3)}');
    expect(top).not.toMatch(/content:\s*"\/"/);
  });
});
describe("e. the shared Pill still leaves closed out: whether closed is a stage is R8, captain-held (design-system.md 1.7 and section 4 R25)", () => {
  it("pinned in ui-next-pill.test.ts (refuses closed, V-09); the results lane keeps its StagePill until R8 is ruled", () => {
    expect(read("src/Pill.svelte")).not.toMatch(/closed:/);
  });
});
