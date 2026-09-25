// node --test ui/assess/less-text.test.mjs — lane 9 L9-24 (captain 17:05 "way too much text", Bincy B30), part 2.
// Every screen here keeps one heading, at most one short line under it and one primary action; explanations move behind the
// shared closed-by-default Learn more (ui/v3/components/learn-more.js). Nothing is lost: the moved text is still in the DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  for (const moved of ['Counts are per survey.', 'data-lens-sum=', 'data-results>', 'data-v3-provisional']) assert.ok(all.includes(moved), `moved, not removed: ${moved}`);
  assert.doesNotMatch(upFront(h), /Counts are per survey|Bring the perspectives together|Provisional bands/);
  assert.match(upFront(h), /data-reports>/, 'reports (actions) stay visible');
});

test('L9-24 Understand held: the server reason is said once up front, not once per perspective card', async () => {
  const reason = 'Results are held for now';
  const api = async url => { if (url.endsWith('/results')) return { status: 'held', reason }; if (url.endsWith('/reports')) return { reports: [] }; throw Object.assign(new Error('x'), { code: '404' }); };
  const ctx = { api, current: { assessment: { id: 'a1', stage: 'collect', role: 'owner' }, surveys: [] }, enc, esc, routes, state: {} };
  const h = views.understand.render(ctx, await views.understand.load(ctx, { aid: 'a1' }));
  assert.equal(count(upFront(h), new RegExp(reason, 'g')), 1, 'held reason once');
  assert.match(h.slice(h.indexOf(LM)), /data-results-reason>Results are held for now</, 'results state kept behind Learn more');
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
  assert.match(body, /Accepting an invitation happens on the legacy surface/);
  assert.match(upFront(h), /Destructive: it cannot be undone from here\./, 'the transfer warning stays up front');
});

test('L9-24 assessment page (Prepare + head): stage explanations and the viewer note use the shared Learn more; one primary per view', () => {
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  assert.match(src, /^import \{ learnMore \} from '\/v3\/components\/learn-more\.js';$/m);
  assert.match(src, /learnMore\(`<p class="muted">The stage is the assessment's own state\. Browsing these views never changes it\.<\/p>/);
  assert.match(src, /roleMore = a\.role === 'viewer' \? learnMore\('<p class="muted">You can read this assessment;/);
  assert.doesNotMatch(src, /class="primary" data-stage=/, 'stage move is secondary; Save preparation is the view primary');
});
