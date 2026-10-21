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
// Returns { view, props }: view is "home" | "components" | "layouts" | "home-parts".
export function route(params, storage) {
  const page = params.get("page");
  const theme = params.get("theme");
  const mode = ["light", "dark"].includes(theme) ? theme : "both";
  const phone = params.get("w") === "phone";
  const on = flagOn(params, storage);
  if (page === "layouts") return { view: "layouts", props: { mode, phone } };
  if (page === "home") return { view: "home-parts", props: { mode, phone } };
  if (page === "components" || !on) return { view: "components", props: { mode } };
  const state = params.get("state") === "first" ? "first" : "reviews";
  return { view: "home", props: { state: phone ? "reviews" : state, phone, theme: theme === "dark" ? "dark" : "light" } };
}
