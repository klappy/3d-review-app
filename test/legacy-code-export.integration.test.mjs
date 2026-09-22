// node --test test/legacy-code-export.integration.test.mjs — REAL ui/legacy/index.html + REAL ui/app.js (imports stripped,
// the real modules injected as globals) in jsdom over a synthetic fail-closed fetch installed BEFORE any script runs.
// Simulates exactly the code endpoints (/v2/me, assessment/survey listing needed to select, /codes, /codes/export).
// Unknown or non-local reads/writes fail closed. No real issue/export, no cookies, no real session token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const legacyAdapter = await import('../ui/kit/legacy-adapter.js');
const ORIGIN = 'http://127.0.0.1:4173';
const HTML = readFileSync(new URL('../ui/legacy/index.html', import.meta.url), 'utf8');
const APP_SRC = readFileSync(new URL('../ui/app.js', import.meta.url), 'utf8');
const APP = APP_SRC.replace(/^import .*;\n/gm, '');
const tick = (n = 8) => new Promise(r => { let i = 0; (function step() { if (++i > n) return r(); setTimeout(step, 0); })(); });
const SYNTHETIC = { aid: 'asm_synthetic_1', sid: 'svy_synthetic_1', sid2: 'svy_synthetic_2', pid: 'prj_synthetic_1' };

