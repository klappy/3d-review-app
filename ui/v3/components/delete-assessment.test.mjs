import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { deleteAssessmentButton, deleteImpact, deleteAssessmentFlow, DELETED_NOTICE } from './delete-assessment.js';
import { askStageMove } from './review-gate.js';
import * as m from '../../assess/v3-assessment.js';
const tick = () => new Promise(r => setTimeout(r, 0));
const dryOf = (surveys, responses) => ({ assessment: { id: 'a1' }, impact: { affected: [{ assessment: 'a1', surveys, responses }], irreversible: true }, confirm_token: 'tok-1', expires_in: 300 });
function harness(dry) {
  const doc = new JSDOM(`<nav>${deleteAssessmentButton('owner')}</nav>`).window.document;
  const calls = [], out = { deleted: 0, refused: [], errors: [] };
  const api = async (url, opts) => { calls.push({ url, ...opts }); if (opts.body.mode === 'dry_run') return dry; return { deleted: true, id: 'a1' }; };
  const b = doc.querySelector('[data-delete-assessment]');
  const run = (over = {}) => deleteAssessmentFlow(b, { id: 'a1', api, ask: askStageMove, onDeleted: () => out.deleted++, onRefused: t => out.refused.push(t), onError: e => out.errors.push(e), ...over });
  return { doc, b, calls, out, run };
}
test('U14: Delete assessment is for owners only', () => {
  assert.match(deleteAssessmentButton('owner'), /data-delete-assessment[^>]*>Delete assessment</);
  for (const role of ['member', 'viewer', '', undefined]) assert.equal(deleteAssessmentButton(role), '');
});
test('U14: the dry run reads as one sentence; a non-empty assessment cannot be deleted (D5)', () => {
  assert.deepEqual(deleteImpact(dryOf(0, 0)), { ok: true, sentence: 'This deletes the assessment; it has no surveys or responses.' });
  assert.deepEqual(deleteImpact(dryOf(2, 12)), { ok: false, sentence: 'This assessment has 12 responses in 2 surveys, so it cannot be deleted.' });
  assert.equal(deleteImpact(dryOf(1, 1)).sentence, 'This assessment has 1 response in 1 survey, so it cannot be deleted.');
});
test('U14: dry run → ask in the page → Cancel writes nothing; confirm executes once with the token', async () => {
  const h = harness(dryOf(0, 0));
  await h.run();
  assert.deepEqual(h.calls, [{ url: '/v2/assessments/a1', method: 'DELETE', body: { mode: 'dry_run' } }]);
  const box = h.doc.querySelector('[data-stage-confirm]');
  assert.equal(box.getAttribute('aria-label'), 'Confirm deleting the assessment');
  assert.match(box.textContent, /This deletes the assessment; it has no surveys or responses\./);
  h.doc.querySelector('[data-stage-confirm-cancel]').click();
  assert.equal(h.calls.length, 1); assert.equal(h.out.deleted, 0); assert.equal(h.doc.querySelectorAll('[data-stage-confirm]').length, 0);
  await h.run();
  h.doc.querySelector('[data-stage-confirm-go]').click(); await tick();
  assert.deepEqual(h.calls.at(-1), { url: '/v2/assessments/a1', method: 'DELETE', body: { mode: 'execute', confirm_token: 'tok-1' } });
  assert.equal(h.out.deleted, 1); assert.deepEqual(h.out.refused, []);
});
test('U14: non-empty → one sentence, no confirm, no execute; an expired preview never executes', async () => {
  const h = harness(dryOf(2, 12));
  await h.run();
  assert.equal(h.doc.querySelectorAll('[data-stage-confirm]').length, 0);
  assert.deepEqual(h.out.refused, ['This assessment has 12 responses in 2 surveys, so it cannot be deleted.']);
  assert.equal(h.calls.length, 1);
  const e = harness(dryOf(0, 0)); let t = 0;
  await e.run({ now: () => t }); t = 301_000;
  e.doc.querySelector('[data-stage-confirm-go]').click(); await tick();
  assert.equal(e.calls.length, 1); assert.equal(e.out.deleted, 0); assert.deepEqual(e.out.refused, ['Preview deletion again before confirming.']);
});
test('U14: assessment page wires it in the settings nav, lands on the project with a notice, never window.confirm', () => {
  assert.equal(m.deleteAssessmentButton, deleteAssessmentButton); assert.equal(m.deleteAssessmentFlow, deleteAssessmentFlow);
  assert.equal(DELETED_NOTICE, 'Assessment deleted.');
  const src = readFileSync(new URL('../../assess/assess.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /window\.confirm\(/);
  assert.match(src, /aria-label="Assessment settings"[^\n]*deleteAssessmentButton\(a\.role/);
  assert.match(src, /deleteAssessmentFlow\(del, \{ id: aid, api, ask: askStageMove/);
  assert.match(src, /pendingNotice = DELETED_NOTICE; location\.hash = cards\.routes\.project\(pid\)/);
  assert.match(src, /note\.textContent = pendingNotice \|\| ''/);
});
