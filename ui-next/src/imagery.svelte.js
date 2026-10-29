// UI Next (v4): the one shared imagery state (design-system.md section 2 Level row: bars | faces | jars | plants). AppShell sets it as the
// root .app[data-imagery], which the Level renderers' skins read (base.css); LevelLegend's "Show levels as" radios set it. Persisted per
// viewer in this browser (localStorage, best effort: a blocked store keeps the in-memory choice for the session). Status: provisional.
import { SKINS } from "./Level.svelte";
const KEY = "ui_next_imagery";
const read = () => { try { const v = globalThis.localStorage?.getItem(KEY); return SKINS.includes(v) ? v : "bars"; } catch { return "bars"; } };
export const imagery = $state({ skin: read() });
export function setImagery(skin) {
  if (!SKINS.includes(skin)) throw new TypeError(`imagery: unknown skin "${String(skin)}"`);
  imagery.skin = skin;
  try { globalThis.localStorage?.setItem(KEY, skin); } catch { /* the choice still holds for this session */ }
}
