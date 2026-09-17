import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverParticipant, redeemAndOpen, resumeNoticeAfterReceipt, resumeTarget, savedSubmitKey } from './participant-resume.js';

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

test('only a failed redeem is labeled bad code', async () => {
  let badCode = 0, token = null;
  const formError = new Error('form unavailable');
  await assert.rejects(redeemAndOpen(async () => ({ participant_token: 'pt_1' }),
    result => { token = result.participant_token; }, async () => { throw formError; },
    () => { badCode++; }), error => error === formError);
  assert.equal(token, 'pt_1');
  assert.equal(badCode, 0);
  await assert.rejects(redeemAndOpen(async () => { throw new Error('invalid code'); },
    () => { throw new Error('should not save token'); }, async () => {}, () => { badCode++; }), /invalid code/);
  assert.equal(badCode, 1);
});

test('confirmed receipt clears stale re-entry warning but unsubmitted receipt retains it', () => {
  const warning = 'Answers entered before reload were not saved';
  assert.equal(resumeNoticeAfterReceipt({ submitted: true }, warning), '');
  assert.equal(resumeNoticeAfterReceipt({ submitted: false }, warning), warning);
});

 test('recover retries the form after consumed-code failure without redeeming again', async () => {
  let redeems = 0, opens = 0, savedToken = null, displayed = 0;
  const open = async () => { if (++opens === 1) throw new Error('temporary form failure'); };
  await assert.rejects(redeemAndOpen(async () => { redeems++; return { participant_token: 'synthetic' }; },
    r => { savedToken = r.participant_token; }, open, () => assert.fail('code succeeded')));
  await recoverParticipant({ submitted: false }, false, open, () => displayed++);
  assert.equal(redeems, 1); assert.equal(opens, 2); assert.equal(savedToken, 'synthetic'); assert.equal(displayed, 0);
});

test('recover preserves loaded answers and routes saved receipts without loading form', async () => {
  const answers = { answer: 'entered value' }; const shown = [];
  const open = async () => { answers.answer = ''; assert.fail('must not reload form'); };
  await recoverParticipant({ submitted: false }, true, open, r => shown.push(r));
  await recoverParticipant({ submitted: true }, false, open, r => shown.push(r));
  assert.equal(answers.answer, 'entered value'); assert.deepEqual(shown, [{ submitted: false }, { submitted: true }]);
});
