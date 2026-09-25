// node --test ui/assess/views.test.mjs — acceptance A1–A9 + permissions, against a fake api() and a minimal fake root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { views, classify, NOTES_VISIBILITY, RECOMMENDATIONS_NOT_BUILT, NOT_VISIBLE, css } from './views.js';
import { esc, enc, routes } from './cards.js';

const err = (code, status, message = code) => Object.assign(new Error(message), { code, status });
function fakeApi(table) {
  const calls = [];
  const api = async (url, init = {}) => { calls.push({ url, ...init }); const h = table[`${init.method || 'GET'} ${url}`]; if (!h) throw err('NOT_FOUND_OR_NOT_VISIBLE', 404, `unmapped ${init.method || 'GET'} ${url}`); if (h instanceof Error) throw h; return typeof h === 'function' ? h(init) : h; };
  return { api, calls };
}
const assessment = { id: 'a1', name: 'Lake', stage: 'understand', project_id: 'p1', role: 'owner', notes_reflection: 'r<1>', notes_next_steps: 'n&2' };
const surveys = [
  { id: 's1', template_id: 't1', template_name: 'Team A', perspective: 'Translation Team', state: 'selected', archived_at: null },
  { id: 's2', template_id: 't2', template_name: 'Team B', perspective: 'Translation Team', state: 'selected', archived_at: null },
  { id: 's3', template_id: 't3', template_name: 'Church', perspective: 'Church', state: 'selected', archived_at: null },
  { id: 's4', template_id: 't4', template_name: 'Old', perspective: 'Community', state: 'archived', archived_at: 'x' },
];
const ctxFor = (api, extra = {}) => ({ api, esc, enc, go() {}, note() {}, state: { principal: { id: 'me' } }, routes: { ...routes, permissions: (s, id) => `#permissions/${s}/${id}` }, cards: {}, current: { assessment, surveys }, ...extra });

