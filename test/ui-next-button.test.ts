// @vitest-environment jsdom
// UI Next (v4) Button contract (status: provisional).
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Button row.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain ES module, no type declarations
import { renderButton } from "../ui-next/components/button.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintText } from "../scripts/ui-next-lint.mjs";

// jsdom environment: import.meta.url is not a file URL, so resolve from the repo root vitest runs in.
const read = (p: string) => readFileSync(resolve(process.cwd(), "ui-next", p), "utf8");
const icon = () => document.createElementNS("http://www.w3.org/2000/svg", "svg");
const classes = (el: Element) => [...el.classList].sort();

describe("renderButton variants", () => {
  it("secondary is the plain .btn button with type=button", () => {
    const b = renderButton({ label: "Secondary" });
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("type")).toBe("button");
    expect(classes(b)).toEqual(["btn"]);
    expect(b.textContent).toBe("Secondary");
  });
  it("primary adds .btn-primary", () => {
    expect(classes(renderButton({ label: "Go", variant: "primary" }))).toEqual(["btn", "btn-primary"]);
  });
  it("quiet adds .btn-quiet", () => {
    expect(classes(renderButton({ label: "Close", variant: "quiet" }))).toEqual(["btn", "btn-quiet"]);
  });
  it("lg and block add .btn-lg and .btn-block", () => {
    expect(classes(renderButton({ label: "Next", variant: "primary", lg: true, block: true }))).toEqual(["btn", "btn-block", "btn-lg", "btn-primary"]);
  });
  it("href renders a link with the same classes and no type", () => {
    const a = renderButton({ label: "Read the results", href: "/results" });
    expect(a.tagName).toBe("A");
    expect(a.getAttribute("href")).toBe("/results");
    expect(a.hasAttribute("type")).toBe(false);
    expect(classes(a)).toEqual(["btn"]);
  });
  it("rejects a variant the contract does not name", () => {
    expect(() => renderButton({ label: "x", variant: "danger" })).toThrow(/unknown variant/);
  });
});

describe("renderButton anatomy and labels", () => {
  it("label goes in as text, never markup", () => {
    const b = renderButton({ label: "<b>x</b> & y" });
    expect(b.children.length).toBe(0);
    expect(b.textContent).toBe("<b>x</b> & y");
  });
  it("leading and trailing icons sit around the label and are hidden from assistive tech", () => {
    const lead = icon(), trail = icon();
    const b = renderButton({ label: "Continue", lead, trail });
    expect(b.firstChild).toBe(lead);
    expect(b.lastChild).toBe(trail);
    expect(b.textContent).toBe("Continue");
    expect(lead.getAttribute("aria-hidden")).toBe("true");
    expect(trail.getAttribute("aria-hidden")).toBe("true");
  });
  it("needs a visible label unless icon-only", () => {
    expect(() => renderButton({})).toThrow(/needs a label/);
    expect(() => renderButton({ label: "   " })).toThrow(/needs a label/);
  });
  it("passes an aria-label through when given", () => {
    expect(renderButton({ label: "Share", ariaLabel: "Share the survey" }).getAttribute("aria-label")).toBe("Share the survey");
  });
});

describe("renderButton icon-only", () => {
  it("renders .btn-icon with the aria-label and only the icon", () => {
    const i = icon();
    const b = renderButton({ icon: i, ariaLabel: "Help", variant: "quiet" });
    expect(classes(b)).toEqual(["btn", "btn-icon", "btn-quiet"]);
    expect(b.getAttribute("aria-label")).toBe("Help");
    expect(b.childNodes.length).toBe(1);
    expect(b.firstChild).toBe(i);
    expect(i.getAttribute("aria-hidden")).toBe("true");
  });
  it("refuses to render without an aria-label", () => {
    expect(() => renderButton({ icon: icon() })).toThrow(/aria-label/);
    expect(() => renderButton({ icon: icon(), ariaLabel: "  " })).toThrow(/aria-label/);
    expect(() => renderButton({ icon: icon(), ariaLabel: 42 })).toThrow(/aria-label/);
  });
  it("takes no visible label", () => {
    expect(() => renderButton({ icon: icon(), ariaLabel: "Help", label: "Help" })).toThrow(/no label/);
  });
});

describe("renderButton states not in this slice", () => {
  it("refuses disabled until the contract defines it", () => {
    expect(() => renderButton({ label: "x", disabled: true })).toThrow(/disabled/);
  });
});

describe("button.css", () => {
  const css = read("components/button.css");
  it("defines the ported classes and states", () => {
    for (const sel of [/\.btn \{/, /\.btn:hover \{/, /\.btn-primary \{/, /&:hover \{/, /\.btn-quiet \{/, /\.btn-quiet:hover \{/, /\.btn-icon \{/, /\.btn-lg \{/, /\.btn-block \{/, /\.app \.btn:focus-visible \{/]) expect(css).toMatch(sel);
  });
  it("link form sizes border-box like the button form (the helmet's .app * reset)", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).toMatch(/\.btn \{[^}]*box-sizing: border-box;/);
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    try {
      for (const props of [{ label: "Read", href: "/r" }, { label: "Go", href: "/g", block: true }, { icon: icon(), ariaLabel: "Menu", href: "/m" }]) {
        const a = renderButton(props);
        document.body.append(a);
        expect(a.tagName).toBe("A");
        expect(getComputedStyle(a).boxSizing).toBe("border-box");
        a.remove();
      }
    } finally {
      style.remove();
    }
  });
  it("paints only from tokens: no raw colour literals", () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    for (const t of ["--target", "--radius-m", "--t-15", "--t-16", "--line-2", "--glass-hi", "--ink", "--ink-2", "--field", "--primary", "--primary-hi", "--on-primary", "--line", "--focus"]) expect(noComments).toContain(`var(${t})`);
  });
  it("uses only tokens that ui-next/tokens.css defines", () => {
    const tokens = read("tokens.css");
    for (const [, name] of css.matchAll(/var\((--[a-z0-9-]+)\)/g)) expect(tokens).toContain(`${name}:`);
  });
  it("has no disabled or press rule (not ported)", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/:disabled|\[disabled\]|:active/);
  });
  it("turns transitions off under reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.btn \{ transition: none; \}/);
  });
});

describe("button module and fixture", () => {
  it("button.js imports only ./h.js and uses no innerHTML", () => {
    const js = read("components/button.js").replace(/^\s*\/\/.*$/gm, "");
    expect([...js.matchAll(/^\s*import .* from "([^"]+)";/gm)].map((m) => m[1])).toEqual(["./h.js"]);
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });
  it("fixture loads the tokens and the button stylesheet and renders light and dark .app roots", () => {
    const html = read("fixtures/button.html");
    expect(html).toContain('href="../tokens.css"');
    expect(html).toContain('href="../components/button.css"');
    expect(html).toContain('from "../components/button.js"');
    expect(html).toMatch(/sheet\("light"\), sheet\("dark"\)/);
    for (const v of ['variant: "primary"', 'variant: "quiet"', "icon: icon(", "lg: true", "block: true", "href:", "lead:", "trail:"]) expect(html).toContain(v);
  });
  it("the new files pass the ui-next lint", () => {
    for (const p of ["components/h.js", "components/button.js", "components/button.css", "fixtures/button.html"]) expect(lintText(p, read(p))).toEqual([]);
  });
});
