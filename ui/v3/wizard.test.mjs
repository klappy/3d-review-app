import test from 'node:test';
import assert from 'node:assert/strict';
import { ORGANIZATIONS, orgChoices, ORG_OTHER, countLabel, expectedValue, launchPlan, launch, validateStep, freshDraft, latestTemplates, renderStep, NEW_PROJECT, expectedFor, EXPECTED_KEY, reconcile, STEP_TITLES, pdot, renderDone } from './wizard.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const draft = (o = {}) => ({ ...freshDraft(), name: 'Oct', project: 'p1', language: 'l1', until: '2026-10-31', groups: { 'tpl.team': { version: '3', expected: '10' }, 'tpl.community': { version: '2', expected: '' } }, ...o });

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
  const ctx = await launch(draft({ purpose: 'Gen 1-3', starts: '2026-09-25' }), { api, store });
  assert.equal(calls[0].url, '/v2/projects/p1/assessments');
  assert.deepEqual(calls[0].body, { name: 'Oct', language_id: 'l1', purpose: 'Gen 1-3', period: 'Starts 2026-09-25 · Active until 2026-10-31', format: 'Written' });
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
  assert.match(r, /Ready to launch/); assert.match(r, /<h3>Participant information<\/h3>/);
  assert.equal((r.match(/data-wz="edit"/g) || []).length, 3);
  assert.match(r, /data-step="information"/);
  assert.equal((renderStep('review', draft(), data, [], true).match(/data-wz="edit"/g) || []).length, 0);
  assert.match(renderStep('details', draft(), data), /<span>Participants<\/span>/);
  // Bincy B10: step 3 promises only what the welcome shows (project · language · material · format · when); no unsaved note box.
  const info = renderStep('information', draft({ purpose: 'Mark 1–4' }), data);
  for (const k of ['Project', 'Language', 'Material', 'Format', 'Active until']) assert.match(info, new RegExp(`<dt>${k}</dt>`));
  assert.doesNotMatch(info, /textarea|not saved|Not sent/);
  assert.doesNotMatch(renderStep('review', draft(), data), /Note for participants|not saved/);
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

