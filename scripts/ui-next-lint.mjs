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

export const LINTED = /\.(html|css|js|mjs|svg)$/;
export const SKIPPED = new Set(["tokens.css"]);

const findAll = (re, s) => [...s.matchAll(re)];

export function lintText(name, text) {
  const v = [];
  const body = text.includes("</helmet>") ? text.split("</helmet>")[1] : text;
  let bodyNoPaper = body.replace(/<div class="paper".*?<\/div>\s*(?=<div class="paper"|<\/main>)/gs, "");
  if (name.endsWith(".css")) bodyNoPaper = bodyNoPaper.replace(/(?<=^|[};])\s*\.paper(?:[\s>+~][^{},]*)?(?:,\s*\.paper(?:[\s>+~][^{},]*)?)*\{[^{}]*\}/g, "");
  for (const m of findAll(/font-size: ?(\d+)px/g, body)) v.push(`font-size ${m[1]}px (use --t-*)`);
  for (const m of findAll(/border-radius: ?(\d+)px/g, body)) if (m[1] !== "50") v.push(`border-radius ${m[1]}px (use --radius-*)`);
  for (const m of findAll(/#[0-9a-fA-F]{3,6}\b/g, bodyNoPaper)) v.push(`raw colour ${m[0]} (use a token)`);
  for (const _ of findAll(/class="pt [tch]"/g, body)) v.push("pt colour by class letter (use data-lens)");
  for (const _ of findAll(/<span class="status"/g, body)) v.push("legacy .status (use .pill[data-stage] or .tag)");
  const n = findAll(/btn-primary/g, body).length;
  if (n > 1) v.push(`${n} primary buttons (rule 1: exactly one)`);
  if (/<label[^>]*>(?:(?!<\/label>).)*<label/s.test(body)) v.push("nested <label>");
  if (body.includes("[CONTACT")) v.push("placeholder text on screen");
  return v;
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (LINTED.test(e) && !SKIPPED.has(e)) out.push(p);
  }
  return out;
}

export function lintDir(dir) {
  const result = new Map();
  for (const f of walk(dir)) {
    const v = lintText(basename(f), readFileSync(f, "utf8"));
    if (v.length) result.set(relative(dir, f), v);
  }
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
  lines.push("", `${tot} violations in ${result.size} files`);
  return { text: lines.join("\n"), total: tot };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../ui-next", import.meta.url));
  const { text, total } = report(lintDir(dir));
  console.log(text);
  process.exit(total ? 1 : 0);
}
