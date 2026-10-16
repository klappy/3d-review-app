// @vitest-environment jsdom
// UI Next (v4) Stage pill contract (status: provisional).
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Stage pill row;
// section 1.2 Stage row (neutral stage tokens, the five labels).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain ES module, no type declarations
import { renderPill, STAGES, STAGE_LABELS } from "../ui-next/components/pill.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintText } from "../scripts/ui-next-lint.mjs";

const read = (p: string) => readFileSync(resolve(process.cwd(), "ui-next", p), "utf8");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const EXPECTED: [string, string][] = [
  ["setup", "Setting up"],
  ["collecting", "Collecting"],
  ["results", "Results ready"],
  ["reviewed", "Reviewed"],
  ["done", "Completed"],
];

describe("renderPill states", () => {
  it("ports exactly the five neutral stages, in order", () => {
    expect(STAGES).toEqual(EXPECTED.map(([s]) => s));
    expect(Object.entries(STAGE_LABELS)).toEqual(EXPECTED);
  });
  for (const [stage, label] of EXPECTED) {
    it(`${stage} renders span.pill[data-stage=${stage}] with dot + "${label}"`, () => {
      const p = renderPill({ stage });
      expect(p.tagName).toBe("SPAN");
      expect([...p.classList]).toEqual(["pill"]);
      expect(p.getAttribute("data-stage")).toBe(stage);
      expect(p.childNodes.length).toBe(2);
      const dot = p.firstChild as Element;
      expect(dot.tagName).toBe("I");
      expect(dot.getAttribute("aria-hidden")).toBe("true");
      expect(dot.childNodes.length).toBe(0);
      expect(p.lastChild?.nodeType).toBe(3); // text node, not markup
      expect(p.textContent).toBe(label);
    });
  }
});

describe("renderPill refusals", () => {
  it("refuses closed until the contract defines it (V-09)", () => {
    expect(() => renderPill({ stage: "closed" })).toThrow(/closed/);
  });
  it("refuses an unknown or missing stage", () => {
    expect(() => renderPill({ stage: "live" })).toThrow(/unknown stage/);
    expect(() => renderPill({})).toThrow(/unknown stage/);
    expect(() => renderPill()).toThrow(/unknown stage/);
    expect(() => renderPill({ stage: "toString" })).toThrow(/unknown stage/);
  });
  it("refuses a caller-supplied label (label text comes from the contract)", () => {
    expect(() => renderPill({ stage: "collecting", label: "18 answered" })).toThrow(/label/);
  });
});

describe("pill.css", () => {
  const css = read("components/pill.css");
  const body = stripComments(css);
  it("defines .pill, the dot and one data-stage binding per ported stage", () => {
    expect(body).toMatch(/\.pill \{/);
    expect(body).toMatch(/\.pill i \{[^}]*background: var\(--stage\)/);
    for (const [stage] of EXPECTED) expect(body).toContain(`.pill[data-stage=${stage}] { --stage: var(--stage-${stage}); }`);
  });
  it("has no closed binding (not ported)", () => {
    expect(body).not.toMatch(/closed/);
  });
  it("paints only from tokens: no raw colour literals", () => {
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    for (const t of ["--glass-hi", "--line", "--ink", "--t-13", "--radius-xl", "--field"]) expect(body).toContain(`var(${t})`);
  });
  it("uses only tokens that ui-next/tokens.css defines (or the local --stage binding)", () => {
    const tokens = read("tokens.css");
    for (const [, name] of body.matchAll(/var\((--[a-z0-9-]+)\)/g)) if (name !== "--stage") expect(tokens).toContain(`${name}:`);
  });
  it("stage tokens stay neutral in tokens.css (ruling: stages are grey)", () => {
    const tokens = read("tokens.css");
    for (const [stage] of EXPECTED) expect(tokens).toContain(`--stage-${stage}: var(--ink-3);`);
  });
  it("turns glass into --field under reduced transparency", () => {
    expect(body).toMatch(/@media \(prefers-reduced-transparency: reduce\) \{\s*\.pill \{ background: var\(--field\); \}/);
  });
});

describe("pill module and fixture", () => {
  it("pill.js imports only ./h.js and uses no innerHTML", () => {
    const js = read("components/pill.js").replace(/^\s*\/\/.*$/gm, "");
    expect([...js.matchAll(/^\s*import .* from "([^"]+)";/gm)].map((m) => m[1])).toEqual(["./h.js"]);
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });
  it("fixture loads the tokens and the pill stylesheet and renders every stage on light and dark .app roots", () => {
    const html = read("fixtures/pill.html");
    expect(html).toContain('href="../tokens.css"');
    expect(html).toContain('href="../components/pill.css"');
    expect(html).toContain('from "../components/pill.js"');
    expect(html).toContain("STAGES.map((stage) => renderPill({ stage }))");
    expect(html).toMatch(/sheet\("light"\), sheet\("dark"\)/);
    expect(html).toContain('class: "app", "data-theme": theme');
  });
  it("the new files pass the ui-next lint", () => {
    for (const p of ["components/pill.js", "components/pill.css", "fixtures/pill.html"]) expect(lintText(p, read(p))).toEqual([]);
  });
});
