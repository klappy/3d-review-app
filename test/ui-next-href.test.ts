// UI Next (v4) shared screen-link helper (status: provisional). Screens fanout
// (3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/): seven lanes' hand-written links dropped
// ?theme=, ?w=phone or ?ui_next=on; screens/href.js builds them and carries w + theme over.
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { href, CARRY } from "../ui-next/src/screens/href.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route, screenHref } from "../ui-next/src/route.js";

describe("href(screen, extra, from)", () => {
  it("always sets ui_next=on and screen, first", () => {
    expect(href("results", {}, "")).toBe("?ui_next=on&screen=results");
    expect(href("results", {}, "?screen=collect")).toBe("?ui_next=on&screen=results");
  });
  it("carries the current w and theme over", () => {
    expect(CARRY).toEqual(["w", "theme"]);
    expect(href("results", {}, "?ui_next=on&screen=collect&w=phone&theme=dark&state=busy")).toBe("?ui_next=on&screen=results&w=phone&theme=dark");
    expect(href("results", {}, "?theme=dark")).toBe("?ui_next=on&screen=results&theme=dark");
    expect(href("results", {}, new URLSearchParams("w=phone"))).toBe("?ui_next=on&screen=results&w=phone");
  });
  it("does not carry state or any other param", () => {
    expect(href("results", {}, "?state=first&page=home&x=1")).toBe("?ui_next=on&screen=results");
  });
  it("extra overrides w/theme; null or false drops them; undefined keeps the carried value", () => {
    const from = "?screen=collect&w=phone&theme=dark";
    expect(href("results", { w: null }, from)).toBe("?ui_next=on&screen=results&theme=dark");
    expect(href("results", { theme: null, w: false }, from)).toBe("?ui_next=on&screen=results");
    expect(href("results", { theme: "light" }, from)).toBe("?ui_next=on&screen=results&w=phone&theme=light");
    expect(href("results", { w: undefined }, from)).toBe("?ui_next=on&screen=results&w=phone&theme=dark");
    expect(href("results", { w: "phone" }, "")).toBe("?ui_next=on&screen=results&w=phone");
  });
  it("appends extra keys like state in order, encoded; null/false/undefined extras are skipped", () => {
    expect(href("explore", { state: "filters" }, "?w=phone")).toBe("?ui_next=on&screen=explore&w=phone&state=filters");
    expect(href("explore", { state: "a b&c", n: 2 }, "")).toBe("?ui_next=on&screen=explore&state=a+b%26c&n=2");
    expect(href("explore", { state: null, a: false, b: undefined }, "")).toBe("?ui_next=on&screen=explore");
  });
  it("defaults from to location.search, or \"\" where there is no location (node)", () => {
    expect(globalThis.location).toBeUndefined();
    expect(href("results")).toBe("?ui_next=on&screen=results");
    vi.stubGlobal("location", { search: "?ui_next=on&screen=collect&w=phone&theme=dark" });
    try {
      expect(href("results")).toBe("?ui_next=on&screen=results&w=phone&theme=dark");
      expect(href("results", { state: "empty" })).toBe("?ui_next=on&screen=results&w=phone&theme=dark&state=empty");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("refuses a bad screen name and extra.ui_next / extra.screen", () => {
    expect(() => href("Results", {}, "")).toThrow(/kebab-case/);
    expect(() => href("results?x=1", {}, "")).toThrow(/kebab-case/);
    expect(() => href("results", { screen: "x" }, "")).toThrow(/extra\.screen/);
    expect(() => href("results", { ui_next: "off" }, "")).toThrow(/extra\.ui_next/);
  });
  it("routes where it says: the link lands on the screen with the carried phone, theme and state", () => {
    const link = href("fake-screen", { state: "busy" }, "?w=phone&theme=dark");
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    expect(route(new URLSearchParams(link), storage, ["fake-screen"])).toEqual({ view: "fake-screen", props: { phone: true, theme: "dark", state: "busy" } });
  });
  it("carries only the w and theme values route() reads (w=phone, theme=dark|light); any other value is dropped", () => {
    expect(href("results", {}, "?w=tablet&theme=both")).toBe("?ui_next=on&screen=results");
    expect(href("results", {}, "?w=&theme=")).toBe("?ui_next=on&screen=results");
    expect(href("results", { w: "desk", theme: "sepia" }, "?w=phone&theme=dark")).toBe("?ui_next=on&screen=results");
    expect(href("results", {}, "?w=phone&theme=light")).toBe("?ui_next=on&screen=results&w=phone&theme=light");
  });
  it("agrees with route.js screenHref (main 638275c): from the same context both land on the same view and props, with no stored opt-in", () => {
    const stored = { getItem: () => "on", setItem: () => {}, removeItem: () => {} };
    for (const from of ["", "?theme=dark", "?w=phone", "?w=phone&theme=dark", "?w=phone&theme=light", "?w=tablet&theme=both", "?screen=project&theme=dark&state=x"]) {
      const { phone, theme } = route(new URLSearchParams(from), stored).props;
      for (const screen of ["home", "about", "landing"]) {
        const ours = route(new URLSearchParams(href(screen, {}, from)), undefined);
        const main = route(new URLSearchParams(screenHref(screen, { phone, theme })), undefined);
        expect(ours, `${screen} from "${from}"`).toEqual(main);
        expect(ours.view, `${screen} from "${from}"`).toBe(screen);
      }
    }
  });
});
