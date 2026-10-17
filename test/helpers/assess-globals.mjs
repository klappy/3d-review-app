// One source for the names the vm harnesses inject onto the jsdom window before running ui/assess/assess.js.
// The harnesses strip assess.js's `import` lines and run it as a classic script, so every imported binding must be a
// window global. Derive them from assess.js's own import lines (same resolution as the browser: '/x' → ui/x, './x'
// relative to ui/assess/), so a new import can never be missing from a hand-kept list again.
import { readFileSync } from 'node:fs';

const ASSESS_URL = new URL('../../ui/assess/assess.js', import.meta.url);
const UI_ROOT = new URL('../../ui/', import.meta.url);
const IMPORT = /^import\s+(.+?)\s+from\s+'([^']+)';$/gm;
const IMPORT_LINE = /^import\b.*$/gm;

// Every `^import` line must match IMPORT. The harnesses' strip (`/^import .*;\n/gm`) removes single-line imports, so a
// double-quoted or side-effect `import '/x'` line the regex skips would vanish without its bindings being injected. A
// multi-line clause is not stripped at all (vm then throws a SyntaxError); this check names it before that happens.
export function importsOf(src) {
  const lines = src.match(IMPORT_LINE) || [];
  const matched = [...src.matchAll(IMPORT)];
  if (matched.length !== lines.length) {
    const seen = new Set(matched.map(m => m[0]));
    const missed = lines.filter(l => !seen.has(l)).map(l => JSON.stringify(l)).join(', ');
    throw new Error(`assess-globals: ${lines.length} import lines but ${matched.length} matched; unmatched: ${missed}`);
  }
  return matched.map(([, clause, spec]) => ({ clause, spec }));
}

export async function assessGlobals() {
  const out = {};
  for (const { clause, spec } of importsOf(readFileSync(ASSESS_URL, 'utf8'))) {
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

// The imported modules live in Node's realm, so a `fetchImpl = globalThis.fetch` default, or a bare `fetch(...)` call
// (scope.js's email-link form), is Node's real fetch, not the window's synthetic transport. Route Node's
// `globalThis.fetch` to `w.fetch`, and bind the two names assess.js calls without a fetchImpl (passages.js mountPassages,
// print-lang.js facilitatorFetch) to it too, all read at call time, so none of them can reach Node's fetch.
export function bindWindowFetch(w, globals) {
  const viaWindow = (...a) => w.fetch(...a);
  globalThis.fetch = viaWindow;
  w.mountPassages = deps => globals.mountPassages({ ...deps, fetchImpl: deps?.fetchImpl ?? viaWindow });
  w.facilitatorFetch = (token, fetchImpl = viaWindow) => globals.facilitatorFetch(token, fetchImpl);
}

// For the harness tests: with `w.fetch` swapped for a recorder, call each Node-realm fetch path once — a bare
// `fetch` (as scope.js does), mountPassages with `fetchImpl: undefined`, facilitatorFetch — and return the URLs that
// reached the window. bindWindowFetch missing from bootPage drops entries (Node's fetch rejects relative URLs).
export async function windowFetchProbe(w) {
  const real = w.fetch, seen = [];
  w.fetch = async url => { seen.push(String(url)); return { ok: false, status: 404, json: async () => ({ ok: false, error: { message: 'probe' } }) }; };
  try {
    await globalThis.fetch('/v2/auth/email').catch(() => {});
    w.mountPassages?.({ root: w.document.createElement('div'), aid: 'probe', mayEdit: false, esc: String, token: () => null, fetchImpl: undefined });
    await new Promise(r => setTimeout(r, 0));
    await w.facilitatorFetch?.('t')('/v2/translate', {}).catch(() => {});
  } finally { w.fetch = real; }
  return seen;
}
