// @vitest-environment jsdom
// UI Next (v4) shared focus treatment for script focus targets (status: provisional).
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/ (VALIDATION-integration.md N2: the browser's default focus
// ring boxed the programmatically focused title of the Print and PrintQR dialogs on arrival). Contract: design-system.md section 2
// "Dialog and sheet states" (R14 Focus on open: the title, with tabindex="-1"; Focus return: the page h1 with tabindex="-1") and the
// --focus token row (3px ring on controls, never removed). Rule: ui-next/components/type.css.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const css = (name: string) => readFileSync(resolve(__dirname, "../ui-next/components", name), "utf8");
const SHEETS = ["base.css", "button.css", "phone.css", "type.css"];
const RULE = '.app :is(h1,h2,h3,h4,h5,h6)[tabindex="-1"]:focus';

describe("a script-focused title draws no focus ring; controls keep the kit's ring (integration N2)", () => {
  let style: HTMLStyleElement;
  beforeEach(() => {
    style = document.createElement("style");
    // jsdom has no UA stylesheet: stand in for the browser's default focus ring (author rules outrank it in a browser too)
    style.textContent = [":focus{outline:2px solid black}", ...SHEETS.map(css)].join("\n");
    document.head.append(style);
    document.body.innerHTML =
      '<div class="app"><dialog open aria-labelledby="t"><h2 class="h2 t-24" id="t" tabindex="-1" data-autofocus>Print paper surveys</h2>' +
      '<button class="btn" type="button">Cancel</button><button class="tab" role="tab" type="button" tabindex="-1">Collect</button></dialog>' +
      '<h1 class="title-page" tabindex="-1">Mark 1-4 draft</h1></div><h2 id="outside" tabindex="-1">Not UI Next</h2>';
  });
  afterEach(() => { style.remove(); document.body.innerHTML = ""; });

  it("type.css carries the rule, scoped to headings inside .app", () => {
    expect(css("type.css")).toContain(`${RULE}{outline:none}`);
  });
  it("the dialog title focused on open (R14) and a page h1 focused on return compute outline none", () => {
    for (const sel of ["#t", "h1.title-page"]) {
      const h = document.querySelector(sel) as HTMLElement;
      h.focus();
      expect(document.activeElement, sel).toBe(h);
      expect(h.matches(RULE), sel).toBe(true);
      expect(getComputedStyle(h).outline, sel).toBe("none"); // jsdom keeps the shorthand as written (no longhand expansion)
    }
  });
  it("only while focused, only headings, only tabindex=-1, only inside .app", () => {
    const t = document.querySelector("#t") as HTMLElement;
    expect(t.matches(RULE)).toBe(false); // not focused yet
    for (const sel of [".btn", ".tab", "#outside"]) {
      const el = document.querySelector(sel) as HTMLElement;
      el.focus();
      expect(el.matches(RULE), sel).toBe(false);
      expect(getComputedStyle(el).outline, sel).toMatch(/solid/);
    }
    t.setAttribute("tabindex", "0");
    t.focus();
    expect(t.matches(RULE)).toBe(false);
  });
  it("the kit's 3px --focus ring on :focus-visible stays on every control (never removed)", () => {
    expect(css("base.css")).toMatch(/\.app button:focus-visible[^{]*\{outline:3px solid var\(--focus\)/);
    expect(css("button.css")).toMatch(/\.app \.btn:focus-visible \{ outline: 3px solid var\(--focus\)/);
    // the only shared hand-written rule that drops an outline is the heading rule (base.css is generated from the canvas)
    const own = readdirSync(resolve(__dirname, "../ui-next/components")).filter((n) => n.endsWith(".css") && n !== "base.css");
    expect(own).toContain("type.css");
    for (const f of own) {
      for (const [, sel, body] of css(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (/outline:\s*(none|0)\b/.test(body)) expect(sel.trim(), f).toBe(RULE);
      }
    }
  });
});
