// node --test ui/assess/less-text.test.mjs — lane 9 L9-24 (captain 17:05 "way too much text", Bincy B30), part 2.
// Every screen here keeps one heading, at most one short line under it and one primary action; explanations move behind the
// shared closed-by-default Learn more (ui/v3/components/learn-more.js). Nothing is lost: the moved text is still in the DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { views } from './views.js';
import { permissions } from './permissions.js';
import { pages } from './scope.js';
import { esc, enc, routes } from './cards.js';
import { demoApi } from '../demo.js';

const LM = '<details class="small learn-more"><summary>Learn more</summary>';
const closed = /<details(?![^>]*\bopen\b)[^>]*>[\s\S]*?<\/details>/g;
const upFront = h => h.replace(closed, ''); // what the screen shows before anyone opens a disclosure
const count = (h, re) => (h.match(re) || []).length;
const sentences = t => t.split(/[.!?](\s|$)/).filter(x => x && x.trim()).length;
function lessText(h, name, heading = /<h[12]\b/g) {
  const v = upFront(h);
  assert.equal(count(v, heading), 1, `${name}: one heading`);
  assert.ok(count(v, /class="(?:[^"]* )?primary(?: [^"]*)?"/g) <= 1, `${name}: at most one primary action`);
  const lm = h.indexOf(LM); assert.ok(lm > -1, `${name}: Learn more present`);
  assert.ok(!/<details[^>]*\bopen\b/.test(h.slice(lm, lm + 60)), `${name}: Learn more closed by default`);
  return h.slice(lm, h.indexOf('</details>', lm)); // the Learn more body
}

test('L9-24 Understand/results: band panel is the screen; per-survey counts and the results state live behind Learn more', async () => {
  const demo = await demoApi('/v2/assessments/demo-assessment'), current = { ...demo, assessment: { ...demo.assessment, role: 'owner' } };
  const ctx = { api: demoApi, current, enc: encodeURIComponent, esc, routes, state: {} };
  const h = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'demo-assessment' }));
  lessText(h, 'understand', /<h2\b/g);
  assert.match(upFront(h), /<h2>What the perspectives say<\/h2>/);
  assert.equal(count(upFront(h), /class="primary"/g), 1, 'the review gate is the one primary');
  const all = [...h.matchAll(closed)].map(x => x[0]).join('');
  for (const moved of ['Counts are per survey.', 'data-lens-sum=', 'data-v3-provisional']) assert.ok(all.includes(moved), `moved, not removed: ${moved}`);
  assert.doesNotMatch(upFront(h), /Counts are per survey|Bring the perspectives together|Provisional bands/);
  assert.match(upFront(h), /data-reports>/, 'reports (actions) stay visible');
});

test('L9-24 + U05 Understand held: one plain line up front, never per card and never the server reason', async () => {
  const reason = 'Results are held for now'; const plain = 'Results appear after a report is built';
  const api = async url => { if (url.endsWith('/results')) return { status: 'held', reason }; if (url.endsWith('/reports')) return { reports: [] }; throw Object.assign(new Error('x'), { code: '404' }); };
  const ctx = { api, current: { assessment: { id: 'a1', stage: 'collect', role: 'owner' }, surveys: [] }, enc, esc, routes, state: {} };
  const h = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.equal(count(upFront(h), new RegExp(plain, 'g')), 1, 'plain held line once');
  assert.doesNotMatch(h, new RegExp(reason), 'server reason never shown (U05)');
  assert.equal(count(h, new RegExp(plain, 'g')), 1, 'plain held line once even with Learn more opened (U05)');
});

test('L9-24 next step: one line (who can read the notes) + Learn more holds the schedule note', async () => {
  const ctx = { esc, current: { assessment: { id: 'a1', role: 'owner', notes_reflection: '', notes_next_steps: '' } } };
  const h = views.improve.render(ctx, await views.improve.load(ctx, { aid: 'a1' }));
  const body = lessText(h, 'improve', /<h2\b/g);
  assert.match(body, /There is no fixed schedule\./); assert.match(upFront(h), /Everyone with access to this assessment can read these notes\./, 'privacy line stays up front');
  const viewer = views.improve.render({ esc }, { aid: 'a1', role: 'viewer', editable: false, notes_reflection: '', notes_next_steps: '' });
  assert.match(lessText(viewer, 'improve viewer', /<h2\b/g), /editing needs a member or owner role/);
});

test('L9-24 sign-in: one heading, one sentence, one primary; survey help behind Learn more', () => {
  const h = pages.entry.render({ esc, state: {} }, { mode: 'signin', signin: { stage: 'email', email: '' } });
  const body = lessText(h, 'sign-in', /<h1\b/g);
  const line = h.slice(h.indexOf('</h1>') + 5).match(/^<p class="muted">([^<]*)<\/p>/); assert.ok(line); assert.equal(sentences(line[1]), 1, 'one sentence under the heading');
  assert.match(body, /Open the link you were given; no sign-in is needed\. <a href="#survey">Have an access code\?<\/a>/);
});

test('L9-24 admin (permissions): heading + one note; the legacy-acceptance explanation behind Learn more', () => {
  const m = { scope: 'assessments', id: 'a1', status: 'loaded', grants: [{ id: 'g1', principal_id: 'me', role: 'owner' }], pending: [], me: 'me', myEmail: '', myRole: 'owner', receipts: {} };
  const h = permissions.render({ esc }, m);
  const body = lessText(h, 'permissions', /<h2\b/g);
  assert.match(body, /Accepting an invitation happens from the mailed link/);
  assert.match(upFront(h), /Destructive: it cannot be undone from here\./, 'the transfer warning stays up front');
});

