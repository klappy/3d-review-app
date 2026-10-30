<script>
  import Stack from '../Stack.svelte';
  import Row from '../Row.svelte';
  import { previewInvitations, confirmInvitations, readPrivateInvitation, forgetPrivateInvitation, privateInvitationFallback } from './invitation-actions.js';
  let { invitations = [], privateInvitation = false, onsettled } = $props();
  let previews = $state(null), busy = $state(false), locked = $state(false), status = $state(''), progress = $state(''), reveal = $state(false);
  let privateToken = $state(privateInvitation ? readPrivateInvitation() : null);
  async function prepare(rows) {
    if (busy || locked) return;
    busy = true; status = '';
    try { previews = await previewInvitations(rows, { token: privateInvitation ? privateToken : null }); }
    catch (e) {
      status = 'The invitation preview is unavailable. Check your account and refresh Invitations.';
      if (privateInvitation && (['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED', 'NOT_AUTHORIZED_AT_SCOPE'].includes(e?.code) || /invitation_(used|expired)/.test(e?.message ?? ''))) { forgetPrivateInvitation(); privateToken = null; reveal = false; }
    }
    finally { busy = false; }
  }
  function cancel() { previews = null; reveal = false; if (privateInvitation) { forgetPrivateInvitation(); privateToken = null; } status = 'Cancelled. No invitation was accepted.'; }
  async function confirm() {
    if (busy || locked || !previews) return;
    busy = true; locked = true; const selected = previews; previews = null; reveal = false;
    const out = await confirmInvitations(selected, { onprogress: (done, total) => { progress = `Accepting ${done + 1} of ${total}…`; } });
    status = out.message; progress = ''; busy = false;
    if (privateInvitation && !out.failed) { forgetPrivateInvitation(); privateToken = null; }
    if (!out.failed) await onsettled?.();
  }
</script>
<Stack gap={3}>
  <h1 class="h1">{privateInvitation ? 'Private invitation' : 'Your invitations'}</h1>
  {#if privateInvitation}
    {#if privateToken}
      <p class="small">Preview what was shared before accepting. Sign in with the email address that was invited.</p>
      <Row gap={2}><button class="btn" type="button" onclick={() => { reveal = !reveal; }}>{reveal ? 'Hide invitation token' : 'Reveal invitation token'}</button><button class="btn" type="button" onclick={() => privateInvitationFallback()}>Open in the current design</button></Row>
      {#if reveal}<input class="in" readonly value={privateToken} aria-label="Private invitation token" autocomplete="off" />{/if}
      {#if !previews}<Row gap={2}><button class="btn btn-primary" type="button" onclick={() => prepare([])} disabled={busy || locked}>Preview invitation</button><button class="btn" type="button" onclick={cancel} disabled={busy}>Cancel invitation</button></Row>{/if}
    {:else}<p class="small">No private invitation is waiting. Reopen the original invitation link or return to your pending invitations.</p>{/if}
  {:else}
    {#if !invitations.length}<p class="small">No invitations are waiting.</p>{/if}
    {#each invitations as invitation}
      <div class="solid l-card l-stack" data-pad="form" data-gap="2">
        <b>{invitation.scope?.name || 'Shared work'}</b><p class="small">{invitation.scope?.type} · {invitation.role}{invitation.scope?.path?.length ? ` · ${invitation.scope.path.join(' › ')}` : ''}</p>
        <button class="btn" type="button" onclick={() => prepare([invitation])} disabled={busy || locked || !!previews}>Preview invitation</button>
      </div>
    {/each}
    {#if invitations.length > 1}<button class="btn btn-primary" type="button" onclick={() => prepare(invitations)} disabled={busy || locked || !!previews}>Preview accepting all invitations</button>{/if}
  {/if}
  {#if previews}
    <section class="glass l-card" data-pad="form" aria-label="Invitation acceptance preview">
      <Stack gap={2}>
        <h2 class="h3">Confirm invitation acceptance</h2>
        {#each previews as preview}<p class="small">Join {preview.name || `this ${preview.scope.type}`} as {preview.role}.</p>{/each}
        <Row gap={2}><button class="btn btn-primary" type="button" onclick={confirm} disabled={busy}>Confirm acceptance</button><button class="btn" type="button" onclick={cancel} disabled={busy}>Cancel</button></Row>
      </Stack>
    </section>
  {/if}
  {#if progress}<p class="small" role="status" aria-live="polite">{progress}</p>{/if}
  {#if status}<p class="small" role="status">{status}</p>{/if}
  {#if locked}<button class="btn" type="button" onclick={() => onsettled ? onsettled() : globalThis.location?.reload()}>Refresh invitations before another action</button>{/if}
</Stack>
