// UI Next (v4) per-lane screen registry + its /next/ route (status: provisional).
// Screens fanout (3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md): seven lanes each own
// ui-next/src/screens/<lane>/index.js; screens/registry.js merges them and main.js passes the names to route().
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain .js module, no type declarations
import { route, BUILTIN_VIEWS, SCREENS } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { LANES, REGISTRY, merge } from "../ui-next/src/screens/registry.js";

const p = (q: string) => new URLSearchParams(q);
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const on = () => { const s = store(); s.setItem("ui_next", "on"); return s; };
const FAKE = ["fake-screen", "other-screen"];
const LANE_NAMES = ["participant", "collect", "results", "setup", "people", "explore", "actions"];

describe("/next/ route for registered lane screens", () => {
  it("a registered ?screen=<name> routes to it with { phone, theme, state }", () => {
    expect(route(p("?screen=fake-screen"), on(), FAKE)).toEqual({ view: "fake-screen", props: { phone: false, theme: "light", state: undefined } });
    expect(route(p("?screen=fake-screen&w=phone&theme=dark&state=busy"), on(), FAKE)).toEqual({ view: "fake-screen", props: { phone: true, theme: "dark", state: "busy" } });
    expect(route(p("?ui_next=on&screen=other-screen&state=first"), store(), FAKE)).toEqual({ view: "other-screen", props: { phone: false, theme: "light", state: "first" } });
    expect(route(p("?screen=fake-screen&theme=sepia"), on(), FAKE).props.theme).toBe("light");
    expect("state" in route(p("?screen=fake-screen"), on(), FAKE).props).toBe(true);
  });
  it("an unknown or unregistered name falls back to Home", () => {
    const home = { view: "home", props: { state: "reviews", phone: false, theme: "light" } };
    expect(route(p("?screen=nope"), on(), FAKE)).toEqual(home);
    expect(route(p("?screen=fake-screen"), on(), [])).toEqual(home);
    expect(route(p("?screen=fake-screen"), on())).toEqual(home);
    expect(route(p("?screen=Fake-Screen"), on(), FAKE)).toEqual(home);
  });
  it("the opt-out still gates registered screens; ?page= still wins", () => {
    expect(route(p("?screen=fake-screen&ui_next=off"), undefined, FAKE).view).toBe("components");
    const off = store(); off.setItem("ui_next", "off");
    expect(route(p("?screen=fake-screen"), off, FAKE).view).toBe("components");
    expect(route(p("?screen=fake-screen&page=layouts"), on(), FAKE).view).toBe("layouts");
    expect(route(p("?screen=fake-screen&page=home"), on(), FAKE).view).toBe("home-parts");
    expect(route(p("?screen=fake-screen&page=components"), on(), FAKE).view).toBe("components");
  });
  it("home, about, landing and the gallery route exactly as before, whatever names are registered", () => {
    const qs = ["", "?screen=home", "?screen=about", "?screen=landing", "?screen=about&w=phone&theme=dark", "?screen=landing&state=busy",
      "?state=first", "?state=first&theme=dark", "?w=phone&state=first", "?screen=nope", "?page=components", "?page=layouts&theme=dark",
      "?page=home&w=phone", "?ui_next=off", "?ui_next=on&screen=about"];
    const names = [...FAKE, ...BUILTIN_VIEWS];
    for (const q of qs) for (const s of [on, store, () => undefined]) expect(route(p(q), s(), names), q).toEqual(route(p(q), s()));
    expect(route(p("?screen=about"), on(), names)).toEqual({ view: "about", props: { phone: false, theme: "light" } });
    expect(route(p("?screen=landing&w=phone&theme=dark"), on(), names)).toEqual({ view: "landing", props: { phone: true, theme: "dark" } });
    expect(route(p("?state=first&theme=dark"), on(), names)).toEqual({ view: "home", props: { state: "first", phone: false, theme: "dark" } });
    expect(route(p("?page=layouts"), on(), names)).toEqual({ view: "layouts", props: { mode: "both", phone: false } });
    expect(SCREENS).toEqual(["home", "about", "landing"]);
  });
});

describe("screens/registry.js merges the seven lane maps", () => {
  const C = {}; const D = {};
  it("one index.js per lane, each a plain { name: Component } map, merged without collisions", () => {
    expect(Object.keys(LANES)).toEqual(LANE_NAMES);
    for (const lane of LANE_NAMES) {
      expect(existsSync(resolve(__dirname, `../ui-next/src/screens/${lane}/index.js`)), lane).toBe(true);
      expect(Object.getPrototypeOf(LANES[lane]), lane).toBe(Object.prototype);
    }
    expect(Object.keys(REGISTRY).sort()).toEqual(LANE_NAMES.flatMap((l) => Object.keys(LANES[l])).sort());
    for (const name of Object.keys(REGISTRY)) expect(route(p(`?screen=${name}`), on(), Object.keys(REGISTRY)).view).toBe(name);
  });
  it("merge keeps every lane's screens and throws on a duplicate, a built-in or a bad name", () => {
    expect(merge({ a: { "fake-screen": C }, b: { "other-screen": D } })).toEqual({ "fake-screen": C, "other-screen": D });
    expect(merge({ a: {}, b: {} })).toEqual({});
    expect(() => merge({ a: { "fake-screen": C }, b: { "fake-screen": D } })).toThrow(/registered twice \(lanes a and b\)/);
    for (const name of BUILTIN_VIEWS) expect(() => merge({ a: { [name]: C } }), name).toThrow(/shadows a built-in view/);
    for (const name of ["FakeScreen", "fake_screen", "fake screen", "-fake", "fake-", "1fake"]) expect(() => merge({ a: { [name]: C } }), name).toThrow(/kebab-case/);
    expect(() => merge({ a: { "fake-screen": undefined } })).toThrow(/has no component/);
  });
});