// Real render of the assessment page (head + Prepare view): assess.js runs in a headless vm with its real imports, as
// identity-reset.test.mjs does, then screen() is called with a fixture assessment. No boot (no #app, no #rv).
async function assessPage() {
  const imp = async p => import(new URL(p, import.meta.url));
  const [demo, dp, ss, wh, cardsNs, bc, st, lm, scope, vw, share, fb, ad, v3s, v3a] = await Promise.all(['../demo.js', '../diagnostic-path.js', '../stage-screens.js', './whats-here.js', './cards.js', '../v3/components/breadcrumbs.js', '../v3/components/sidebar-tree.js', '../v3/components/learn-more.js', './scope.js', './views.js', './share.js', './feedback.js', '../kit/app-adapter.js', '../v3-shell.js', './v3-assessment.js'].map(imp));
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  const box = { ...demo, ...dp, ...ss, ...wh, cards: cardsNs, ...bc, ...st, ...lm, pages: scope.pages, scopeCss: scope.css, views: vw.views, viewsCss: vw.css, share, ...fb, ...ad, ...v3s, ...v3a,
    document: new JSDOM('<!doctype html><head></head><body></body>').window.document, location: { hash: '', pathname: '/' }, history: { replaceState() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }), addEventListener() {}, setTimeout, clearTimeout, console, URL, URLSearchParams };
  box.globalThis = box;
  const api = vm.runInNewContext(source + '\n({screen,state})', box);
  return (role, stage = 'prepare', view = 'prepare') => { api.state.projects = [{ id: 'p1', name: 'Coast' }];
    return api.screen({ assessment: { id: 'a1', name: 'Oct', project_id: 'p1', role, stage, language_id: 'lang1', period: '2026' }, surveys: [{ id: 's1', state: 'selected' }, { id: 's2', state: 'selected' }] }, view); };
}

test('L9-24 assessment page, Prepare view (validator #282): one view heading, no stray lines, one primary; stage notes behind Learn more', async () => {
  const page = await assessPage();
  for (const [role, stage] of [['owner', 'prepare'], ['owner', 'collect'], ['member', 'understand'], ['viewer', 'prepare']]) {
    const h = page(role, stage), name = `prepare ${role}/${stage}`;
    const view = h.slice(h.indexOf('<div class="grid">')); assert.ok(view.length > 20, name + ': view rendered');
    assert.equal(count(upFront(view), /<h[1-6]\b/g), 1, name + ': one view heading');
    assert.match(upFront(view), /<h2>Prepare this assessment<\/h2>/);
    assert.ok(count(upFront(h), /class="(?:[^"]* )?primary(?: [^"]*)?"/g) <= 2 && count(upFront(view), /class="(?:[^"]* )?primary(?: [^"]*)?"/g) <= 1, name + ': one primary in the view (the head keeps its own stage primary)');
    assert.doesNotMatch(view, /<aside\b/, name + ': no <aside> (kit.css flexes .rv aside at ≤760px)');
    const lines = count(upFront(view).replace(/<form[\s\S]*?<\/form>/, ''), /<p class="(?:small )?muted"/g);
    assert.ok(lines <= 1, `${name}: at most one line up front (got ${lines})`);
    const more = [...view.matchAll(closed)].map(x => x[0]).join('');
    for (const moved of ["The stage is the assessment's own state.", 'Language: lang1', 'Period: 2026']) assert.ok(more.includes(moved), `${name}: moved, not removed: ${moved}`);
    if (role !== 'viewer') assert.match(more, /Moving into Collect opens collection; moving out of Collect closes it — for all 2 included surveys\./);
  }
  const viewerNext = page('viewer', 'improve', 'improve');
  assert.doesNotMatch(viewerNext, /owner\/member actions/, 'Next steps: one role note (the view\'s own), not the head\'s as well');
  assert.match(page('viewer', 'prepare'), /owner\/member actions/, 'other tabs keep the head role note behind Learn more');
});

test('L9-24 Understand (validator #282): a results error and its Retry stay up front even when a report supplies band scores', async () => {
  const report = { id: 'r1', created_at: '2026-09-18', payload: { lenses: [{ lens: 'Translation Team', score: 80, sub_dimensions: [] }] } };
  const api = async url => {
    if (url.endsWith('/results')) throw Object.assign(new Error('boom'), { code: '500' });
    if (url.endsWith('/reports')) return { reports: [{ id: 'r1', created_at: report.created_at }] };
    if (url === '/v2/reports/r1') return { report };
    throw Object.assign(new Error('x'), { code: '404' });
  };
  const ctx = { api, current: { assessment: { id: 'a1', stage: 'understand', role: 'owner' }, surveys: [] }, enc, esc, routes, state: {} };
  const m = await views.understand.load(ctx, { aid: 'a1' }); assert.ok(m.bandScores, 'band scores come from the report');
  const h = views.understand.render(ctx, m), v = upFront(h);
  assert.match(v, /data-v3-bands="provisional"/, 'band panel shown');
  assert.match(v, /data-results>[\s\S]*Results could not be loaded\. <a href="#" data-retry="results">Retry<\/a>/, 'error + Retry visible, not behind Learn more');
  assert.ok(h.indexOf(LM) > -1 && h.indexOf('Counts are per survey.') > h.indexOf(LM), 'counts still behind Learn more');
});
