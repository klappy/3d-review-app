// node --test ui/assess/s20-gate-0230.test.mjs — persona release gate on DEV 0.23.0 (facilitator), fixes E and F2.
// The REAL ui/index.html + REAL assess controller, booted in jsdom with every module it imports (read from its own import
// lines, so the harness cannot drift from the controller), over the synthetic fail-closed transport of the kit-root harness.
// Only the calls a test names are answered; every other mutation is refused and recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { dataset, createTransport } from '../../test/fixtures/kit-root-transport.js';
import { LINKS_KEY } from './share.js';

const ORIGIN = 'http://127.0.0.1:4173';
const UI = new URL('../', import.meta.url);
const HTML = readFileSync(new URL('index.html', UI), 'utf8');
const RAW = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
const strip = src => src.replace(/^import .*;\n/gm, '').replace(/^export (async )?function /gm, '$1function ').replace(/^export const /gm, 'const ');
const ASSESS = strip(RAW), CHANGELOG = strip(readFileSync(new URL('changelog.js', UI), 'utf8'));
const tick = (n = 6) => new Promise(r => { let i = 0; (function step() { if (++i > n) return r(); setTimeout(step, 0); })(); });

// Every binding assess.js imports, under the name it uses (named, `as` aliases and `* as` namespaces).
async function imports() {
  const out = {};
  for (const m of RAW.matchAll(/^import (.+) from '([^']+)';$/gm)) {
    const [, what, spec] = m, url = spec.startsWith('/') ? new URL('.' + spec, UI) : new URL(spec, import.meta.url);
    const mod = await import(url.href);
    const ns = /^\* as (\w+)$/.exec(what.trim()); if (ns) { out[ns[1]] = mod; continue; }
    for (const part of what.replace(/[{}]/g, '').split(',').map(x => x.trim()).filter(Boolean)) { const [name, alias] = part.split(/\s+as\s+/); out[alias || name] = mod[name]; }
  }
  return out;
}
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: k => (k.toLowerCase() === 'content-type' ? 'application/json' : null) }, json: async () => body, text: async () => JSON.stringify(body) });

