// node --test ui/assess/improve-resources.test.mjs — Improve: a resource line under each suggested area
// (cookbook work/active/2026-10-26-3d-improve-resources-links, Done when 2). The shipped table is empty until its owner delivers it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPROVE_RESOURCES, RESOURCES_COMING, resourcesFor, resourcesMarkup } from './improve-resources.js';
import { views } from './views.js';
import { esc, enc, routes } from './cards.js';

// Fixture table only: example.org placeholders, never shipped.
const T = { listening: [{ title: 'Listening guide', url: 'https://example.org/listening' }], Church: [{ title: 'Church <starter>', url: 'https://example.org/church?a=1&b=2' }, { title: 'Bad', url: 'javascript:alert(1)' }, { title: '', url: 'https://example.org/x' }] };

test('shipped table is empty: no resource is invented before the owner delivers the table', () => {
  assert.deepEqual(Object.keys(IMPROVE_RESOURCES), []);
  assert.ok(Object.isFrozen(IMPROVE_RESOURCES));
  assert.deepEqual(resourcesFor('Church'), []);
});

test('lookup: whole area first, then the category after " · ", case-insensitive; unsafe or untitled entries dropped', () => {
  assert.deepEqual(resourcesFor('Translation Team · Listening', T).map(r => r.title), ['Listening guide']);
  assert.deepEqual(resourcesFor('church', T).map(r => r.title), ['Church <starter>']);
  assert.deepEqual(resourcesFor('Community', T), []);
});

test('markup: links (escaped, new tab) when present; "More resources coming." when none', () => {
  const h = resourcesMarkup('Church', esc, T);
  assert.match(h, /^<p class="small muted" data-resources-for="Church"><a href="https:\/\/example\.org\/church\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Church &lt;starter&gt;<\/a><\/p>$/);
  assert.doesNotMatch(h, /javascript:/);
  assert.equal(resourcesMarkup('Community', esc, T), `<p class="small muted" data-resources-for="Community">${RESOURCES_COMING}</p>`);
});

test('Improve page: each suggested area carries its resource line; with the empty table every one says "More resources coming."', async () => {
  const surveys = [
    { id: 's1', template_id: 't1', perspective: 'Translation Team', state: 'selected', archived_at: null },
    { id: 's2', template_id: 't2', perspective: 'Church', state: 'selected', archived_at: null },
  ];
  const report = { payload: { lenses: [
    { lens: 'Translation Team', score: 80, sub_dimensions: [{ sub_dimension: 'Listening', score: 45 }] },
    { lens: 'Church', score: 30, sub_dimensions: [] },
  ] } };
  const table = {
    'GET /v2/assessments/a1/reports': { reports: [{ id: 'rep_1', created_at: '2026-09-25T00:00:00Z' }] },
    'GET /v2/reports/rep_1': { report },
    'GET /v2/assessments/a1/surveys/s1': { counts: { responses: 5 } },
    'GET /v2/assessments/a1/surveys/s2': { counts: { responses: 4 } },
  };
  const api = async (url, init = {}) => { const h = table[`${init.method || 'GET'} ${url}`]; if (!h) throw Object.assign(new Error('NOT_FOUND'), { status: 404 }); return h; };
  const ctx = { api, esc, enc, go() {}, note() {}, state: { dirty: new Map() }, routes, current: { assessment: { id: 'a1', stage: 'improve', role: 'owner', notes_reflection: '', notes_next_steps: '' }, surveys } };
  const html = views.improve.render(ctx, await views.improve.load(ctx, { aid: 'a1' }));
  assert.equal((html.match(/data-resources-for=/g) || []).length, 2);
  assert.match(html, /data-resources-for="Translation Team · Listening">More resources coming\.<\/p>/);
  assert.match(html, /data-resources-for="Church">More resources coming\.<\/p>/);
});
