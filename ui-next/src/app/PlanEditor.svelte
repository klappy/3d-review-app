<script>
  import PlanDates from './PlanDates.svelte';
  import { onDestroy } from 'svelte';
  import Stack from '../Stack.svelte';
  import Row from '../Row.svelte';
  let { notes = {}, suggestions = [], completed = false, onsave, oncomplete } = $props();
  let reflection = $state(notes.notes_reflection ?? '');
  let next = $state(notes.notes_next_steps ?? '');
  let busy = $state(false), status = $state(''), failed = $state(false);
  let alive = true;
  onDestroy(() => { alive = false; });
  async function save(complete = false) {
    if (busy || !onsave) return;
    busy = true; failed = false; status = 'Saving…';
    try {
      const saveNotes = onsave, finish = oncomplete;
      await saveNotes({ notes_reflection: reflection, notes_next_steps: next });
      if (!alive) return;
      status = 'Saved and verified';
      if (complete && finish) await finish();
    } catch (e) { failed = true; status = e?.message || 'The save could not be confirmed. Your text is still here.'; }
    finally { busy = false; }
  }
</script>

<Stack gap={3}>
  {#if completed}<p class="small" role="status">This review is complete. Saved notes and the plan are read-only.</p>{:else if !onsave}<p class="small">Notes and the plan are read-only with your current access.</p>{/if}
  {#if onsave && suggestions.length}<details><summary>Choose discussion topics for the plan</summary><Stack gap={2}>{#each suggestions as topic}<label class="row-opt"><input class="cb" type="checkbox" checked={next.split('\n').includes(topic)} disabled={busy} onchange={e => { const lines = next.split('\n').filter(x => x !== topic); next = (e.currentTarget.checked ? [...lines, topic] : lines).filter(Boolean).join('\n'); }} />{topic}</label>{/each}</Stack></details>{/if}
  <div><label class="lbl" for="plan-reflection">What you noticed</label><textarea class="in" id="plan-reflection" bind:value={reflection} disabled={!onsave || busy}></textarea></div>
  <div><label class="lbl" for="plan-next">The next step</label><textarea class="in" id="plan-next" bind:value={next} disabled={!onsave || busy}></textarea><p class="small">Include agreed actions, who will follow up and dates. Everyone with access to this review can read these notes.</p></div>
  <PlanDates text={next} disabled={!onsave || busy} onchange={value => { next = value; }} />
  <Row wrap gap={2}>
    {#if onsave}<button class="btn" type="button" onclick={() => save()} disabled={busy}>{busy ? 'Saving…' : 'Save notes and plan'}</button>{/if}
    {#if oncomplete}<button class="btn" type="button" onclick={() => save(true)} disabled={busy}>Save and complete the review</button>{/if}
  </Row>
  {#if status}<p class="small" role={failed ? 'alert' : 'status'}>{status}</p>{/if}
</Stack>
