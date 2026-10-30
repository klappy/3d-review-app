// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Editor from '../ui-next/src/app/PlanEditor.svelte';
import { savePlan, completePlan } from '../ui-next/src/app/plan.js';
afterEach(cleanup);
it('saves both fields and independently reads the stored assessment', async () => {
  let stored: any = {};
  const request = vi.fn(async (_url, init) => {
    if (init) { stored = { ...init.body }; return { assessment: stored }; }
    return { assessment: stored };
  });
  expect(await savePlan('review/a', { notes_reflection: 'Discussed together', notes_next_steps: 'Team meets June 4' }, request)).toEqual(stored);
  expect(request.mock.calls.map(x => x[0])).toEqual(['/v2/assessments/review%2Fa', '/v2/assessments/review%2Fa/notes', '/v2/assessments/review%2Fa']);
});
it('does not report success when persisted readback differs', async () => {
  await expect(savePlan('a', { notes_reflection: 'new', notes_next_steps: '' }, async () => ({ assessment: { notes_reflection: 'old' } }))).rejects.toThrow('could not be verified');
});
it('retains edited text and never completes when save is uncertain', async () => {
  const complete = vi.fn();
  const v = render(Editor, { notes: {}, onsave: async () => { throw new Error('Outcome unknown'); }, oncomplete: complete });
  await fireEvent.input(v.getByLabelText('What you noticed'), { target: { value: 'Keep my draft' } });
  await fireEvent.click(v.getByText('Save and complete the review'));
  await waitFor(() => expect(v.getByRole('alert').textContent).toContain('Outcome unknown'));
  expect((v.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe('Keep my draft');
  expect(complete).not.toHaveBeenCalled();
});
it('completion waits for saving and verified readback', async () => {
  const order: string[] = [];
  const v = render(Editor, { notes: {}, onsave: async () => { order.push('saved and read'); }, oncomplete: async () => { order.push('complete'); } });
  await fireEvent.click(v.getByText('Save and complete the review'));
  await waitFor(() => expect(order).toEqual(['saved and read', 'complete']));
});

it('completion preserves legacy metadata and verifies a durable complete marker', async () => {
  let stored: any = { stage: 'collect', notes_reflection: 'Keep reflection', notes_next_steps: 'Agreed text\n\n[Areas to discuss] Meaning\n[Other] Follow up' };
  const calls: string[] = [];
  const request = async (url, init) => {
    if (init) { calls.push(url); stored = { ...stored, ...init.body }; }
    return { assessment: { ...stored } };
  };
  const result = await completePlan('a', request);
  expect(result.stage).toBe('improve');
  expect(result.notes_reflection).toBe('Keep reflection');
  expect(result.notes_next_steps).toContain('Agreed text');
  expect(result.notes_next_steps).toContain('[Areas to discuss] Meaning');
  expect(result.notes_next_steps).toContain('[Other] Follow up');
  expect(result.notes_next_steps).toContain('[This review is complete.]');
  expect(calls.filter(x => x.endsWith('/stage'))).toHaveLength(2);
});
it('stage failure never writes the complete marker', async () => {
  const writes: any[] = [];
  await expect(completePlan('a', async (_url, init) => {
    if (init) { writes.push(init.body); throw new Error('Stage outcome unknown'); }
    return { assessment: { stage: 'understand', notes_next_steps: 'Keep draft' } };
  })).rejects.toThrow('unknown');
  expect(writes).toEqual([{stage: 'improve'}]);
});
