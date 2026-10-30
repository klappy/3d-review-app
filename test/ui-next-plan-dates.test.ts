// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import PlanDates from '../ui-next/src/app/PlanDates.svelte';
import { readPlanDates, validPlanDate, writePlanDates } from '../ui-next/src/app/plan-dates.js';
import { v3NextParse, v3NextSerialize } from '../ui/assess/v3-assessment.js';
afterEach(cleanup);
it('roundtrips calendar dates as readable notes through the existing serializer without changing completion or areas', () => {
  const text = writePlanDates('Meet the team\nKeep this exact line.', { followUp: '2026-11-28', reviewAgain: '2027-01-03' });
  expect(text).toContain('Follow up on: 2026-11-28');
  const stored = v3NextSerialize({ text, areas: ['Community'], other: 'Reading', complete: true });
  const reloaded = v3NextParse(stored);
  expect(reloaded).toEqual({ text, areas: ['Community'], other: 'Reading', complete: true });
  expect(readPlanDates(reloaded.text)).toEqual({ text: 'Meet the team\nKeep this exact line.', followUp: '2026-11-28', reviewAgain: '2027-01-03' });
});
it('replaces only its own trailing block and clearing dates preserves all prose', () => {
  const initial = 'Follow up on: custom words\nDo not remove this.';
  const first = writePlanDates(initial, { followUp: '2028-02-29' });
  const second = writePlanDates(first, { reviewAgain: '2028-03-01' });
  expect(second.match(/Follow up on: 2028/g)).toHaveLength(1);
  expect(writePlanDates(second, { followUp: '', reviewAgain: '' })).toBe(initial);
  expect(readPlanDates('Follow up on: 2026-11-28')).toEqual({ text: 'Follow up on: 2026-11-28', followUp: '', reviewAgain: '' });
});
it('refuses invalid dates and leaves malformed user prose untouched', () => {
  expect(validPlanDate('2027-02-29')).toBe(false);
  expect(validPlanDate('2028-02-29')).toBe(true);
  expect(() => writePlanDates('Notes', { followUp: '2026-02-30' })).toThrow('valid calendar');
  const malformed = 'Follow up on: 2026-02-30\nReview again on: —';
  expect(readPlanDates(malformed).text).toBe(malformed);
});
it('renders dates from persisted text, reports edits as notes text, and refuses changes while readonly', async () => {
  const text = writePlanDates('Notes', { followUp: '2026-11-28' }), onchange = vi.fn();
  const view = render(PlanDates, { text, onchange });
  expect((view.getByLabelText(/Follow up on/) as HTMLInputElement).value).toBe('2026-11-28');
  await fireEvent.change(view.getByLabelText(/Review again on/), { target: { value: '2027-01-03' } });
  expect(readPlanDates(onchange.mock.calls[0][0]).reviewAgain).toBe('2027-01-03');
  await view.rerender({ text, onchange, disabled: true });
  await fireEvent.change(view.getByLabelText(/Follow up on/), { target: { value: '2027-02-01' } });
  expect(onchange).toHaveBeenCalledTimes(1);
});