test('locked review after a partial launch hides Back/Edit; step 1 has no unstored controls or internal notes', () => {
  const data = { projects: [{ id: 'p1', name: 'P' }], languages: [{ id: 'l1', name: 'L' }], templates: [{ id: 'tpl.team', version: 3, name: 'Team', perspective: 'Translation team' }] };
  const html = renderStep('review', draft(), data, [], true);
  assert.ok(!html.includes('data-wz="edit"') && !html.includes('data-wz="back"') && html.includes('data-wz="cancel"'));
  assert.match(html, /Continue the launch/);
  assert.ok(!/Follow-up<\/dd>/.test(html));
  const details = renderStep('details', draft(), data);
  assert.ok(!details.includes('name="followup"'));
  assert.ok(!/not stored yet|no field for it/.test(details));
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
    if (url.endsWith('/assessments')) { const a = { id: 'a1', name: body.name, language_id: body.language_id, role: 'owner', stage: 'prepare', created_at: new Date().toISOString() }; db.assessments.push(a); r = { assessment: a }; }
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

test('#188 a clear 4xx refusal leaves nothing pending, so the draft stays editable', async () => {
  const api = async (url) => { if (url.endsWith('/assessments')) { const e = new Error('Language archived'); e.status = 400; throw e; } throw new Error('unexpected ' + url); };
  let err; try { await launch(draft(), { api, store: mem() }); } catch (e) { err = e; }
  assert.equal(err.ctx.done.length, 0); assert.equal(err.ctx.pending, null);
});

test('#188 reconcile never adopts a collaborator\'s same-name assessment', async () => {
  const theirs = { id: 'x9', name: 'Oct', language_id: 'l1', role: 'member', stage: 'prepare', created_at: new Date().toISOString() };
  const found = await reconcile({ cap: 'cap.assessment.create' }, { pid: 'p1', lid: 'l1', pending: { at: Date.now() } }, draft(), async () => ({ assessments: [theirs] }));
  assert.equal(found, null);
});

test('#188 resume reads back an existing same-name language instead of repeating a refused create', async () => {
  const langs = [{ id: 'l7', name: 'Hill' }]; const posts = [];
  const api = async (url, { method = 'GET', body } = {}) => {
    if (method === 'GET' && url === '/v2/projects/p9/languages') return { languages: langs };
    if (method === 'POST') posts.push(url);
    if (url === '/v2/projects/p9/languages') { const e = new Error('a language with that name already exists'); e.status = 400; throw e; }
    if (url.endsWith('/assessments')) return { assessment: { id: 'a1' } };
    if (url.endsWith('/surveys')) return { survey: { id: 's' + body.template_id } };
    if (url.endsWith('/stage')) return {};
    if (url.endsWith('/links')) return body.mode === 'dry_run' ? { confirm_token: 'ct' } : { entry_fragment: '#survey=x' };
    throw new Error('unexpected ' + url);
  };
  const d = draft({ project: NEW_PROJECT, newProject: 'H', newLanguage: 'Hill' });
  const resume = { pid: 'p9', lid: null, aid: null, surveys: [], links: [], done: ['cap.project.create'], pending: null };
  const ctx = await launch(d, { api, store: mem(), resume });
  assert.equal(ctx.lid, 'l7'); assert.ok(!posts.includes('/v2/projects/p9/languages'));
});

test('lane 12 L12-1: lead organisation rides cap.project.create only when given (contract field `organization`)', () => {
  const body = d => launchPlan(draft({ project: NEW_PROJECT, newProject: ' Hill ', newLanguage: 'L', ...d }))[0].body({});
  assert.deepEqual(body({ newOrg: ' Hill Bible Society ' }), { name: 'Hill', organization: 'Hill Bible Society' });
  assert.deepEqual(body({ newOrg: '  ' }), { name: 'Hill' });
  assert.deepEqual(body({ newOrg: undefined }), { name: 'Hill' });
  const html = renderStep('details', draft({ project: NEW_PROJECT, newOrg: 'A & B' }), { projects: [], languages: [], templates: [] }, [], false, '');
  assert.match(html, /<option value="__other__" selected>Other \(type it\)<\/option>/);
  assert.match(html, /Organisation name<input name="newOrg" value="A &amp; B"/);
  assert.doesNotMatch(renderStep('details', draft(), { projects: [], languages: [], templates: [] }, [], false, ''), /newOrg/);
  assert.match(renderStep('review', draft({ project: NEW_PROJECT, newProject: 'H', newOrg: 'Org' }), { projects: [], languages: [], templates: [] }, [], false, ''), /<dt>Lead organisation<\/dt><dd>Org<\/dd>/);
});

test('L2-4 setup look follows the design-system-v3 prototype: short stepper labels, perspective dots', () => {
  assert.deepEqual(STEP_TITLES, ['Details', 'Participants', 'Information', 'Review']);
  assert.equal(pdot('Translation team'), 'p-team'); assert.equal(pdot('Community'), 'p-community'); assert.equal(pdot('Church'), 'p-church'); assert.equal(pdot('Other'), 'p-reviewer');
});

test('lane 12 L12-2: language ISO code rides cap.language.create only when given (contract field `code`)', () => {
  const plan = d => launchPlan(draft({ project: NEW_PROJECT, newProject: 'Hill', newLanguage: ' Hiligaynon ', ...d }));
  const body = d => plan(d).find(s => s.cap === 'cap.language.create').body({});
  assert.deepEqual(body({ newLangCode: ' hil ' }), { name: 'Hiligaynon', code: 'hil' });
  assert.deepEqual(body({ newLangCode: '  ' }), { name: 'Hiligaynon' });
  assert.deepEqual(body({ newLangCode: undefined }), { name: 'Hiligaynon' });
  const base = { name: 'R', project: NEW_PROJECT, newProject: 'H', newLanguage: 'L' };
  assert.ok(validateStep('details', draft({ ...base, newLangCode: 'Hil!' })).some(e => /Language code/.test(e)));
  assert.ok(!validateStep('details', draft({ ...base, newLangCode: 'en-US' })).some(e => /Language code/.test(e)));
  const empty = { projects: [], languages: [], templates: [] };
  assert.match(renderStep('details', draft({ project: NEW_PROJECT, newLangCode: 'x"y' }), empty, [], false, ''), /Language code \(ISO 639, optional\)<input name="newLangCode" value="x&quot;y"/);
  assert.doesNotMatch(renderStep('details', draft(), empty, [], false, ''), /newLangCode/);
  assert.match(renderStep('review', draft({ project: NEW_PROJECT, newProject: 'H', newLanguage: 'Hiligaynon', newLangCode: 'hil' }), empty, [], false, ''), /<dt>Language<\/dt><dd>Hiligaynon · hil<\/dd>/);
});

test('L2-5: group titles are h3 on participants and information (prototype frames 4–5)', () => {
  const data = { templates: [{ id: 't1', version: 1, perspective: 'Community', name: 'Community survey' }] };
  const d = { ...freshDraft(), groups: { t1: { version: 1, expected: '' } } };
  assert.match(renderStep('participants', d, data), /<h3>Community<\/h3>/);
  assert.match(renderStep('information', d, data), /<h3>Community<\/h3>/);
  assert.doesNotMatch(renderStep('participants', d, data), /<b>Community<\/b>/);
});

test('L2-6: review rows carry the perspective dot and prototype sub-line (V.setupReview)', () => {
  const tpl = { id: 'tpl.team', version: 1, name: 'Team', perspective: 'Translation team' };
  const r = renderStep('review', { ...freshDraft(), name: 'X', project: 'p1', language: 'l1', groups: { 'tpl.team': { version: 1, expected: '' } } }, { projects: [{ id: 'p1', name: 'P' }], languages: [{ id: 'l1', name: 'L' }], templates: [tpl] });
  assert.match(r, /<dt><span class="pdot wz-kvdot p-team" aria-hidden="true"><\/span>Translation team<\/dt><dd>no number given<\/dd>/);
  assert.match(r, /Check the details, then launch\./); assert.match(r, /<summary>Learn more<\/summary><p class="muted">Launching opens the survey links; nothing is sent to anyone\.<\/p>/);
});

test('L2-7 wizard composes the shared Stepper component (ruling 12:34): no local copy', async () => {
  const { stepper } = await import('./wizard.js');
  const { stepper: shared } = await import('./components/stepper.js');
  assert.equal(stepper(2), shared(STEP_TITLES, 2, { label: 'Setup steps' }));
  const html = renderStep('participants', draft(), { projects: [], languages: [], templates: [] }, [], false, '');
  assert.match(html, /class="v3-stepper stepper" aria-label="Setup steps"/);
  assert.match(html, /<li class="on" aria-current="step"><i aria-hidden="true">2<\/i><span>Participants<\/span>/);
});

test('wizard alert colour comes from the design-system token (dark-mode safe)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('./wizard.css', import.meta.url), 'utf8');
  assert.match(css, /\.note\.alert\{color:var\(--warning-ink/);
  assert.doesNotMatch(css, /#8a2a1c/);
});

test('L2-15 eyebrow step count follows STEP_TITLES, not a literal', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('./wizard.js', import.meta.url), 'utf8');
  assert.match(src, /step \$\{n\} of \$\{STEP_TITLES\.length\}/);
  assert.doesNotMatch(src, /step \$\{n\} of 4/);
});

test('L9-23 less text (captain 17:05): every setup screen = one heading, at most one short line, one primary action; the rest in Learn more', () => {
  const tpl = { id: 'tpl.team', version: 1, name: 'Team', perspective: 'Translation team' };
  const d = { ...freshDraft(), name: 'X', project: 'p1', language: 'l1', groups: { 'tpl.team': { version: 1, expected: '' } } };
  const data = { projects: [{ id: 'p1', name: 'P' }], languages: [{ id: 'l1', name: 'L' }], templates: [tpl] };
  const screens = { details: renderStep('details', d, data), participants: renderStep('participants', d, data), information: renderStep('information', d, data), review: renderStep('review', d, data), done: renderDone({ aid: 'a1', links: [] }, 'https://x', [tpl]) };
  for (const [k, h] of Object.entries(screens)) {
    assert.equal((h.match(/<h1\b/g) || []).length, 1, k + ': one heading');
    assert.equal((h.match(/class="primary"/g) || []).length, 1, k + ': one primary action');
    const after = h.slice(h.indexOf('</h1>') + 5).trimStart(); const line = after.match(/^<p class="muted[^"]*">([^<]*)<\/p>/);
    if (line) assert.equal(line[1].split(/[.!?](\s|$)/).filter(x => x && x.trim()).length, 1, k + ': one sentence under the heading');
    const lm = h.indexOf('<details class="small learn-more"><summary>Learn more</summary>');
    if (k !== 'information') assert.ok(lm > -1, k + ': Learn more present'); if (lm > -1) assert.ok(!/<details[^>]*\bopen\b/.test(h.slice(lm, lm + 60)), k + ': collapsed');
  }
  // nothing lost: the explanations moved, they did not go
  assert.match(screens.details, /Learn more<\/summary><p class="muted">Only what the review needs\./);
  assert.match(screens.participants, /Learn more<\/summary>.*Three perspectives, kept separate\..*The number is optional\./s);
  assert.ok(screens.participants.indexOf('The number is optional') < screens.participants.indexOf('</details>'), 'optional-number note lives behind Learn more');
  assert.match(screens.information, /Answers are grouped, never shown alone\./); assert.equal((screens.information.match(/never shown alone/g) || []).length, 1, 'privacy line once, not per group');
  assert.match(screens.done, /Learn more<\/summary><p class="muted">Nothing was sent to anyone\./);
});

test('B08+B20 (Bincy SI 04): step 2 groups surveys under one heading per perspective, each with one plain who-line', async () => {
  const { PERSPECTIVE_WHO } = await import('../assess/scope.js');
  const templates = [
    { id: 'c1', version: 1, perspective: 'Church', name: 'Involved-Pastor' }, { id: 'c2', version: 1, perspective: 'Church', name: 'Uninvolved-Pastor' },
    { id: 'm1', version: 1, perspective: 'Community', name: 'Community' }, { id: 't1', version: 1, perspective: 'Translation Team', name: 'Mid-Level' },
  ];
  const html = renderStep('participants', { ...freshDraft(), groups: { c1: { version: 1, expected: '' } } }, { templates });
  for (const line of Object.values(PERSPECTIVE_WHO)) assert.equal((html.match(new RegExp(`>${line}<`, 'g')) || []).length, 1, line);
  assert.equal((html.match(/<h3>Church<\/h3>/g) || []).length, 1, 'one heading per perspective, not per survey');
  for (const h of ['Translation Team', 'Community', 'Church']) assert.match(html, new RegExp(`<h3>${h}</h3>`), 'headings unchanged');
  assert.ok(html.indexOf(PERSPECTIVE_WHO.church) < html.indexOf('Involved-Pastor'), 'who-line above its surveys');
  assert.doesNotMatch(html, /Experience of/, 'says who the group is, not what it is asked about');
  assert.match(html, /Mid-Level/); assert.equal((html.match(/name="g"/g) || []).length, 4, 'every survey still selectable');
  assert.doesNotMatch(renderStep('participants', freshDraft(), { templates: [{ id: 'x', version: 1, perspective: 'Reviewer', name: 'R' }] }), /wz-pnote/);
  // same shared line on the launched screen, once per group above its rows
  const done = renderDone({ aid: 'a1', links: [{ survey: 's1', template: 'c1' }, { survey: 's2', template: 'c2' }, { survey: 's3', template: 't1' }] }, 'https://x.test', templates);
  assert.equal((done.match(new RegExp(PERSPECTIVE_WHO.church, 'g')) || []).length, 1, 'church who-line once on launch');
  assert.ok(done.indexOf(PERSPECTIVE_WHO.team) > -1 && done.indexOf(PERSPECTIVE_WHO.church) < done.indexOf('Involved-Pastor'), 'launch who-line above its rows');
  assert.equal((done.match(/data-group-link=/g) || []).length, 3, 'rows unchanged');
});

test('B36 launched screen: one labelled row per group (group · survey) with Copy link and Show QR code; still one primary', () => {
  const tpls = [{ id: 'tpl.team', version: 1, name: 'Team', perspective: 'Translation team' }, { id: 'tpl.comm', version: 1, name: 'Listening', perspective: 'Community' }];
  const h = renderDone({ aid: 'a1', links: [{ survey: 's1', template: 'tpl.team', entry_fragment: '#survey=AAA' }, { survey: 's2', template: 'tpl.comm', entry_fragment: '#survey=BBB' }] }, 'https://x', tpls);
  assert.match(h, /Translation team <span aria-hidden="true">·<\/span> Team/); assert.match(h, /Community <span aria-hidden="true">·<\/span> Listening/);
  assert.equal((h.match(/data-group-copy="s[12]"/g) || []).length, 2); assert.equal((h.match(/data-group-qr="s[12]"/g) || []).length, 2);
  assert.match(h, /#survey=AAA/); assert.match(h, /#survey=BBB/);
  assert.equal((h.match(/class="primary"/g) || []).length, 1);
});

test('B41: setup asks Active until (required) and Starts (optional, default today) on the existing period field', () => {
  const html = renderStep('details', draft(), { projects: [], languages: [], templates: [] });
  assert.match(html, /Starts \(optional\)<input type="date" name="starts"/);
  assert.match(html, /Active until<input type="date" name="until" value="2026-10-31" required>/);
  assert.doesNotMatch(html, />When</);
  assert.match(freshDraft().starts, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(freshDraft().until, '');
  assert.deepEqual(validateStep('details', draft({ until: '' })), ['Choose the date the survey is active until.']);
  assert.deepEqual(validateStep('details', draft({ starts: '' })), []);
  const body = d => launchPlan(draft(d)).find(s => s.cap === 'cap.assessment.create').body({});
  assert.equal(body({ starts: '2026-09-25' }).period, 'Starts 2026-09-25 · Active until 2026-10-31');
  assert.equal(body({ starts: '' }).period, 'Active until 2026-10-31');
  assert.match(renderStep('review', draft({ starts: '2026-09-25' }), { projects: [], languages: [], templates: [] }), /<dt>Starts<\/dt><dd>25 September 2026<\/dd><dt>Active until<\/dt><dd>31 October 2026<\/dd>/);
});

test('B40: lead organisation is a seeded select plus "Other (type it)"; the stored field is unchanged', () => {
  const data = { projects: [{ id: 'p1', name: 'P', organization: 'Hill Bible Society' }, { id: 'p2', name: 'Q', organization: 'sil' }], languages: [], templates: [] };
  const names = orgChoices(data.projects);
  assert.ok(names.includes('Hill Bible Society'));
  assert.equal(names.filter(n => n.toLowerCase() === 'sil').length, 1);
  assert.equal(new Set(ORGANIZATIONS.map(n => n.toLowerCase())).size, ORGANIZATIONS.length);
  const blank = renderStep('details', draft({ project: NEW_PROJECT }), data, [], false, '');
  assert.match(blank, /<select name="newOrgPick"><option value="" selected>Choose… \(optional\)<\/option>/);
  assert.match(blank, /<option value="Hill Bible Society">/);
  assert.doesNotMatch(blank, /name="newOrg"/);
  const picked = renderStep('details', draft({ project: NEW_PROJECT, newOrg: 'SIL' }), data, [], false, '');
  assert.match(picked, /<option value="SIL" selected>SIL<\/option>/);
  assert.doesNotMatch(picked, /name="newOrg"/);
  const other = renderStep('details', draft({ project: NEW_PROJECT, newOrgOther: true, newOrg: '' }), data, [], false, '');
  assert.match(other, new RegExp(`value="${ORG_OTHER}" selected`));
  assert.match(other, /Organisation name<input name="newOrg" value=""/);
  const body = launchPlan(draft({ project: NEW_PROJECT, newProject: 'H', newLanguage: 'L', newOrg: 'SIL' }))[0].body({});
  assert.deepEqual(body, { name: 'H', organization: 'SIL' });
});
