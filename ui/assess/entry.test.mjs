import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MOUNTED, ELSEWHERE, whatsHere } from './whats-here.js';
const read = n => readFileSync(fileURLToPath(new URL(n, import.meta.url)), 'utf8');

test('E1: legacy header carries exactly one Assessments link to /assess/# with no token, scoped by CSS to confirmed staff on the staff surface', () => {
  const html = read('../index.html'), css = read('../public-choices.css');
  const links = html.match(/<a id="assess-link"[^>]*>/g) || [];
  assert.equal(links.length, 1); assert.ok(links[0].includes('href="/assess/#"')); assert.ok(!/session=|st_/.test(links[0]));
  assert.match(css, /\.rv:not\(\[data-staff-confirmed="true"\]\) #assess-link,\s*\.rv:not\(\[data-entry-view="workspace"\]\) #assess-link,\s*\.rv\[data-workspace-route="participant"\] #assess-link \{ display:none; \}/);
});
test('E1: the shell way back is /#facilitator, hidden until a session is observed; the statement is generated and names where the rest lives', () => {
  const html = read('./index.html');
  assert.match(html, /<a id="legacy-link" href="\/#facilitator" hidden>Workspaces &amp; people<\/a>/);
  assert.ok(html.includes('<p class="storage-note" id="whats-here" hidden></p>'));
  assert.ok(MOUNTED.length >= 2 && ELSEWHERE.items.includes('stage change') && ELSEWHERE.items.includes('reports and results'));
  assert.ok(!/coming soon/i.test(whatsHere()));
  assert.ok(read('../.assetsignore').split('\n').includes('assess/entry.test.mjs'));
});
