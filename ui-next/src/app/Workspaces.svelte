<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { to } from './router.js';
  import { api } from './api.js';
  import { createWorkspace, setWorkspaceArchived, previewWorkspaceDeletion, executeWorkspaceDeletion } from './workspace-actions.js';
  let { phone = false, theme = 'light', workspaces = [], canCreate = false, request = api, onchanged } = $props();
  let current = $state([]);
  $effect(() => { current = workspaces; });
  let search = $state(''), view = $state('Active'), name = $state('');
  let busy = $state(false), mustReload = $state(false), message = $state(''), error = $state(''), pending = $state(null);
  const shown = $derived(current.filter(w => (view === 'All' || (view === 'Archived' ? !!w.archived_at : !w.archived_at)) && w.name.toLowerCase().includes(search.trim().toLowerCase())));
  async function run(action) {
    if (busy || mustReload) return;
    busy = true; error = ''; message = '';
    try { await action(); }
    catch (e) { pending = null; error = `${e.message || 'The request could not be confirmed.'} Reload workspaces before another change.`; mustReload = true; }
    finally { busy = false; }
  }
  async function refresh() {
    if (busy) return;
    busy = true; pending = null; error = ''; message = '';
    try { const next = await request('/v2/workspaces'); if (!Array.isArray(next.workspaces)) throw new Error('The workspace list could not be read.'); current = next.workspaces; mustReload = false; message = 'Workspaces reloaded.'; }
    catch(e) { error = e.message || 'The workspace list could not be loaded.'; mustReload = true; }
    finally { busy = false; }
  }
  const replaceWorkspace = saved => { current = current.map(w => w.id === saved.id ? { ...w, ...saved } : w); };
  const create = event => { event.preventDefault(); if (!canCreate) return; run(async () => { const saved = await createWorkspace(name,request); current = [...current,saved]; name = ''; message = 'Workspace created and verified.'; await onchanged?.(); }); };
  const archive = w => run(async () => { replaceWorkspace(await setWorkspaceArchived(w,!w.archived_at,request)); message = 'Workspace state saved and verified.'; await onchanged?.(); });
  const previewDelete = w => run(async () => { pending = await previewWorkspaceDeletion(w,request); });
  const confirmDelete = () => run(async () => { const preview = pending; pending = null; current = await executeWorkspaceDeletion(preview,request); message = 'Workspace deleted and verified.'; await onchanged?.(); });
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Workspaces" parent="Home" back={to('home')} menuHref={to('menu')} />{:else}<TopBar home={to('home')} crumbs={[{ label: 'Workspaces' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}><Page gap={4}>
  <h1 class="title-page">Workspaces</h1>
  {#if canCreate}<form class="glass l-card l-stack" data-gap="2" onsubmit={create}><label class="lbl">New workspace name<input class="in" required bind:value={name} disabled={busy || mustReload || !!pending} /></label><button class="btn" type="submit" disabled={busy || mustReload || !!pending}>Create workspace</button></form>{/if}
  <label class="lbl">Search workspaces<input class="in" type="search" bind:value={search} /></label>
  <label class="lbl">Show workspaces<select class="in" bind:value={view}><option>Active</option><option>All</option><option>Archived</option></select></label>
  <button class="btn" type="button" onclick={refresh} disabled={busy}>Reload workspaces</button>
  {#if error}<p class="small" role="alert">{error}</p>{/if}<p class="small" role="status">{busy ? 'Working…' : message}</p>
  {#each shown as w}<Card gap={2} label={w.name}><a class="link h3" href={to('workspace', { wid: w.id })}>{w.name}</a><p class="small">{w.role} · {w.project_count ?? 0} projects{w.archived_at ? ' · Archived' : ''}</p>
    {#if w.role === 'owner'}<div class="l-row" data-gap="2" data-wrap><button class="btn" type="button" aria-label={`${w.archived_at ? 'Restore' : 'Archive'} ${w.name}`} disabled={busy || mustReload || !!pending} onclick={() => archive(w)}>{w.archived_at ? 'Restore' : 'Archive'}{phone ? '' : ` ${w.name}`}</button><button class="btn btn-quiet" type="button" aria-label={`Preview deletion of ${w.name}`} disabled={busy || mustReload || !!pending} onclick={() => previewDelete(w)}>Preview deletion{phone ? '' : ` of ${w.name}`}</button></div>{/if}
  </Card>{/each}
  {#if pending}<section class="glass-hi l-card l-stack" data-gap="2" aria-label="Confirm workspace deletion"><h2 class="h3">Delete {pending.workspace.name}?</h2><p class="small">Deletion cannot be undone. Only an empty workspace can be deleted. Workspace invitations and grants are removed.</p>
    {#each pending.impact.affected as row}{#each ['projects','assessments','responses','grants'] as key}<p class="small">{key}: {row[key]}</p>{/each}{/each}
    {#if pending.impact.affected[0].projects > 0}<p class="small">Remove the grouped projects before deleting this workspace. The projects keep their own grants.</p>{/if}
    <div class="l-row" data-gap="2" data-wrap><button class="btn" type="button" disabled={busy || mustReload || pending.impact.affected[0].projects > 0} onclick={confirmDelete}>Confirm deletion</button><button class="btn btn-quiet" type="button" disabled={busy} onclick={() => { pending = null; }}>Cancel deletion</button></div>
  </section>{/if}
  {#if !shown.length}<p class="small">No workspaces match this view.</p>{/if}
  <a class="link" href={to('projects')}>Projects across workspaces</a>
</Page></AppShell>
