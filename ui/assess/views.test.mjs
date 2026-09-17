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

test('A3 results: the held literal with the server reason; no numbers or bands', async () => {
  const { api } = fakeApi(understandTable); const ctx = ctxFor(api);
  const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  const panel = html.slice(html.indexOf('data-results>'), html.indexOf('data-reports>'));
  assert.match(panel, /<span class="badge">held<\/span>/);
  assert.match(panel, /data-results-reason>D7 scoring, threshold, and differencing policy unresolved</);
  assert.doesNotMatch(panel, /\b\d+\b/); // no numbers, no "0"
  assert.doesNotMatch(panel, /band/i);
});

test('A4/A5 reports: list rendered from the server; no Build/Preview control anywhere', async () => {
  const { api } = fakeApi(understandTable); const ctx = ctxFor(api);
  const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.match(html, /data-open-report="rep_1"/);
  assert.doesNotMatch(html, /build/i);
  assert.doesNotMatch(html, /preview/i);
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
  assert.equal(m.openReport.status, 'held'); assert.equal(view.textContent, 'held by policy');
});

test('A6 reports 404 → unavailable; results/counts failures are per-part, never a page failure', async () => {
  const { api } = fakeApi({ ...understandTable, 'GET /v2/assessments/a1/reports': err('NOT_FOUND_OR_NOT_VISIBLE', 404), 'GET /v2/assessments/a1/surveys/s2': err('ECONN', 0, 'API unavailable') });
  const ctx = ctxFor(api); const html = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.match(html, /data-reports-unavailable>Reports are unavailable/);
  assert.match(html, /data-count="s2" role="alert">count unavailable/);
  assert.match(html, /data-lens-sum="Translation Team">3 responses across 1 of 2 surveys <strong>\(partial\)/);
  assert.match(html, /data-results-reason>D7/);
});

test('A7 improve viewer: read-only notes, no save control, visibility line; text escaped', async () => {
  const { api } = fakeApi({}); const ctx = ctxFor(api, { current: { assessment: { ...assessment, role: 'viewer' }, surveys } });
  const html = views.improve.render(ctx, await views.improve.load(ctx, { aid: 'a1' }));
  assert.doesNotMatch(html, /<textarea|data-save-notes|Save/);
  assert.match(html, /data-notes-reflection>r&lt;1&gt;</); assert.match(html, /data-notes-next-steps>n&amp;2</);
  assert.ok(html.includes(NOTES_VISIBILITY));
  assert.doesNotMatch(html, /undo/i);
  assert.ok(html.includes(esc(RECOMMENDATIONS_NOT_BUILT)));
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

test('permissions: refusal → "Not visible to you"; no-inheritance line on every scope page', async () => {
  const { api } = fakeApi({ 'GET /v2/project/p1/grants': err('NOT_AUTHORIZED_AT_SCOPE', 403) }); const ctx = ctxFor(api);
  const html = views.permissions.render(ctx, await views.permissions.load(ctx, { scope: 'projects', id: 'p1' }));
  assert.ok(html.includes(NOT_VISIBLE)); assert.match(html, /Permissions apply to this project only; nothing is inherited\./);
  assert.doesNotMatch(html, /data-invite-form|data-revoke|Retry/);
});

// F2 (PR65 bf9be9b verdict): the AS1 grants contract is read-only. Grants + pending invitations render; no mutation control
// (invite, revoke, role change, transfer) exists in the DOM at any role, and no write or danger twin is ever requested.
test('permissions: read-only — grants and pending invitations listed, zero mutation controls, no writes, danger twins never requested', async () => {
  const w = fakeApi({ 'GET /v2/workspace/w1/grants': { grants: [{ id: 'g1', principal_id: 'me', role: 'owner' }, { id: 'g2', principal_id: 'u2', role: 'member' }], pending_invitations: [{ id: 'inv1', role: 'viewer', created_at: '2026-09-17T00:00:00Z' }] } });
  const ctx = ctxFor(w.api); const m = await views.permissions.load(ctx, { scope: 'workspaces', id: 'w1' }); const html = views.permissions.render(ctx, m);
  assert.equal(m.myRole, 'owner'); assert.match(html, /Permissions apply to this workspace only; nothing is inherited\./);
  assert.match(html, /<td>me <span class="muted small">\(you\)<\/span><\/td><td>owner<\/td>/); assert.match(html, /<td>u2<\/td><td>member<\/td>/);
  assert.match(html, /Pending invitations/); assert.match(html, /viewer · invited 2026-09-17T00:00:00Z/);
  assert.doesNotMatch(html, /data-invite-form|data-revoke|data-transfer-form|data-confirm|<form|<button|<select|Change role|Remove|Transfer ownership|Invite someone/);
  assert.match(html, /not done here yet/); assert.match(html, /href="\/legacy\/#facilitator"/);
  const root = makeRoot([]); views.permissions.bind(ctx, root, m);
  assert.deepEqual(w.calls.map(c => `${c.method || 'GET'} ${c.url}`), ['GET /v2/workspace/w1/grants']);
  for (const role of ['member', 'viewer']) { const c = ctxFor(w.api, { current: { assessment: { ...assessment, role }, surveys } }); const h = views.permissions.render(c, await views.permissions.load(c, { scope: 'assessments', id: 'a1', role })); assert.doesNotMatch(h, /<form|<button|<select/, role); }
});

test('css export is a string', () => { assert.equal(typeof css, 'string'); assert.match(css, /\.grants/); });
