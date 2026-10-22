// UI Next (v4) /next/ router and the ui_next flag. Status: provisional.
// Flag (glass-v4 ASK option 1): off by default, core team only. On when localStorage.ui_next === "on", or when the URL carries
// ?ui_next=on (which stores it); ?ui_next=off clears it. Client-only: no server change. Gallery pages stay at ?page=components|layouts|home.
export const FLAG = "ui_next";
export function flagOn(params, storage) {
  const q = params.get(FLAG);
  // An explicit query controls this navigation even when persistence is absent,
  // blocked, or a storage implementation silently declines the write.
  if (q === "on" || q === "off") {
    try {
      if (q === "on") storage?.setItem(FLAG, "on");
      else storage?.removeItem(FLAG);
    } catch { /* Persistence is optional for the current URL. */ }
    return q === "on";
  }
  try {
    return storage?.getItem(FLAG) === "on";
  } catch {
    return false;
  }
}
// Screens under the flag: ?screen=home (default) | about | landing (Landing = the signed-out entry; About from Landing and Home's account menu).
// Returns { view, props }: view is "home" | "about" | "landing" | "components" | "layouts" | "home-parts", or a registered screen name.
// screens: the names in screens/registry.js (main.js passes Object.keys(REGISTRY)); a registered ?screen=<name> under the flag
// returns { view: name, props: { phone, theme, state } } with state the raw ?state= value (undefined when absent).
export const SCREENS = Object.freeze(["home", "about", "landing"]);
export const BUILTIN_VIEWS = Object.freeze([...SCREENS, "components", "layouts", "home-parts"]);
// width: the viewport width in CSS px (main.js passes it). Phone breakpoint (cookbook design/2026-10-15-glass-redesign/canvas/
// design-system.md §8.3): screens render phone below 720px by default; ?w=phone / ?w=desktop override the width (board captures,
// gallery links). Gallery pages (?page=layouts|home) stay explicit-only so their captures never depend on the window.
// Without a width (tests, no window) the default stays desktop, as before.
export const PHONE_BELOW = 720;
export const PHONE_QUERY = `(max-width: ${PHONE_BELOW - 0.02}px)`;
export function wOverride(params) {
  const w = params.get("w");
  return w === "phone" || w === "desktop" ? w : null;
}
export function route(params, storage, screens = [], width) {
  const page = params.get("page");
  const theme = params.get("theme");
  const mode = ["light", "dark"].includes(theme) ? theme : "both";
  const w = wOverride(params);
  const explicitPhone = w === "phone";
  const on = flagOn(params, storage);
  if (page === "layouts") return { view: "layouts", props: { mode, phone: explicitPhone } };
  if (page === "home") return { view: "home-parts", props: { mode, phone: explicitPhone } };
  if (page === "components" || !on) return { view: "components", props: { mode } };
  const live = typeof width === "number";
  const phone = w ? explicitPhone : live && width < PHONE_BELOW;
  // Live (width given): screens also get w, the explicit override ("phone" | "desktop" | null), kept apart from the effective
  // layout so links carry only the override (screenHref, screens/href.js) and the destination re-derives phone from its own width.
  const ov = live ? { w } : {};
  const t = theme === "dark" ? "dark" : "light";
  const screen = params.get("screen");
  if (screens.includes(screen) && !BUILTIN_VIEWS.includes(screen)) return { view: screen, props: { phone, theme: t, state: params.get("state") ?? undefined, ...ov } };
  if (screen === "about" || screen === "landing") return { view: screen, props: { phone, theme: t, ...ov } };
  const state = params.get("state") === "first" ? "first" : "reviews";
  return { view: "home", props: { state: phone ? "reviews" : state, phone, theme: t, ...ov } };
}

// Links between mounted screens carry their presentation and flag explicitly;
// they keep working when localStorage is unavailable and survive a full reload.
// w: the explicit override from route() props ("phone" | "desktop" | null). When w is passed (live app), only it is carried, so a
// width-derived phone page never pins the destination and ?w=desktop survives the link. Without w (board captures, tests with no
// viewport), phone is carried as w=phone, as before.
export function screenHref(screen, { phone = false, theme = "light", w } = {}) {
  const params = new URLSearchParams({ screen, [FLAG]: "on", theme });
  const carry = w === undefined ? (phone ? "phone" : null) : w;
  if (carry === "phone" || carry === "desktop") params.set("w", carry);
  return `?${params}`;
}