// Minimal fake DOM: elements addressed by attribute selectors used in bind().
function el(attrs = {}) { return { attrs, disabled: false, hidden: false, value: attrs.value || '', checked: false, textContent: '', dataset: Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])), setAttribute() {}, querySelector: s => root.querySelector(s), querySelectorAll: s => root.querySelectorAll(s) }; }
let root;
function makeRoot(elements) {
  const match = (e, sel) => { const m = sel.match(/^\[([\w-]+)(?:([\^$]?)="?([^"\]]*)"?)?\]$/); if (sel === 'button') return e.attrs.tag === 'button'; if (!m) return false; const [, k, op, v] = m; if (!(k in e.attrs)) return false; if (v === undefined) return true; return op === '^' ? String(e.attrs[k]).startsWith(v) : e.attrs[k] === v; };
  root = { querySelector: s => elements.find(e => match(e, s)) || null, querySelectorAll: s => elements.filter(e => match(e, s)), ownerDocument: null };
  return root;
}

const RESULTS = { assessment_id: 'a1', suppressed: true, status: 'held', reason: 'D7 scoring, threshold, and differencing policy unresolved', summary: null };
const understandTable = {
  'GET /v2/assessments/a1/surveys/s1': { survey: { id: 's1' }, counts: { responses: 3, respondents: 2 } },
  'GET /v2/assessments/a1/surveys/s2': { survey: { id: 's2' }, counts: { responses: 4, respondents: 2 } },
  'GET /v2/assessments/a1/surveys/s3': { survey: { id: 's3' }, counts: { responses: 1, respondents: 1 } },
  'GET /v2/assessments/a1/results': RESULTS,
  'GET /v2/assessments/a1/reports': { reports: [{ id: 'rep_1', created_at: '2026-09-17T00:00:00Z' }] },
};

test('A1/A2 understand: each survey shows its own counts; lens sums responses only, never respondents', async () => {
  const { api, calls } = fakeApi(understandTable); const ctx = ctxFor(api);
  const m = await views.understand.load(ctx, { aid: 'a1' }); const html = views.understand.render(ctx, m);
  assert.match(html, /data-count="s1">3 responses · 2 respondents/);
  assert.match(html, /data-count="s2">4 responses · 2 respondents/);
  assert.match(html, /data-count="s3">1 response · 1 respondent</);
  assert.match(html, /data-lens-sum="Translation Team">7 responses across 2 of 2 surveys/);
  assert.match(html, /data-lens-sum="Church">1 response across 1 of 1 survey/);
  assert.match(html, /aria-label="Community"><h3>Community<\/h3><p class="small muted">No survey included for this lens\./); // archived s4 excluded; no invented "0"
  assert.doesNotMatch(html, /4 respondents/); // 2+2 never summed
  assert.doesNotMatch(html, /data-lens-sum="[^"]*">[^<]*respondent/); // no lens-level respondent number at all
  assert.ok(html.indexOf('Translation Team') < html.indexOf('>Church<') && html.indexOf('>Church<') < html.indexOf('Community'));
  assert.doesNotMatch(html, /Other perspective/);
  assert.ok(!calls.some(c => c.url.includes('/surveys/s4')), 'archived survey is not counted');
});

test('A3 results: the held literal with one plain line (U05), never the server policy code; no numbers or bands', async () => {
  const { api } = fakeApi(understandTable); const ctx = ctxFor(api);
  const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  const panel = html.slice(html.indexOf('data-results>'), html.indexOf('data-reports>'));
  assert.match(panel, /<span class="badge">held<\/span>/);
  assert.match(panel, /data-results-reason>Results appear after a report is built from at least three responses per group\.</); assert.doesNotMatch(panel, /D7 scoring/);
  assert.doesNotMatch(panel, /\b\d+\b/); // no numbers, no "0"
  assert.doesNotMatch(panel, /band/i);
});

test('Reports: server list plus preview control for exact assessment editor', async () => {
  const { api } = fakeApi(understandTable); const ctx = ctxFor(api);
  const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.match(html, /data-open-report="rep_1"/);
  assert.match(html, /data-preview-report/);
  assert.doesNotMatch(html, /data-confirm-report/);
});

test('A4 open report: GET /v2/reports/{id} rendered by report-view.js; held → reason', async () => {
  const report = { id: 'rep_1', created_at: '2026-09-17', payload: { source_commit: 'abcdef1234', versions: { scorer: 1, narrative: 1, policy: 'p' }, narrative: ['line one'] } };
  const { api, calls } = fakeApi({ ...understandTable, 'GET /v2/reports/rep_1': { report }, 'GET /v2/reports/rep_2': { suppressed: true, reason: 'held by policy' } });
  const ctx = ctxFor(api); const m = await views.understand.load(ctx, { aid: 'a1' });
  const appended = []; const doc = { createElement: tag => ({ tag, children: [], set textContent(t) { this.text = t; }, get textContent() { return this.text; }, append(...n) { this.children.push(...n); }, dataset: {}, addEventListener() {} }) };
  const view = { attrs: { 'data-report-view': '' }, replaceChildren(...n) { appended.splice(0, appended.length, ...n); }, textContent: '' };
  const b1 = el({ tag: 'button', 'data-open-report': 'rep_1' }), b2 = el({ tag: 'button', 'data-open-report': 'rep_2' });
  makeRoot([b1, b2, view, el({ 'data-report-status': '' })]); root.ownerDocument = doc;
  views.understand.bind(ctx, root, m);
  await b1.onclick();
  assert.ok(calls.some(c => c.url === '/v2/reports/rep_1' && !c.method));
  assert.match(appended[0].text, /^Synthetic data · source abcdef1/); // report-view.js header constant, untouched
  assert.equal(b1.disabled, false);
  await b2.onclick();
  assert.equal(m.openReport.status, 'held');
});

// R-1 (Auditor 04aee96 verdict): held / refused / render-failure must be VISIBLE — written to the Reports status, never only into
// the hidden full-width view; the full section stays hidden and the view is emptied.
test('R-1: held, refused and render-failure outcomes show in the visible Reports status; full view stays hidden with empty content', async () => {
  const bad = { id: 'rep_bad', created_at: '2026-09-17', payload: null };
  const { api } = fakeApi({ ...understandTable, 'GET /v2/reports/rep_held': { suppressed: true, reason: 'held by policy' }, 'GET /v2/reports/rep_refused': err('NOT_FOUND_OR_NOT_VISIBLE', 404), 'GET /v2/reports/rep_bad': { report: bad } });
  const ctx = ctxFor(api); const m = await views.understand.load(ctx, { aid: 'a1' });
  const doc = { createElement: tag => ({ tag, children: [], set textContent(t) { this.text = t; }, get textContent() { return this.text; }, append(...n) { this.children.push(...n); }, dataset: {}, addEventListener() {} }) };
  let viewKids = ['stale']; const full = el({ 'data-report-full': '' }); full.hidden = true;
  const view = { attrs: { 'data-report-view': '' }, replaceChildren(...n) { viewKids = n; }, textContent: '', parentHidden: () => full.hidden };
  const status = el({ 'data-report-status': '' }); status.hidden = false; status.ancestorHidden = false; // lives in the always-visible Reports card, not inside [data-report-full]
  const buttons = ['rep_held', 'rep_refused', 'rep_bad'].map(id => el({ tag: 'button', 'data-open-report': id }));
  makeRoot([...buttons, view, status, full]); root.ownerDocument = doc; views.understand.bind(ctx, root, m);
  const html = views.understand.render(ctx, m); const statusIdx = html.indexOf('data-report-status'), fullIdx = html.indexOf('data-report-full');
  assert.ok(statusIdx > -1 && fullIdx > -1 && statusIdx < fullIdx, 'status markup precedes the hidden full section (not nested in it)');
  assert.ok(!html.slice(fullIdx).includes('data-report-status'), 'no status element inside the hidden full section');
  await buttons[0].onclick(); assert.equal(status.textContent, 'held by policy'); assert.equal(full.hidden, true); assert.deepEqual(viewKids, []);
  await buttons[1].onclick(); assert.equal(status.textContent, NOT_VISIBLE); assert.equal(full.hidden, true); assert.deepEqual(viewKids, []);
  await buttons[2].onclick(); assert.equal(m.openReport.status, 'error'); assert.equal(status.textContent, 'This report could not be displayed.'); assert.equal(full.hidden, true);
  for (const b of buttons) assert.equal(b.disabled, false);
});

test('A6 reports 404 → unavailable; results/counts failures are per-part, never a page failure', async () => {
  const { api } = fakeApi({ ...understandTable, 'GET /v2/assessments/a1/reports': err('NOT_FOUND_OR_NOT_VISIBLE', 404), 'GET /v2/assessments/a1/surveys/s2': err('ECONN', 0, 'API unavailable') });
  const ctx = ctxFor(api); const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.match(html, /data-reports-unavailable>Reports are unavailable/);
  assert.match(html, /data-count="s2" role="alert">count unavailable/);
  assert.match(html, /data-lens-sum="Translation Team">3 responses across 1 of 2 surveys <strong>\(partial\)/);
  assert.match(html, /data-results-reason>Results appear after a report is built/); // U05
});

test('A7 improve viewer: read-only notes, no save control, visibility line; text escaped', async () => {
  const { api } = fakeApi({}); const ctx = ctxFor(api, { current: { assessment: { ...assessment, role: 'viewer' }, surveys } });
  const html = views.improve.render(ctx, await views.improve.load(ctx, { aid: 'a1' }));
  assert.doesNotMatch(html, /<textarea|data-save-notes|Save/);
  assert.match(html, /data-notes-reflection>r&lt;1&gt;</); assert.match(html, /data-notes-next-steps>n&amp;2</);
  assert.ok(html.includes(NOTES_VISIBILITY));
  assert.doesNotMatch(html, /undo/i);
  assert.ok(!html.includes(esc(RECOMMENDATIONS_NOT_BUILT))); // v3 L3-4: aside not drawn (PARITY I1)
  assert.match(html, /What happens next\?/); assert.match(html, /<h3>What you noticed<\/h3>/);
  assert.ok(!(await views.improve.load(ctx, { aid: 'a1' })).editable);
});

test('A8 improve owner/member: one Save → PATCH /v2/assessments/{aid}/notes with both fields; refresh after server result', async () => {
  const { api, calls } = fakeApi({ 'PATCH /v2/assessments/a1/notes': ({ body }) => ({ assessment: { ...assessment, ...body } }) });
  let refreshed = 0; const ctx = ctxFor(api, { current: { assessment: { ...assessment, role: 'member' }, surveys }, refresh: async () => { refreshed++; } });
  const m = await views.improve.load(ctx, { aid: 'a1' }); const html = views.improve.render(ctx, m);
  assert.equal((html.match(/data-save-notes/g) || []).length, 1); assert.match(html, /<textarea name="notes_reflection"[^>]*>r&lt;1&gt;</);
  assert.ok(html.includes(NOTES_VISIBILITY));
  const form = el({ 'data-notes-form': '' }), btn = el({ tag: 'button', 'data-save-notes': '' }), status = el({ 'data-notes-status': '' });
  const ta1 = el({ name: 'notes_reflection', value: 'new r' }), ta2 = el({ name: 'notes_next_steps', value: 'new n' });
  makeRoot([form, btn, status, ta1, ta2]); views.improve.bind(ctx, root, m);
  let disabledDuring = null; const origApi = ctx.api; ctx.api = async (...a) => { disabledDuring = btn.disabled; return origApi(...a); };
  await form.onsubmit({ preventDefault() {} });
  assert.deepEqual(calls[0], { url: '/v2/assessments/a1/notes', method: 'PATCH', body: { notes_reflection: 'new r', notes_next_steps: 'new n' } });
  assert.equal(disabledDuring, true); assert.equal(btn.disabled, false);
  assert.equal(status.textContent, 'Notes saved.'); assert.equal(refreshed, 1); assert.equal(m.notes_reflection, 'new r');
});

test('A8c v3 next step (frame 11): one "Save notes" in any stage, never a stage write from this page', async () => {
  const { api, calls } = fakeApi({ 'PATCH /v2/assessments/a1/notes': ({ body }) => ({ assessment: { ...assessment, ...body } }) });
  const ctx = ctxFor(api, { current: { assessment: { ...assessment, role: 'member', stage: 'understand' }, surveys }, refresh: async () => {} });
  const m = await views.improve.load(ctx, { aid: 'a1' }); const html = views.improve.render(ctx, m);
  assert.match(html, /data-v3-next/); assert.match(html, /data-save-notes>Save notes</); assert.doesNotMatch(html, /Recommendations|finish/i);
  assert.match(html, /What you noticed/); assert.match(html, /The next step/);
  const form = el({ 'data-notes-form': '' }), btn = el({ tag: 'button', 'data-save-notes': '' }), status = el({ 'data-notes-status': '' });
  makeRoot([form, btn, status, el({ name: 'notes_reflection', value: 'r' }), el({ name: 'notes_next_steps', value: 'n' })]); views.improve.bind(ctx, root, m);
  await form.onsubmit({ preventDefault() {} });
  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), ['PATCH /v2/assessments/a1/notes']); assert.equal(status.textContent, 'Notes saved.');
});