async function bootPage(hash, { routes = () => {}, answer = () => null, session = {} } = {}) {
  const data = dataset('owner'), transport = createTransport({ routes: data.routes, origin: ORIGIN });
  routes(data);
  const posts = [], base = transport.fetch;
  const fetch = async (u, init = {}) => { const r = answer(String(u), init, posts); return r || base(u, init); };
  const dom = new JSDOM(HTML, { url: ORIGIN + '/' + hash, pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  for (const [k, v] of Object.entries(session)) w.sessionStorage.setItem(k, v); // what this tab kept before the reload
  w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  w.CSS = { escape: s => String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c) };
  w.fetch = fetch; w.confirm = () => false; w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  Object.assign(w, await imports());
  const ctx = dom.getInternalVMContext();
  vm.runInContext(CHANGELOG, ctx, { filename: 'changelog.js' });
  const api = vm.runInContext(ASSESS + '\n({ state, render, boot })', ctx, { filename: 'assess.js' });
  await tick(20);
  const d = w.document, q = s => d.querySelector(s), qa = s => [...d.querySelectorAll(s)];
  const go = async h => { w.location.hash = h; await tick(20); };
  const log = transport.log;
  return { dom, w, d, q, qa, go, api, posts, log };
}

// Collect for a1 (stage collect, owner) with two open surveys; POST …/links answered like cap.survey.issue_link.
const SURVEYS = [
  { id: 's1', template_id: 't1', template_version: 1, template_name: 'Church leaders', perspective: 'Church', collection_status: 'open', state: 'selected' },
  { id: 's2', template_id: 't2', template_version: 1, template_name: 'Translation team check', perspective: 'Translation Team', collection_status: 'open', state: 'selected' },
];
const collectRoutes = data => data.routes.set('GET /v2/assessments/a1', { ok: true, result: { assessment: data.a1, surveys: SURVEYS } });
let serial = 0;
const issueLinks = (u, init, posts) => {
  const m = /\/v2\/assessments\/a1\/surveys\/(s\d)\/links$/.exec(new URL(u, ORIGIN).pathname);
  if (!m || (init.method || '').toUpperCase() !== 'POST') return null;
  const body = JSON.parse(init.body || '{}'); posts.push({ sid: m[1], mode: body.mode });
  if (body.mode === 'dry_run') return json(200, { ok: true, result: { survey_id: m[1], expires_at: null, confirm_token: 'ct_' + m[1] } });
  const n = ++serial; return json(200, { ok: true, result: { link_id: `inv_${m[1]}_${n}`, link_token: `link_${m[1]}${n}`, expires_at: null, entry_fragment: `#survey=link_${m[1]}${n}` } });
};
const rowUrl = (p, sid) => p.q(`[data-group-link="${sid}"] input.share-group-url`)?.value || null;
const executes = p => p.posts.filter(x => x.mode === 'execute');

test('Gate 0.23.0 E: Collect with no active link mints exactly one per survey; later page views (in-app and after a reload) make NO issue_link call and reuse it', async () => {
  const first = await bootPage('#assessment/a1/collect', { routes: collectRoutes, answer: issueLinks });
  assert.deepEqual(first.posts.map(x => `${x.sid}:${x.mode}`).sort(), ['s1:dry_run', 's1:execute', 's2:dry_run', 's2:execute'], 'none active: one dry run → execute per survey, no tap');
  const held = sid => first.api.state.collectLinks.get('a1|' + sid)?.link?.url || null; // the row's QR carries it; its text field appears on the next paint
  const url1 = held('s1'), url2 = held('s2');
  assert.match(url1, /^http:\/\/127\.0\.0\.1:4173\/#survey=link_s1\d+$/); assert.match(url2, /#survey=link_s2\d+$/);
  assert.equal(first.qa('[data-group-qr-figure] svg').length, 2, 'QR visible on first render (B43)');
  // the same tab moves between views: nothing new is issued
  await first.go('#assessment/a1/prepare'); await first.go('#assessment/a1/collect');
  assert.equal(executes(first).length, 2, 'in-app page view: no second link');
  assert.equal(rowUrl(first, 's1'), url1); assert.equal(rowUrl(first, 's2'), url2);
  const kept = first.w.sessionStorage.getItem(LINKS_KEY);
  assert.ok(kept && JSON.parse(kept).owner === 'synthetic-owner');
  // a reload of the same tab (the persona's repro: every page view minted again, ~12 links per survey)
  for (let i = 0; i < 3; i++) {
    const again = await bootPage('#assessment/a1/collect', { routes: collectRoutes, answer: issueLinks, session: { [LINKS_KEY]: kept } });
    assert.deepEqual(again.posts, [], `reload ${i + 1}: an active link exists → no issue_link call at all`);
    assert.ok(!again.log.some(l => /\/links$/.test(l.key)), 'no links request reached the transport');
    assert.equal(rowUrl(again, 's1'), url1, 'the active link is reused'); assert.equal(rowUrl(again, 's2'), url2);
    assert.equal(again.qa('[data-group-qr-figure] svg').length, 2, 'its QR shows at once');
  }
});

test('Gate 0.23.0 E: only the survey without an active link mints (exactly one); another principal in the tab never reuses the first one\'s links', async () => {
  const kept = JSON.stringify({ owner: 'synthetic-owner', links: { 'a1|s1': { id: 'inv_launch', url: `${ORIGIN}/#survey=link_LAUNCH`, expires_at: null } } }); // e.g. issued on the launch page
  const p = await bootPage('#assessment/a1/collect', { routes: collectRoutes, answer: issueLinks, session: { [LINKS_KEY]: kept } });
  assert.deepEqual(p.posts.map(x => `${x.sid}:${x.mode}`), ['s2:dry_run', 's2:execute'], 's1 active → reused; s2 none → one link');
  assert.equal(rowUrl(p, 's1'), `${ORIGIN}/#survey=link_LAUNCH`);
  const saved = JSON.parse(p.w.sessionStorage.getItem(LINKS_KEY)).links;
  assert.deepEqual(Object.keys(saved).sort(), ['a1|s1', 'a1|s2'], 'the new one joins the tab copy');
  const stranger = await bootPage('#assessment/a1/collect', { routes: collectRoutes, answer: issueLinks, session: { [LINKS_KEY]: JSON.stringify({ owner: 'someone-else', links: { 'a1|s1': { id: 'inv_x', url: `${ORIGIN}/#survey=link_X`, expires_at: null } } }) } });
  assert.notEqual(rowUrl(stranger, 's1'), `${ORIGIN}/#survey=link_X`); assert.equal(executes(stranger).length, 2);
});

test('Gate 0.23.0 F2: Save preparation says "Saved" (shared SavedStatus, U17) on success, the error on failure; a route change clears it', async () => {
  const patches = [];
  const ok = await bootPage('#assessment/a2/prepare', { answer: (u, init) => {
    if ((init.method || '').toUpperCase() !== 'PATCH') return null; patches.push(JSON.parse(init.body));
    return json(200, { ok: true, result: { assessment: { id: 'a2', name: 'Spring baseline', purpose: 'Read Mark 1 aloud first' } } });
  } });
  const form = ok.q('#prepare-form'); assert.ok(form, 'owner sees the Prepare form');
  form.querySelector('textarea[name="purpose"]').value = 'Read Mark 1 aloud first';
  form.dispatchEvent(new ok.w.Event('submit', { cancelable: true })); await tick(20);
  assert.equal(patches.length, 1); assert.equal(patches[0].purpose, 'Read Mark 1 aloud first');
  const saved = ok.q('#prepare-form [data-saved-status]');
  assert.ok(saved, 'a Saved status on the form that was used'); assert.equal(saved.textContent, 'Saved'); assert.equal(saved.getAttribute('role'), 'status');
  assert.equal(ok.q('[data-prepare-outcome]'), null); assert.doesNotMatch(ok.q('#note')?.textContent || '', /Saving preparation/, 'the busy line is gone');
  await ok.go('#assessment/a2/collect'); await ok.go('#assessment/a2/prepare');
  assert.equal(ok.q('[data-saved-status]'), null, 'navigation clears it (U30)');
  // failure: the synthetic transport refuses the PATCH → the error is shown on Prepare, never "Saved"
  const bad = await bootPage('#assessment/a2/prepare');
  bad.q('#prepare-form').dispatchEvent(new bad.w.Event('submit', { cancelable: true })); await tick(20);
  assert.equal(bad.q('[data-saved-status]'), null);
  const outcome = bad.q('#prepare-form [data-prepare-outcome]');
  assert.ok(outcome, 'the error is on the form'); assert.equal(outcome.getAttribute('role'), 'alert'); assert.match(outcome.textContent, /refuses every mutation/);
});
