// BCS demo 2026-09-29 (bee:10809312 u3540382364-388): "We just have start survey." The survey, the paper and Collect now
// say to read or listen to the passage first; a passage can be named with nothing attached.
// Cookbook ticket: work/active/2026-09-29-3d-passage-instructions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { passagesHtml } from './passages.js';
import { UI_EN, passageNames, formStrings } from '../participate/i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('facilitator panel: a named-only passage shows without a link; editors get the "passage only" form first', () => {
  const html = passagesHtml(esc, { mayEdit: true, passages: [{ id: 'p1', kind: 'reference', media: 'reference', title: 'Genesis 1', reference: 'Genesis 1', href: null }] });
  assert.match(html, /<span class="p-kind">Named only<\/span><span class="p-title">Genesis 1<\/span>/);
  assert.doesNotMatch(html, /href="null"|href=""/);
  assert.ok(html.indexOf('data-passage-ref') < html.indexOf('data-passage-link'), 'naming the passage comes before links and files');
  assert.match(html, /asked to read or listen first/);
  assert.doesNotMatch(passagesHtml(esc, { mayEdit: false, passages: [] }), /data-passage-ref/);
});

test('participant: the instruction is a translatable UI string; names are each passage once, reference first', () => {
  assert.equal(UI_EN.passageFirst, 'Please read or listen to the passage before you answer:');
  assert.equal(passageNames([{ reference: 'Genesis 1' }, { title: 'Mark 4 in ISL', reference: 'Mark 4' }, { reference: 'Genesis 1' }, { title: 'Psalm 23' }, {}]), 'Genesis 1 · Mark 4 · Psalm 23');
  assert.equal(passageNames([]), '');
  const page = read('../participate/page.js');
  assert.match(page, /p\.kind === 'reference'/, 'reference-only passages count as passages');
  assert.match(page, /list\.filter\(p => p\.href\)\.map/, 'only openable passages get a Read / Listen / Watch row');
  assert.match(page, /T\('passageFirst'\)/);
});

test('paper and Collect: the print names the passage; Collect tells the facilitator to read or play it first', () => {
  const src = read('./assess.js');
  const line = src.split('\n').find(l => l.startsWith('const passageLine = '));
  const passageLine = new Function(`${line}; return passageLine;`)();
  assert.equal(passageLine([{ reference: 'Genesis 1' }, { title: 'Mark 4 audio', reference: 'Mark 4' }]), 'Before you answer, read or listen to: Genesis 1 · Mark 4');
  assert.equal(passageLine([]), ''); assert.equal(passageLine(undefined), '');
  assert.match(src, /model\.passageLine = await passageLineFor\(aid\)/);
  assert.match(src, /<p class="note" data-passage-first>\$\{esc\(PASSAGE_FIRST_FACILITATOR\)\}<\/p>/);
  assert.match(src, /const PASSAGE_FIRST_FACILITATOR = 'Before you share the links or hand out paper, read or play the passage for the group\./);
});