test('A8b save failure: no success claim, refusal wording', async () => {
  const { api } = fakeApi({ 'PATCH /v2/assessments/a1/notes': err('NOT_AUTHORIZED_AT_SCOPE', 403) });
  let refreshed = 0; const ctx = ctxFor(api, { refresh: async () => { refreshed++; } }); const m = await views.improve.load(ctx, { aid: 'a1' });
  const form = el({ 'data-notes-form': '' }), btn = el({ tag: 'button', 'data-save-notes': '' }), status = el({ 'data-notes-status': '' });
  makeRoot([form, btn, status, el({ name: 'notes_reflection' }), el({ name: 'notes_next_steps' })]); views.improve.bind(ctx, root, m);
  await form.onsubmit({ preventDefault() {} });
  assert.match(status.textContent, /^Not visible to you: the notes were not saved/); assert.equal(refreshed, 0);
});

test('A9 RESERVED_NOT_BUILT / 501 is its own state, never the generic retry', async () => {
  assert.equal(classify(err('RESERVED_NOT_BUILT', 501)), 'not_built'); assert.equal(classify(err('501', 501)), 'not_built');
  assert.equal(classify(err('ECONN', 0)), 'failed'); assert.equal(classify(err('NOT_AUTHENTICATED', 401)), 'unauthenticated');
  const { api } = fakeApi({ ...understandTable, 'GET /v2/assessments/a1/reports': err('RESERVED_NOT_BUILT', 501) });
  const ctx = ctxFor(api); const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  const panel = html.slice(html.indexOf('data-reports>'));
  assert.match(panel, /Reports is not built yet/); assert.doesNotMatch(panel, /Retry/);
  // improve never probes recommendations: zero calls, static "not built" text
  const p = fakeApi({}); const c2 = ctxFor(p.api); views.improve.render(c2, await views.improve.load(c2, { aid: 'a1' }));
  assert.equal(p.calls.length, 0);
});

