// One source for the names the vm harnesses inject onto the jsdom window before running ui/assess/assess.js.
// The harnesses strip assess.js's `import` lines and run it as a classic script, so every imported binding must be a
// window global. Derive them from assess.js's own import lines (same resolution as the browser: '/x' → ui/x, './x'
// relative to ui/assess/), so a new import can never be missing from a hand-kept list again.
import { readFileSync } from 'node:fs';

const ASSESS_URL = new URL('../../ui/assess/assess.js', import.meta.url);
const UI_ROOT = new URL('../../ui/', import.meta.url);
const IMPORT = /^import\s+(.+?)\s+from\s+'([^']+)';$/gm;

export async function assessGlobals() {
  const out = {};
  for (const [, clause, spec] of readFileSync(ASSESS_URL, 'utf8').matchAll(IMPORT)) {
    const mod = await import(new URL(spec.startsWith('/') ? spec.slice(1) : spec, spec.startsWith('/') ? UI_ROOT : ASSESS_URL).href);
    const ns = clause.match(/^\*\s+as\s+(\w+)$/);
    if (ns) { out[ns[1]] = mod; continue; }
    const named = clause.match(/^\{([^}]*)\}$/);
    if (!named) throw new Error(`assess-globals: unsupported import clause: ${clause}`);
    for (const part of named[1].split(',').map(s => s.trim()).filter(Boolean)) {
      const [name, local = name] = part.split(/\s+as\s+/);
      if (!(name in mod)) throw new Error(`assess-globals: ${spec} has no export ${name}`);
      out[local] = mod[name];
    }
  }
  return out;
}
