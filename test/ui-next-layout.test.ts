// @vitest-environment jsdom
// UI Next (v4) layout primitives (design-system.md section 8, status: provisional).
// Unit: 3d-review-cookbook work/active/2026-10-20-ui-next-layout-primitives/TICKET.md Do 3.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent } from "@testing-library/svelte";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintText, lintDir } from "../scripts/ui-next-lint.mjs";
import Page from "../ui-next/src/Page.svelte";
import Stack from "../ui-next/src/Stack.svelte";
import Row from "../ui-next/src/Row.svelte";
import Grid from "../ui-next/src/Grid.svelte";
import Card from "../ui-next/src/Card.svelte";
import Section from "../ui-next/src/Section.svelte";
import AppShell from "../ui-next/src/AppShell.svelte";
import Fixture from "../ui-next/src/LayoutFixture.svelte";
import Layouts from "../ui-next/src/Layouts.svelte";

const root = resolve(process.cwd(), "ui-next");
const css = readFileSync(resolve(root, "components/base.css"), "utf8") + readFileSync(resolve(root, "components/layout.css"), "utf8"); // primitives live in the generated helmet
const tokens = readFileSync(resolve(root, "tokens.css"), "utf8");

describe("layout.css and tokens carry the 8.1-8.3 contract", () => {
  it("defines every primitive class and gap step", () => {
    for (const c of [".l-shell{", ".l-main{", ".l-page{", ".l-section{", ".l-stack{", ".l-row{", ".l-grid{", ".l-card:not([data-pad]){", ".glass{", ".glass-hi{"]) expect(css).toContain(c);
    for (let n = 1; n <= 8; n++) expect(css).toContain(`[data-gap="${n}"]{--g:var(--sp-${n})}`);
  });
  it("tokens.css carries the spacing scale, gutter and page widths, with the phone override", () => {
    for (const [k, v] of [["--sp-1", "4px"], ["--sp-4", "16px"], ["--sp-7", "48px"], ["--gutter", "32px"], ["--page-max", "1120px"], ["--page-max-narrow", "880px"], ["--page-max-read", "520px"]]) expect(tokens).toMatch(new RegExp(`${k}: ${v};`));
    expect(tokens).toMatch(/\.app\[data-w=phone\] \{[^}]*--gutter: 16px;[^}]*--page-max: 100%;/s);
  });
});

describe("primitives render the literal contract classes", () => {
  it("Stack, Row and Grid set only the class and data-gap", () => {
    for (const [C, cls] of [[Stack, "l-stack"], [Row, "l-row"], [Grid, "l-grid"]] as const) {
      const el = render(C, { gap: 3 }).container.firstElementChild!;
      expect(el.className).toBe(cls);
      expect(el.getAttribute("data-gap")).toBe("3");
      expect(el.hasAttribute("style")).toBe(false);
    }
    expect(render(Stack).container.firstElementChild!.hasAttribute("data-gap")).toBe(false);
  });
  it("gap is the --sp step 1..8 only (--sp-8 72, design-system.md 8.2)", () => {
    for (const bad of [0, 9, 2.5, "3"]) expect(() => render(Stack, { gap: bad as never })).toThrow(/gap must be an integer 1\.\.8/);
  });
  it("Page widths: default, narrow, read; nothing else", () => {
    expect(render(Page).container.firstElementChild!.hasAttribute("data-w")).toBe(false);
    for (const w of ["narrow", "read"]) expect(render(Page, { width: w }).container.firstElementChild!.getAttribute("data-w")).toBe(w);
    expect(() => render(Page, { width: "wide" })).toThrow(/narrow or read/);
  });
  it("Grid takes cols 2..4 or a named template, not both", () => {
    expect(render(Grid, { cols: 3 }).container.firstElementChild!.getAttribute("data-cols")).toBe("3");
    expect(render(Grid, { template: "barbell" }).container.firstElementChild!.getAttribute("data-tpl")).toBe("barbell");
    expect(() => render(Grid, { cols: 5 })).toThrow(/cols must be/);
    expect(() => render(Grid, { cols: 2, template: "barbell" })).toThrow(/not both/);
    expect(() => render(Grid, { template: "x" })).toThrow(/unknown template/);
  });
  it("Section renders heading and help before the body", () => {
    const s = render(Section, { heading: "H", help: "help", level: 3 }).container.querySelector("section.l-section")!;
    expect([...s.children].map((e) => e.className)).toEqual(["h3", "small"]);
  });
  it("AppShell is .app > .layer.l-shell, phone sets data-w=phone and the phone page", () => {
    const d = render(AppShell, { theme: "light" }).container.querySelector(".app")!;
    expect(d.getAttribute("data-theme")).toBe("light");
    expect(d.hasAttribute("data-w")).toBe(false);
    expect(d.querySelector(":scope > .layer.l-shell > main.l-main")).not.toBeNull();
    const p = render(AppShell, { phone: true }).container.querySelector(".app")!;
    expect(p.getAttribute("data-w")).toBe("phone");
    expect(p.querySelector("main.l-page.l-phone")).not.toBeNull();
    expect(() => render(AppShell, { theme: "sepia" })).toThrow(/light or dark/);
  });
  it("Card refuses width, style and margin (the parent sets width; the parent gap spaces it)", () => {
    for (const k of ["width", "style", "margin"]) expect(() => render(Card, { [k]: "1px" })).toThrow(/Card: no/);
    expect(render(Card, { hi: true }).container.firstElementChild!.className).toBe("glass-hi l-card l-stack");
    expect(render(Card, { lens: "church" }).container.firstElementChild!.getAttribute("data-lens")).toBe("church");
    expect(render(Card, {}).container.firstElementChild!.hasAttribute("data-lens")).toBe(false);
    expect(() => render(Card, { lens: "red" })).toThrow(/Card: lens/);
  });
});

