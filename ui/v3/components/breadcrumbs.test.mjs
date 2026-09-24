import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadcrumbs, crumbTrail, ORDER } from './breadcrumbs.js';
const full = { workspace: { id: 'w1', name: 'Asia' }, project: { id: 'p 1', name: 'Hindi NT' }, assessment: { id: 'a1', name: 'Mark' }, page: 'Collect' };
test('fixed order Home › Workspace › Project › Assessment › Page, whatever order the caller passes', () => {
  const shuffled = { page: full.page, assessment: full.assessment, workspace: full.workspace, project: full.project };
  assert.deepEqual(crumbTrail(shuffled).map(c => c.level), ORDER);
  assert.equal(breadcrumbs(shuffled), breadcrumbs(full));
  const h = breadcrumbs(full);
  const at = s => h.indexOf(s);
  assert.ok(at('>Home<') < at('>Asia<') && at('>Asia<') < at('>Hindi NT<') && at('>Hindi NT<') < at('>Mark<') && at('>Mark<') < at('>Collect<'));
});
test('ancestors link; the current page is plain text with aria-current', () => {
  const h = breadcrumbs(full);
  assert.match(h, /<a data-crumb="home" href="#"/);
  assert.match(h, /href="#workspace\/w1"/); assert.match(h, /href="#project\/p%201"/); assert.match(h, /href="#assessment\/a1"/);
  assert.match(h, /<span data-crumb="page" aria-current="page">Collect<\/span><\/nav>$/);
  assert.equal((h.match(/<a /g) || []).length, 4);
});
test('missing levels are omitted; last present level becomes the plain current page', () => {
  const h = breadcrumbs({ project: { id: 'p1', name: 'P' } });
  assert.deepEqual(crumbTrail({ project: { id: 'p1', name: 'P' } }).map(c => c.level), ['home', 'project']);
  assert.match(h, /<span data-crumb="project" aria-current="page">P<\/span>/);
  assert.doesNotMatch(h, /workspace|assessment/);
  assert.match(breadcrumbs({}), /<span data-crumb="home" aria-current="page">Home<\/span>/);
  assert.equal(breadcrumbs({ home: false }), '');
});
test('escapes labels; non-hash hrefs never become links', () => {
  const h = breadcrumbs({ workspace: { name: '<b>x</b>', href: 'https://evil.example' }, page: 'Now' });
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/); assert.doesNotMatch(h, /evil/);
  assert.match(h, /<span data-crumb="workspace">&lt;b&gt;/);
});
test('custom hrefs (demo mode) are honoured', () => {
  const h = breadcrumbs({ home: { href: '#?demo=1' }, assessment: { id: 'demo-assessment', name: 'Demo', href: '#assessment/demo-assessment/prepare' }, page: 'Prepare' });
  assert.match(h, /href="#\?demo=1"/); assert.match(h, /href="#assessment\/demo-assessment\/prepare"/);
});
