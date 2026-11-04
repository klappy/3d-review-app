// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as D from '../ui-next/src/app/data.js';
import * as S from '../ui-next/src/app/session.js';
import * as SU from '../ui-next/src/app/setup.js';
import { setToken } from '../ui-next/src/app/api.js';
import { REPORT } from '../ui-next/src/screens/results/data.js';
const person = (id = 'owner') => ({ principal: { id, display_name: id } });
function deferred<T>() { let resolve!: (x: T) => void, reject!: (x: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function flush() { await tick(); for (let n = 0; n < 20; n++) await Promise.resolve(); await tick(); }
async function go(hash: string) { location.hash = hash; await fireEvent(window, new HashChangeEvent('hashchange')); await flush(); }
const model = (aid: string, plan = false) => ({ aid, review: { ...REPORT.desktop.review, id: aid, title: `Review ${aid}` }, counts: REPORT.desktop.counts, payload: plan ? REPORT.desktop.payload : null, results: {}, serverStage: 'understand', canBuild: true, canEditNotes: true, notes: { notes_reflection: '', notes_next_steps: '' } });
function setup(aid: string) { const draft = SU.freshDraft('p'); draft.name = `Draft ${aid}`; draft.language = 'l'; draft.purpose = 'Passage'; return { key: aid, aid, draft, role: 'owner', stage: 'prepare', snap: SU.snapOf(draft), pre: [], projects: [{ id: 'p', name: 'Project' }], templates: [], languages: [{ id: 'l', name: 'Language' }], passages: [], fileStorage: true }; }
function session() { return vi.spyOn(S, 'me').mockResolvedValue(person()); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setToken(null); S.forget(); SU.forgetAll(); });

function identityFeed() {
  let state: any = person();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url !== '/v2/me') return new Response(JSON.stringify({ ok: true, result: { email_links: false } }));
    if (state instanceof Error) throw state;
    if (state instanceof Response) return state;
    if (state === null) return new Response(JSON.stringify({ ok: false, error: { code: 'NOT_AUTHENTICATED' } }), { status: 401 });
    return new Response(JSON.stringify({ ok: true, result: state }));
  }));
  return (next: any) => { state = next; };
}
it.each(['focus', 'pageshow'])('a transient %s identity-read failure retains the unsaved plan and setup caches', async event => {
  const identity = identityFeed(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid, true));
  const forget = vi.spyOn(SU, 'forgetAll');
  location.hash = '#/review/A/next-step'; const view = render(Live);
  const input = await view.findByLabelText('What you noticed'); await fireEvent.input(input, { target: { value: 'Unsaved private draft' } });
  identity(event === 'focus' ? new Error('Network unavailable') : new Response(JSON.stringify({ ok: false, error: { code: 'UNAVAILABLE' } }), { status: 503 }));
  await fireEvent(window, new Event(event)); await flush();
  expect(forget).not.toHaveBeenCalled(); expect((view.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe('Unsaved private draft');
});
it('a same-actor fresh identity read retains the plan draft, but a confirmed actor change clears it', async () => {
  const identity = identityFeed(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid, true));
  const forget = vi.spyOn(SU, 'forgetAll');
  location.hash = '#/review/A/next-step'; const view = render(Live); const input = await view.findByLabelText('What you noticed');
  await fireEvent.input(input, { target: { value: 'Original actor draft' } });
  await fireEvent(window, new Event('focus')); await flush(); expect((view.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe('Original actor draft'); expect(forget).not.toHaveBeenCalled();
  identity(person('replacement')); await fireEvent(window, new Event('pageshow'));
  await waitFor(() => expect(forget).toHaveBeenCalledOnce());
  await waitFor(() => expect((view.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe(''));
});
it('a confirmed signed-out identity clears the draft and shows sign in', async () => {
  const identity = identityFeed(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid, true));
  const forget = vi.spyOn(SU, 'forgetAll'); location.hash = '#/review/A/next-step'; const view = render(Live);
  await fireEvent.input(await view.findByLabelText('What you noticed'), { target: { value: 'Private draft' } });
  identity(null); await fireEvent(window, new Event('focus'));
  await waitFor(() => expect(forget).toHaveBeenCalledOnce()); expect(view.queryByLabelText('What you noticed')).toBeNull();
});
it('a malformed identity read preserves the draft rather than inventing a sign-out', async () => {
  const identity = identityFeed(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid, true)); const forget = vi.spyOn(SU, 'forgetAll');
  location.hash = '#/review/A/next-step'; const view = render(Live); await fireEvent.input(await view.findByLabelText('What you noticed'), { target: { value: 'Unsaved draft' } });
  identity({}); await fireEvent(window, new Event('focus')); await flush(); expect(forget).not.toHaveBeenCalled(); expect((view.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe('Unsaved draft');
});
it.each(['same-current-actor', 'newer-established-actor'])('a delayed focus response across navigation handles %s without stale identity adoption', async mode => {
  const pending = deferred<Response>(); let reads = 0, current = 'owner';
  vi.stubGlobal('fetch', vi.fn(async () => { if (++reads === 2) return pending.promise; return new Response(JSON.stringify({ ok: true, result: person(current) })); }));
  vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid, true)); const forget = vi.spyOn(SU, 'forgetAll');
  location.hash = '#/review/A/next-step'; const view = render(Live); await view.findByLabelText('What you noticed');
  await fireEvent(window, new Event('focus')); await waitFor(() => expect(reads).toBe(2));
  if (mode === 'newer-established-actor') { current = 'replacement'; S.forget(); }
  await go('#/review/B/next-step'); await waitFor(() => expect(view.container.textContent).toContain('Review B'));
  await fireEvent.input(view.getByLabelText('What you noticed'), { target: { value: 'B actor draft' } });
  current = 'replacement'; pending.resolve(new Response(JSON.stringify({ ok: true, result: person(mode === 'same-current-actor' ? 'replacement' : 'owner') })));
  await flush();
  if (mode === 'same-current-actor') { await waitFor(() => expect(forget).toHaveBeenCalledOnce()); await waitFor(() => expect((view.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe('')); }
  else { expect(forget).not.toHaveBeenCalled(); expect((view.getByLabelText('What you noticed') as HTMLTextAreaElement).value).toBe('B actor draft'); expect((await S.me()).principal.id).toBe('replacement'); }
});
it('a late setup A load cannot replace the displayed or saved setup B state', async () => {
  session(); const pending = deferred<any>(), a = setup('A'), b = setup('B');
  vi.spyOn(D, 'assessment').mockImplementation(async aid => ({ assessment: { id: aid, role: 'owner' } } as any));
  const open = vi.spyOn(SU, 'openSetup').mockImplementation(async aid => aid === 'A' ? pending.promise : b as any);
  vi.spyOn(SU, 'validateDetails').mockReturnValue([]); const save = vi.spyOn(SU, 'saveDetails').mockResolvedValue('B');
  location.hash = '#/setup/1?review=A'; const view = render(Live); await waitFor(() => expect(open).toHaveBeenCalledWith('A', expect.anything()));
  await go('#/setup/1?review=B'); await waitFor(() => expect((view.getByLabelText('Name this review') as HTMLInputElement).value).toBe('Draft B'));
  pending.resolve(a); await flush();
  expect((view.getByLabelText('Name this review') as HTMLInputElement).value).toBe('Draft B');
  await fireEvent.input(view.getByLabelText('Name this review'), { target: { value: 'B changed' } }); expect(b.draft.name).toBe('B changed'); expect(a.draft.name).toBe('Draft A');
  await fireEvent.click(view.getByRole('button', { name: 'Continue' })); await waitFor(() => expect(save).toHaveBeenCalledWith(b));
});

it.each(['resolve', 'reject'])('a late report preview from A cannot arm or alter B when it %s', async outcome => {
  session(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid));
  const pending = deferred<any>(); const preview = vi.spyOn(D, 'previewBuild').mockImplementation(async aid => aid === 'A' ? pending.promise : { token: 'token-B', expires: Date.now() + 60000 });
  const execute = vi.spyOn(D, 'executeBuild').mockResolvedValue({ held: true, preview: {} } as any);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, result: person() }))));
  location.hash = '#/review/A/results'; const view = render(Live); await fireEvent.click(await view.findByRole('button', { name: 'Build the report' }));
  await waitFor(() => expect(preview).toHaveBeenCalledWith('A')); await go('#/review/B/results'); await view.findByText(/No report has been built for Review B/);
  if (outcome === 'resolve') pending.resolve({ token: 'token-A', expires: Date.now() + 60000 }); else pending.reject(new Error('A preview failed'));
  await flush(); expect(view.container.querySelector('[data-confirm-report]')).toBeNull(); expect(view.container.textContent).not.toContain('A preview failed');
  await fireEvent.click(view.getByRole('button', { name: 'Build the report' })); await waitFor(() => expect(view.container.querySelector('[data-confirm-report]')).not.toBeNull());
  await fireEvent.click(view.container.querySelector('[data-confirm-report]')!); await waitFor(() => expect(execute).toHaveBeenCalledWith('B', 'token-B'));
  expect(execute.mock.calls.some(([aid]) => aid === 'A')).toBe(false);
});
it('a confirmed actor change invalidates a pending report preview', async () => {
  const me = session(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid)); const pending = deferred<any>();
  const preview = vi.spyOn(D, 'previewBuild').mockReturnValue(pending.promise); const execute = vi.spyOn(D, 'executeBuild');
  location.hash = '#/review/A/results'; const view = render(Live); await fireEvent.click(await view.findByRole('button', { name: 'Build the report' })); await waitFor(() => expect(preview).toHaveBeenCalled());
  me.mockResolvedValue(person('replacement')); vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, result: person('replacement') })))); await fireEvent(window, new Event('focus')); await view.findByRole('button', { name: 'Build the report' });
  pending.resolve({ token: 'old-actor-token', expires: Date.now() + 60000 }); await flush(); expect(view.container.querySelector('[data-confirm-report]')).toBeNull(); expect(execute).not.toHaveBeenCalled();
});
it('a cookie-only account change is verified before executing an armed report preview', async () => {
  session(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid)); vi.spyOn(D, 'previewBuild').mockResolvedValue({ token: 'owner-token', expires: Date.now() + 60000 }); const execute = vi.spyOn(D, 'executeBuild');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, result: person('different-cookie-owner') }))));
  location.hash = '#/review/A/results'; const view = render(Live); await fireEvent.click(await view.findByRole('button', { name: 'Build the report' })); await waitFor(() => expect(view.container.querySelector('[data-confirm-report]')).not.toBeNull());
  await fireEvent.click(view.container.querySelector('[data-confirm-report]')!); await flush(); expect(execute).not.toHaveBeenCalled(); expect(view.container.querySelector('[data-confirm-report]')).toBeNull();
});
it('navigation while the confirmation identity read is pending never executes the old review build', async () => {
  session(); vi.spyOn(D, 'resultsModel').mockImplementation(async aid => model(aid)); vi.spyOn(D, 'previewBuild').mockResolvedValue({ token: 'token-A', expires: Date.now() + 60000 }); const execute = vi.spyOn(D, 'executeBuild'); const identity = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn(() => identity.promise)); location.hash = '#/review/A/results'; const view = render(Live);
  await fireEvent.click(await view.findByRole('button', { name: 'Build the report' })); await waitFor(() => expect(view.container.querySelector('[data-confirm-report]')).not.toBeNull()); await fireEvent.click(view.container.querySelector('[data-confirm-report]')!);
  await go('#/review/B/results'); await view.findByText(/No report has been built for Review B/); identity.resolve(new Response(JSON.stringify({ ok: true, result: person() }))); await flush(); expect(execute).not.toHaveBeenCalled();
});
it('an old setup read cannot repopulate drafts after identity invalidation clears the cache', async () => {
  const languages = deferred<Response>(); let languageCalls = 0, serverName = 'Old server name';
  const response = (result: any) => new Response(JSON.stringify({ ok: true, result }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/v2/projects') return response({ projects: [{ id: 'p', name: 'Project', role: 'owner' }] });
    if (url === '/v2/templates') return response({ templates: [] });
    if (url === '/v2/projects/p/languages') { if (++languageCalls === 1) return languages.promise; return response({ languages: [] }); }
    if (url.endsWith('/passages')) return response({ passages: [], fileStorage: true });
    if (url === '/v2/assessments/A') return response({ assessment: { id: 'A', project_id: 'p', language_id: 'l', role: 'owner', stage: 'prepare', name: serverName }, surveys: [] });
    throw new Error('Unexpected synthetic endpoint ' + url);
  }));
  const old = SU.openSetup('A'); await waitFor(() => expect(languageCalls).toBe(1));
  SU.forgetAll(); serverName = 'New actor server name'; languages.resolve(response({ languages: [] }));
  const stale = await old; stale.draft.name = 'Old actor private unsaved draft';
  const current = await SU.openSetup('A'); expect(current.draft.name).toBe('New actor server name'); expect(current).not.toBe(stale);
});
