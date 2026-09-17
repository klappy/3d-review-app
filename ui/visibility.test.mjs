import assert from 'node:assert/strict';
import test from 'node:test';
import { assessmentGrants, clearIdentityData, codeEntryFailure, hasProjectWork, hasReportWork } from './visibility.js';

test('ungranted or assessment-only identity does not see project work', () => {
  assert.equal(hasProjectWork({ principal: { provisioned: false }, grants: [] }), false);
  assert.equal(hasProjectWork({ principal: { provisioned: false }, grants: [{ scope_type: 'assessment' }] }), false);
});

test('provisioned creator or exact project grantee can see project navigation', () => {
  assert.equal(hasProjectWork({ principal: { provisioned: true }, grants: [] }), true);
  assert.equal(hasProjectWork({ principal: { provisioned: false }, grants: [{ scope_type: 'project', role: 'viewer' }] }), true);
});

test('assessmentGrants returns only the identity’s own assessment rows, in order', () => {
  const me = { principal: { provisioned: false }, grants: [
    { scope_type: 'project', scope_id: 'proj_1', role: 'owner' },
    { scope_type: 'assessment', scope_id: 'assess_2', role: 'viewer' },
    { scope_type: 'assessment', scope_id: 'assess_1', role: 'member' },
  ] };
  assert.deepEqual(assessmentGrants(me).map(g => g.scope_id), ['assess_2', 'assess_1']);
  assert.deepEqual(assessmentGrants({ principal: {}, grants: [] }), []);
  assert.deepEqual(assessmentGrants(undefined), []);
});

test('report work is reachable for an assessment-only grantee and for every project identity', () => {
  assert.equal(hasReportWork({ principal: { provisioned: false }, grants: [{ scope_type: 'assessment', scope_id: 'a1', role: 'viewer' }] }), true);
  assert.equal(hasReportWork({ principal: { provisioned: true }, grants: [] }), true);
  assert.equal(hasReportWork({ principal: { provisioned: false }, grants: [{ scope_type: 'project', role: 'viewer' }] }), true);
  assert.equal(hasReportWork({ principal: { provisioned: false }, grants: [] }), false);
  assert.equal(hasReportWork(null), false);
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
