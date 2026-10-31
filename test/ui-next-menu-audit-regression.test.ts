// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import MenuSheet from '../ui-next/src/screens/actions/MenuSheet.svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as D from '../ui-next/src/app/data.js';
import * as S from '../ui-next/src/app/session.js';
import { setLiveChrome } from '../ui-next/src/app/chrome.js';
import { setLiveContext } from '../ui-next/src/screens/href.js';
import { loadMenuIdentity, loadMenuModel, MENU_READ_LIMIT_MS } from '../ui-next/src/app/menu-loader.js';

const me = { principal: { id: 'synthetic-owner', display_name: 'Synthetic Owner', email: 'owner@example.invalid', access_mode: 'my' }, grants: [] };
const home = { user: { first: 'Synthetic', name: 'Synthetic Owner', initials: 'SO' }, workspace: 'Synthetic workspace', workspaces: [], projects: [], groups: [], completed: [], empty: true };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); S.forget(); setLiveChrome(null); setLiveContext(null); history.replaceState(null, '', '/next/?ui_next=on'); });

function phone() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
async function flush() { await tick(); for (let n = 0; n < 20; n++) await Promise.resolve(); await tick(); }
async function go(hash: string) { history.replaceState(null, '', `/next/?ui_next=on${hash}`); await fireEvent(window, new HashChangeEvent('hashchange')); await flush(); }
const response = (result: any, status = 200) => new Response(JSON.stringify(status === 200 ? { ok: true, result } : { ok: false, error: result }), { status });
function sessionReads() {
  phone();
  vi.spyOn(S, 'me').mockResolvedValue(me);
  vi.stubGlobal('fetch', vi.fn(async () => response(me)));
}

it('renders the actual live account rows and preserves their explicit targets and sign-out callback', async () => {
  const signOut = vi.fn();
  const model = D.menuModel(me, home, { onSignOut: signOut, currentDesign: '/#projects' });
  expect(model.items.length).toBeGreaterThan(8); // the live model is intentionally larger than the gallery board
  const view = render(MenuSheet, { data: model });
  const nav = view.getByRole('navigation', { name: 'Workspace and account' });
  for (const [label, href] of [['Projects', '#/projects'], ['Workspaces', '#/workspaces'], ['Account settings', '#/account'], ['Current design', '/#projects'], ['Use another account', '#/account?view=switch']]) {
    expect(view.getByRole('link', { name: label, exact: true }).getAttribute('href')).toBe(href);
  }
  expect(nav.querySelectorAll('a.mi,button.mi')).toHaveLength(model.items.length);
  await fireEvent.click(view.getByRole('button', { name: 'Sign out', exact: true }));
  expect(signOut).toHaveBeenCalledOnce();
});

it('retains the eight-row gallery menu independently of the live row count', () => {
  const view = render(MenuSheet);
  expect(view.getByRole('navigation', { name: 'Workspace and account' }).querySelectorAll('a.mi')).toHaveLength(8);
});

it('a signed-out menu route shows sign-in without reading another account history', async () => {
  phone();
  vi.spyOn(S, 'me').mockResolvedValue(null);
  vi.spyOn(S, 'emailLinksOn').mockResolvedValue(false);
  vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'NOT_AUTHENTICATED' }, 401)));
  const history = vi.spyOn(D, 'homeModel');
  location.hash = '#/menu';
  const view = render(Live);
  await waitFor(() => expect(view.getByRole('heading', { name: 'Sign in to 3D Review' })).toBeTruthy());
  expect(history).not.toHaveBeenCalled();
  expect(view.queryByRole('navigation', { name: 'Workspace and account' })).toBeNull();
  expect(view.container.textContent).not.toContain(me.principal.email);
});

it('Close and repeated same-route menu clicks reopen one usable dialog without route churn', async () => {
  const model = D.menuModel(me, home, { onSignOut: vi.fn() });
  const view = render(MenuSheet, { data: model });
  const dialog = view.getByRole('dialog');
  const before = location.href;
  for (let n = 0; n < 2; n++) {
    await fireEvent.click(view.getByRole('button', { name: 'Close', exact: true }));
    expect(dialog.hasAttribute('open')).toBe(false);
    await fireEvent.click(view.getByRole('link', { name: 'Workspace and account', exact: true }));
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('[data-autofocus]'));
    expect(location.href).toBe(before);
    expect(view.getAllByRole('dialog')).toHaveLength(1);
  }
});

