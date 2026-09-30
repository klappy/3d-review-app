import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { reportBuildMarkup, bindReportBuild, heldText } from './report-build.js';
// S28: below the minimum the report build says the same two numbers Results and the responses list carry.
const HELD = 'The results can’t be built yet.';
test('S28 held line names responses in and needed below the minimum; otherwise the one plain line', () => {
  assert.equal(heldText({ responses_in: 1, responses_needed: 5 }, HELD), `${HELD} 1 response so far; at least 5 are needed before any score is shown.`);
  assert.equal(heldText({ responses_in: 3, responses_needed: 5 }, HELD), `${HELD} 3 responses so far; at least 5 are needed before any score is shown.`);
  for (const r of [{}, null, { responses_in: 5, responses_needed: 5 }, { responses_in: '1', responses_needed: 5 }, { reason: 'D7 disclosure policy unresolved' }]) assert.equal(heldText(r, HELD), HELD);
});
test('S28 preview held below the minimum: the status names the numbers and builds nothing', async () => {
  const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main'); let builds = 0; const calls = [];
  const ctx = { enc: encodeURIComponent, isCurrent: () => true, api: async (url, init) => { calls.push(init.body); return { assessment_id: 'a', suppressed: true, status: 'held', reason: 'server words', responses_in: 1, responses_needed: 5, report: null }; } };
  root.innerHTML = reportBuildMarkup(ctx, 'owner'); bindReportBuild(ctx, root, { aid: 'a', role: 'owner' }, async () => { builds++; });
  await root.querySelector('[data-preview-report]').onclick();
  assert.match(root.textContent, /1 response so far; at least 5 are needed before any score is shown\. Nothing was built\./);
  assert.doesNotMatch(root.textContent, /server words/);
  assert.equal(builds, 0); assert.deepEqual(calls.map(b => b.mode), ['dry_run']);
});
