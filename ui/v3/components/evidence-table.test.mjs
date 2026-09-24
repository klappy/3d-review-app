import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceTable } from './evidence-table.js';

test('evidence table: toggle label + hidden state follow open', () => {
  const c = evidenceTable([['A', 'b', 'c']], false), o = evidenceTable([['A', 'b', 'c']], true);
  assert.match(c.btn, /aria-expanded="false">Show evidence and details/); assert.match(c.table, /data-v3-evidence hidden/);
  assert.match(o.btn, /aria-expanded="true">Simple view/); assert.doesNotMatch(o.table, /hidden/);
});
test('evidence table: escapes cells, footer only when given', () => {
  const t = evidenceTable([['<x>', '&', '"']], true, undefined, { footer: 'F<' }).table;
  assert.match(t, /<td>&lt;x&gt;<\/td><td>&amp;<\/td><td>&quot;<\/td>/); assert.match(t, /footer">F&lt;<\/p>/);
  assert.doesNotMatch(evidenceTable([], true).table, /footer/);
});
