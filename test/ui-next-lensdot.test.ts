// @vitest-environment jsdom
// UI Next (v4) Lens dot contract (status: provisional).
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Lens dot row.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain ES module, no type declarations
import { renderLensDot, renderLensPoint, LENSES } from "../ui-next/components/lensdot.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintText } from "../scripts/ui-next-lint.mjs";

const read = (p: string) => readFileSync(resolve(process.cwd(), "ui-next", p), "utf8");
const KEYS = ["team", "community", "church"] as const;
const NAMES = { team: "Translation team", community: "Community", church: "Church" };
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

describe("LENSES", () => {
  it("names exactly the three perspectives", () => {
    expect(LENSES).toEqual(NAMES);
    expect(Object.isFrozen(LENSES)).toBe(true);
  });
});

describe.each([
  ["renderLensDot", renderLensDot, "lensdot"],
  ["renderLensPoint", renderLensPoint, "pt"],
])("%s", (_name, render, cls) => {
  it.each(KEYS)("data-lens=%s: class, binding attribute and default accessible name", (lens) => {
    const el = render({ lens });
    expect(el.tagName).toBe("SPAN");
    expect([...el.classList]).toEqual([cls]);
    expect(el.getAttribute("data-lens")).toBe(lens);
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe(NAMES[lens]);
    expect(el.hasAttribute("aria-hidden")).toBe(false);
    expect(el.childNodes.length).toBe(0);
    expect(el.hasAttribute("style")).toBe(false);
  });
  it("takes a custom accessible name as an attribute, never markup", () => {
    const el = render({ lens: "church", label: "  <b>Church</b> & co " });
    expect(el.getAttribute("aria-label")).toBe("<b>Church</b> & co");
    expect(el.children.length).toBe(0);
  });
  it("decorative: aria-hidden with no role or name, for a dot beside visible text", () => {
    const el = render({ lens: "team", decorative: true });
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.hasAttribute("role")).toBe(false);
    expect(el.hasAttribute("aria-label")).toBe(false);
  });
  it("refuses a lens the contract does not name, or none (no class-letter or unbound dot)", () => {
    for (const lens of [undefined, "", "t", "c", "Team", "toString", "hasOwnProperty"]) expect(() => render({ lens })).toThrow(/unknown lens/);
    expect(() => render()).toThrow(/unknown lens/);
  });
  it("refuses an empty label and a label on a decorative dot", () => {
    expect(() => render({ lens: "team", label: " " })).toThrow(/label/);
    expect(() => render({ lens: "team", label: 3 })).toThrow(/label/);
    expect(() => render({ lens: "team", label: "x", decorative: true })).toThrow(/decorative/);
  });
});

describe("lensdot.css", () => {
  const css = read("components/lensdot.css");
  const body = noComments(css);
  it("the dot is --dot square and round", () => {
    expect(body).toMatch(/\.lensdot \{[^}]*width: var\(--dot\);[^}]*height: var\(--dot\);[^}]*border-radius: 50%;/);
  });
  it.each(KEYS)("binds data-lens=%s to its perspective token on .lensdot and .pt", (lens) => {
    expect(body).toContain(`.lensdot[data-lens=${lens}], .pt[data-lens=${lens}] { background: var(--${lens}); }`);
  });
  it("is graphic-only: no text colour, and no perspective token outside the background binding", () => {
    expect(body).not.toMatch(/(^|[\s;{])color:/);
    expect(body.match(/var\(--(team|community|church)\)/g)).toHaveLength(3);
  });
  it("ports no barbell geometry and no data-lens on other components", () => {
    expect(body).not.toMatch(/position:|margin-left|gapbar|barbell/);
    for (const [, sel] of body.matchAll(/([^{}]+)\{/g)) for (const s of sel.split(",")) {
      if (s.includes("[data-lens")) expect(s.trim()).toMatch(/^\.(lensdot|pt)\[data-lens=(team|community|church)\]$/);
    }
  });
  it("paints only from tokens that ui-next/tokens.css defines", () => {
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    const tokens = read("tokens.css");
    for (const [, name] of css.matchAll(/var\((--[a-z0-9-]+)\)/g)) expect(tokens).toContain(`${name}:`);
    expect(tokens).toMatch(/--dot: 10px;/);
  });
});

describe("lensdot module and fixture", () => {
  it("lensdot.js imports only ./h.js and uses no innerHTML", () => {
    const js = read("components/lensdot.js").replace(/^\s*\/\/.*$/gm, "");
    expect([...js.matchAll(/^\s*import .* from "([^"]+)";/gm)].map((m) => m[1])).toEqual(["./h.js"]);
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|\.style\b/);
  });
  it("fixture loads the tokens and the lensdot stylesheet and renders light and dark .app roots", () => {
    const html = read("fixtures/lensdot.html");
    expect(html).toContain('href="../tokens.css"');
    expect(html).toContain('href="../components/lensdot.css"');
    expect(html).toContain('from "../components/lensdot.js"');
    expect(html).toMatch(/sheet\("light"\), sheet\("dark"\)/);
    expect(html).toContain('class: "app", "data-theme": theme');
    for (const v of ["renderLensDot({ lens, decorative: true })", "renderLensDot({ lens })", "label:", "renderLensPoint({ lens })"]) expect(html).toContain(v);
  });
  it("the new files pass the ui-next lint", () => {
    for (const p of ["components/lensdot.js", "components/lensdot.css", "fixtures/lensdot.html"]) expect(lintText(p, read(p))).toEqual([]);
  });
});
