// UI Next (v4) /next/ router and the ui_next flag. Status: provisional.
// Flag (glass-v4 ASK option 1): off by default, core team only. On when localStorage.ui_next === "on", or when the URL carries
// ?ui_next=on (which stores it); ?ui_next=off clears it. Client-only: no server change. Gallery pages stay at ?page=components|layouts|home.
export const FLAG = "ui_next";
export function flagOn(params, storage) {
  const q = params.get(FLAG);
  try {
    if (q === "on") storage?.setItem(FLAG, "on");
    else if (q === "off") storage?.removeItem(FLAG);
    return storage?.getItem(FLAG) === "on";
  } catch {
    return q === "on";
  }
}
// Screens under the flag: ?screen=home (default) | about | landing (Landing = the signed-out entry; About from Landing and Home's account menu).
// Returns { view, props }: view is "home" | "about" | "landing" | "components" | "layouts" | "home-parts".
export const SCREENS = Object.freeze(["home", "about", "landing"]);
export function route(params, storage) {
  const page = params.get("page");
  const theme = params.get("theme");
  const mode = ["light", "dark"].includes(theme) ? theme : "both";
  const phone = params.get("w") === "phone";
  const on = flagOn(params, storage);
  if (page === "layouts") return { view: "layouts", props: { mode, phone } };
  if (page === "home") return { view: "home-parts", props: { mode, phone } };
  if (page === "components" || !on) return { view: "components", props: { mode } };
  const screen = params.get("screen");
  if (screen === "about" || screen === "landing") return { view: screen, props: { phone, theme: theme === "dark" ? "dark" : "light" } };
  const state = params.get("state") === "first" ? "first" : "reviews";
  return { view: "home", props: { state: phone ? "reviews" : state, phone, theme: theme === "dark" ? "dark" : "light" } };
}
