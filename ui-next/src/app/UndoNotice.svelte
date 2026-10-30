<script>
  let { undo = null, onundo, label = 'Review details saved and verified.' } = $props();
  let busy = $state(false), attempted = $state(false), message = $state('');
  $effect(() => { void undo; attempted = false; message = ''; });
  async function reverse() {
    if (!undo || !onundo || busy || attempted) return;
    const receipt = undo;
    attempted = true; busy = true; message = '';
    try { await onundo(); message = 'Review details restored and verified.'; }
    catch (e) { message = `${e.message || 'The undo could not be confirmed.'} Reload the review before another change.`; }
    finally { busy = false; }
  }
</script>
{#if undo && onundo}
  <section class="glass l-card l-stack" data-gap="2" aria-label="Saved review details">
    <p class="small" role="status">{message || label}</p>
    <button class="btn" type="button" onclick={reverse} disabled={busy || attempted}>{busy ? 'Restoring…' : 'Undo saved details'}</button>
  </section>
{:else if message}<p class="small" role="status">{message}</p>{/if}