it('phone Projects → menu → Projects, repeated entry and remount keep required actions usable', async () => {
  sessionReads();
  const readHistory = vi.spyOn(D, 'homeModel').mockResolvedValue(home as any);
  vi.spyOn(D, 'projects').mockResolvedValue([{ id: 'p', name: 'Authorized project', role: 'owner', assessment_count: 1, response_count: 12 }]);
  const signOut = vi.spyOn(S, 'signOut').mockResolvedValue(undefined);
  history.replaceState(null, '', '/next/?ui_next=on#/projects');
  const view = render(Live);
  await view.findByRole('heading', { name: 'Projects', exact: true });
  await go(view.getByRole('link', { name: 'Workspace and account', exact: true }).getAttribute('href')!);
  await view.findByRole('navigation', { name: 'Workspace and account' });
  expect(view.container.querySelector('[data-loading-frame]')).toBeNull();
  await go(view.getByRole('link', { name: 'Projects', exact: true }).getAttribute('href')!);
  await view.findByRole('heading', { name: 'Projects', exact: true });
  await go(view.getByRole('link', { name: 'Workspace and account', exact: true }).getAttribute('href')!);
  await view.findByRole('navigation', { name: 'Workspace and account' });
  view.unmount();
  const reload = render(Live);
  await reload.findByRole('navigation', { name: 'Workspace and account' });
  expect(reload.getByRole('link', { name: 'Account settings', exact: true }).getAttribute('href')).toBe('#/account');
  expect(readHistory).toHaveBeenCalled();
  await fireEvent.click(reload.getByRole('button', { name: 'Sign out', exact: true }));
  await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  await waitFor(() => expect(location.hash).toBe('#/welcome'));
});

it.each(['reject', 'timeout'])('optional review history %s keeps account actions and marks history unknown', async mode => {
  vi.useFakeTimers();
  const late = deferred<any>();
  const readHome = vi.fn(mode === 'reject' ? async () => { throw new Error('Temporary aggregate failure'); } : () => late.promise);
  const pending = loadMenuModel(me, { readHome, onSignOut: vi.fn() });
  await vi.advanceTimersByTimeAsync(MENU_READ_LIMIT_MS + 1);
  const model = await pending;
  expect(model.historyStatus).toBe('unavailable');
  expect(model.completed).toBeNull();
  expect(model.reviews).toEqual([]);
  const view = render(MenuSheet, { data: model });
  expect(view.getByRole('navigation', { name: 'Workspace and account' })).toBeTruthy();
  expect(view.getByRole('status').textContent).toContain('review list could not be loaded');
  expect(view.getByRole('link', { name: 'Open your reviews to retry' })).toBeTruthy();
  expect(view.queryByText('Completed · 0')).toBeNull();
  late.resolve({ ...home, groups: [{ stage: 'collecting', reviews: [{ title: 'Late private history' }] }] });
  await flush();
  expect(view.container.textContent).not.toContain('Late private history');
  expect(readHome).toHaveBeenCalledOnce();
});

it('a delayed authorized history read uses its actual menu data before the bounded deadline', async () => {
  vi.useFakeTimers();
  const late = deferred<any>();
  const pending = loadMenuModel(me, { readHome: () => late.promise, onSignOut: vi.fn() });
  await vi.advanceTimersByTimeAsync(500);
  late.resolve(home);
  const model = await pending;
  expect(model.historyStatus).toBe('ready');
  expect(model.completed).toBe(0); // known zero from a successfully read, empty authorized history
  expect(model.items.map((row: any[]) => row[1])).toContain('Projects');
});