// G1: the Permissions page and its negative cases are covered in ./permissions.test.mjs (Auth contract 2026-09-18).
test('permissions view is the G1 module', async () => { const g1 = await import('./permissions.js'); assert.equal(views.permissions, g1.permissions); });

test('css export is a string', () => { assert.equal(typeof css, 'string'); assert.match(css, /\.grants/); });

// Checkpoint 5: readable report display — rounded text, exact value retained on the element; human dates; IDs in <details>.
test('readableNumbers rounds long decimals to one place and keeps the exact value; skips code/details; humanDate is human', async () => {
  const { readableNumbers, humanDate } = await import('./views.js');
  const doc = { createTreeWalker(root) { const list = []; (function walk(n) { for (const c of n.childNodes || []) { if (c.nodeType === 3) list.push(c); else walk(c); } })(root); let i = -1; return { nextNode: () => list[++i] || null }; }, createDocumentFragment() { return { kids: [], append(...x) { this.kids.push(...x); } }; }, createElement(t) { return { tag: t, dataset: {}, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }; } };
  const mk = (text, parent) => ({ nodeType: 3, nodeValue: text, parentElement: parent, replaced: null, replaceWith(f) { this.replaced = f; } });
  const plain = mk('Church 91.35416666666667 · Affirmation · 86.16666666666667 · 3 · built 2026-09-17T22:15:39.634Z', { closest: () => null });
  const inCode = mk('sreport_928bb601 91.35416666666667', { closest: sel => sel.includes('code') ? {} : null });
  const root = { ownerDocument: doc, childNodes: [plain, inCode] };
  assert.equal(readableNumbers(root), 2);
  const spans = plain.replaced.kids.filter(k => k && k.tag === 'span'); assert.deepEqual(spans.map(s => s.textContent), ['91.4', '86.2']); assert.deepEqual(spans.map(s => s.dataset.exact), ['91.35416666666667', '86.16666666666667']); assert.equal(spans[0].title, 'exact: 91.35416666666667');
  assert.equal(inCode.replaced, null, 'text inside code/details is left exact');
  assert.match(humanDate('2026-09-17T22:15:39.634Z'), /2026/); assert.equal(humanDate('not a date'), 'not a date');
});
test('report list shows a human title/date with the raw id inside <details>, not in the button', async () => {
  const { api } = fakeApi({ 'GET /v2/assessments/a1/results': { ok: true, suppressed: true, status: 'held', reason: 'D7 held', summary: null }, 'GET /v2/assessments/a1/reports': { suppressed: false, reports: [{ id: 'sreport_928bb601-f318-4cca-b48c-e4683371c6c8', created_at: '2026-09-17T22:15:39.634Z' }] } });
  const ctx = ctxFor(api, { current: { assessment, surveys: [] } }); const m = await views.understand.load(ctx, { aid: 'a1' }); const html = views.understand.render(ctx, m);
  const btn = html.match(/<button type="button" data-open-report="[^"]+">([^<]+)<\/button>/)[1];
  assert.match(btn, /^Report 1 · built /); assert.doesNotMatch(btn, /sreport_|T22:15/);
  assert.match(html, /<details class="small muted report-ids"><summary>Report id<\/summary><code>sreport_928bb601-f318-4cca-b48c-e4683371c6c8<\/code>/);
});

