import test from 'node:test';
import assert from 'node:assert/strict';
import { countLabel, expectedValue, launchPlan, launch, validateStep, freshDraft, latestTemplates, renderStep, NEW_PROJECT, expectedFor, EXPECTED_KEY } from './wizard.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const draft = (o = {}) => ({ ...freshDraft(), name: 'Oct', project: 'p1', language: 'l1', groups: { 'tpl.team': { version: '3', expected: '10' }, 'tpl.community': { version: '2', expected: '' } }, ...o });

test('ruling (a): denominator only when entered', () => {
  assert.equal(countLabel(4, 10), '4 of 10');
  assert.equal(countLabel(4, null), '4 responded');
  assert.equal(countLabel(0, expectedValue('')), '0 responded');
  for (const bad of ['', ' ', '0', '-3', '2.5', 'abc', null, undefined]) assert.equal(expectedValue(bad), null, String(bad));
  assert.equal(expectedValue(' 12 '), 12);
});

test('validation per step', () => {
  assert.ok(validateStep('details', freshDraft()).length >= 2);
  assert.deepEqual(validateStep('details', draft()), []);
  assert.ok(validateStep('details', draft({ project: NEW_PROJECT })).length === 2);
  assert.deepEqual(validateStep('details', draft({ project: NEW_PROJECT, newProject: 'Hill', newLanguage: 'Hill' })), []);
  assert.ok(validateStep('participants', draft({ groups: {} })).length === 1);
});

test('launch plan order maps onto the unchanged contract', () => {
  assert.deepEqual(launchPlan(draft()).map(s => s.cap), ['cap.assessment.create', 'cap.survey.select', 'cap.survey.select', 'cap.assessment.set_stage', 'cap.survey.issue_link']);
  assert.deepEqual(launchPlan(draft({ project: NEW_PROJECT, newProject: 'H', newLanguage: 'L' })).map(s => s.cap).slice(0, 3), ['cap.project.create', 'cap.language.create', 'cap.assessment.create']);
});

test('launch performs writes in order, never sends expected count to the API, stores N only when given', async () => {
  const calls = []; let n = 0;
  const api = async (url, { method, body } = {}) => {
    calls.push({ url, method, body });
    if (url.endsWith('/assessments')) return { assessment: { id: 'a1' } };
    if (url.endsWith('/surveys')) return { survey: { id: 's' + (++n) } };
    if (url.endsWith('/stage')) return {};
    if (url.endsWith('/links')) return body.mode === 'dry_run' ? { confirm_token: 'ct' } : { entry_fragment: '#survey=x', expires_at: null };
    throw new Error('unexpected ' + url);
  };
  const store = mem();
  const ctx = await launch(draft({ purpose: 'Gen 1-3' }), { api, store });
  assert.equal(calls[0].url, '/v2/projects/p1/assessments');
  assert.deepEqual(calls[0].body, { name: 'Oct', language_id: 'l1', purpose: 'Gen 1-3', format: 'Written' });
  assert.deepEqual(calls[1].body, { template_id: 'tpl.team', version: 3 });
  assert.deepEqual(calls[3], { url: '/v2/assessments/a1/stage', method: 'POST', body: { stage: 'collect' } });
  assert.equal(calls.filter(c => c.url.endsWith('/links')).length, 4);
  assert.equal(calls[5].body.confirm_token, 'ct');
  assert.ok(!JSON.stringify(calls).includes('expected'));
  assert.equal(ctx.links.length, 2);
  assert.equal(expectedFor('s1', store), 10);
  assert.equal(expectedFor('s2', store), null);
  assert.deepEqual(JSON.parse(store.getItem(EXPECTED_KEY)), { s1: 10 });
});

test('new project path creates project then language first', async () => {
  const urls = [];
  const api = async (url, { body } = {}) => { urls.push(url);
    if (url === '/v2/projects') return { project: { id: 'pN' } };
    if (url.endsWith('/languages')) return { language: { id: 'lN' } };
    if (url.endsWith('/assessments')) return { assessment: { id: 'a9' } };
    if (url.endsWith('/surveys')) return { survey: { id: 's9' } };
    if (url.endsWith('/links')) return body.mode === 'dry_run' ? { confirm_token: 't' } : { entry_fragment: '#survey=y' };
    return {}; };
  await launch(draft({ project: NEW_PROJECT, newProject: 'Hill', newLanguage: 'Hill', groups: { t: { version: '1', expected: '' } } }), { api, store: null });
  assert.deepEqual(urls.slice(0, 3), ['/v2/projects', '/v2/projects/pN/languages', '/v2/projects/pN/assessments']);
});

