// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canTransferOwnership, transferCandidates, previewOwnershipTransfer, executeOwnershipTransfer } from '../ui-next/src/app/ownership-transfer.js';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Transfer from '../ui-next/src/app/OwnershipTransfer.svelte';
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const scope = { type: 'assessment', id: 'review/1' };
const me = { principal: { id: 'owner', kind: 'user' }, grants: [{ scope_type: 'assessment', scope_id: 'review/1', role: 'owner' }] };
describe('Next ownership transfer', () => {
  it('requires a direct owner and excludes support and self', () => {
    expect(canTransferOwnership(me, scope)).toBe(true);
    expect(canTransferOwnership({ ...me, grants: [{ scope_type: 'workspace', scope_id: 'w1', role: 'owner' }] }, scope)).toBe(false);
    expect(canTransferOwnership({ ...me, principal: { ...me.principal, kind: 'support' } }, scope)).toBe(false);
    expect(transferCandidates([{ principal_id: 'owner', role: 'owner' }, { principal_id: 'member', role: 'member' }], me)).toEqual([{ principal_id: 'member', role: 'member' }]);
  });
  it('previews without executing, then confirms exact token and verifies persisted grants', async () => {
    const request = vi.fn().mockResolvedValueOnce({ confirm_token: 'preview-token', impact: { revoked_invitations: 2 } }).mockResolvedValueOnce({ transferred: true }).mockResolvedValueOnce({ grants: [{ principal_id: 'member', role: 'owner' }, { principal_id: 'owner', role: 'member' }] });
    const p = await previewOwnershipTransfer(scope, me, 'member', true, request);
    expect(request).toHaveBeenCalledTimes(1); // Cancel means discard p, no execute.
    expect(request.mock.calls[0]).toEqual(['/v2/assessment/review%2F1/transfer', { method: 'POST', body: { to: 'member', step_down: true, mode: 'dry_run' } }]);
    await executeOwnershipTransfer(p, request);
    expect(request.mock.calls[1][1].body).toEqual({ to: 'member', step_down: true, mode: 'execute', confirm_token: 'preview-token' });
    expect(request.mock.calls[2][0]).toBe('/v2/assessment/review%2F1/grants');
  });
  it('does not retry uncertain execution and rejects unmatched readback', async () => {
    const request = vi.fn().mockRejectedValue(new Error('API unavailable. For a write, its outcome is unknown.'));
    const p = { scope, params: { to: 'member', step_down: false }, token: 'token', caller: 'owner' };
    await expect(executeOwnershipTransfer(p, request)).rejects.toThrow('unknown');
    expect(request).toHaveBeenCalledTimes(1);
    const mismatch = vi.fn().mockResolvedValueOnce({ transferred: true }).mockResolvedValueOnce({ grants: [{ principal_id: 'member', role: 'member' }] });
    await expect(executeOwnershipTransfer(p, mismatch)).rejects.toThrow('readback');
  });
});

for (const cancelled of [true, false]) it(`ownership confirmation cancellation=${cancelled}`, async () => {
  const calls: any[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : null; calls.push({url,body});
    const result = body?.mode === 'dry_run' ? { confirm_token: 'token', impact: { revoked_invitations: 2 } } : body?.mode === 'execute' ? { transferred: true } : { grants: [{ principal_id: 'member', role: 'owner' }, { principal_id: 'owner', role: 'owner' }] };
    return new Response(JSON.stringify({ok:true,result}));
  }) as typeof fetch;
  const view=render(Transfer,{scope,me,grants:[{principal_id:'member',role:'member',name:'Member 1'}]});
  view.container.querySelector('details')!.open = true;
  await fireEvent.change(view.getByLabelText('New owner'),{target:{value:'member'}});
  await fireEvent.click(view.getByRole('button',{name:'Preview transfer'}));
  await waitFor(()=>view.getByRole('button',{name:'Confirm transfer'}));
  expect(calls).toHaveLength(1);
  if(cancelled) {
    await fireEvent.click(view.getByRole('button',{name:'Cancel'}));
    expect(calls).toHaveLength(1);
    expect(view.getByRole('status').textContent).toContain('unchanged');
  } else {
    await fireEvent.click(view.getByRole('button',{name:'Confirm transfer'}));
    await waitFor(()=>expect(view.getByRole('status').textContent).toContain('verified'));
    expect(calls).toHaveLength(3);
    expect(view.getByRole('button',{name:'Preview transfer'}).hasAttribute('disabled')).toBe(true);
  }
});
