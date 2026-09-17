import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeTarget, savedSubmitKey } from './participant-resume.js';

test('reload before submit reopens the form, not an empty receipt', () => {
  assert.equal(resumeTarget({ submitted: false, response_id: null }), 'form');
});

test('reload after submit restores the persisted receipt', () => {
  assert.equal(resumeTarget({ submitted: true, response_id: 'resp_1' }), 'receipt');
});

test('an in-flight submit key survives reload only with a participant token', () => {
  const storage = { getItem: key => key === 'responseKey' ? 'same-key' : null };
  assert.equal(savedSubmitKey(storage, 'pt_1'), 'same-key');
  assert.equal(savedSubmitKey(storage, null), null);
});
