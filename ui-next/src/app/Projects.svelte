<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import Row from '../Row.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { to } from './router.js';
  import { api, enc } from './api.js';
  let { phone = false, theme = 'light', projects = [] } = $props();
  let search = $state(''), view = $state('Active'), creating = $state(false), name = $state(''), organization = $state(''), busy = $state(false), error = $state(''), uncertain = $state(false);
  const shown = $derived(projects.filter(p => (view === 'All' || (view === 'Archived' ? !!p.archived_at : !p.archived_at)) && `${p.name} ${p.organization ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())));
  async function create(event) {
    event.preventDefault(); if (busy || uncertain || !name.trim()) return;
    busy = true; error = '';
    try {
      const result = await api('/v2/projects', { method: 'POST', body: { name: name.trim(), ...(organization.trim() ? { organization: organization.trim() } : {}) } });
      if (!result.project?.id) throw new Error('Project creation could not be confirmed.');
      const read = await api(`/v2/projects/${enc(result.project.id)}`);
      if (read.project?.name !== name.trim()) throw new Error('The new project could not be verified.');
      location.hash = to('project', { pid: read.project.id });
    } catch (e) { error = `${e.message || 'Project creation failed.'} Reload the project list before trying again.`; uncertain = true; }
    finally { busy = false; }
  }
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Projects" parent="Home" back={to('home')} menuHref={to('menu')} />{:else}<TopBar home={to('home')} crumbs={[{ label: 'Projects' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page gap={4}>
    <Row split><h1 class="title-page">Projects</h1><button class="btn btn-primary" type="button" onclick={() => { creating = !creating; }}>New project</button></Row>
    <p class="small">All projects available in your current access mode, including projects with no reviews.</p>
    <Row wrap gap={3}><label class="lbl">Search projects<input class="in" type="search" bind:value={search} /></label><label class="lbl">Show projects<select class="in" bind:value={view}><option>Active</option><option>All</option><option>Archived</option></select></label></Row>
    {#if creating}<Card gap={3} label="New project"><form class="l-stack" data-gap="3" onsubmit={create}><label class="lbl">Project name<input class="in" bind:value={name} required disabled={busy} /></label><label class="lbl">Lead organisation<input class="in" bind:value={organization} disabled={busy} /></label><Row gap={2}><button class="btn" type="submit" disabled={busy || uncertain || !name.trim()}>Create project</button><button class="btn" type="button" disabled={busy} onclick={() => { creating = false; }}>Cancel</button></Row>{#if error}<p role="alert">{error}</p><a class="link" href={to('projects')}>Reload projects</a>{/if}</form></Card>{/if}
    {#each shown as p}<Card gap={2} label={p.name}><a class="link h3" href={to('project', { pid: p.id })}>{p.name}</a><p class="small">{p.organization ?? ''} · {p.role} · {p.assessment_count ?? 0} reviews{p.archived_at ? ' · Archived' : ''}</p><a class="link" href={to('setup1', {}, { project: p.id })}>Start a review in this project</a></Card>{/each}
    {#if !shown.length}<p class="small">No projects match this view.</p>{/if}
  </Page>
</AppShell>
