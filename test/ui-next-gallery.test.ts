// @vitest-environment jsdom
// UI Next (v4) /next/ gallery + Svelte lint guards (status: provisional).
// Plan: 3d-review-cookbook work/active/2026-10-15-glass-redesign-v4/PLAN-6b-svelte-2026-10-16.md (tripwire T3).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent } from "@testing-library/svelte";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintText, lintDir } from "../scripts/ui-next-lint.mjs";
import App from "../ui-next/src/App.svelte";

const root = resolve(process.cwd(), "ui-next");

describe("/next/ fixture gallery", () => {
  it("shows every ported state on light and dark .app roots, light DOM, no inline style", () => {
    const { container } = render(App);
    const sheets = [...container.querySelectorAll("section.app")];
    expect(sheets.map((s) => s.getAttribute("data-theme"))).toEqual(["light", "dark"]);
    for (const s of sheets) {
      for (const sel of [".btn-primary", ".btn-quiet", ".btn-icon[aria-label]", ".btn-lg", ".btn-block", "a.btn"]) expect(s.querySelector(sel)).not.toBeNull();
      expect([...s.querySelectorAll(".pill")].map((p) => p.getAttribute("data-stage"))).toEqual(expect.arrayContaining(["setup", "collecting", "results", "reviewed", "done"]));
      for (const k of ["lensdot", "pt"]) for (const l of ["team", "community", "church"]) expect(s.querySelector(`.${k}[data-lens=${l}]`)).not.toBeNull();
    }
    expect(container.querySelector("[style]")).toBeNull();
    expect([...container.querySelectorAll("*")].some((e) => e.shadowRoot)).toBe(false);
  });
  it("the theme toggle shows one theme at a time", async () => {
    const { container, getByRole } = render(App);
    await fireEvent.click(getByRole("button", { name: "dark" }));
    expect([...container.querySelectorAll("section.app")].map((s) => s.getAttribute("data-theme"))).toEqual(["dark"]);
    await fireEvent.click(getByRole("button", { name: "light" }));
    expect([...container.querySelectorAll("section.app")].map((s) => s.getAttribute("data-theme"))).toEqual(["light"]);
  });
  it("all of ui-next passes the lint", () => {
    expect([...lintDir(root)]).toEqual([]);
  });
});

describe("ui-next lint Svelte guards (T3)", () => {
  it.each([
    ["x.svelte", "<div></div>\n<style>.x{}</style>", /<style>/],
    ["x.svelte", "<script>const o = { customElement: true };</script>", /customElement/],
    ["x.js", "el.attachShadow({ mode: 'open' })", /attachShadow/],
    ["x.svelte", '<div style={{ color: "red" }}></div>', /inline style/],
    ["x.svelte", '<div style:color="red"></div>', /inline style/],
    ["x.svelte", '<div style="color: red"></div>', /inline style/],
    ["x.js", "el.style.color = 'red'", /inline style/],
  ])("%s rejects %s", (name, text, re) => {
    expect(lintText(name, text).join("\n")).toMatch(re);
  });
  it("comments do not trip the guards", () => {
    expect(lintText("x.svelte", "<!-- no <style> here, no customElement -->\n<span class=\"pill\"></span>")).toEqual([]);
  });
  it("the gallery entry index.html lints clean", () => {
    expect(lintText("index.html", readFileSync(resolve(root, "index.html"), "utf8"))).toEqual([]);
  });
});
