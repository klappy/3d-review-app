import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Exercise the shipped entry document and the real assessment detail mount together.
// A renderer fixture that manually includes CSS cannot catch a missing host link.
test('current assessment host loads report styles and their selectors reach the actual detail mount', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const views = await readFile(new URL('./assess/views.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(x => x.getAttribute('href'));
  assert.ok(links.includes('/report-cards.css'), 'shipped assessment host must load detail styles');
  assert.ok(links.includes('/kit/tokens.css'), 'detail spacing and color tokens are available');
  assert.ok(links.includes('/kit/components.css'), 'existing glass card composition is available');
  const markup = views.match(/const full = '([^']+)'/)[1];
  doc.querySelector('#rv').innerHTML = markup;
  const css = await readFile(new URL('./report-cards.css', import.meta.url), 'utf8');
  const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
  const detail = doc.querySelector('[data-report-view]');
  assert.ok(detail.matches('.rv :is(#report-view, [data-report-view])'));
  assert.equal(dom.window.getComputedStyle(detail).display, 'grid');
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.report-lens-score\s*\{\s*font-size:18px;/);
  dom.window.close();
});

test('full-report section rules for lists and paragraphs do not reach the lenses block (its own CSS styles rows and scores)', async () => {
  const { renderLensesAgree } = await import('./report-lenses.js');
  const css = await readFile(new URL('./report-cards.css', import.meta.url), 'utf8');
  const dom = new JSDOM('<!doctype html><div class="rv"><section data-report-view></section></div>');
  const doc = dom.window.document;
  const report = { payload: { cross_lens_multi: [{ construct_name: 'Appeal', triangulated_mean: 58, agreement_range: 52, n_lenses_included: 2, lens_scores: [{ lens: 'Church', score: 84 }, { lens: 'Translation Team', score: 32 }] }] } };
  const lens = renderLensesAgree({ doc, report });
  doc.querySelector('[data-report-view]').append(lens);
  assert.ok(lens.classList.contains('report-detail-section'), 'fixture keeps the class that caused the override');
  const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
  const selectors = [...style.sheet.cssRules].flatMap(r => r.selectorText ? r.selectorText.split(/,(?![^(]*\))/) : []).filter(s => /\.report-detail-section[^{]*>/.test(s));
  assert.ok(selectors.length >= 6, 'section child rules found');
  const inside = [...lens.querySelectorAll('*')];
  assert.ok(inside.some(el => el.matches('li.lens-agree-row')) && inside.some(el => el.matches('ul.lens-agree-scores')));
  for (const sel of selectors) assert.equal(inside.filter(el => el.matches(sel)).length, 0, `${sel.trim()} must not match inside the lenses block`);
  dom.window.close();
});

test('host full-report li margin rule (index.html) does not reach the lenses block rows or score lines', async () => {
  const { renderLensesAgree } = await import('./report-lenses.js');
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const hostCss = html.match(/s\.textContent = a \+ b \+ c \+ `([^`]*)`/)[1];
  const dom = new JSDOM('<!doctype html><main class="rv"><section class="report-full"><div data-report-view><ul><li id="other">kept</li></ul></div></section></main>');
  const doc = dom.window.document;
  const style = doc.createElement('style'); style.textContent = hostCss; doc.head.append(style);
  const liRules = [...style.sheet.cssRules].filter(r => r.selectorText && /\[data-report-view\][^,]*\bli\b/.test(r.selectorText) && /margin/.test(r.style.cssText));
  assert.ok(liRules.length >= 1, 'host li margin rule found');
  const report = { payload: { cross_lens_multi: [{ construct_name: 'Appeal', agreement_range: 52.5, lens_scores: [{ lens: 'Church', score: 84.75 }, { lens: 'Translation Team', score: 32.25 }] }, { construct_name: 'Clarity', agreement_range: 4, lens_scores: [{ lens: 'Church', score: 70 }, { lens: 'Community', score: 66 }] }] } };
  const lens = renderLensesAgree({ doc, report });
  doc.querySelector('[data-report-view]').append(lens);
  const rows = [...lens.querySelectorAll('li.lens-agree-row')], scores = [...lens.querySelectorAll('ul.lens-agree-scores li')];
  assert.equal(rows.length, 2); assert.ok(scores.length >= 4);
  for (const r of liRules) {
    assert.ok(doc.getElementById('other').matches(r.selectorText), 'other report lists keep the host margin');
    for (const el of [...rows, ...scores]) assert.ok(!el.matches(r.selectorText), `${r.selectorText} must not match ${el.className || 'score li'} inside the lenses block`);
  }
  for (const el of [...rows, ...scores]) assert.match(dom.window.getComputedStyle(el).marginTop, /^0(px)?$/, 'lenses rows keep the mock 10px grid gap, no extra margin');
  dom.window.close();
});
