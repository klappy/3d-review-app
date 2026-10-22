// UI Next (v4) live router and the href bridge (status: provisional). Cookbook work/active/2026-10-21-ui-next-demo-wiring.
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { parse, to, linkFor, ROUTES, needs } from "../ui-next/src/app/router.js";
// @ts-expect-error -- plain .js module, no type declarations
import { href, setLiveContext } from "../ui-next/src/screens/href.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";

describe("router", () => {
  it("every registered lane screen has a route of the same name", () => {
    const names = new Set(ROUTES.map(([n]: [string, string]) => n));
    for (const name of Object.keys(REGISTRY)) expect(names.has(name), name).toBe(true);
  });
  it("parses hash routes with params and query, and round-trips to()", () => {
    expect(parse("")).toMatchObject({ name: "home", params: {} });
    expect(parse("#/")).toMatchObject({ name: "home" });
    expect(parse("#/review/asm_1/collect/qr")).toMatchObject({ name: "qr-room", params: { aid: "asm_1" } });
    const r = parse("#/p/q/3?state=all");
    expect(r).toMatchObject({ name: "p-question", params: { n: "3" } });
    expect(r.query.get("state")).toBe("all");
    expect(to("results", { aid: "a b" })).toBe("#/review/a%20b/results");
    expect(parse(to("results", { aid: "a b" })).params.aid).toBe("a b");
    expect(to("p-review", {}, { state: "all" })).toBe("#/p/review?state=all");
  });
  it("treats #survey= as the participant entry and bare lane anchors as routes", () => {
    expect(parse("#survey=link_x").name).toBe("p-entry");
    expect(parse("#signin").name).toBe("sign-in");
    expect(parse("#help").name).toBe("help");
    expect(parse("#setup").name).toBe("setup");
    expect(parse("#/nowhere/at/all").name).toBe("home");
    expect(parse("#/review").name).toBe("home");
  });
  it("to() refuses a route without its param; linkFor falls back to home", () => {
    expect(needs("results")).toEqual(["aid"]);
    expect(() => to("results")).toThrow(/needs :aid/);
    expect(linkFor("results", {}, {})).toBe("#/");
    expect(linkFor("p-question", { q: 4 }, {})).toBe("#/p/q/4");
    expect(linkFor("results", { w: "phone", theme: "dark" }, { aid: "x" })).toBe("#/review/x/results");
  });
});

describe("href bridge", () => {
  afterEach(() => setLiveContext(null));
  it("stays on the fixture query form without a live context", () => {
    expect(href("results", {}, "")).toBe("?ui_next=on&screen=results");
  });
  it("becomes a hash route carrying the live params", () => {
    setLiveContext({ aid: "asm_9" });
    expect(href("results")).toBe("#/review/asm_9/results");
    expect(href("p-question", { q: 2 })).toBe("#/p/q/2");
    expect(href("collect", { state: "menu" })).toBe("#/review/asm_9/collect?state=menu");
  });
});
