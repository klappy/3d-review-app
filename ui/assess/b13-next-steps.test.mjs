// node --test ui/assess/b13-next-steps.test.mjs — Bincy B13 (lanes-2148, captain ASK 8 option 1; screen 11).
// Improve: "Suggested areas to discuss" = the areas the built report bands Needs support / Needs urgent attention, as tick boxes,
// plus Other, saved with the notes; one primary "Complete 3D Review" asked in the page; afterwards everything is read-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { views } from './views.js';
import { esc, enc, routes } from './cards.js';
import { v3SuggestedAreas, v3NextParse, v3NextSerialize, v3IsComplete, v3CompleteLock, V3_SUGGEST } from './v3-assessment.js';

const LENSES = ['Translation Team', 'Church', 'Community'];
const err = (code, status) => Object.assign(new Error(code), { code, status });
function fakeApi(table) {
  const calls = [];
  const api = async (url, init = {}) => { calls.push({ url, ...init }); const h = table[`${init.method || 'GET'} ${url}`]; if (!h) throw err('NOT_FOUND_OR_NOT_VISIBLE', 404); if (h instanceof Error) throw h; return typeof h === 'function' ? h(init) : h; };
  return { api, calls };
}
const surveys = [
  { id: 's1', template_id: 't1', template_name: 'Team', perspective: 'Translation Team', state: 'selected', archived_at: null },
  { id: 's2', template_id: 't2', template_name: 'Church', perspective: 'Church', state: 'selected', archived_at: null },
  { id: 's3', template_id: 't3', template_name: 'Community', perspective: 'Community', state: 'selected', archived_at: null },
];
// Team 80 Strong (sub Listening 45 Needs support), Church 30 Needs urgent attention, Community 50 but only 2 responses → More input needed.
const report = { payload: { lenses: [
  { lens: 'Translation Team', score: 80, sub_dimensions: [{ sub_dimension: 'Listening', score: 45 }, { sub_dimension: 'Clarity', score: 90 }] },
  { lens: 'Church', score: 30, sub_dimensions: [{ sub_dimension: 'Trust; care', score: 65 }] },
  { lens: 'Community', score: 50, sub_dimensions: [] },
] } };
const built = {
  'GET /v2/assessments/a1/reports': { reports: [{ id: 'rep_1', created_at: '2026-09-25T00:00:00Z' }] },
  'GET /v2/reports/rep_1': { report },
  'GET /v2/assessments/a1/surveys/s1': { counts: { responses: 5, respondents: 5 } },
  'GET /v2/assessments/a1/surveys/s2': { counts: { responses: 4, respondents: 4 } },
  'GET /v2/assessments/a1/surveys/s3': { counts: { responses: 2, respondents: 2 } },
};
const base = { id: 'a1', name: 'Lake', stage: 'improve', project_id: 'p1', role: 'owner', notes_reflection: 'We saw growth.', notes_next_steps: 'Meet the elders' };
const ctxFor = (api, assessment = base, extra = {}) => ({ api, esc, enc, go() {}, note() {}, state: { dirty: new Map() }, routes, current: { assessment, surveys }, ...extra });
function mount(html) {
  const dom = new JSDOM(`<!doctype html><body><div id="root">${html}</div></body>`);
  dom.window.confirm = () => { throw new Error('window.confirm must not be used'); };
  return dom.window.document.getElementById('root');
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('B13 suggestions are derived from the report bands only (Needs support / Needs urgent attention), gated by responses', () => {
  const groups = { 'Translation Team': { surveys: 1, loaded: 1, responses: 5 }, Church: { surveys: 1, loaded: 1, responses: 4 }, Community: { surveys: 1, loaded: 1, responses: 2 } };
  const scores = { 'Translation Team': { score: 80, subs: [{ name: 'Listening', score: 45 }, { name: 'Clarity', score: 90 }] }, Church: { score: 30, subs: [{ name: 'Trust; care', score: 65 }] }, Community: { score: 50, subs: [] } };
  assert.deepEqual(v3SuggestedAreas(scores, LENSES, groups), [
    { area: 'Translation Team · Listening', band: 'Needs support' },
    { area: 'Church', band: 'Needs urgent attention' },
  ]);
  assert.deepEqual(v3SuggestedAreas(null, LENSES, groups), []);
});

test('B13 notes codec: ticks, Other and the complete mark ride under the facilitator text; plain text is untouched', () => {
  assert.equal(v3NextSerialize({ text: 'Meet the elders' }), 'Meet the elders');
  assert.deepEqual(v3NextParse('Meet the elders\n[Other] not a trailer?'), { text: 'Meet the elders', areas: [], other: 'not a trailer?', complete: false });
  const raw = v3NextSerialize({ text: 'Meet the elders\n', areas: ['Church', 'Team · A; B', 'Church'], other: ' two\nlines ', complete: true });
  assert.equal(raw, 'Meet the elders\n\n[Areas to discuss] Church; Team · A, B\n[Other] two lines\n[This review is complete.]');
  assert.deepEqual(v3NextParse(raw), { text: 'Meet the elders', areas: ['Church', 'Team · A, B'], other: 'two lines', complete: true });
  assert.deepEqual(v3NextParse(v3NextSerialize({ areas: ['Church'] })), { text: '', areas: ['Church'], other: '', complete: false });
  assert.ok(v3IsComplete({ notes_next_steps: raw })); assert.ok(!v3IsComplete({ notes_next_steps: 'Meet the elders' }));
  const locked = v3CompleteLock({ role: 'owner', notes_next_steps: raw });
  assert.equal(locked.role, 'viewer'); assert.equal(locked.granted_role, 'owner'); assert.equal(locked.complete, true);
  const open = { role: 'owner', notes_next_steps: 'x' }; assert.equal(v3CompleteLock(open), open);
});

test('B13 Improve lists the suggested areas as tick boxes with their band word, plus Other; reads only', async () => {
  const { api, calls } = fakeApi(built); const ctx = ctxFor(api);
  const m = await views.improve.load(ctx, { aid: 'a1' }); const html = views.improve.render(ctx, m);
  assert.match(html, /<legend>Suggested areas to discuss<\/legend>/);
  assert.match(html, /<input type="checkbox" name="area" value="Translation Team · Listening" data-area> Translation Team · Listening <span class="small muted">· Needs support<\/span>/);
  assert.match(html, /value="Church" data-area> Church <span class="small muted">· Needs urgent attention/);
  assert.equal((html.match(/data-area/g) || []).length, 2, 'Strong, Growing and More input needed areas are not suggested');
  assert.match(html, /<input type="text" name="notes_other"/);
  assert.ok(!calls.some(c => c.method), 'loading never writes');
  // one primary on the page: Complete 3D Review (Save notes is a plain button)
  assert.equal((html.match(/class="primary"/g) || []).length, 1); assert.match(html, /class="primary" data-complete-review>Complete 3D Review</);
  assert.match(html, /<button type="submit" data-save-notes>Save notes</);
  assert.doesNotMatch(html, /data-review-complete/);
});

test('B13 no report built yet → the suggestions list says so in one sentence', async () => {
  const { api } = fakeApi({ 'GET /v2/assessments/a1/reports': { reports: [] } }); const ctx = ctxFor(api);
  const html = views.improve.render(ctx, await views.improve.load(ctx, { aid: 'a1' }));
  assert.match(html, /data-suggest-empty>No report is built yet, so there are no suggested areas\.</);
  assert.doesNotMatch(html, /data-area/); assert.match(html, /name="notes_other"/);
});

test('B13 ticks and Other are saved with the notes (one PATCH) and come back ticked after reload', async () => {
  let stored = { ...base };
  const table = { ...built, 'PATCH /v2/assessments/a1/notes': ({ body }) => { stored = { ...stored, ...body }; return { assessment: stored }; } };
  const { api, calls } = fakeApi(table); const ctx = ctxFor(api);
  const m = await views.improve.load(ctx, { aid: 'a1' }); const root = mount(views.improve.render(ctx, m)); views.improve.bind(ctx, root, m);
  root.querySelectorAll('[data-area]').forEach(b => { b.checked = true; });
  root.querySelector('[name=notes_other]').value = 'Bible storying';
  await root.querySelector('[data-notes-form]').onsubmit({ preventDefault() {} });
  const writes = calls.filter(c => c.method);
  assert.deepEqual(writes.map(c => `${c.method} ${c.url}`), ['PATCH /v2/assessments/a1/notes']);
  assert.equal(writes[0].body.notes_reflection, 'We saw growth.');
  assert.equal(writes[0].body.notes_next_steps, 'Meet the elders\n\n[Areas to discuss] Translation Team · Listening; Church\n[Other] Bible storying');
  // reload: a fresh load from the stored assessment
  const ctx2 = ctxFor(fakeApi(built).api, stored); const m2 = await views.improve.load(ctx2, { aid: 'a1' }); const html = views.improve.render(ctx2, m2);
  assert.match(html, /value="Translation Team · Listening" data-area checked>/); assert.match(html, /value="Church" data-area checked>/);
  assert.match(html, /name="notes_other"[^>]*value="Bible storying"/);
  assert.match(html, /<textarea name="notes_next_steps"[^>]*>Meet the elders<\/textarea>/, 'the trailer never shows inside the text box');
});

test('B13 a saved tick that is no longer suggested stays listed (ticked), so nothing saved is lost', async () => {
  const a = { ...base, notes_next_steps: v3NextSerialize({ text: 'x', areas: ['Community'] }) };
  const ctx = ctxFor(fakeApi(built).api, a); const html = views.improve.render(ctx, await views.improve.load(ctx, { aid: 'a1' }));
  assert.match(html, /value="Community" data-area checked> Community<\/label>/);
});

test('B13 Complete 3D Review asks in the page; Cancel writes nothing; confirm moves the stage forward then saves the complete mark', async () => {
  let stored = { ...base, stage: 'understand' }; let refreshed = 0;
  const table = { ...built,
    'POST /v2/assessments/a1/stage': ({ body }) => { stored = { ...stored, stage: body.stage }; return { assessment: stored }; },
    'PATCH /v2/assessments/a1/notes': ({ body }) => { stored = { ...stored, ...body }; return { assessment: stored }; } };
  const { api, calls } = fakeApi(table); const ctx = ctxFor(api, stored, { refresh: async () => { refreshed++; } });
  const m = await views.improve.load(ctx, { aid: 'a1' }); const root = mount(views.improve.render(ctx, m)); views.improve.bind(ctx, root, m);
  root.querySelector('[data-area][value="Church"]').checked = true;
  const btn = root.querySelector('[data-complete-review]');
  btn.onclick();
  const box = root.querySelector('[data-stage-confirm]'); assert.ok(box, 'in-page confirm opens');
  assert.match(box.textContent, /Complete this review\? Nothing in it can be changed afterwards\./);
  box.querySelector('[data-stage-confirm-cancel]').onclick();
  assert.equal(root.querySelector('[data-stage-confirm]'), null); assert.equal(calls.filter(c => c.method).length, 0, 'cancel writes nothing');
  btn.onclick(); root.querySelector('[data-stage-confirm-go]').onclick(); await tick(); await tick(); await tick();
  const writes = calls.filter(c => c.method).map(c => `${c.method} ${c.url} ${JSON.stringify(c.body)}`);
  assert.deepEqual(writes, [
    'POST /v2/assessments/a1/stage {"stage":"improve"}',
    `PATCH /v2/assessments/a1/notes ${JSON.stringify({ notes_reflection: 'We saw growth.', notes_next_steps: 'Meet the elders\n\n[Areas to discuss] Church\n[This review is complete.]' })}`,
  ]);
  assert.equal(root.querySelector('[data-complete-status]').textContent, 'This review is complete.');
  assert.equal(refreshed, 1); assert.ok(v3IsComplete(stored)); assert.equal(stored.stage, 'improve');
});

test('B13 from Collect the confirm says collection closes; the stage walks one step at a time', async () => {
  let stored = { ...base, stage: 'collect' };
  const table = { ...built, 'POST /v2/assessments/a1/stage': ({ body }) => { stored = { ...stored, stage: body.stage }; return { assessment: stored }; }, 'PATCH /v2/assessments/a1/notes': ({ body }) => ({ assessment: { ...stored, ...body } }) };
  const { api, calls } = fakeApi(table); const ctx = ctxFor(api, stored);
  const m = await views.improve.load(ctx, { aid: 'a1' }); const root = mount(views.improve.render(ctx, m)); views.improve.bind(ctx, root, m);
  root.querySelector('[data-complete-review]').onclick();
  assert.match(root.querySelector('[data-stage-confirm]').textContent, /Collection closes for every survey\./);
  root.querySelector('[data-stage-confirm-go]').onclick(); for (let i = 0; i < 5; i++) await tick();
  assert.deepEqual(calls.filter(c => c.method === 'POST').map(c => c.body.stage), ['understand', 'improve']);
});

test('B13 a failed stage move never saves the complete mark and keeps the button usable', async () => {
  const table = { ...built, 'POST /v2/assessments/a1/stage': err('STAGE_CONFLICT', 409) };
  const { api, calls } = fakeApi(table); const ctx = ctxFor(api, { ...base, stage: 'understand' });
  const m = await views.improve.load(ctx, { aid: 'a1' }); const root = mount(views.improve.render(ctx, m)); views.improve.bind(ctx, root, m);
  root.querySelector('[data-complete-review]').onclick(); root.querySelector('[data-stage-confirm-go]').onclick(); await tick(); await tick();
  assert.ok(!calls.some(c => c.method === 'PATCH')); assert.match(root.querySelector('[data-complete-status]').textContent, /^The review was not completed/);
  assert.equal(root.querySelector('[data-complete-review]').disabled, false);
});

test('B13 read-only after complete: saved values, no edit controls, one "This review is complete." line', async () => {
  const done = v3CompleteLock({ ...base, notes_next_steps: v3NextSerialize({ text: 'Meet the elders', areas: ['Church'], other: 'Bible storying', complete: true }) });
  const { api, calls } = fakeApi(built); const ctx = ctxFor(api, done);
  const m = await views.improve.load(ctx, { aid: 'a1' }); const html = views.improve.render(ctx, m);
  assert.equal(calls.length, 0, 'a completed review reads no suggestions');
  assert.doesNotMatch(html, /<form|<textarea|<input|<button|data-complete-review/);
  assert.equal((html.match(/This review is complete\./g) || []).length, 1); assert.match(html, /data-review-complete>This review is complete\.</);
  assert.match(html, /<li>Church<\/li>/); assert.match(html, /data-notes-other>Other: Bible storying</); assert.match(html, /data-notes-next-steps>Meet the elders</);
  assert.doesNotMatch(html, /editing needs a member or owner role/);
  // Understand after complete: the owner gets the viewer rendering (no review gate, no build action)
  const u = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.doesNotMatch(u, /data-v3-gate-go|data-results-build|data-report-build/);
});

test('B13 the assessment shell locks a completed review for every stage view and draws the one complete line', () => {
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  assert.match(src, /return \{ assessment: completeLock\(r\.assessment\), surveys: r\.surveys \|\| \[\] \};/);
  assert.match(src, /const done = a\.complete && tab !== 'improve' \? `<p class="note" data-review-complete>\$\{esc\(V3_SUGGEST\.done\)\}<\/p>` : '';/);
  assert.match(src, /if \(tab === 'prepare'\) return head \+ done \+ prepareView\(current\);/);
  assert.match(src, /return head \+ done \+ collectScreen\(current\);/);
  assert.equal(V3_SUGGEST.done, 'This review is complete.');
});