test('v3 U4 gate in Understand: checkbox arms Record my review; click posts set_stage understand then reloads', async () => {
  const collecting = { ...assessment, stage: 'collect' };
  const table = { ...understandTable, 'POST /v2/assessments/a1/stage': { assessment: { ...collecting, stage: 'understand' } } };
  const { api, calls } = fakeApi(table); const gone = [];
  const dirty = new Map();
  const ctx = ctxFor(api, { current: { assessment: collecting, surveys }, state: { principal: { id: 'me' }, dirty }, go: (to, o) => gone.push([to, o]) });
  const m = await views.understand.load(ctx, { aid: 'a1' }); const html = views.understand.render(ctx, m);
  assert.match(html, /data-v3-gate-go="recordReview" disabled>Record my review/);
  const btn = el({ 'data-v3-gate-go': 'recordReview', tag: 'button' }); btn.disabled = true;
  const chk = el({ 'data-v3-review-check': '' }); const status = el({ 'data-v3-gate-status': '' });
  const r = makeRoot([btn, chk, status]); views.understand.bind(ctx, r, m);
  await btn.onclick(); assert.equal(calls.filter(c => c.method === 'POST').length, 0, 'unchecked: no write');
  chk.checked = true; chk.onchange(); assert.equal(btn.disabled, false);
  await btn.onclick();
  const posts = calls.filter(c => c.method === 'POST'); assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/v2/assessments/a1/stage'); assert.deepEqual(posts[0].body, { stage: 'understand' });
  assert.equal(gone.at(-1)[0], '#assessment/a1/understand'); assert.equal(status.textContent, 'Review recorded.');
  assert.equal(dirty.get('a1'), 'write', 'committed stage marks the assessment dirty so the shell refetches it (Bugbot 4093922740)');
});
test('v3 U4 gate: viewers see the state only, no write control', async () => {
  const { api } = fakeApi(understandTable);
  const ctx = ctxFor(api, { current: { assessment: { ...assessment, stage: 'collect', role: 'viewer' }, surveys } });
  const m = await views.understand.load(ctx, { aid: 'a1' });
  assert.doesNotMatch(views.understand.render(ctx, m), /data-v3-gate-go/);
});
