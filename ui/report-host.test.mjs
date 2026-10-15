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
