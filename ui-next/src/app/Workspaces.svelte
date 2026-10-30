<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { to } from './router.js';
  let { phone = false, theme = 'light', workspaces = [] } = $props();
  let search = $state(''), view = $state('Active');
  const shown = $derived(workspaces.filter(w => (view === 'All' || (view === 'Archived' ? !!w.archived_at : !w.archived_at)) && w.name.toLowerCase().includes(search.trim().toLowerCase())));
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Workspaces" parent="Home" back={to('home')} menuHref={to('menu')} />{:else}<TopBar home={to('home')} crumbs={[{ label: 'Workspaces' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}><Page gap={4}>
  <h1 class="title-page">Workspaces</h1>
  <label class="lbl">Search workspaces<input class="in" type="search" bind:value={search} /></label>
  <label class="lbl">Show workspaces<select class="in" bind:value={view}><option>Active</option><option>All</option><option>Archived</option></select></label>
  {#each shown as w}<Card gap={2} label={w.name}><a class="link h3" href={to('workspace', { wid: w.id })}>{w.name}</a><p class="small">{w.role} · {w.project_count ?? 0} projects{w.archived_at ? ' · Archived' : ''}</p></Card>{/each}
  {#if !shown.length}<p class="small">No workspaces match this view.</p>{/if}
  <a class="link" href={to('projects')}>Projects across workspaces</a>
</Page></AppShell>
