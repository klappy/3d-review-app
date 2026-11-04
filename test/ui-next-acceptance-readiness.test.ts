// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { requireTerminalPage as loaded, hasTerminalUi, verifyAccountMenuAndSignOut } from '../scripts/ui-next-acceptance/readiness.mjs';
import LoadingFrame from '../ui-next/src/app/LoadingFrame.svelte';
import Status from '../ui-next/src/app/Status.svelte';

// Test readiness without launching the legacy credential-seeding journey.
const page = () => ({
  waitForTimeout: async () => {},
  waitForFunction: async (check: () => boolean) => { if (!check()) throw new Error('Pending UI timed out'); },
  textContent: async (selector: string) => document.querySelector(selector)?.textContent ?? '',
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

for (const phone of [false, true]) for (const kind of ['page', 'results']) {
  it(`rejects the actual ${kind} LoadingFrame, phone=${phone}`, async () => {
    render(LoadingFrame, { phone, kind });
    await expect(loaded(page(), 'pending route')).rejects.toThrow();
  });
}
it('rejects the older Status loading state too', async () => {
  render(Status, { kind: 'loading' });
  await expect(loaded(page(), 'pending route')).rejects.toThrow();
});
it('does not accept a blank page as terminal content', async () => {
  document.body.innerHTML = '<main></main>';
  await expect(loaded(page(), 'blank route')).rejects.toThrow();
});
it('accepts an actual retryable error only when the scenario explicitly allows it', async () => {
  render(Status, { kind: 'failed', message: 'The server could not be reached.', onretry: vi.fn(), back: '#/home' });
  expect(hasTerminalUi()).toBe(true);
  await expect(loaded(page(), 'happy route')).rejects.toThrow('failure state');
  await expect(loaded(page(), 'network recovery', { allowError: true })).resolves.toBeUndefined();
});
it('does not accept an error with no recovery action', () => {
  document.body.innerHTML = '<main><section><h1>Something went wrong</h1></section></main>';
  expect(hasTerminalUi()).toBe(false);
});
it('waits for an actual terminal page rather than passing after an unmatched loading string', async () => {
  const view = render(LoadingFrame, { kind: 'results' });
  const p = page();
  p.waitForFunction = async check => {
    expect(check()).toBe(false);
    view.unmount();
    document.body.innerHTML = '<main><h1>Projects</h1><input aria-label="Search projects" /></main>';
    expect(check()).toBe(true);
  };
  await expect(loaded(p, 'projects')).resolves.toBeUndefined();
});
it('propagates a refused account-menu click instead of swallowing it', async () => {
  const p = { click: vi.fn().mockRejectedValue(new Error('Account menu not available')), waitForSelector: vi.fn() };
  await expect(verifyAccountMenuAndSignOut(p)).rejects.toThrow('Account menu not available');
  expect(p.waitForSelector).not.toHaveBeenCalled();
});
it('requires visible authorized menu actions and confirmed sign-out terminal UI', async () => {
  document.body.innerHTML = '<main><h1>Welcome</h1><a href="#/signin">Sign in</a></main>';
  const p = { ...page(), click: vi.fn().mockResolvedValue(undefined), waitForSelector: vi.fn().mockResolvedValue(undefined) };
  await verifyAccountMenuAndSignOut(p);
  expect(p.click).toHaveBeenCalledTimes(2);
  expect(p.waitForSelector.mock.calls.map(call => call[0])).toEqual([
    'details[open] a.mi:has-text("Account settings")', 'details[open] a.mi:has-text("Projects")',
    'details[open] button.mi:has-text("Sign out")', 'text=Sign in',
  ]);
});
