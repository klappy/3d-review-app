<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import Row from '../Row.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { api } from './api.js';
  import { to } from './router.js';
  import { archiveEntity, previewEntityDelete, deleteEntity } from './entity-actions.js';
  let { phone = false, theme = 'light', type, entity } = $props();
  let current = $state(entity), busy = $state(false), preview = $state(null), status = $state(''), uncertain = $state(false);
  const review = $derived(type === 'assessment');
  const back = $derived(review ? to('review', { aid: current.id }) : to('project', { pid: current.id }));
  const owner = $derived(review ? current.direct_role === 'owner' : current.role === 'owner');
  const editable = $derived(review ? ['owner','member'].includes(current.direct_role) : current.role === 'owner');
  async function run(action) {
    if (busy || uncertain) return;
    busy = true; status = '';
    try { await action(); } catch(e) { status = `${e.message || 'The operation could not be confirmed.'} Reload before taking another action.`; uncertain = true; }
    finally { busy = false; }
  }
  async function move(stage) {
    await api(`/v2/assessments/${encodeURIComponent(current.id)}/stage`, { method: 'POST', body: { stage } });
    const r = await api(`/v2/assessments/${encodeURIComponent(current.id)}`);
    if (r.assessment?.stage !== stage) throw new Error('Stage could not be verified.');
    current = r.assessment; status = 'Stage changed and verified.';
  }
  async function remove() {
    const captured = preview; preview = null; uncertain = true; busy = true;
    try { await deleteEntity(type, current, captured); location.hash = review ? to('project', { pid: current.project_id }) : to('projects'); }
    catch(e) { status = `${e.message || 'Deletion outcome is unknown.'} Reload the list to check what happened.`; }
    finally { busy = false; }
  }
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Manage" parent={current.name} {back} menuHref={to('menu')} />{:else}<TopBar home={to('home')} crumbs={[{ label: current.name, href: back }, { label: 'Manage' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}><Page gap={4}>
  <h1 class="title-page">Manage {current.name}</h1>
  <a class="link" href={back}>Back to {review ? 'review' : 'project'}</a>
  {#if editable}<Card gap={3} label="Archive"><p class="small">Archiving keeps the saved content. You can find it again under Archived.</p><button class="btn" type="button" disabled={busy || uncertain} onclick={() => run(async () => { current = await archiveEntity(type, current, !current.archived_at); status = 'Archive state saved and verified.'; })}>{current.archived_at ? 'Unarchive' : 'Archive'} {review ? 'review' : 'project'}</button></Card>{/if}
  {#if review && !current.complete && ['owner','member'].includes(current.role)}<Card gap={3} label="Review stage"><p class="small">Current stage: {current.stage}. The server protects surveys and responses when changing stages.</p><Row wrap gap={2}>{#each ['prepare','collect','understand','improve'] as stage}<button class="btn" type="button" disabled={busy || uncertain || current.stage === stage} onclick={() => run(() => move(stage))}>Move to {stage}</button>{/each}</Row></Card>{/if}
  {#if owner}<Card gap={3} label="Delete"><p class="small">Preview the exact impact first. Only empty items can be deleted; the server protects saved responses.</p>{#if !preview}<button class="btn" type="button" disabled={busy || uncertain} onclick={() => run(async () => { preview = await previewEntityDelete(type, current); })}>Preview deletion</button>{:else}<div role="group" aria-label="Confirm deletion"><p>Delete {current.name}? This cannot be undone from here.</p><ul>{#each (preview.impact?.affected ?? []).flatMap(row => Object.entries(row).filter(([key, value]) => typeof value === "number").map(([key, value]) => `${value} ${key}`)) as item}<li>{item}</li>{/each}</ul><Row gap={2}><button class="btn" type="button" disabled={busy} onclick={remove}>Confirm deletion</button><button class="btn" type="button" disabled={busy} onclick={() => { preview = null; status = 'Cancelled. Nothing was deleted.'; }}>Cancel</button></Row></div>{/if}</Card>{/if}
  {#if !editable && !owner}<p class="small">Your current access does not allow these changes.</p>{/if}
  {#if status}<p class="small" role="status">{status}</p>{/if}
  {#if uncertain}<button class="btn" type="button" onclick={() => location.reload()}>Reload current state</button>{/if}
</Page></AppShell>