describe("nesting rules (8.1)", () => {
  it("AppShell > Page > Section > Grid > Card > Stack/Row, each inside the level above", () => {
    const { container } = render(Fixture);
    const app = container.querySelector(".app[data-theme=dark]")!;
    const page = app.querySelector(":scope > .layer > main > .l-page[data-w=narrow][data-gap='6']")!;
    expect(page).not.toBeNull();
    const grid = page.querySelector(":scope > section.l-section > .l-grid[data-cols='2'][data-gap='4']")!;
    expect(grid).not.toBeNull();
    const cards = [...grid.children];
    expect(cards.map((c) => c.className)).toEqual(["glass l-card l-stack", "glass-hi l-card l-stack"]);
    expect(cards[0].querySelector(":scope > .l-stack[data-gap='2']")).not.toBeNull();
    expect(cards[1].querySelector(":scope > .l-row[data-gap='3']")).not.toBeNull();
  });
  it("a Card inside a Grid sets no width; sibling spacing is the parent's gap (no margin, no style anywhere)", () => {
    const { container } = render(Fixture);
    for (const c of container.querySelectorAll(".l-card")) for (const a of ["style", "width", "data-w", "data-cols"]) expect(c.hasAttribute(a)).toBe(false);
    expect(container.querySelector("[style]")).toBeNull();
    // the CSS never gives a primitive or card a margin other than the Page's auto centring
    for (const [, sel, decl] of css.matchAll(/(\.l-[a-z-]+(?:\[[^\]]*\])?)\{([^}]*)\}/g)) if (sel !== ".l-page") expect(decl, sel).not.toMatch(/margin/);
    expect(css).not.toMatch(/\.l-card\{[^}]*width/);
  });
  it("phone fixture flips the shell to the phone page and gutter scope", () => {
    const app = render(Fixture, { phone: true }).container.querySelector(".app")!;
    expect(app.getAttribute("data-w")).toBe("phone");
  });
});

describe("/next/?page=layouts gallery page", () => {
  it("draws the five outlined levels, the 7-step ruler and the three width bars on light and dark", () => {
    const { container } = render(Layouts);
    const apps = [...container.querySelectorAll(".gx-lay > .app")];
    expect(apps.map((a) => a.getAttribute("data-theme"))).toEqual(["light", "dark"]);
    for (const a of apps) {
      for (const lv of ["shell", "page", "section", "card", "axis"]) expect(a.querySelector(`.gx-lv[data-lv=${lv}]`)).not.toBeNull();
      expect([...a.querySelectorAll(".gx-ruler")].map((r) => r.getAttribute("data-sp"))).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
      expect([...a.querySelectorAll(".gx-wbar")].map((r) => r.getAttribute("data-w"))).toEqual(["max", "narrow", "read"]);
    }
    expect(container.querySelector("[style]")).toBeNull();
  });
  it("width and theme toggles switch to phone and to one theme", async () => {
    const { container, getByRole } = render(Layouts);
    await fireEvent.click(getByRole("button", { name: "phone" }));
    await fireEvent.click(getByRole("button", { name: "dark" }));
    const apps = [...container.querySelectorAll(".gx-lay > .app")];
    expect(apps.map((a) => [a.getAttribute("data-theme"), a.getAttribute("data-w")])).toEqual([["dark", "phone"]]);
  });
});

describe("8.6 L4 lint: inline layout style in .svelte is refused", () => {
  it("flags layout properties in style=, style={} and style: directives", () => {
    for (const s of ['<div style="gap: 8px">', "<div style='padding: 4px'>", "<div style={{ margin: 0 }}>", '<div style:max-width="1px">']) expect(lintText("x.svelte", s).some((m: string) => m.includes("8.6 L4"))).toBe(true);
    expect(lintText("x.svelte", '<div class="l-stack" data-gap="3"></div>')).toEqual([]);
  });
  it("ui-next/ lints clean", () => {
    expect(lintDir(root).size).toBe(0);
  });
});
