// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as D from '../ui-next/src/app/data.js';
import * as S from '../ui-next/src/app/session.js';
import { setToken } from '../ui-next/src/app/api.js';
import { REPORT } from '../ui-next/src/screens/results/data.js';
const original = globalThis.fetch;
afterEach(() => { cleanup(); vi.restoreAllMocks(); globalThis.fetch = original; setToken(null); S.forget(); });
it.each(['review', 'credential', 'cookie-authorized', 'cookie-unauthorized'])('pending A completion cannot continue after %s context changes', async kind => {
  const f = REPORT.desktop;
  vi.spyOn(S, 'me').mockResolvedValue({ principal: { id: 'owner', display_name: 'Owner' } });
  vi.spyOn(D, 'resultsModel').mockImplementation(async aid => ({ aid, review: { ...f.review, id: aid, title: `Review ${aid}` }, counts: f.counts, payload: f.payload, serverStage: 'understand', canEditNotes: true, canBuild: true, notes: { notes_reflection: '', notes_next_steps: '' } }));
  let activeActor = 'owner';
  const writes: any[] = []; let reads = 0; let release!: (r: Response) => void;
  let stored = { id: 'A', stage: 'understand', notes_reflection: '', notes_next_steps: '' };
  const response = () => new Response(JSON.stringify({ ok: true, result: { assessment: { ...stored } } }));
  globalThis.fetch = vi.fn(async (url, init: any) => {
    if (url === "/v2/me") return new Response(JSON.stringify({ ok: true, result: { principal: { id: activeActor } } }));
    if (init?.method === 'PATCH' || init?.method === 'POST') { writes.push({ url, body: JSON.parse(init.body) }); stored = { ...stored, ...JSON.parse(init.body) }; return response(); }
    if (String(url) === '/v2/assessments/A' && ++reads === 2) return new Promise<Response>(resolve => { release = resolve; });
    return response();
  }) as any;
  location.hash = '#/review/A/next-step';
  const v = render(Live);
  await waitFor(() => v.getByText('Save and complete the review'));
  await fireEvent.click(v.getByLabelText('I checked the meaning, the missing evidence and any sensitive details'));
  await fireEvent.click(v.getByText('Save and complete the review'));
  await waitFor(() => expect(reads).toBe(2));
  if (kind === 'review') {
    location.hash = '#/review/B/next-step'; dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(v.container.textContent).toContain('Review B'));
  } else if (kind === 'credential') setToken('different-synthetic-session');
  else activeActor = kind === 'cookie-authorized' ? 'other-owner' : 'outsider';
  release(response());
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(writes).toHaveLength(1);
  expect(writes[0].url).toBe('/v2/assessments/A/notes');
  expect(writes.some(w => w.url.endsWith('/stage') || w.url.includes('/B/'))).toBe(false);
});
