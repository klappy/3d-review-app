// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import Status from '../ui-next/src/app/Status.svelte';
afterEach(cleanup);
it.each(['light', 'dark'])('places the only phone Retry in the existing bottom action bar (%s)', async theme => {
  const retry = vi.fn();
  const view = render(Status, { phone: true, theme, kind: 'failed', message: 'Read failed', onretry: retry, back: '#/review/A/collect', backLabel: 'Back to previous view' });
  const button = view.getByRole('button', { name: 'Retry' });
  const bar = view.getByRole('group', { name: 'Page actions' });
  expect(bar.classList.contains('phone-bar')).toBe(true);
  expect(bar.contains(button)).toBe(true);
  expect(bar.contains(view.getByRole('link', { name: 'Back to previous view' }))).toBe(true);
  expect(view.container.querySelector('main')?.contains(button)).toBe(false);
  expect(view.container.querySelector('main')?.classList.contains('l-phone')).toBe(true);
  expect(view.container.querySelectorAll('.btn-primary')).toHaveLength(1);
  await fireEvent.click(button); expect(retry).toHaveBeenCalledTimes(1);
});
it('keeps desktop Retry at the upper right of the status card with no phone bar', async () => {
  const retry = vi.fn();
  const view = render(Status, { kind: 'failed', onretry: retry, back: '#/review/A/collect' });
  const button = view.getByRole('button', { name: 'Retry' });
  const heading = view.getByRole('heading', { name: 'Something went wrong' });
  expect(button.parentElement).toBe(heading.parentElement);
  expect(button.parentElement?.hasAttribute('data-split')).toBe(true);
  expect(view.queryByRole('group', { name: 'Page actions' })).toBeNull();
  expect(view.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('#/review/A/collect');
  await fireEvent.click(button); expect(retry).toHaveBeenCalledTimes(1);
});
it.each([false, true])('removes Retry during loading and preserves the back destination (phone=%s)', async phone => {
  const view = render(Status, { phone, kind: 'failed', onretry: vi.fn(), back: '#/review/A/collect' });
  expect(view.getByRole('button', { name: 'Retry' })).toBeTruthy();
  await view.rerender({ phone, kind: 'loading', onretry: vi.fn(), back: '#/review/A/collect' });
  expect(view.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(view.queryByRole('group', { name: 'Page actions' })).toBeNull();
  expect(view.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('#/review/A/collect');
});
it('does not add a retry bar to inline status or nonretryable phone states', () => {
  const inline = render(Status, { phone: true, inline: true, kind: 'failed', onretry: vi.fn() });
  expect(inline.queryByRole('button', { name: 'Retry' })).toBeNull(); inline.unmount();
  const view = render(Status, { phone: true, kind: 'refused', back: '#/' });
  expect(view.queryByRole('group', { name: 'Page actions' })).toBeNull();
  expect(view.getByRole('link', { name: 'Home' })).toBeTruthy();
});
