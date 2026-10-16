// @vitest-environment jsdom
// UI Next (v4) shared DOM helper h() + esc() (status: provisional).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain ES module, no type declarations
import { h, esc } from "../ui-next/components/h.js";

describe("ui-next h()", () => {
  it("creates the element with attributes set by setAttribute", () => {
    const el = h("a", { class: "btn btn-quiet", href: "/x", "aria-label": "Help", "data-n": 3 });
    expect(el.tagName).toBe("A");
    expect(el.getAttribute("class")).toBe("btn btn-quiet");
    expect(el.getAttribute("href")).toBe("/x");
    expect(el.getAttribute("aria-label")).toBe("Help");
    expect(el.getAttribute("data-n")).toBe("3");
  });

  it("skips null, undefined and false attributes; true sets an empty attribute", () => {
    const el = h("button", { hidden: true, title: null, "aria-label": undefined, "data-x": false });
    expect(el.getAttribute("hidden")).toBe("");
    expect(el.hasAttribute("title")).toBe(false);
    expect(el.hasAttribute("aria-label")).toBe(false);
    expect(el.hasAttribute("data-x")).toBe(false);
  });

  it("accepts null attrs and appends text, numbers, nodes and nested arrays in order", () => {
    const child = h("span", null, "b");
    const el = h("p", null, "a", child, [1, [null, "c"]], false, undefined, true);
    expect(el.childNodes.length).toBe(4);
    expect(el.textContent).toBe("ab1c");
    expect(el.childNodes[1]).toBe(child);
  });

  it("puts markup-looking text in as text, never as markup", () => {
    const evil = '<img src=x onerror="alert(1)"><b>bold</b>';
    const el = h("div", { title: evil }, evil);
    expect(el.children.length).toBe(0);
    expect(el.textContent).toBe(evil);
    expect(el.getAttribute("title")).toBe(evil);
    expect(el.innerHTML).toContain("&lt;img");
  });

  it("refuses inline event-handler attributes", () => {
    expect(() => h("button", { onclick: "alert(1)" })).toThrow(/inline handler/);
    expect(() => h("button", { OnMouseOver: "x" })).toThrow(/inline handler/);
  });

  it("uses no innerHTML assignment", () => {
    const src = readFileSync(resolve(process.cwd(), "ui-next/components/h.js"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    expect(src).not.toMatch(/^\s*import /m);
  });
});

describe("ui-next esc()", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(esc(`<a href="x">Tom & Jerry's</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  });
  it("turns null and undefined into an empty string and stringifies the rest", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
    expect(esc(0)).toBe("0");
  });
});
