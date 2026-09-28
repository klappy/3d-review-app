// node --test ui/assess/s8b-complete-keeps-owner.test.mjs — S8b, captain ruling 2026-09-28 15:27 ET:
// "Owner keeps Permissions + Delete after Complete" — read-only applies to responses, setup and next-steps content;
// ownership actions stay. Both sides: the owner keeps the settings; every content gate stays locked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { v3CompleteLock, v3SettingsRole, v3NextSerialize, v3StagePrimary } from './v3-assessment.js';
import { deleteAssessmentButton } from '../v3/components/delete-assessment.js';

const done = v3NextSerialize({ text: 'Meet the elders', areas: [], other: '', complete: true });
const lock = role => v3CompleteLock({ id: 'a1', stage: 'improve', role, notes_next_steps: done });

test('S8b completed review: the owner keeps the settings role (Permissions + Delete)', () => {
  const a = lock('owner');
  assert.equal(a.complete, true);
  assert.equal(v3SettingsRole(a), 'owner');
  assert.match(deleteAssessmentButton(v3SettingsRole(a)), /data-delete-assessment/);
});

test('S8b completed review: content stays read-only for the owner (effective role is viewer)', () => {
  const a = lock('owner');
  assert.equal(a.role, 'viewer', 'every content gate reads a.role');
  assert.equal(a.granted_role, 'owner');
  const mayEdit = a.role === 'owner' || a.role === 'member';
  assert.equal(mayEdit, false, 'no Save preparation / notes / survey set / stage move');
  assert.doesNotMatch(v3StagePrimary('collect', mayEdit), /<button/, 'no write action in the stage primary');
});

test('S8b completed review: a member or viewer gains nothing (ownership actions are the owner\'s)', () => {
  for (const role of ['member', 'viewer']) {
    const a = lock(role);
    assert.equal(v3SettingsRole(a), 'viewer');
    assert.equal(deleteAssessmentButton(v3SettingsRole(a)), '');
  }
});

test('S8b open review: settings role is the role as granted (no change before Complete)', () => {
  for (const role of ['owner', 'member', 'viewer']) {
    const a = v3CompleteLock({ id: 'a1', stage: 'improve', role, notes_next_steps: 'x' });
    assert.equal(v3SettingsRole(a), role);
  }
  assert.equal(v3SettingsRole(undefined), undefined);
  assert.equal(deleteAssessmentButton(v3SettingsRole({ role: 'member' })), '', 'Delete stays owner-only');
});

test('S8b the assessment shell gates Permissions + Delete on the settings role, content on a.role', () => {
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  assert.match(src, /function viewTabs\(a, current\) \{[^\n]*const sr = settingsRole\(a\);[^\n]*const perm = \(sr === 'owner' \|\| sr === 'member'\) \?[^\n]*deleteAssessmentButton\(sr, /);
  assert.doesNotMatch(src.match(/function viewTabs[^\n]*/)[0], /a\.role/, 'viewTabs reads no effective role');
  assert.match(src, /return \{ assessment: completeLock\(r\.assessment\), surveys: r\.surveys \|\| \[\] \};/, 'the lock still applies');
  assert.match(src, /const mayEdit = current\.assessment\.role === 'owner' \|\| current\.assessment\.role === 'member';/, 'content gate unchanged');
});
