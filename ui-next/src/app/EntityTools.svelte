<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import Row from '../Row.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { to } from './router.js';
  import { adjacentStages, moveEntityStage, archiveEntity, previewEntityDelete, deleteEntity } from './entity-actions.js';
  let { phone = false, theme = 'light', type, entity } = $props();
  let current = $state(entity), busy = $state(false), preview = $state(null), status = $state(''), uncertain = $state(false), deleted = $state(false), needsReload = $state(false);
  const review = $derived(type === 'assessment');
  const back = $derived(deleted ? to('home') : review ? to('review', { aid: current.id }) : to('project', { pid: current.id }));
  const owner = $derived(review ? current.direct_role === 'owner' : current.role === 'owner');
  const editable = $derived(review ? current.can_archive === true : current.role === 'owner');
  function failed(error) {
    if (error?.outcome === 'refused') {
      status = `Request refused: ${error.message} Nothing was changed by this request. Reload current state if your access or the review changed.`;
      uncertain = false; needsReload = true;
    } else if (error?.outcome === 'not-started') {
      status = error.message; uncertain = false;
    } else {
      status = `${error?.message || 'The operation could not be confirmed.'} Its outcome is unknown. Reload before taking another action.`;
      uncertain = true; needsReload = true;
    }
  }
  async function run(action) {
    if (busy || uncertain || deleted) return;
    busy = true; status = ''; needsReload = false;
    try { await action(); } catch(e) { failed(e); }
    finally { busy = false; }
  }
  async function move(stage) {
    current = await moveEntityStage(current, stage); status = 'Stage changed and verified.';
  }
  async function remove() {
    if (busy || uncertain || deleted || !preview) return;
    const captured = preview; preview = null; busy = true; status = ''; needsReload = false;
    try { await deleteEntity(type, current, captured); deleted = true; }
    catch(e) { failed(e); }
    finally { busy = false; }
  }
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Manage" parent={current.name} {back} menuHref={to('menu', {}, review ? { review: current.id } : { project: current.id })} />{:else}<TopBar home={to('home')} crumbs={[{ label: current.name, href: back }, { label: 'Manage' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}><Page gap={4}>
  {#if deleted}
  <h1 class="title-page">{review ? 'Review' : 'Project'} deleted</h1>
  <p>{current.name} was deleted.</p>
  <a class="btn btn--solid" href={to('home')}>Home</a>
  {#if !review}<a class="link" href={to('projects')}>Projects</a>{/if}
  {:else}
  <h1 class="title-page">Manage {current.name}</h1>
  <a class="link" href={back}>Back to {review ? 'review' : 'project'}</a>
  {#if editable}<Card gap={3} label="Archive"><p class="small">Archiving keeps the saved content. You can find it again under Archived.</p><button class="btn" type="button" disabled={busy || uncertain} onclick={() => run(async () => { current = await archiveEntity(type, current, !current.archived_at); status = 'Archive state saved and verified.'; })}>{current.archived_at ? 'Unarchive' : 'Archive'} {review ? 'review' : 'project'}</button></Card>{/if}
  {#if review && !editable}<p class="small">Archiving requires a direct review member or owner grant and member or owner access to its project.</p>{/if}
  {#if review && !current.complete && ['owner','member'].includes(current.role)}<Card gap={3} label="Review stage"><p class="small">Current stage: {current.stage}. Move one stage at a time. The server protects surveys and responses when changing stages.</p><Row wrap gap={2}>{#each adjacentStages(current.stage) as stage}<button class="btn" type="button" disabled={busy || uncertain} onclick={() => run(() => move(stage))}>Move to {stage}</button>{/each}</Row></Card>{/if}
  {#if owner}<Card gap={3} label="Delete"><p class="small">Preview the exact impact first. Only empty items can be deleted; the server protects saved responses.</p>{#if !preview}<button class="btn" type="button" disabled={busy || uncertain} onclick={() => run(async () => { preview = await previewEntityDelete(type, current); })}>Preview deletion</button>{:else}<div role="group" aria-label="Confirm deletion"><p>Delete {current.name}? This cannot be undone from here.</p><ul>{#each (preview.impact?.affected ?? []).flatMap(row => Object.entries(row).filter(([key, value]) => typeof value === "number").map(([key, value]) => `${value} ${key}`)) as item}<li>{item}</li>{/each}</ul><Row gap={2}><button class="btn" type="button" disabled={busy} onclick={remove}>Confirm deletion</button><button class="btn" type="button" disabled={busy} onclick={() => { preview = null; status = 'Cancelled. Nothing was deleted.'; }}>Cancel</button></Row></div>{/if}</Card>{/if}
  {#if !editable && !owner}<p class="small">Archiving and deletion are unavailable with your current access.</p>{/if}
  {#if status}<p class="small" role="status">{status}</p>{/if}
  {#if needsReload}<button class="btn" type="button" onclick={() => location.reload()}>Reload current state</button>{/if}
  {/if}
</Page></AppShell>
