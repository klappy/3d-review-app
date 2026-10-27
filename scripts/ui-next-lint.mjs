#!/usr/bin/env node
// UI Next (v4) conformance lint: everything under ui-next/ paints only from tokens. Exit 1 on violations.
//   node scripts/ui-next-lint.mjs [dir]   (default: ui-next)
// Rules mirror 3d-review-cookbook design/2026-10-15-glass-redesign/generator/lint.py one for one.
// Adaptations for app files (lint.py reads canvas boards only):
//   - ui-next/tokens.css is the token home and is skipped, as lint.py skips the shared <helmet> block;
//   - a file with a </helmet> is linted after it, as lint.py does; any other file is linted whole;
//   - in .css files a rule whose every selector is .paper or a descendant of .paper is the paper scope, alongside lint.py's <div class="paper"> strip.
// Node stdlib only. Status: provisional.
import { readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const LINTED = /\.(html|css|js|mjs|svg|svelte)$/;
export const SKIPPED = new Set(["tokens.css", "components/base.css", "design-source/helmet.html", "design-source/gen.py"]); // token homes: generated from the design system (lint.py skips the helmet)

const findAll = (re, s) => [...s.matchAll(re)];

// lint.py paper_blocks(): balance <div>/</div> from each <div class="paper">; an unclosed one fails closed.
export function paperBlocks(body) {
  const out = [];
  let i = 0, unclosed = 0;
  for (const m of body.matchAll(/<div class="paper"/g)) {
    if (m.index < i) continue;
    let depth = 0, j = -1;
    for (const t of body.slice(m.index).matchAll(/<div\b|<\/div>/g)) {
      depth += t[0] === "</div>" ? -1 : 1;
      if (depth === 0) { j = m.index + t.index + t[0].length; break; }
    }
    if (j < 0) { unclosed++; continue; }
    out.push(body.slice(i, m.index)); i = j;
  }
  out.push(body.slice(i));
  return { outside: out.join(""), unclosed };
}

// lint.py primaries(): exact token btn-primary inside class attributes of markup pages only.
const CLASS_ATTR = /(?<![\w-])class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
export const primaries = (body) => findAll(CLASS_ATTR, body).reduce((n, m) => n + (m[1] ?? m[2] ?? m[3]).split(/\s+/).filter((c) => c === "btn-primary").length, 0);

const LAYOUT_PROPS = "gap|row-gap|column-gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|(?:max-|min-)?width|(?:max-|min-)?height|grid-template-columns|grid-template-rows|flex(?:-[a-z]+)?|display";
export const LAYOUT_STYLE = new RegExp(`(?<![\\w-])style\\s*=\\s*(?:"[^"]*?(?<![\\w-])(${LAYOUT_PROPS})\\s*:|'[^']*?(?<![\\w-])(${LAYOUT_PROPS})\\s*:|\\{[^}]*?(${LAYOUT_PROPS})\\b)|\\bstyle:(${LAYOUT_PROPS})\\b`, "g");

export const DATA_GEOMETRY = /\bstyle:(?:left|width)=\{`\$\{[^`{}]+\}%`\}/g;
export function lintText(name, text) {
  const v = [];
  const body = text.includes("</helmet>") ? text.split("</helmet>")[1] : text;
  const { outside, unclosed } = paperBlocks(body.replace(/<!--[\s\S]*?-->/g, ""));
  for (let k = 0; k < unclosed; k++) v.push("unclosed .paper block (balance its <div>s)");
  let bodyNoPaper = outside;
  if (name.endsWith(".css")) bodyNoPaper = bodyNoPaper.replace(/(?<=^|[};])\s*\.paper(?:[\s>][^{},+~]*)?(?:,\s*\.paper(?:[\s>][^{},+~]*)?)*\{[^{}]*\}/g, "");
  for (const m of findAll(/font-size: ?(\d+)px/g, body)) v.push(`font-size ${m[1]}px (use --t-*)`);
  for (const m of findAll(/border-radius: ?(\d+)px/g, body)) if (m[1] !== "50") v.push(`border-radius ${m[1]}px (use --radius-*)`);
  for (const m of findAll(/#[0-9a-fA-F]{3,6}\b/g, bodyNoPaper)) v.push(`raw colour ${m[0]} (use a token)`);
  for (const _ of findAll(/class="pt [tch]"/g, body)) v.push("pt colour by class letter (use data-lens)");
  for (const _ of findAll(/<span class="status"/g, body)) v.push("legacy .status (use .pill[data-stage] or .tag)");
  const n = /\.(html|svg)$/.test(name) ? primaries(body) : 0; // component CSS/JS define the class; pages use it
  if (n > 1) v.push(`${n} primary buttons (rule 1: exactly one)`);
  if (/<label[^>]*>(?:(?!<\/label>).)*<label/s.test(body)) v.push("nested <label>");
  if (body.includes("[CONTACT")) v.push("placeholder text on screen");
  // Svelte guard (PLAN-6b tripwire T3): light DOM, external CSS, no styles-in-JS.
  // design-system.md §8.11 Data geometry (Paper sheet contents @697c974d): a value-driven percentage position stays inline, and only
  // that: a Svelte style:left / style:width whose value is one template literal ending in "%". Everything else below still applies.
  const code = body.replace(/<!--[\s\S]*?-->/g, "").replace(DATA_GEOMETRY, "");
  if (name.endsWith(".svelte") && /<style[\s>]/i.test(code)) v.push("<style> block in .svelte (use the external contract CSS)");
  if (/\bcustomElement\b/.test(code)) v.push("customElement (light DOM only)");
  if (/\battachShadow\b/.test(code)) v.push("attachShadow (light DOM only)");
  if (/\.svelte$|\.m?js$/.test(name) && (/(?<![\w-])style\s*=\s*\{|\bstyle:[\w-]+|\.style\b|(?<![\w-])style\s*=\s*["']/.test(code))) v.push("inline style (use classes and tokens)");
  // design-system.md 8.6 L4: in ui-next .svelte, an inline style carrying a layout property is refused (use the layout primitives).
  if (name.endsWith(".svelte")) for (const m of findAll(LAYOUT_STYLE, code)) v.push(`inline layout style ${m[1] ?? m[2] ?? m[3] ?? m[4]} (8.6 L4: use Page/Section/Card/Stack/Row/Grid and data-gap)`);
  return v;
}

function walk(dir, root = dir) {
  const out = [];
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p, root));
    else if (LINTED.test(e) && !SKIPPED.has(relative(root, p))) out.push(p);
  }
  return out;
}

export function lintDir(dir) {
  const result = new Map();
  const files = walk(dir);
  for (const f of files) {
    const v = lintText(basename(f), readFileSync(f, "utf8"));
    if (v.length) result.set(relative(dir, f), v);
  }
  result.scanned = files.length; // so the report says how many files were read, not only how many had violations
  return result;
}

export function report(result) {
  const lines = [];
  let tot = 0;
  for (const [f, v] of result) {
    tot += v.length;
    const c = new Map();
    for (const k of v) c.set(k, (c.get(k) ?? 0) + 1);
    lines.push(`${f}: ` + [...c].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join("; "));
  }
  lines.push("", `${tot} violations in ${result.size} files` + (result.scanned != null ? ` (${result.scanned} scanned)` : ""));
  return { text: lines.join("\n"), total: tot };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../ui-next", import.meta.url));
  const { text, total } = report(lintDir(dir));
  console.log(text);
  process.exit(total ? 1 : 0);
}