it('menu identity timeout and malformed identity reject instead of creating a signed-in menu', async () => {
  vi.useFakeTimers();
  const pending = expect(loadMenuIdentity({ read: () => new Promise(() => {}) })).rejects.toThrow('sign-in could not be checked');
  await vi.advanceTimersByTimeAsync(MENU_READ_LIMIT_MS + 1);
  await pending;
  await expect(loadMenuIdentity({ read: async () => ({}) })).rejects.toThrow('sign-in could not be checked');
  await expect(loadMenuIdentity({ read: async () => ({ principal: { id: 'anon', kind: 'anonymous' } }) })).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
  await expect(loadMenuModel(me, { readHome: async () => { throw Object.assign(new Error('Signed out'), { code: 'NOT_AUTHENTICATED' }); } })).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
});

it('a rejected fresh menu identity shows truthful Retry and recovers without a false sign-in state', async () => {
  sessionReads();
  let unavailable = true;
  vi.stubGlobal('fetch', vi.fn(async () => unavailable ? response({ code: 'UNAVAILABLE', message: 'Sign-in check temporarily unavailable' }, 503) : response(me)));
  vi.spyOn(D, 'homeModel').mockResolvedValue(home as any);
  history.replaceState(null, '', '/next/?ui_next=on#/menu');
  const view = render(Live);
  await view.findByRole('heading', { name: 'Something went wrong' });
  expect(view.queryByRole('heading', { name: 'Sign in to 3D Review' })).toBeNull();
  expect(view.queryByRole('navigation', { name: 'Workspace and account' })).toBeNull();
  unavailable = false;
  await fireEvent.click(view.getByRole('button', { name: 'Retry', exact: true }));
  await view.findByRole('navigation', { name: 'Workspace and account' });
});

it('a never-settling fresh menu identity reaches a bounded retryable terminal error', async () => {
  vi.useFakeTimers();
  sessionReads();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const readHistory = vi.spyOn(D, 'homeModel');
  history.replaceState(null, '', '/next/?ui_next=on#/menu');
  const view = render(Live);
  await flush();
  await vi.advanceTimersByTimeAsync(MENU_READ_LIMIT_MS + 1);
  await flush();
  expect(view.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Retry', exact: true })).toBeTruthy();
  expect(view.container.querySelector('[data-loading-frame]')).toBeNull();
  expect(readHistory).not.toHaveBeenCalled();
});

it('the menu uses its fresh actor instead of another actor cached by a previous route', async () => {
  sessionReads(); // the ordinary cached-session path still answers with the former actor
  const replacement = { principal: { id: 'replacement', display_name: 'Replacement Person', email: 'replacement@example.invalid', access_mode: 'my' }, grants: [] };
  vi.stubGlobal('fetch', vi.fn(async () => response(replacement)));
  const readHistory = vi.spyOn(D, 'homeModel').mockResolvedValue({ ...home, user: { first: 'Replacement', name: 'Replacement Person', initials: 'RP' } } as any);
  history.replaceState(null, '', '/next/?ui_next=on#/menu');
  const view = render(Live);
  await view.findByRole('navigation', { name: 'Workspace and account' });
  expect(readHistory).toHaveBeenCalledWith(replacement);
  expect(view.container.textContent).toContain(replacement.principal.email);
  expect(view.container.textContent).not.toContain(me.principal.email);
});

it('a late menu identity cannot replace a newer page or adopt the former actor history', async () => {
  sessionReads();
  const identity = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn(() => identity.promise));
  const readHistory = vi.spyOn(D, 'homeModel').mockResolvedValue(home as any);
  vi.spyOn(D, 'projects').mockResolvedValue([{ id: 'replacement-project', name: 'Replacement project', role: 'viewer', assessment_count: 1, response_count: 12 }]);
  history.replaceState(null, '', '/next/?ui_next=on#/menu');
  const view = render(Live);
  await flush();
  vi.mocked(S.me).mockResolvedValue({ principal: { id: 'replacement', display_name: 'Replacement Person', access_mode: 'my' }, grants: [] });
  await go('#/projects');
  await view.findByRole('heading', { name: 'Projects', exact: true });
  identity.resolve(response(me));
  await flush();
  expect(view.getByRole('link', { name: 'Replacement project', exact: true })).toBeTruthy();
  expect(view.queryByRole('navigation', { name: 'Workspace and account' })).toBeNull();
  expect(view.container.textContent).not.toContain(me.principal.email);
  expect(readHistory).not.toHaveBeenCalled();
});
