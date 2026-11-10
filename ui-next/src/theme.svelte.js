// UI Next (v4): the viewer's theme choice (design-system.md section 2 Theme control): light | dark | system. System (a new viewer's
// default) follows prefers-color-scheme; light and dark override it. Persisted per viewer in this browser (localStorage, best effort).
// AppShell reads themeOf(prop): an explicit choice wins; System leaves the screen's own theme (the live app passes the system theme,
// the fixture harness its ?theme=). The report paper keeps its light palette in every theme (base.css .paper scope). Status: provisional.
export const THEMES = Object.freeze(["light", "dark", "system"]);
const KEY = "ui_next_theme";
const read = () => { try { const v = globalThis.localStorage?.getItem(KEY); return THEMES.includes(v) ? v : "system"; } catch { return "system"; } };
export const viewerTheme = $state({ choice: read() });
export function setTheme(choice) {
  if (!THEMES.includes(choice)) throw new TypeError(`theme: unknown choice "${String(choice)}"`);
  viewerTheme.choice = choice;
  try { globalThis.localStorage?.setItem(KEY, choice); } catch { /* the choice still holds for this session */ }
}
/** The theme the system asks for (prefers-color-scheme), light when it cannot be read. */
export const systemTheme = () => { try { return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { return "light"; } };
/** The data-theme an .app draws: the viewer's explicit choice, else the screen's own theme (or the system one when it has none). */
export const themeOf = (screen) => (viewerTheme.choice === "system" ? screen ?? systemTheme() : viewerTheme.choice);
