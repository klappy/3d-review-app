// UI Next (v4) live router and the href bridge (status: provisional). Cookbook work/active/2026-10-21-ui-next-demo-wiring.
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { parse, to, linkFor, ROUTES, needs, legacyHref, contextForRoute } from "../ui-next/src/app/router.js";
// @ts-expect-error -- plain .js module, no type declarations
import { href, setLiveContext } from "../ui-next/src/screens/href.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { liveEntry, FLAG } from "../ui-next/src/route.js";

describe("entry contract (route.js liveEntry; glass-v4 ASK option 1)", () => {
  const mem = () => { const m = new Map(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) }; };
  it("live by default (captain's ruling 2026-10-22, demo): bare /next/ mounts the live app; ?ui_next=off stores the opt-out (gallery); ?ui_next=on clears it", () => {
    const s = mem();
    expect(liveEntry(new URLSearchParams(""), s)).toBe(true);
    expect(liveEntry(new URLSearchParams("ui_next=off"), s)).toBe(false);
    expect(s.getItem(FLAG)).toBe("off");
    expect(liveEntry(new URLSearchParams(""), s)).toBe(false);
    expect(liveEntry(new URLSearchParams("ui_next=on"), s)).toBe(true);
    expect(s.getItem(FLAG)).toBeNull();
    expect(liveEntry(new URLSearchParams(""), s)).toBe(true);
  });
  it("explicit fixture selection wins over the flag: ?screen= is a board, ?page= the gallery", () => {
    const s = mem(); s.setItem(FLAG, "on");
    expect(liveEntry(new URLSearchParams("screen=qr-room"), s)).toBe(false);
    expect(liveEntry(new URLSearchParams("page=components"), s)).toBe(false);
    expect(liveEntry(new URLSearchParams("theme=dark"), s)).toBe(true);
  });
  it("works without storage (private mode): live unless ?ui_next=off this navigation", () => {
    expect(liveEntry(new URLSearchParams("ui_next=on"), undefined)).toBe(true);
    expect(liveEntry(new URLSearchParams(""), undefined)).toBe(true);
    expect(liveEntry(new URLSearchParams("ui_next=off"), undefined)).toBe(false);
  });
});

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
  it("an in-page anchor after a second # names an element, not a route (QR room's \"Meeting offline?\" -> collect#offline)", () => {
    const r = parse("#/review/asm_9/collect#offline");
    expect(r.name).toBe("collect"); expect(r.params).toEqual({ aid: "asm_9" }); expect(r.anchor).toBe("offline");
    expect(parse("#/review/asm_9/collect?state=menu#offline")).toMatchObject({ name: "collect", anchor: "offline" });
    expect(parse("#/review/asm_9/collect").anchor).toBe("");
  });
});


describe("context-preserving account navigation", () => {
  it("preserves originating scope through phone menu reload and People", () => {
    const route = parse(linkFor("menu", {}, { aid: "review / 1", pid: "project_2", wid: "workspace_3" }));
    const context = contextForRoute(route);
    expect(context).toMatchObject({ aid: "review / 1", pid: "project_2", wid: "workspace_3" });
    expect(linkFor("people", {}, context)).toBe("#/people?review=review+%2F+1");
    expect(legacyHref(route)).toBe("/#assessment/review%20%2F%201");
  });
  it("chooses project or workspace People without inventing a review", () => {
    expect(linkFor("people", {}, { pid: "p" })).toBe("#/people?project=p");
    expect(linkFor("people", {}, { wid: "w" })).toBe("#/workspace/w/people");
    expect(legacyHref(parse("#/people?project=p"))).toBe("/#permissions/projects/p");
    expect(legacyHref(parse("#/workspace/w/people"))).toBe("/#permissions/workspaces/w");
  });
  it("returns to matching review stage independently of browser history", () => {
    for (const [screen, expected] of [["results", "understand"], ["report-detailed", "understand"], ["next-step", "improve"], ["action-plan", "improve"], ["share", "collect"], ["print", "collect"], ["people", "permissions"]]) {
      expect(legacyHref({ name: screen, params: { aid: "a" } })).toBe(`/#assessment/a/${expected}`);
    }
    expect(legacyHref(parse("#/project/p"))).toBe("/#project/p");
    expect(legacyHref(parse("#/workspace/w"))).toBe("/#workspace/w");
    expect(legacyHref(parse("#/projects"))).toBe("/#projects");
  });
  it("preserves a selected report only inside its result and plan journey", () => {
    const ctx = { aid: "a", report: "report_1" };
    expect(linkFor("report-detailed", {}, ctx)).toBe("#/review/a/report/detailed?report=report_1");
    expect(linkFor("next-step", {}, ctx)).toBe("#/review/a/next-step?report=report_1");
    expect(linkFor("people", {}, ctx)).toBe("#/people?review=a");
    expect(linkFor("collect", {}, ctx)).toBe("#/review/a/collect");
  });
  it("keeps sample separate and never carries arbitrary credentials or URLs", () => {
    expect(legacyHref(parse("#/review/sample/results"))).toBe("/?demo=1#assessment/demo-assessment/results");
    expect(legacyHref(parse("#/menu?token=secret&next=https%3A%2F%2Fother.example"))).toBe("/#projects");
    expect(linkFor("menu", {}, { token: "secret", aid: "a" })).toBe("#/menu?review=a");
    expect(contextForRoute(parse("#/menu?token=secret"))).not.toHaveProperty("token");
  });
});
