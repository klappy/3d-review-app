import { afterEach, expect, it } from 'vitest';
import { activitySnapshot, clearActivity, observeActivity } from '../ui-next/src/app/activity.js';
afterEach(clearActivity);
it('retains only receipt evidence, never credentials or payloads', () => {
  observeActivity({ capability: 'cap.assessment.notes.update', result: { notes: 'private', token: 'secret' }, receipt: { actor: 'a', id: 'r1', trace_id: 't1', scope: { type: 'assessment', id: 'private-scope' }, undo_token: 'undo-secret', at: 'now', class: 'write.reversible' } }, null);
  expect(activitySnapshot()).toEqual([{ capability: 'cap.assessment.notes.update', at: 'now', receipt: 'r1', trace: 't1', scope: 'assessment', kind: 'write.reversible' }]);
  expect(JSON.stringify(activitySnapshot())).not.toMatch(/private|secret|undo/);
});
it('clears the prior identity on cookie-only and bearer transitions', () => {
  observeActivity({ receipt: { actor: 'a', id: 'r1' } }, null);
  observeActivity({ result: { principal: { id: 'b' } } }, null);
  expect(activitySnapshot()).toEqual([]);
  observeActivity({ receipt: { actor: 'b', id: 'r2' } }, null);
  observeActivity({ result: { principal: { id: 'c' } } }, 'new-synthetic-bearer');
  expect(activitySnapshot()).toEqual([]);
});
