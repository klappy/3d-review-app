import assert from 'node:assert/strict';
import test from 'node:test';
import { clearIdentityData, codeEntryFailure, hasProjectWork } from './visibility.js';

test('ungranted or assessment-only identity does not see project work', () => {
  assert.equal(hasProjectWork({ principal: { provisioned: false }, grants: [] }), false);
  assert.equal(hasProjectWork({ principal: { provisioned: false }, grants: [{ scope_type: 'assessment' }] }), false);
});

test('provisioned creator or exact project grantee can see project navigation', () => {
  assert.equal(hasProjectWork({ principal: { provisioned: true }, grants: [] }), true);
  assert.equal(hasProjectWork({ principal: { provisioned: false }, grants: [{ scope_type: 'project', role: 'viewer' }] }), true);
});

test('identity switch clears facilitator, participant and scoped client state', () => {
  const state = { session: 'owner', participant: 'pt', principal: { id: 'owner' }, project: 'proj', projectView: { name: 'Old' }, assessment: 'assessment', survey: 'survey', form: { items: [] }, answers: { Q1: 'a' }, responseKey: 'key', codeIds: ['code'], confirmToken: 'confirm' };
  const removed = [];
  clearIdentityData(state, { removeItem: key => removed.push(key) });
  assert.ok(Object.values(state).every(value => value === null));
  assert.deepEqual(removed, ['facilitatorToken', 'participantToken', 'responseKey']);
});

test('invalid-code failure has a local, non-disclosing message', () => {
  assert.match(codeEntryFailure, /Check it and try again/);
  assert.doesNotMatch(codeEntryFailure, /NOT_FOUND|trace|code value/);
});
