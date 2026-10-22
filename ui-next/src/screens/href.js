// UI Next (v4) shared screen-link helper for the screens fanout. Status: provisional.
// Plain JS (no Svelte import), so lanes, route tests and vitest can import it. Seven lanes wrote links by hand that dropped
// ?theme=, ?w=phone or ?ui_next=on; build every cross-screen link here instead:
//   href("results")                       -> "?ui_next=on&screen=results"                  (from "")
//   href("results", { state: "empty" })   -> "?ui_next=on&screen=results&w=phone&state=empty"  (from "?screen=x&w=phone")
//   href("results", { w: null })          -> drops the carried w; { theme: "dark" } overrides the carried theme
// from: the current query string (or URLSearchParams); defaults to location.search, or "" where there is no location.
// extra: more params in insertion order; a null/false value drops the key, an undefined value is ignored (w/theme still carry).
// The ?screen= values in screens/**/*.svelte are checked against the registry by test/ui-next-links.test.ts.
// Link context agrees with route.js screenHref (main 638275c, "preserve screen context"): ui_next=on is explicit, so a link never
// depends on stored opt-in; w carries only as "phone" or "desktop" (the explicit override; a width-derived phone layout is not in the
// URL, so it is not carried) and theme only as "dark" or "light", the values route() reads. Any other value is dropped, and route()
// reads a dropped w as the viewport width (desktop with no width) and a dropped theme as light, so href(s, {}, from) and
// screenHref(s, { phone, theme } of from) land on the same view and props (test/ui-next-href.test.ts).
export const CARRY = Object.freeze(["w", "theme"]);
const READ = Object.freeze({ w: (v) => v === "phone" || v === "desktop", theme: (v) => v === "dark" || v === "light" });
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/; // same rule as screens/registry.js NAME
const OWN = ["ui_next", "screen"];

export function href(screen, extra = {}, from = globalThis.location?.search ?? "") {
  if (!NAME.test(screen)) throw new Error(`ui-next href: "${screen}" is not a lowercase kebab-case screen name`);
  for (const k of OWN) if (Object.hasOwn(extra, k)) throw new Error(`ui-next href: extra.${k} is set by href itself`);
  const cur = new URLSearchParams(from);
  const out = new URLSearchParams({ ui_next: "on", screen });
  for (const k of CARRY) {
    const v = Object.hasOwn(extra, k) && extra[k] !== undefined ? extra[k] : cur.get(k);
    if (v != null && v !== false && READ[k](String(v))) out.set(k, String(v));
  }
  for (const [k, v] of Object.entries(extra)) {
    if (CARRY.includes(k) || v == null || v === false) continue;
    out.set(k, String(v));
  }
  return `?${out}`;
}
