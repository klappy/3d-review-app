<script>
  import Stack from '../Stack.svelte';
  import Row from '../Row.svelte';
  import { canTransferOwnership, transferCandidates, previewOwnershipTransfer, executeOwnershipTransfer } from './ownership-transfer.js';
  let { scope, me, grants = [], ontransferred } = $props();
  const allowed = $derived(canTransferOwnership(me, scope));
  const candidates = $derived(transferCandidates(grants, me));
  let target = $state(''), stepDown = $state(false), preview = $state(null), busy = $state(false), status = $state(''), executed = $state(false);
  let lastScope = '';
  $effect(() => { const key = `${scope?.type}/${scope?.id}`; if (key !== lastScope) { lastScope = key; target = ''; preview = null; executed = false; status = ''; } });
  const person = (g, i) => g.name || `Member ${i + 1}`;
  async function prepare() {
    busy = true; status = '';
    const key = `${scope.type}/${scope.id}`;
    try { const next = await previewOwnershipTransfer(scope, me, target, stepDown); if (key === `${scope.type}/${scope.id}`) preview = next; }
    catch(e) { status = e?.message || 'The preview could not be loaded.'; }
    finally { busy = false; }
  }
  function cancel() { preview = null; status = 'Cancelled. Ownership is unchanged.'; }
  async function confirm() {
    if (busy || executed || !preview || preview.scope.type !== scope.type || preview.scope.id !== scope.id) return;
    busy = true; executed = true; const p = preview; preview = null;
    try { await executeOwnershipTransfer(p); status = 'Ownership changed and verified.'; await ontransferred?.(); }
    catch(e) { status = `${e?.message || 'The ownership change could not be confirmed.'} Reopen People to check the current owners before proceeding.`; }
    finally { busy = false; }
  }
</script>

{#if allowed}
  <details class="glass l-card" data-pad="work">
    <summary>Transfer ownership</summary>
    <Stack gap={3}>
      <p class="small">The chosen person becomes an owner of this {scope.type === 'assessment' ? 'review' : scope.type}. Reversing this requires the new owner.</p>
      {#if !candidates.length}<p class="small">Invite another person and wait for them to accept before transferring ownership.</p>{:else}
        {#if !preview}
          <label class="lbl" for="ownership-person">New owner</label>
          <select class="in" id="ownership-person" bind:value={target} disabled={busy || executed}><option value="">Choose a person</option>{#each candidates as g, i}<option value={g.principal_id}>{person(g, i)}</option>{/each}</select>
          <label class="row-opt"><input type="checkbox" bind:checked={stepDown} disabled={busy || executed} />Step down to member after the transfer</label>
          <button class="btn" type="button" onclick={prepare} disabled={!target || busy || executed}>Preview transfer</button>
        {:else}
          <div role="group" aria-label="Confirm ownership transfer">
            <p>Make {person(candidates.find(g => g.principal_id === preview.params.to) || {}, candidates.findIndex(g => g.principal_id === preview.params.to))} an owner of this {scope.type === 'assessment' ? 'review' : scope.type}?</p>
            <p class="small">You will {preview.params.step_down ? 'become a member' : 'remain an owner'}. {Number(preview.impact?.revoked_invitations ?? 0)} invitations will be revoked.</p>
            <Row gap={2}><button class="btn" type="button" onclick={confirm} disabled={busy}>Confirm transfer</button><button class="btn" type="button" onclick={cancel} disabled={busy}>Cancel</button></Row>
          </div>
        {/if}
      {/if}
      {#if status}<p class="small" role="status">{status}</p>{/if}
    </Stack>
  </details>
{/if}
