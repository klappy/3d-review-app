// UI Next (v4) phone breakpoint: /next/ screens follow the viewport width (phone below 720px) unless ?w= overrides.
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md §8.3 (phone below 720px).
// Defect: cookbook work/review/2026-10-21-ui-next-screens-fanout/LENS-dev-next-2108.md debt 1 (390x844 rendered desktop).
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { route, wOverride, PHONE_BELOW, PHONE_QUERY } from "../ui-next/src/route.js";

const p = (q: string) => new URLSearchParams(q);
const on = () => ({ getItem: () => "on", setItem() {}, removeItem() {} });
const phoneOf = (q: string, width?: number, screens: string[] = []) => route(p(q), on(), screens, width).props.phone;

describe("/next/ phone layout follows the viewport width", () => {
  it("breakpoint is 720px and the media query matches below it", () => {
    expect(PHONE_BELOW).toBe(720);
    expect(PHONE_QUERY).toBe("(max-width: 719.98px)");
  });
  it.each(["landing", "about", "home"])("screen=%s is phone at 390 and desktop at 1280 by default", (screen) => {
    expect(phoneOf(`?screen=${screen}`, 390)).toBe(true);
    expect(phoneOf(`?screen=${screen}`, 719)).toBe(true);
    expect(phoneOf(`?screen=${screen}`, 720)).toBe(false);
    expect(phoneOf(`?screen=${screen}`, 1280)).toBe(false);
  });
  it("registered lane screens follow the width too", () => {
    expect(phoneOf("?screen=results", 390, ["results"])).toBe(true);
    expect(phoneOf("?screen=results", 1280, ["results"])).toBe(false);
  });
  it("no width (tests, no window) keeps the desktop default", () => {
    expect(phoneOf("?screen=landing")).toBe(false);
  });
  it("home on a phone viewport takes the phone state, as ?w=phone does", () => {
    expect(route(p("?screen=home&state=first"), on(), [], 390).props.state).toBe("reviews");
  });
});

describe("?w= overrides the viewport width", () => {
  it("w=phone forces phone on a desktop viewport; w=desktop forces desktop on a phone viewport", () => {
    expect(phoneOf("?screen=landing&w=phone", 1280)).toBe(true);
    expect(phoneOf("?screen=landing&w=desktop", 390)).toBe(false);
    expect(route(p("?screen=home&w=desktop&state=first"), on(), [], 390).props).toMatchObject({ phone: false, state: "first" });
  });
  it("unknown w values do not override", () => {
    expect(wOverride(p("?w=tablet"))).toBeNull();
    expect(phoneOf("?screen=landing&w=tablet", 390)).toBe(true);
  });
  it("gallery pages stay explicit-only so board captures never depend on the window", () => {
    expect(route(p("?page=layouts"), on(), [], 390).props.phone).toBe(false);
    expect(route(p("?page=home"), on(), [], 390).props.phone).toBe(false);
    expect(route(p("?page=layouts&w=phone"), on(), [], 1280).props.phone).toBe(true);
    expect(route(p("?page=components"), on(), [], 390).props).toEqual({ mode: "both" });
  });
});
