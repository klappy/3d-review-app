// S25: the printed survey is its own document (captain's iOS print 2026-09-30 11:48 ET printed the whole app page and cut
// the choice column). Proof PDFs from Chromium: test/fixtures/print/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { printDocumentHtml, paperHtml, openPrintDocument, PRINT_DOC_CSS } from './print.js';
import { renderBlankPrint } from '../stage-screens.js';

const model = { visible: true, blank: true, title: 'Community-Pastor <&>', template_id: 'tpl_community_pastor', template_version: 2, passageLine: 'Before you answer, read or listen to: Ruth 1', items: [
  { text: 'What type of translation did your community agree upon or expect?', type: 'single', options: [{ text: 'Resembling — close to the original with some adjustments for clarity' }, { text: 'Other (please describe)', other: true }] },
  { text: 'Which resources?', type: 'multi', options: [{ text: 'Commentaries' }] },
  { text: 'Anything else?', type: 'text', options: [] },
] };

test('printDocumentHtml is the finished, self-contained print document (one string; a server-side PDF can render it)', () => {
  const html = printDocumentHtml(model, { paper: 'letter' });
  assert.match(html, /^<!doctype html><html lang="en">/);
  assert.doesNotMatch(html, /<link |src=|https?:\/\//, 'no external stylesheet, script or URL');
  assert.doesNotMatch(html, /<script/, 'no auto print unless asked');
  assert.match(printDocumentHtml(model, { autoPrint: true }), /<script>addEventListener\("load"/);
  assert.match(html, /<h1>Community-Pastor &lt;&amp;&gt;<\/h1>/, 'text is escaped');
  for (const s of ['What type of translation did your community agree upon or expect?', 'Resembling — close to the original with some adjustments for clarity', 'Other (please describe)', 'Commentaries', 'Choose one', 'Choose all that apply', 'Before you answer, read or listen to: Ruth 1', 'Code (optional; legacy)'])
    assert.ok(html.includes(s), `document carries ${s}`);
  assert.equal((html.match(/class="p-opt"/g) || []).length, 3, '0.23.0: every choice');
  assert.equal((html.match(/class="p-lines"/g) || []).length, 1, '0.23.0: write-in lines for the open question');
  // S30 (captain 2026-09-30 13:20 ET): room to write — ≥3 full-width lines right after the Other choice, ≥5 for free text.
  assert.doesNotMatch(html, /_{3}/, 'no short inline blank after Other');
  assert.match(html, /Other \(please describe\)<\/span><\/div><div class="p-lines p-write">(<div><\/div>){3,}<\/div>/);
  assert.match(html, /<div class="p-lines">(<div><\/div>){5,}<\/div>/);
  assert.match(PRINT_DOC_CSS, /\.p-opts>\.p-write\{grid-column:1\/-1;margin:0 0 4px\}/, 'write-in spans the choice column from the box edge');
  assert.doesNotMatch(html, /nav|Back to|Print survey|Learn more|Signed in/, 'no app chrome');
  assert.match(PRINT_DOC_CSS, /\.p-opts\{display:grid;grid-template-columns:minmax\(0,1fr\)/, 'one column of choices');
  assert.match(PRINT_DOC_CSS, /overflow-wrap:anywhere/, 'long choices wrap inside the page');
  assert.match(PRINT_DOC_CSS, /counter\(page\)/, 'page numbers');
  assert.match(html, /@page\{size:letter\}/); assert.match(printDocumentHtml(model, { paper: 'a4' }), /@page\{size:A4\}/);
  assert.equal(printDocumentHtml({ ...model, blank: false }), ''); assert.equal(paperHtml(null), '');
});

test('a translated form keeps its language on the document and the EN marks', () => {
  const hi = { ...model, lang: 'hi', dir: 'ltr', items: [{ ...model.items[0], text: 'क्या?', en: false, options: [{ text: 'Yes', en: true }] }], words: { chooseOne: 'एक चुनें' }, wordsEn: [] };
  const html = printDocumentHtml(hi);
  assert.match(html, /^<!doctype html><html lang="hi">/);
  assert.match(html, /<article class="paper letter" lang="hi">/);
  assert.match(html, /<span lang="en" data-en>Yes<\/span>/);
  assert.match(printDocumentHtml({ ...hi, lang: 'ur', dir: 'rtl' }), /<html lang="ur" dir="rtl">/);
});

test('Print opens the document in its own tab from the click; a blocked tab returns false', () => {
  const written = [];
  const tab = { document: { open() {}, write(h) { written.push(h); }, close() {} } };
  let opened = null;
  assert.equal(openPrintDocument({ open: (u, t) => { opened = [u, t]; return tab; } }, model, { paper: 'a4' }), true);
  assert.deepEqual(opened, ['', '_blank']);
  assert.match(written[0], /@page\{size:A4\}/); assert.match(written[0], /print\(\)/);
  assert.equal(openPrintDocument({ open: () => null }, model), false);
  assert.equal(openPrintDocument({ open: () => { throw new Error('blocked'); } }, model), false);
});

test('renderBlankPrint printHere hands the paper size to onPrint and mounts nothing around print()', () => {
  const node = tag => ({ tag, textContent: '', children: [], className: '', listeners: {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener(e, f) { (this.listeners[e] ||= []).push(f); }, append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; } });
  const body = node('body');
  const doc = { createElement: node, createTextNode: t => ({ tag: '#text', textContent: t, children: [] }), body };
  const root = node('div'); const calls = [];
  renderBlankPrint(doc, root, model, { paper: 'a4', printHere: true, onPrint: p => calls.push(p) });
  const walk = n => [n, ...(n.children || []).flatMap(walk)];
  walk(root).find(n => n.tag === 'button' && n.textContent === 'Print').listeners.click[0]();
  assert.deepEqual(calls, ['a4']); assert.equal(body.children.length, 0);
});

test('the app page wires Print to the print document; printing the app page itself prints only the paper', () => {
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  assert.match(src, /openPrintDocument\(window, model, \{ paper \}\)/);
  assert.match(src, /printHere: true, onPrint/);
  const css = readFileSync(new URL('../stage-screens.css', import.meta.url), 'utf8');
  assert.match(css, /body:has\(#print-root \.paper\):not\(:has\(> \.stage-print-only\)\) \*:not\(:has\(#print-root\)\):not\(#print-root\):not\(#print-root \*\)\{display:none!important\}/);
  assert.match(css, /#print-root \.paper \.p-opts\{grid-template-columns:minmax\(0,1fr\)\}/);
});