// Synthetic transport: exact code endpoints + the minimal reads app.js performs to reach a selected survey. Everything
// else → served 404 with ok:false (fail closed) and logged. Handlers may be held (deferred) to interleave context changes.
function createTransport() {
  const log = [], holds = [];
  let issued = 0, tokens = 0;
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const result = (r, extra = {}) => json(200, { ok: true, result: r, capability: 'v2', receipt: { id: `rcpt_${log.length}` }, trace_id: `trace_${log.length}`, ...extra });
  const routes = {
    'GET /v2/me': () => result({ principal: { id: 'p_synth', kind: 'facilitator', provisioned: true }, grants: [{ scope_type: 'project', scope_id: SYNTHETIC.pid, role: 'owner' }] }),
    'GET /v2/templates': () => result({ templates: [{ id: 'tpl_1', name: 'Synthetic T1', perspective: 'team' }] }),
    [`GET /v2/projects/${SYNTHETIC.pid}/languages`]: () => result({ languages: [] }),
    'GET /v2/projects': () => result({ projects: [{ id: SYNTHETIC.pid, name: 'Synthetic project', role: 'owner' }] }),
    [`GET /v2/projects/${SYNTHETIC.pid}`]: () => result({ project: { id: SYNTHETIC.pid, name: 'Synthetic project', role: 'owner' }, languages: [] }),
    [`GET /v2/projects/${SYNTHETIC.pid}/assessments`]: () => result({ assessments: [{ id: SYNTHETIC.aid, name: 'Synthetic assessment', stage: 'collect', role: 'owner' }] }),
    [`GET /v2/assessments/${SYNTHETIC.aid}`]: () => result({ assessment: { id: SYNTHETIC.aid, name: 'Synthetic assessment', stage: 'collect', role: 'owner', project_id: SYNTHETIC.pid }, surveys: [{ id: SYNTHETIC.sid, template_name: 'Synthetic T1', collection_status: 'open' }, { id: SYNTHETIC.sid2, template_name: 'Synthetic T2', collection_status: 'open' }] }),
    [`GET /v2/assessments/${SYNTHETIC.aid}/surveys`]: () => result({ surveys: [{ id: SYNTHETIC.sid, template_name: 'Synthetic T1', collection_status: 'open' }, { id: SYNTHETIC.sid2, template_name: 'Synthetic T2', collection_status: 'open' }] }),
  };
  for (const sid of [SYNTHETIC.sid, SYNTHETIC.sid2]) {
    routes[`POST /v2/assessments/${SYNTHETIC.aid}/surveys/${sid}/codes`] = body => {
      const count = body?.count;
      if (!Number.isInteger(count) || count < 1 || count > 100) return json(400, { ok: false, error: { code: 'VALIDATION', message: 'count must be 1–100' } });
      const ids = Array.from({ length: count }, () => `code_${sid}_${++issued}`);
      return result({ count, ids });
    };
    routes[`POST /v2/assessments/${SYNTHETIC.aid}/surveys/${sid}/codes/export`] = body => {
      const ids = body?.params?.ids;
      if (!Array.isArray(ids) || !ids.length) return json(400, { ok: false, error: { code: 'VALIDATION', message: 'ids required' } });
      if (body.mode === 'dry_run') return result({ count: ids.length, impact: { reveals: ids.length, once: true }, confirm_token: `ct_${++tokens}`, expires_in: 120 });
      if (body.mode === 'execute') {
        if (typeof body.confirm_token !== 'string' || !body.confirm_token.startsWith('ct_')) return json(409, { ok: false, error: { code: 'CONFIRMATION_EXPIRED', message: 'preview again' } });
        return result({ codes: ids.map(id => ({ id, code: `SECRET-${id.toUpperCase()}` })) });
      }
      return json(400, { ok: false, error: { code: 'VALIDATION', message: 'mode' } });
    };
  }
  let holdNext = null; // { match: key => bool } → returns a release handle
  const fetch = async (url, init = {}) => {
    const u = new URL(url, ORIGIN);
    if (u.origin !== ORIGIN) { log.push({ key: `${init.method || 'GET'} ${url}`, outcome: 'refused-nonlocal' }); throw new TypeError('nonlocal'); }
    const key = `${init.method || 'GET'} ${u.pathname}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    const entry = { key, body, auth: init.headers?.authorization || null, outcome: 'pending' }; log.push(entry);
    const handler = routes[key];
    if (!handler) { entry.outcome = 'failed-closed'; return json(404, { ok: false, error: { code: 'NOT_FOUND', message: 'synthetic: unknown route' } }); }
    if (holdNext && holdNext.match(key)) {
      const gate = {}; gate.promise = new Promise((resolve, reject) => { gate.release = () => { entry.outcome = 'served-after-hold'; resolve(handler(body)); }; gate.reject = (status, code) => { entry.outcome = 'rejected-after-hold'; resolve(json(status, { ok: false, error: { code, message: code } })); }; });
      holds.push(gate); holdNext = null; entry.hold = gate; return gate.promise;
    }
    entry.outcome = 'served'; return handler(body);
  };
  return { fetch, log, holds, hold(match) { holdNext = { match }; }, served: () => log.filter(l => l.outcome.startsWith('served')).map(l => l.key) };
}

async function bootLegacy({ install } = {}) {
  const transport = createTransport(); if (install) install(transport);
  const dom = new JSDOM(HTML, { url: ORIGIN + '/legacy/#session=synthsession', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  w.fetch = transport.fetch; // BEFORE any script runs
  w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.scrollTo = () => {}; w.confirm = () => false; w.print = () => {};
  w.navigator.clipboard = { writeText: async () => {} };
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  // The real modules read the DOM lazily through the `document`/`window` globals; point node's globals at THIS page
  // before the first import and again for every boot (jsdom per test).
  for (const k of ['window', 'document', 'location', 'history', 'navigator', 'sessionStorage', 'localStorage', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'FormData', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia', 'CSS']) { try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch {} }
  const mods = await Promise.all(['../ui/public-entry.js', '../ui/kit/legacy-adapter.js', '../ui/participant-view.js', '../ui/diagnostic-path.js', '../ui/collab-mount.js', '../ui/entity-screen.js', '../ui/lens-surveys.js', '../ui/stage-screens.js', '../ui/language.js', '../ui/present.js', '../ui/visibility.js', '../ui/report-view.js', '../ui/participant-resume.js', '../ui/shared-link.js'].map(m => import(m)));
  const globals = {}; for (const m of mods) Object.assign(globals, m); globals.sharedCopy = mods[13].copy; globals.saveDr = undefined;
  Object.assign(w, globals);
  const ctx = dom.getInternalVMContext();
  const exported = vm.runInContext(APP + '\n({ state, api, run, codeRun, clearCodeBatch, codeSnapshot, resetClientIdentity })', ctx, { filename: 'app.js' });
  await tick(16); // boot: #session= → identity → visible cards
  const d = w.document;
  const q = s => d.querySelector(s), qa = s => [...d.querySelectorAll(s)];
  const text = s => (q(s)?.textContent || '').trim();
  const click = id => { const b = d.getElementById(id); assert.ok(b, id); assert.equal(b.disabled, false, `${id} enabled`); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const select = async (id, value) => { const s = d.getElementById(id); s.value = value; s.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(12); };
  const events = () => qa('#events li').map(li => li.textContent);
  const controlState = () => Object.fromEntries(qa('button').filter(b => b.id).map(b => [b.id, b.disabled]));
  return { dom, w, d, q, qa, text, click, select, events, controlState, transport, app: exported };
}
// Drive the real controllers to a selected survey: projects → project → assessments → assessment → survey.
async function selectSurvey(p, sid = SYNTHETIC.sid) {
  p.click('load-projects'); await tick(12);
  await p.select('projects', SYNTHETIC.pid);
  p.click('load-assessments'); await tick(12);
  await p.select('assessments', SYNTHETIC.aid);
  await p.select('surveys', sid);
  assert.equal(p.app.state.survey, sid);
}
const codeIds = p => p.app.state.codeIds;

test('legacy entry boots the real page; code region is kit-presented with the same control ids and disabled release control', async () => {
  const p = await bootLegacy();
  assert.equal(p.text('#identity'), 'facilitator · p_synth');
  const region = p.q('[data-code-batch]'); assert.ok(region, 'kit code-batch region');
  for (const id of legacyAdapter.CODE_IDS) assert.ok(region.querySelector('#' + id), id);
  assert.equal(p.q('#release-codes').disabled, true);
  assert.equal(p.q('#codes-output').hidden, true);
  assert.equal(p.q('[data-code-review]').hidden, true);
  assert.equal(p.text('[data-code-phase]'), 'Not issued');
});

test('issue → preview: exact targets/bodies, values hidden until execute, badge/review painted, evidence rows redacted', async () => {
  const p = await bootLegacy(); await selectSurvey(p);
  p.q('#code-count').value = '3'; p.click('issue-codes'); await tick(12);
  assert.deepEqual(codeIds(p), [`code_${SYNTHETIC.sid}_1`, `code_${SYNTHETIC.sid}_2`, `code_${SYNTHETIC.sid}_3`]);
  assert.equal(p.text('[data-code-phase]'), '3 ID(s) issued');
  assert.equal(p.text('#notice'), 'Issuing code IDs… — complete.');
  const issue = p.transport.log.find(l => l.key.endsWith('/codes'));
  assert.equal(issue.key, `POST /v2/assessments/${SYNTHETIC.aid}/surveys/${SYNTHETIC.sid}/codes`); assert.deepEqual(issue.body, { count: 3 }); assert.equal(issue.auth, 'Bearer synthsession');
  assert.equal(p.q('#codes-output').hidden, true); assert.equal(p.text('#codes-output'), '');
  p.click('preview-export'); await tick(12);
  const dry = p.transport.log.find(l => l.body?.mode === 'dry_run');
  assert.deepEqual(dry.body, { params: { ids: codeIds(p) }, mode: 'dry_run' });
  assert.equal(p.app.state.confirmToken, 'ct_1');
  assert.equal(p.q('#release-codes').disabled, false, 'confirm enabled only after preview');
  assert.equal(p.q('[data-code-review]').hidden, false); assert.equal(p.text('[data-code-review-title]'), 'Confirm action');
  assert.match(p.text('#export-impact'), /Release 3 code value\(s\) once; impact: \{"reveals":3,"once":true\}\. Confirmation expires in 120 seconds\./);
  assert.equal(p.q('#codes-output').hidden, true, 'values still hidden after preview');
  const rows = p.events(); assert.equal(rows.length >= 2, true);
  assert.ok(rows.some(r => r.startsWith('POST ') && r.includes('/codes/export') && r.includes('rcpt_')), 'redacted preview evidence row present');
  assert.ok(!rows.join('\n').includes('ct_1'), 'no confirmation token in events'); assert.ok(!rows.join('\n').includes('SECRET'), 'no code values in events');
  assert.ok(!p.d.body.textContent.includes('SECRET'), 'no code values anywhere before execute');
});

test('count validation: 0 / 101 / fraction refused before any request; 1 and 100 dispatch', async () => {
  const p = await bootLegacy(); await selectSurvey(p);
  for (const bad of ['0', '101', '2.5']) { p.q('#code-count').value = bad; p.click('issue-codes'); await tick(8); assert.equal(p.text('#error'), 'Code count must be 1–100.'); assert.equal(codeIds(p), null); }
  assert.equal(p.transport.log.filter(l => l.key.endsWith('/codes')).length, 0, 'no issue request for invalid counts');
  p.q('#code-count').value = '100'; p.click('issue-codes'); await tick(12); assert.equal(codeIds(p).length, 100);
  p.q('#code-count').value = '1'; p.click('issue-codes'); await tick(12); assert.equal(codeIds(p).length, 1);
});

test('controls: every non-code control returns to its ORIGINAL disabled state after a code action (no blanket enable)', async () => {
  const p = await bootLegacy(); await selectSurvey(p);
  const before = p.controlState();
  assert.equal(before['release-codes'], true); assert.equal(before['issue-link-confirm'], true); assert.equal(before['build-report'], true);
  p.q('#code-count').value = '2'; p.click('issue-codes'); await tick(12);
  const after = p.controlState();
  for (const [id, was] of Object.entries(before)) if (!['release-codes', 'issue-link-confirm', 'build-report'].includes(id)) assert.equal(after[id], was, `${id} restored to original`);
  assert.equal(after['release-codes'], true); // still no token
});

test('duplicate pending invocation is refused: a second click while issue is held dispatches nothing', async () => {
  const p = await bootLegacy(); await selectSurvey(p);
  p.transport.hold(k => k.endsWith('/codes'));
  p.q('#code-count').value = '2'; p.click('issue-codes'); await tick(4);
  assert.equal(p.q('#issue-codes').disabled, true, 'held');
  p.q('#issue-codes').dispatchEvent(new p.w.MouseEvent('click', { bubbles: true })); await tick(4);
  assert.equal(p.transport.log.filter(l => l.key.endsWith('/codes')).length, 1);
  p.transport.holds[0].release(); await tick(12);
  assert.equal(codeIds(p).length, 2);
});

// ---- Guarded effect chain: held operation × context replacement × success/reject ----
const REPLACE = {
  survey: async p => { await p.select('surveys', SYNTHETIC.sid2); },
  assessment: async p => { await p.select('assessments', ''); },
  // Sign-out's own button is held during any pending operation (as under run()); identity replacement reaches the page
  // through the same reset the sign-out handler, #session= entry and 401 recovery call.
  identity: async p => { p.app.resetClientIdentity(); p.app.state.session = null; p.w.sessionStorage.removeItem('facilitatorToken'); await tick(4); },
};
async function stage(p, op) {
  if (op === 'issue') { p.q('#code-count').value = '2'; p.transport.hold(k => k.endsWith('/codes')); p.click('issue-codes'); }
  if (op === 'preview') { p.q('#code-count').value = '2'; p.click('issue-codes'); await tick(12); p.transport.hold(k => k.endsWith('/codes/export')); p.click('preview-export'); }
  if (op === 'execute') { p.q('#code-count').value = '2'; p.click('issue-codes'); await tick(12); p.click('preview-export'); await tick(12); p.transport.hold(k => k.endsWith('/codes/export')); p.click('release-codes'); }
  await tick(4);
  assert.equal(p.transport.holds.length, 1, `${op} held`);
}
for (const op of ['issue', 'preview', 'execute']) for (const [what, replace] of Object.entries(REPLACE)) for (const outcome of ['success', 'reject']) {
  test(`held ${op} × replace ${what} × ${outcome}: no stale ids/token/values/notice/evidence/control change in the new context`, async () => {
    const p = await bootLegacy(); await selectSurvey(p);
    const origin = p.controlState(); // each control's disabled state at dispatch — the only state a stale return may restore
    await stage(p, op);
    await replace(p);
    const snapshot = { ids: codeIds(p), token: p.app.state.confirmToken, notice: p.text('#notice'), error: p.text('#error'), events: p.events(), output: p.text('#codes-output'), outputHidden: p.q('#codes-output').hidden, phase: p.text('[data-code-phase]'), impact: p.text('#export-impact'), controls: p.controlState(), survey: p.app.state.survey, session: p.app.state.session };
    assert.equal(snapshot.ids, null, 'invalidation cleared ids'); assert.equal(snapshot.token, null);
    if (outcome === 'success') p.transport.holds[0].release(); else p.transport.holds[0].reject(409, 'REJECTED_LATE');
    await tick(16);
    assert.equal(codeIds(p), null, 'stale ids not adopted'); assert.equal(p.app.state.confirmToken, null, 'stale token not adopted');
    assert.equal(p.text('#codes-output'), '', 'no stale values'); assert.equal(p.q('#codes-output').hidden, true);
    assert.equal(p.text('[data-code-phase]'), snapshot.phase); assert.equal(p.text('#export-impact'), snapshot.impact);
    assert.equal(p.text('#notice'), snapshot.notice, 'no stale completion/failure notice'); assert.equal(p.text('#error'), snapshot.error);
    assert.deepEqual(p.events(), snapshot.events, 'no stale diagnostic receipt/trace row');
    // Control restoration rule: state-derived controls follow current state; any other control is restored to its ORIGINAL
    // disabled state at dispatch (never blanket-enabled). A control the new context had already enabled stays enabled.
    const after = p.controlState();
    for (const [id, disabled] of Object.entries(after)) {
      if (id === 'release-codes') assert.equal(disabled, true, 'release-codes follows null token');
      else if (['issue-link-confirm', 'build-report', 'version', 'changelog-close'].includes(id)) continue;
      else assert.equal(disabled, snapshot.controls[id] === false ? false : origin[id], `${id}: restored to original, not blanket-enabled`);
    }
    assert.ok(Object.entries(origin).every(([id, was]) => !was || ['release-codes', 'issue-link-confirm', 'build-report'].includes(id) || after[id] === true || snapshot.controls[id] === false), 'no control disabled at dispatch was enabled by the stale return');
    assert.ok(!p.d.body.textContent.includes('SECRET'), 'no secret leaked');
    assert.equal(p.app.state.survey, snapshot.survey); assert.equal(p.app.state.session, snapshot.session);
    assert.equal(p.transport.log.filter(l => l.hold).length, 1, 'no automatic retry of the held request');
  });
}

test('still-current held issue: released after a wait → adopted with truthful notice and redacted evidence', async () => {
  const p = await bootLegacy(); await selectSurvey(p);
  await stage(p, 'issue'); await tick(6);
  p.transport.holds[0].release(); await tick(12);
  assert.equal(codeIds(p).length, 2); assert.equal(p.text('#notice'), 'Issuing code IDs… — complete.');
  assert.ok(p.events().some(r => r.includes('/codes') && r.includes('rcpt_')), 'current evidence retained');
});
