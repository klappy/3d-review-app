// UI Next (v4) phone breakpoint: /next/ screens follow the viewport width (phone below 720px) unless ?w= overrides.
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md §8.3 (phone below 720px).
// Defect: cookbook work/review/2026-10-21-ui-next-screens-fanout/LENS-dev-next-2108.md debt 1 (390x844 rendered desktop).
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { route, wOverride, screenHref, PHONE_BELOW, PHONE_QUERY } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { href } from "../ui-next/src/screens/href.js";

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

// PR #574 review (r4343742610): links carry only the explicit override, never the width-derived layout.
describe("links carry the explicit ?w= override, not the effective layout", () => {
  const live = (q: string, width: number) => route(p(q), on(), [], width).props;
  it("live screen props keep the override (w) apart from the effective layout (phone)", () => {
    expect(live("?screen=landing", 390)).toEqual({ phone: true, theme: "light", w: null });
    expect(live("?screen=landing&w=desktop", 390)).toEqual({ phone: false, theme: "light", w: "desktop" });
    expect(live("?screen=about&w=phone", 1280)).toEqual({ phone: true, theme: "light", w: "phone" });
  });
  it("(a) a width-derived phone page does not pin the destination to phone", () => {
    const from = "?ui_next=on&screen=about";
    const link = screenHref("home", live(from, 390));
    expect(new URLSearchParams(link).has("w")).toBe(false);
    expect(route(p(link), on(), [], 1280).props.phone).toBe(false);
    expect(route(p(link), on(), [], 390).props.phone).toBe(true);
    const lane = href("results", {}, from);
    expect(new URLSearchParams(lane).has("w")).toBe(false);
  });
  it("(b) ?w=desktop survives the link, so a phone viewport stays desktop", () => {
    const from = "?ui_next=on&screen=about&w=desktop&theme=dark";
    const link = screenHref("home", live(from, 390));
    expect(new URLSearchParams(link).get("w")).toBe("desktop");
    expect(route(p(link), on(), [], 390).props.phone).toBe(false);
    const lane = href("results", {}, from);
    expect(lane).toBe("?ui_next=on&screen=results&w=desktop&theme=dark");
    expect(route(p(lane), on(), ["results"], 390).props.phone).toBe(false);
  });
  it("?w=phone still carries on both helpers", () => {
    const from = "?ui_next=on&screen=about&w=phone";
    expect(new URLSearchParams(screenHref("home", live(from, 1280))).get("w")).toBe("phone");
    expect(new URLSearchParams(href("results", {}, from)).get("w")).toBe("phone");
  });
  it("without a viewport (board captures, component tests) screenHref still carries phone as w=phone", () => {
    expect(screenHref("home", { phone: true, theme: "dark" })).toBe("?screen=home&ui_next=on&theme=dark&w=phone");
  });
});
