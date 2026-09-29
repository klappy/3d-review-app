// S15b (cookbook Sprint 15 row 15b): facilitator-only demographics switch, off by default, in setup step 3 and assessment settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDraft, launchPlan, demographicsToggle, draftFromSaved } from './wizard.js';
import { demographicsSetting, demographicsBody, DEMOGRAPHICS_LABEL } from '../assess/v3-assessment.js';

const draft = on => ({ ...freshDraft(), name: 'R', project: 'p1', language: 'l1', groups: { t1: { version: '1', expected: '' } }, demographics: on });
const fd = entries => { const m = new Map(entries); return { has: k => m.has(k), get: k => m.has(k) ? m.get(k) : null }; };

test('setup: a fresh draft has demographics off', () => { assert.equal(freshDraft().demographics, false); });
test('setup: off sends no demographics write', () => { assert.ok(!launchPlan(draft(false)).some(s => s.cap === 'cap.assessment.update')); });
test('setup: on writes demographics_enabled after the groups are selected, before collection opens', () => {
  const plan = launchPlan(draft(true)), caps = plan.map(s => s.cap), i = caps.indexOf('cap.assessment.update');
  assert.ok(i > caps.lastIndexOf('cap.survey.select') && i < caps.indexOf('cap.assessment.set_stage'));
  assert.equal(plan[i].method, 'PATCH'); assert.equal(plan[i].url({ aid: 'a 1' }), '/v2/assessments/a%201');
  assert.deepEqual(plan[i].body({}), { demographics_enabled: true });
});
test('setup: step-3 toggle is unchecked unless turned on', () => {
  assert.match(demographicsToggle(false), /Ask participants about themselves \(age range, gender\)/);
  assert.doesNotMatch(demographicsToggle(false), /checked/); assert.match(demographicsToggle(true), /checked/);
});
test('setup: resume reads the switch from the assessment', () => {
  assert.equal(draftFromSaved({ id: 'a', name: 'R', language_id: 'l', demographics_enabled: true }, []).d.demographics, true);
  assert.equal(draftFromSaved({ id: 'a', name: 'R', language_id: 'l' }, []).d.demographics, false);
});
test('settings: owner/member see the switch, reflecting the server value', () => {
  assert.match(demographicsSetting({ role: 'owner' }), new RegExp(DEMOGRAPHICS_LABEL.replace(/[()]/g, '\\$&')));
  assert.doesNotMatch(demographicsSetting({ role: 'owner' }), /checked/);
  assert.match(demographicsSetting({ role: 'member', demographics_enabled: true }), /checked/);
});
test('settings: viewers, participants and completed assessments get no control', () => {
  for (const a of [{ role: 'viewer', demographics_enabled: true }, { role: 'participant' }, {}, null, { role: 'owner', complete: true }]) assert.equal(demographicsSetting(a), '');
});
test('settings: PATCH body carries the switch only when the form has it', () => {
  assert.deepEqual(demographicsBody(fd([['demographics-present', '1'], ['demographics', 'on']])), { demographics_enabled: true });
  assert.deepEqual(demographicsBody(fd([['demographics-present', '1']])), { demographics_enabled: false });
  assert.deepEqual(demographicsBody(fd([])), {});
});
