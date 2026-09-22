// node --test ui/kit/legacy-adapter.test.mjs — bounded presentation tests for the legacy code-batch adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { codeBatchMarkup, paintCodeBatch, validCount, CODE_IDS, PHASES } from './legacy-adapter.js';

const region = () => { const d = new JSDOM(`<main>${codeBatchMarkup()}</main>`).window.document; return d.querySelector('[data-code-batch]'); };

test('markup carries exactly the controller ids, once each, and the served legacy page contains the identical region', () => {
  const r = region();
  for (const id of CODE_IDS) assert.equal(r.querySelectorAll('#' + id).length, 1, id);
  assert.equal(r.querySelector('#release-codes').disabled, true);
  assert.equal(r.querySelector('#release-codes').classList.contains('primary'), true);
  assert.equal(r.querySelector('#codes-output').hidden, true);
  assert.equal(r.querySelector('[data-code-review]').hidden, true);
  const html = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(codeBatchMarkup()), 'ui/legacy/index.html embeds codeBatchMarkup() byte-for-byte');
  assert.equal(html.split('id="issue-codes"').length, 2, 'one issue control on the page');
});

test('phases paint badge, review section and output; idle hides review and empties output', () => {
  const r = region();
  assert.equal(paintCodeBatch(r, { phase: 'idle' }), 'idle');
  assert.equal(r.querySelector('[data-code-phase]').textContent, 'Not issued');
  assert.equal(r.querySelector('[data-code-review]').hidden, true);
  assert.equal(paintCodeBatch(r, { phase: 'issued', ids: ['a', 'b'], context: 'svy_1' }), 'issued');
  assert.equal(r.querySelector('#issued-ids').textContent, '2 code ID(s) issued: a, b');
  assert.equal(r.querySelector('[data-code-context]').textContent, 'Survey svy_1');
  assert.equal(r.querySelector('[data-code-review]').hidden, false);
  assert.equal(r.querySelector('#export-impact').textContent, 'Preview and confirm to reveal code values.');
  assert.equal(paintCodeBatch(r, { phase: 'previewed', ids: ['a', 'b'], count: 2, impact: { reveals: 2 }, expiresIn: 90 }), 'previewed');
  assert.equal(r.querySelector('[data-code-review-title]').textContent, 'Confirm action');
  assert.equal(r.querySelector('#export-impact').textContent, 'Release 2 code value(s) once; impact: {"reveals":2}. Confirmation expires in 90 seconds.');
  assert.equal(r.querySelector('#codes-output').hidden, true);
  assert.equal(paintCodeBatch(r, { phase: 'released', ids: ['a'], codesText: 'a: <b>&x' }), 'released');
  assert.equal(r.querySelector('#codes-output').hidden, false);
  assert.equal(r.querySelector('#codes-output').textContent, 'a: <b>&x', 'textContent only — never markup');
  assert.equal(r.querySelector('#codes-output').innerHTML.includes('<b>'), false);
  assert.equal(paintCodeBatch(r, { phase: 'idle' }), 'idle');
  assert.equal(r.querySelector('#codes-output').textContent, ''); assert.equal(r.querySelector('#codes-output').hidden, true);
});

test('unknown phase paints idle; failure paints a warning without changing phase or revealing values', () => {
  const r = region();
  assert.equal(paintCodeBatch(r, { phase: 'nope', codesText: 'SECRET' }), 'idle');
  assert.equal(r.querySelector('#codes-output').textContent, '');
  paintCodeBatch(r, { phase: 'issued', ids: ['a'], failure: 'CONFIRMATION_EXPIRED: preview again' });
  assert.equal(r.querySelector('#export-impact').textContent, 'CONFIRMATION_EXPIRED: preview again');
  assert.equal(r.querySelector('#export-impact').classList.contains('warning'), true);
  assert.equal(r.querySelector('[data-code-review-title]').textContent, 'Needs attention');
  assert.equal(r.querySelector('#codes-output').hidden, true);
});

test('painting never touches control disabled state or replaces control nodes', () => {
  const r = region();
  const issue = r.querySelector('#issue-codes'), release = r.querySelector('#release-codes'), preview = r.querySelector('#preview-export');
  issue.disabled = true; release.disabled = false; preview.disabled = true;
  for (const phase of [...PHASES, 'bogus']) paintCodeBatch(r, { phase, ids: ['x'], codesText: 'x: y' });
  assert.equal(r.querySelector('#issue-codes'), issue); assert.equal(r.querySelector('#release-codes'), release); assert.equal(r.querySelector('#preview-export'), preview);
  assert.equal(issue.disabled, true); assert.equal(release.disabled, false); assert.equal(preview.disabled, true);
});

test('validCount mirrors the controller rule: integers 1–100 only', () => {
  assert.equal(validCount('1'), 1); assert.equal(validCount('100'), 100); assert.equal(validCount(50), 50);
  for (const bad of ['0', '101', '2.5', '', 'abc', null, undefined, '-3', '1e2']) assert.equal(validCount(bad), bad === '1e2' ? 100 : null, String(bad));
});

test('paintCodeBatch tolerates a missing root', () => { assert.equal(paintCodeBatch(null, { phase: 'issued' }), 'idle'); });
