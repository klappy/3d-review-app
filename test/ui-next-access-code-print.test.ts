// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import AccessCodes from '../ui-next/src/screens/actions/AccessCodes.svelte';
import { createAccessCodesState } from '../ui-next/src/app/access-codes.svelte.js';
import { accessCodePrintDocument } from '../ui-next/src/app/access-code-print.js';
import { setLiveContext } from '../ui-next/src/screens/href.js';
const codes = Array.from({ length: 20 }, (_, i) => ({ id: `synthetic_${i}`, code: `SYNTHETIC${String(i).padStart(3,'0')}` }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); setLiveContext(null); });
function fixture() {
  let actor = 'owner';
  const request = vi.fn(async (url, options) => {
    if (url.startsWith('/v2/undo/')) return { result: { undone: 'cap.survey.issue_codes' } };
    if (url === '/v2/me') return { result: { principal: { id: actor } } };
    if (url === '/v2/assessments/a') return { result: { assessment: { role: 'owner' }, surveys: [{ id: 's', state: 'selected', template_name: 'Current survey' }] } };
    if (url.endsWith('/export')) return options.body.mode === 'dry_run' ? { result: { confirm_token: 'local-confirm' } } : { result: { codes } };
    return { result: { ids: codes.map(x => x.id) }, receipt: { undo_token: 'local-undo' } };
  });
  return { request, switchActor: () => { actor = 'other-owner'; } };
}
it('prints all20 already-revealed values with survey and explicit return, without issuing or exporting again', async () => {
  const f = fixture(), flow = createAccessCodesState({ aid: 'a', requestFactory: () => f.request });
  const dispose = flow.mount(); const view = render(AccessCodes, { controller: flow });
  await view.findByRole('button', { name: 'Make access codes' });
  await fireEvent.click(view.getByRole('button', { name: 'Make access codes' }));
  await fireEvent.click(view.getByRole('button', { name: 'Issue and show codes' }));
  await view.findByRole('button', { name: 'Print this batch' });
  const before = f.request.mock.calls.filter(([url]) => url.includes('/codes')).length;
  const tab = { opener: {}, document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), body: { textContent: '' } }, close: vi.fn() };
  vi.spyOn(globalThis, 'open').mockReturnValue(tab as any);
  await fireEvent.click(view.getByRole('button', { name: 'Print this batch' }));
  await waitFor(() => expect(tab.document.write).toHaveBeenCalledTimes(1));
  const html = tab.document.write.mock.calls[0][0];
  expect((html.match(/<li data-code>/g) || [])).toHaveLength(20);
  for (const code of codes) expect(html).toContain(`<li data-code>${code.code}</li>`);
  expect(html).toContain('Current survey'); expect(html).toContain('/next/#/review/a/share');
  expect(f.request.mock.calls.filter(([url]) => url.includes('/codes'))).toHaveLength(before);
  flow.done(); expect(tab.close).toHaveBeenCalled(); expect(tab.document.body.textContent).not.toContain('SYNTHETIC');
  dispose();
});
it('scrubs and closes retained print windows after successful undo', async () => {
  const f = fixture(), flow = createAccessCodesState({ aid: 'a', requestFactory: () => f.request }); const dispose = flow.mount();
  await waitFor(() => expect(flow.state.stage).toBe('idle')); flow.prepare(); await flow.issue();
  const tab = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), body: { textContent: 'SYNTHETIC000' } }, close: vi.fn() };
  await flow.print({ open: () => tab }); expect(tab.document.write).toHaveBeenCalledOnce();
  await flow.undo(); expect(flow.state.stage).toBe('idle'); expect(flow.state.batch).toBeNull();
  expect(tab.close).toHaveBeenCalledOnce(); expect(tab.document.body.textContent).not.toContain('SYNTHETIC');
  dispose();
});
it('suppresses print disclosure after a cookie-only actor switch', async () => {
  const f = fixture(), flow = createAccessCodesState({ aid: 'a', requestFactory: () => f.request }); const dispose = flow.mount();
  await waitFor(() => expect(flow.state.stage).toBe('idle')); flow.prepare(); await flow.issue(); expect(flow.state.stage).toBe('shown');
  f.switchActor();
  const tab = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), body: { textContent: '' } }, close: vi.fn() };
  await flow.print({ open: () => tab }); expect(tab.document.write).not.toHaveBeenCalled(); expect(tab.close).toHaveBeenCalled(); expect(flow.state.codes).toEqual([]);
  dispose();
});
it('escapes labels and code values and includes no browser history dependency', () => {
  const html = accessCodePrintDocument({ aid: 'review/a', survey: '<script>unsafe</script>', codes: [{ code: '<private>' }] });
  expect(html).not.toContain('<script>'); expect(html).toContain('&lt;private&gt;'); expect(html).toContain('review%2Fa/share'); expect(html).not.toContain('history.back');
});
