// @vitest-environment jsdom
// UI Next (v4) shared slice 2: the round-3 validator yellows the lanes handed back to the shared files (status: provisional).
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/ (VALIDATION-participant-r3.md N1, VALIDATION-explore-r3.md R3-2,
// VALIDATION-setup-r3.md N2 N7 N8 DL-8; RESULTS-shared.md § Slice 2). Contract: design-system.md section 9 phone-bar, section 2 Disclosure,
// Field and button states (R16).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import HomeParts from "../ui-next/src/HomeParts.svelte";
import Home from "../ui-next/src/screens/Home.svelte";
import About from "../ui-next/src/screens/About.svelte";
import Landing from "../ui-next/src/screens/Landing.svelte";

const read = (p: string) => readFileSync(resolve(process.cwd(), "ui-next", p), "utf8");
const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** Every [selector, declarations] pair of a flat stylesheet (rules inside @media included). */
const rules = (css: string) => [...noComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const).filter(([s]) => !s.startsWith("@"));

describe("B2. the phone bar is pinned to the viewport foot on every phone screen (section 9 phone-bar; participant N1, explore R3-2, setup DL-8)", () => {
  const pin = rules(read("components/phone.css")).filter(([, d]) => /position:\s*fixed/.test(d));
  it("phone.css has exactly one fixed rule, scoped to a phone screen shell's .phone-bar", () => {
    expect(pin.map(([s]) => s)).toEqual([".app.l-screen[data-w=phone] .phone-bar"]);
    // the helmet keeps the board's absolute bar (left/right/bottom 0 still apply to the fixed bar) and .l-phone pads 120 under the content
    const base = noComments(read("components/base.css"));
    expect(base).toContain(".phone-bar{position:absolute;left:0;right:0;bottom:0;");
    expect(base).toContain(".l-phone{padding:var(--sp-3) var(--gutter) 120px;");
    const main = read("src/main.js");
    expect(main.indexOf(`"../components/phone.css"`)).toBeGreaterThan(main.indexOf(`"../components/base.css"`));
  });
  const SCREENS: [string, () => unknown][] = [
    ["Landing phone", () => render(Landing, { props: { phone: true } })],
    ["Home phone", () => render(Home, { props: { phone: true } })],
    ["Home reviews phone", () => render(Home, { props: { phone: true, state: "reviews" } })],
    ["About phone", () => render(About, { props: { phone: true } })],
  ];
  it("each phone screen renders .app.l-screen[data-w=phone] > .layer.l-shell > main.l-phone + one .phone-bar, and the pin matches it", () => {
    for (const [name, mount] of SCREENS) {
      mount();
      const bars = document.querySelectorAll(".phone-bar");
      expect(bars.length, name).toBe(1);
      const bar = bars[0];
      expect(bar.parentElement!.matches(".app.l-screen[data-w=phone] > .layer.l-shell"), name).toBe(true);
      expect(bar.previousElementSibling!.matches("main.l-page.l-phone"), name).toBe(true);
      expect(bar.matches(pin[0][0]), name).toBe(true);
      expect(bar.querySelectorAll(".btn-primary").length, name).toBe(1);
      document.body.innerHTML = "";
    }
  });
  it("desktop screens and the gallery's phone-bar frames are not pinned", () => {
    for (const C of [Landing, Home, About]) {
      render(C, {});
      expect(document.querySelectorAll(pin[0][0]).length).toBe(0);
      document.body.innerHTML = "";
    }
    render(HomeParts, { props: { phone: true } });
    expect(document.querySelectorAll(".phone-bar").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(pin[0][0]).length).toBe(0);
    document.body.innerHTML = "";
  });
});
