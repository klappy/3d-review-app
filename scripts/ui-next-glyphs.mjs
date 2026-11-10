#!/usr/bin/env node
// UI Next (v4): the board glyph set. Converts the design system's icon set (gen.py ICONS: <path>, <circle>, <rect> elements in a
// 24 viewBox, cookbook design/2026-10-15-glass-redesign/generator/gen.py, vendored at ui-next/design-source/gen.py) into one
// path string per icon, the form the shared Icon component and the lanes' glyph components draw. Same geometry: a circle is two
// arcs, a rounded rect four lines and four arcs.
//   node scripts/ui-next-glyphs.mjs           print the G map ui-next/src/icons.js carries
// test/ui-next-icons.test.ts checks icons.js G against this conversion of the vendored gen.py, so it moves with the PIN.
// Node stdlib only. Status: provisional.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const n = (v) => String(+(+v).toFixed(3));
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** One SVG element string (gen.py ICONS value) -> one path d. */
export function toPath(svg) {
  const parts = [];
  for (const m of svg.matchAll(/<(path|circle|rect)\b([^>]*)>(?:<\/\1>)?/g)) {
    const a = attrs(m[2]);
    if (m[1] === "path") parts.push(a.d);
    else if (m[1] === "circle") {
      const [cx, cy, r] = [+a.cx, +a.cy, +a.r];
      parts.push(`M${n(cx)} ${n(cy - r)}a${n(r)} ${n(r)} 0 1 0 0 ${n(2 * r)}a${n(r)} ${n(r)} 0 1 0 0 ${n(-2 * r)}`);
    } else {
      const [x, y, w, h, rx] = [+a.x, +a.y, +a.width, +a.height, +(a.rx ?? 0)];
      parts.push(rx
        ? `M${n(x + rx)} ${n(y)}h${n(w - 2 * rx)}a${n(rx)} ${n(rx)} 0 0 1 ${n(rx)} ${n(rx)}v${n(h - 2 * rx)}a${n(rx)} ${n(rx)} 0 0 1 ${n(-rx)} ${n(rx)}`
          + `h${n(-(w - 2 * rx))}a${n(rx)} ${n(rx)} 0 0 1 ${n(-rx)} ${n(-rx)}v${n(-(h - 2 * rx))}a${n(rx)} ${n(rx)} 0 0 1 ${n(rx)} ${n(-rx)}z`
        : `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`);
    }
  }
  const rest = svg.replace(/<(path|circle|rect)\b[^>]*>(?:<\/\1>)?/g, "").trim();
  if (rest) throw new Error(`ui-next glyphs: unsupported SVG markup "${rest.slice(0, 40)}"`);
  return parts.join("").replace(/ -/g, "-");
}

/** gen.py source -> { name: path d } for every ICONS entry, in gen.py order. */
export function boardGlyphs(genPy) {
  const block = genPy.match(/\nICONS = \{\n([\s\S]*?)\n\}/);
  if (!block) throw new Error("gen.py: ICONS block not found");
  const out = {};
  for (const m of block[1].matchAll(/^ '([a-z]+)': '([^']*)',$/gm)) out[m[1]] = toPath(m[2]);
  if (!Object.keys(out).length) throw new Error("gen.py: ICONS has no entries");
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const g = boardGlyphs(readFileSync(new URL("../ui-next/design-source/gen.py", import.meta.url), "utf8"));
  console.log(Object.entries(g).map(([k, d]) => `  ${k}: ${JSON.stringify(d)},`).join("\n"));
}
