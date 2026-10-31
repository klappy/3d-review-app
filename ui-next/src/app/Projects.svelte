<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import Row from '../Row.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { to } from './router.js';
  import { api, enc } from './api.js';
  let { phone = false, theme = 'light', projects = [], returnToSetup = false, canCreate = false } = $props();
  let search = $state(''), view = $state('Active'), creating = $state(false), name = $state(''), organization = $state(''), busy = $state(false), error = $state(''), uncertain = $state(false);
  let expanded = $state({}), reviews = $state({}), loading = $state({}), failures = $state({}), archivedReviews = $state(false);
  const countText = (value, unit) => Number.isSafeInteger(value) && value >= 0
    ? `${value} ${unit}${value === 1 ? '' : 's'}`
    : `${unit === 'review' ? 'Review' : 'Response'} count unavailable`;
  const shown = $derived(projects.filter(p => (view === 'All' || (view === 'Archived' ? !!p.archived_at : !p.archived_at)) && `${p.name} ${p.organization ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())));
  async function toggle(project) {
    expanded = { ...expanded, [project.id]: !expanded[project.id] };
    if (!expanded[project.id] || reviews[project.id] || loading[project.id]) return;
    loading = { ...loading, [project.id]: true };
    try { const r = await api(`/v2/projects/${enc(project.id)}/assessments`); reviews = { ...reviews, [project.id]: r.assessments ?? [] }; }
    catch(e) { failures = { ...failures, [project.id]: e.message || 'Reviews could not be loaded.' }; }
    finally { loading = { ...loading, [project.id]: false }; }
  }
  async function create(event) {
    event.preventDefault(); if (!canCreate || busy || uncertain || !name.trim()) return;
    busy = true; error = '';
    try {
      const result = await api('/v2/projects', { method: 'POST', body: { name: name.trim(), ...(organization.trim() ? { organization: organization.trim() } : {}) } });
      if (!result.project?.id) throw new Error('Project creation could not be confirmed.');
      const read = await api(`/v2/projects/${enc(result.project.id)}`);
      if (read.project?.name !== name.trim()) throw new Error('The new project could not be verified.');
      location.hash = returnToSetup ? to('setup1', {}, { project: read.project.id }) : to('project', { pid: read.project.id });
    } catch (e) { error = `${e.message || 'Project creation failed.'} Reload the project list before trying again.`; uncertain = true; }
    finally { busy = false; }
  }
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Projects" parent="Home" back={to('home')} menuHref={to('menu')} />{:else}<TopBar home={to('home')} crumbs={[{ label: 'Projects' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page gap={4}>
    <Row split><h1 class="title-page">Projects</h1>{#if canCreate}<button class="btn btn-primary" type="button" onclick={() => { creating = !creating; }}>New project</button>{/if}</Row>
    <p class="small">All projects available in your current access mode, including projects with no reviews.</p>
    <p class="small">Counts reflect reviews and submitted survey responses you can access in this mode, including archived reviews. Your project role and review access can differ.</p>
    <Row wrap gap={3}><label class="lbl">Search projects<input class="in" type="search" bind:value={search} /></label><label class="lbl">Show projects<select class="in" bind:value={view}><option>Active</option><option>All</option><option>Archived</option></select></label></Row>
    <label class="row-opt"><input class="cb" type="checkbox" bind:checked={archivedReviews} />Include archived reviews inside projects</label>
    {#if creating}<Card gap={3} label="New project"><form class="l-stack" data-gap="3" onsubmit={create}><label class="lbl">Project name<input class="in" bind:value={name} required disabled={busy} /></label><label class="lbl">Lead organisation<input class="in" bind:value={organization} disabled={busy} /></label><Row gap={2}><button class="btn" type="submit" disabled={busy || uncertain || !name.trim()}>Create project</button><button class="btn" type="button" disabled={busy} onclick={() => { creating = false; }}>Cancel</button></Row>{#if error}<p role="alert">{error}</p><button class="btn" type="button" onclick={() => location.reload()}>Reload projects</button>{/if}</form></Card>{/if}
    {#each shown as p}<Card gap={2} label={p.name}><a class="link h3" href={to('project', { pid: p.id })}>{p.name}</a><p class="small">{p.organization ?? ''} · {p.role} · {countText(p.assessment_count, 'review')} · {countText(p.response_count, 'response')}{p.archived_at ? ' · Archived' : ''}</p><Row wrap gap={2}>{#if !p.archived_at && ['owner','member'].includes(p.role)}<a class="link" href={to('setup1', {}, { project: p.id })}>Start a review in this project</a>{/if}<button class="btn" type="button" aria-expanded={!!expanded[p.id]} onclick={() => toggle(p)}>{expanded[p.id] ? 'Hide reviews' : 'Show reviews'} in {p.name}</button></Row>{#if expanded[p.id]}{#if loading[p.id]}<p class="small" role="status">Loading reviews…</p>{/if}{#if failures[p.id]}<p class="small" role="alert">{failures[p.id]}</p>{/if}{#each (reviews[p.id] ?? []).filter(a => archivedReviews || !a.archived_at) as a}<a class="link" href={to('review', { aid: a.id })}>{a.name}{a.archived_at ? ' · Archived' : ''}</a>{/each}{#if reviews[p.id]?.length === 0}<p class="small">No reviews available to you in this project.</p>{/if}{/if}</Card>{/each}
    {#if !shown.length}<p class="small">No projects match this view.</p>{/if}
  </Page>
</AppShell>
