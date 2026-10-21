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
