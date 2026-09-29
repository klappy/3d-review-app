// node --test ui/assess/s12a-complete-owner-badge.test.mjs — S12a: after Complete the role badge names the role as granted.
// A completed review renders its content locked (effective a.role 'viewer', v3CompleteLock) while the owner keeps
// Permissions + Delete (S8b). The shell badge (header + tree node) read the locked role and showed VIEWER; it now reads
// granted_role, so the badge and the settings offered agree. Content gates are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { v3CompleteLock, v3SettingsRole, v3NextSerialize } from './v3-assessment.js';
import { shellModel } from '../kit/app-adapter.js';
import { routes } from './cards.js';
import { deleteAssessmentButton } from '../v3/components/delete-assessment.js';

const done = v3NextSerialize({ text: 'Meet the elders', areas: [], other: '', complete: true });
const assessment = (role, notes = done) => v3CompleteLock({ id: 'a1', name: 'A', project_id: 'p1', stage: 'improve', role, notes_next_steps: notes });
const known = role => ({ projects: [{ id: 'p1', name: 'P', role, workspace_id: 'w1' }], workspaces: new Map([['w1', { id: 'w1', name: 'W', role, projects: ['p1'] }]]), lists: new Map() });
const shell = (a, k) => shellModel({ route: { kind: 'assessment', id: a.id }, routes, principal: { id: 'x' }, known: k, current: { assessment: a } });

test('S12a completed review: the owner badge reads Owner while Permissions + Delete stay offered', () => {
  const a = assessment('owner');
  assert.equal(a.role, 'viewer', 'content stays locked');
  const m = shell(a, known('owner'));
  assert.equal(m.role, 'Owner');
  assert.notEqual(m.role, 'Viewer');
  assert.equal(v3SettingsRole(a), 'owner');
  assert.match(deleteAssessmentButton(v3SettingsRole(a)), /data-delete-assessment/, 'badge and settings agree');
});

test('S12a completed review, direct grant (no project role): the tree node badge reads Owner too', () => {
  const a = assessment('owner');
  const m = shell(a, { projects: [], workspaces: new Map(), lists: new Map() });
  assert.equal(m.role, 'Owner');
  assert.equal(m.nodes.find(n => n.id === 'a:a1').role, 'Owner');
});

test('S12a completed review: member and viewer badges keep their granted role; nothing is promoted', () => {
  for (const [role, label] of [['member', 'Member'], ['viewer', 'Viewer']]) assert.equal(shell(assessment(role), known(role)).role, label);
});

test('S12a open review: the badge is the role as granted (unchanged before Complete)', () => {
  for (const [role, label] of [['owner', 'Owner'], ['member', 'Member'], ['viewer', 'Viewer']]) {
    const a = assessment(role, 'x');
    assert.equal(a.complete, undefined);
    assert.equal(shell(a, known(role)).role, label);
  }
});
