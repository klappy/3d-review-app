// UI Next (v4) screen registry for the screens fanout. Status: provisional.
// Each lane owns screens/<lane>/index.js (default export: { "<screen-name>": Component }); this file only merges them,
// so seven lanes register screens without touching a shared file. main.js mounts REGISTRY[view] and passes
// Object.keys(REGISTRY) to route() (route.js stays plain JS, importable without Svelte).
import { BUILTIN_VIEWS } from "../route.js";
import participant from "./participant/index.js";
import collect from "./collect/index.js";
import results from "./results/index.js";
import setup from "./setup/index.js";
import people from "./people/index.js";
import explore from "./explore/index.js";
import actions from "./actions/index.js";

export const LANES = Object.freeze({ participant, collect, results, setup, people, explore, actions });
export const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

// Merge lane maps into one { name: Component }; throws on a bad name, a built-in view name, or a name two lanes register.
export function merge(lanes, reserved = BUILTIN_VIEWS) {
  const out = {};
  const owner = {};
  for (const [lane, screens] of Object.entries(lanes)) {
    for (const [name, component] of Object.entries(screens ?? {})) {
      if (!NAME.test(name)) throw new Error(`ui-next screen "${name}" (lane ${lane}): use a lowercase kebab-case name`);
      if (reserved.includes(name)) throw new Error(`ui-next screen "${name}" (lane ${lane}) shadows a built-in view`);
      if (Object.hasOwn(out, name)) throw new Error(`ui-next screen "${name}" registered twice (lanes ${owner[name]} and ${lane})`);
      if (!component) throw new Error(`ui-next screen "${name}" (lane ${lane}) has no component`);
      out[name] = component;
      owner[name] = lane;
    }
  }
  return Object.freeze(out);
}

export const REGISTRY = merge(LANES);