test('views: four steps, one primary each, optional expected count, escaped', () => {
  const data = { projects: [{ id: 'p1', name: '<P>' }], languages: [{ id: 'l1', name: 'L' }], templates: [{ id: 'tpl.team', version: 2, name: 'Team', perspective: 'Translation team' }, { id: 'tpl.team', version: 3, name: 'Team', perspective: 'Translation team' }] };
  assert.equal(latestTemplates(data.templates).length, 1);
  for (const [i, step] of ['details', 'participants', 'information', 'review'].entries()) {
    const html = renderStep(step, draft(), data);
    assert.match(html, new RegExp(`step ${i + 1} of 4`));
    assert.equal((html.match(/class="primary"/g) || []).length, 1, step);
    assert.ok(!html.includes('<P>'), 'escaped');
  }
  const p = renderStep('participants', draft(), data);
  assert.match(p, /How many do you expect\?/); assert.match(p, /placeholder="optional"/); assert.ok(!/required[^>]*name="n-/.test(p));
  assert.match(p, /data-version="3"/);
  const r = renderStep('review', draft(), { ...data, templates: [...data.templates, { id: 'tpl.community', version: 2, name: 'Community', perspective: 'Community' }] });
  assert.match(r, /10 expected/); assert.match(r, /no number given/);
  // L2-2 · Bincy 03–06: step names, review summary carries all three sections with an Edit each; locked hides Edit.
  assert.match(r, /Review &amp; launch|Review & launch/); assert.match(r, /<h3>Participant information<\/h3>/);
  assert.equal((r.match(/data-wz="edit"/g) || []).length, 3);
  assert.match(r, /data-step="information"/);
  assert.equal((renderStep('review', draft(), data, [], true).match(/data-wz="edit"/g) || []).length, 0);
  assert.match(renderStep('details', draft(), data), /Who will participate\?/);
  assert.match(renderStep('review', draft({ context: '<b>x</b>' }), data), /&lt;b&gt;x&lt;\/b&gt; <span class="sub">\(not stored yet/);
});

test('retry after a partial failure resumes without duplicate writes', async () => {
  const urls = []; let failOnce = true;
  const api = async (url, { body } = {}) => { urls.push(url);
    if (url.endsWith('/assessments')) return { assessment: { id: 'a1' } };
    if (url.endsWith('/surveys')) return { survey: { id: 's1' } };
    if (url.endsWith('/stage')) { if (failOnce) { failOnce = false; throw new Error('boom'); } return {}; }
    if (url.endsWith('/links')) return body.mode === 'dry_run' ? { confirm_token: 't' } : { entry_fragment: '#survey=z' };
    return {}; };
  const d = draft({ groups: { t: { version: '1', expected: '' } } });
  let partial = null;
  await assert.rejects(launch(d, { api, store: null }).catch(e => { partial = e.ctx; throw e; }));
  assert.equal(partial.done.length, 2);
  const ctx = await launch(d, { api, store: null, resume: partial });
  assert.equal(urls.filter(u => u.endsWith('/assessments')).length, 1);
  assert.equal(urls.filter(u => u.endsWith('/surveys')).length, 1);
  assert.equal(urls.filter(u => u.endsWith('/stage')).length, 2);
  assert.equal(ctx.links.length, 1);
});

test('locked review after a partial launch hides Back/Edit; follow-up not claimed as stored', () => {
  const data = { projects: [{ id: 'p1', name: 'P' }], languages: [{ id: 'l1', name: 'L' }], templates: [{ id: 'tpl.team', version: 3, name: 'Team', perspective: 'Translation team' }] };
  const html = renderStep('review', draft({ followup: true }), data, [], true);
  assert.ok(!html.includes('data-wz="edit"') && !html.includes('data-wz="back"') && html.includes('data-wz="cancel"'));
  assert.match(html, /Continue the launch/);
  assert.ok(!/Follow-up<\/dd>/.test(html));
  assert.match(renderStep('details', draft(), data), /not stored yet/);
});

test('locked review shows links already issued so a partial launch never loses them', () => {
  const data = { projects: [{ id: 'p1', name: 'P' }], languages: [{ id: 'l1', name: 'L' }], templates: [{ id: 'tpl.team', version: 3, name: 'Team', perspective: 'Translation team' }] };
  const html = renderStep('review', draft(), data, [], { done: ['x'], links: [{ template: 'tpl.team', entry_fragment: '#survey=abc' }] }, 'https://dev');
  assert.match(html, /Links already opened/); assert.match(html, /Translation team/);
});

// #188: a write that committed but whose response was lost is read back, not repeated.
const lossyApi = (loseOn) => {
  const calls = []; const db = { assessments: [], surveys: [], stage: 'prepare' }; let n = 0; let lost = false;
  const api = async (url, { method = 'GET', body } = {}) => {
    calls.push(`${method} ${url}`);
    let r;
    if (method === 'GET' && url === '/v2/projects/p1/assessments') return { assessments: db.assessments };
    if (method === 'GET' && url === '/v2/assessments/a1') return { assessment: { id: 'a1', stage: db.stage }, surveys: db.surveys };
    if (url.endsWith('/assessments')) { const a = { id: 'a1', name: body.name, language_id: body.language_id, created_at: new Date().toISOString() }; db.assessments.push(a); r = { assessment: a }; }
    else if (url.endsWith('/surveys')) { const x = { id: 's' + (++n), template_id: body.template_id, template_version: body.version }; db.surveys.push(x); r = { survey: x }; }
    else if (url.endsWith('/stage')) { db.stage = body.stage; r = { assessment: { id: 'a1', stage: body.stage } }; }
    else if (url.endsWith('/links')) r = body.mode === 'dry_run' ? { confirm_token: 'ct' } : { entry_fragment: '#survey=x' };
    else throw new Error('unexpected ' + url);
    if (!lost && loseOn(url, method)) { lost = true; throw new Error('network: response lost'); }
    return r;
  };
  return { api, calls, db };
};
for (const [label, loseOn] of [
  ['assessment.create', u => u.endsWith('/assessments')],
  ['survey.select', u => u.endsWith('/surveys')],
  ['set_stage', u => u.endsWith('/stage')],
]) test(`#188 resume after lost ${label} response creates no duplicate`, async () => {
  const { api, calls, db } = lossyApi(loseOn);
  let err; try { await launch(draft(), { api, store: mem() }); } catch (e) { err = e; }
  assert.ok(err && err.ctx && err.ctx.pending, 'failed launch carries a pending write');
  const ctx = await launch(draft(), { api, store: mem(), resume: err.ctx });
  assert.equal(db.assessments.length, 1);
  assert.equal(db.surveys.length, 2);
  assert.equal(calls.filter(c => c.endsWith('/stage')).length, 1);
  assert.equal(ctx.pending, null);
  assert.equal(ctx.links.length, 2);
  assert.deepEqual(ctx.surveys.map(s => s.id).sort(), ['s1', 's2']);
});

test('#188 a failed write that did not commit is retried after reconcile finds nothing', async () => {
  let fail = true; const made = [];
  const api = async (url, { method = 'GET', body } = {}) => {
    if (method === 'GET' && url === '/v2/projects/p1/assessments') return { assessments: made };
    if (url.endsWith('/assessments')) { if (fail) { fail = false; throw new Error('503'); } const a = { id: 'a1', name: body.name, language_id: body.language_id }; made.push(a); return { assessment: a }; }
    if (url.endsWith('/surveys')) return { survey: { id: 's' + body.template_id } };
    if (url.endsWith('/stage')) return {};
    if (url.endsWith('/links')) return body.mode === 'dry_run' ? { confirm_token: 'ct' } : { entry_fragment: '#survey=x' };
    throw new Error('unexpected ' + url);
  };
  let err; try { await launch(draft(), { api, store: mem() }); } catch (e) { err = e; }
  assert.equal(err.ctx.done.length, 0); assert.equal(err.ctx.pending.cap, 'cap.assessment.create');
  const ctx = await launch(draft(), { api, store: mem(), resume: err.ctx });
  assert.equal(made.length, 1); assert.equal(ctx.aid, 'a1');
});
