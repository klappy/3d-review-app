<!-- Live discovery uses the same authorized list for phone and desktop; fixture boards remain in Explore. -->
<script>
  import { untrack } from "svelte";
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Pill from "../../Pill.svelte";
  import Level from "../../Level.svelte";
  import Coverage from "../results/Coverage.svelte";
  import { exploreRows, LENS_KEYS, tableAssurance } from "./explore-data.js";
  import { selectReviews, projectOptions, reviewCsv, groupReviews, viewPreferenceKey, saveView, loadView, deleteView, validateView } from "./discovery.js";
  let { phone = false, theme = "light", data } = $props();
  let search = $state("");
  let project = $state("");
  let stage = $state("");
  let sort = $state("updated");
  let view = $state(phone ? "cards" : "table");
  let projectSearch = $state("");
  let group = $state("none"), viewStatus = $state("");
  const preferenceKey = $derived(viewPreferenceKey(data.viewKey));
  const grouped = $derived(groupReviews(rows, group));
  const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
  function applyView(p) { search = p.search; project = p.project; stage = p.stage; sort = p.sort; view = p.view; group = p.group; }
  $effect(() => {
    const identity = preferenceKey;
    untrack(() => { void identity; applyView(validateView({}, projects, phone ? "cards" : "table")); projectSearch = ""; viewStatus = ""; });
  });
  function saveCurrentView() {
    viewStatus = saveView(storage(), preferenceKey, { search, project, stage, sort, view, group }, projects)
      ? "View saved on this browser for this account and access mode. No review data was saved."
      : "The view could not be saved on this browser.";
  }
  function loadSavedView() {
    const saved = loadView(storage(), preferenceKey, projects, phone ? "cards" : "table");
    if (saved) { applyView(saved); viewStatus = "Loaded the view saved on this browser. Project access was checked against the current list."; }
    else viewStatus = "No saved view is available on this browser for this account and access mode.";
  }
  function removeSavedView() { viewStatus = deleteView(storage(), preferenceKey) ? "Saved view deleted from this browser." : "The saved view could not be deleted on this browser."; }
  const selected = $derived(selectReviews(data.reviews, { search, project, stage, sort }));
  const rows = $derived(exploreRows(selected));
  const projects = $derived(projectOptions(data.projects, data.reviews));
  const listedProjects = $derived(projects.filter(p => String(p.name).toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase())));
  function reset() { search = ""; project = ""; stage = ""; sort = "updated"; group = "none"; }
  function download() { const url = URL.createObjectURL(new Blob([reviewCsv(selected)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "reviews.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
</script>
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={data.user.initials} home="#/" />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.workspace} home="#/" />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page gap={5}>
    <Stack gap={2}><h1 class={phone ? "title-phone" : "title-page"}>Explore reviews</h1><p class="small">Search the reviews and projects you can access.</p></Stack>
    <div class="glass l-card l-stack" data-pad="work" data-gap="3" role="search" aria-label="Find reviews">
      <label class="l-stack" data-gap="1">Search reviews<input class="in" type="search" bind:value={search} placeholder="Review, project or language" /></label>
      <Row wrap gap={3}>
        <label class="l-stack" data-gap="1">Project<select class="in" bind:value={project}><option value="">All projects</option>{#each projects as p}<option value={p.id}>{p.name}</option>{/each}</select></label>
        <label class="l-stack" data-gap="1">Stage<select class="in" bind:value={stage}><option value="">All stages</option><option value="prepare">Setting up</option><option value="collect">Collecting</option><option value="understand">Results ready</option><option value="improve">Reviewed</option></select></label>
        <label class="l-stack" data-gap="1">Sort<select class="in" bind:value={sort}><option value="updated">Recently updated</option><option value="title">Review title</option></select></label>
        <label class="l-stack" data-gap="1">Group by<select class="in" bind:value={group}><option value="none">None</option><option value="project">Project</option><option value="stage">Stage</option><option value="language">Language</option></select></label>
        <button class="btn btn-quiet" type="button" onclick={reset}>Reset filters</button>
      </Row>
      <Row wrap gap={3}><fieldset class="seg" data-inline><legend class="small">Show reviews as</legend><label><input type="radio" name="discovery-view" value="table" bind:group={view} />Table</label><label><input type="radio" name="discovery-view" value="cards" bind:group={view} />Cards</label></fieldset><button class="btn" type="button" onclick={download}>Download CSV</button></Row>
      <Row wrap gap={3}><button class="btn" type="button" disabled={!preferenceKey} onclick={saveCurrentView}>Save this view</button><button class="btn" type="button" disabled={!preferenceKey} onclick={loadSavedView}>Load saved view</button><button class="btn btn-quiet" type="button" disabled={!preferenceKey} onclick={removeSavedView}>Delete saved view</button></Row>
      <p class="small">Saved views stay on this browser, separately for each account and access mode.</p>
      {#if viewStatus}<p class="small" role="status">{viewStatus}</p>{/if}
    </div>
    <p class="small" aria-live="polite">{rows.length} of {data.reviews.length} reviews match</p>
    {#if rows.length === 0}<p class="small">No reviews match. Change the filters or open a project below to start a review.</p>
    {:else}
      {#each grouped as section (`${group}:${section.id}`)}
      {#if section.label}<h2 class="h2">{section.label} · {section.rows.length}</h2>{/if}
      {#if view === "cards"}
      <Stack gap={3}>{#each section.rows as r}<article class="glass l-card l-stack" data-pad="work" data-gap="2"><a class="link h3" href={r.href}>{r.title}</a><p class="small">{r.project} · {r.language}</p><Pill stage={r.pill} /><Row wrap gap={3}>{#each LENS_KEYS as k}{#if r.levels[k]}<span class="l-stack" data-gap="1"><span class="micro">{k}</span><Level level={r.levels[k]} /><Coverage n={r.counts[k]} variant="count" /></span>{/if}{/each}</Row><p class="small">Updated {r.updated}</p></article>{/each}</Stack>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <section class="glass l-card tbl-wrap" data-pad="table" aria-label={section.label ? `Matching reviews · ${section.label}` : "Matching reviews"} tabindex="0"><table class="tbl"><thead><tr>{#each ["Review", "Project", "Language", "Stage", "Responses", "Team", "Community", "Church", "Updated"] as h}<th class="th" scope="col">{h}</th>{/each}</tr></thead><tbody>{#each section.rows as r}<tr><td class="td"><a class="link" href={r.href}>{r.title}</a></td><td class="td">{r.project}</td><td class="td">{r.language}</td><td class="td"><Pill stage={r.pill} /></td><td class="td">{r.responsesText}</td>{#each LENS_KEYS as k}<td class="td">{#if r.levels[k]}<Level level={r.levels[k]} /><Coverage n={r.counts[k]} variant="count" />{:else}—{/if}</td>{/each}<td class="td">{r.updated}</td></tr>{/each}</tbody></table></section>
      {/if}
      {/each}
    {/if}
    <div class="tbl-foot"><span class="small">{tableAssurance(data.levelMinimum)}</span></div>
    <section class="l-stack" data-gap="3" aria-labelledby="discovery-projects"><h2 class="h2" id="discovery-projects">Projects</h2><label class="l-stack" data-gap="1">Search projects<input class="in" type="search" bind:value={projectSearch} /></label>{#if !listedProjects.length}<p class="small">No projects match.</p>{/if}{#each listedProjects as p}<div class="glass l-card" data-pad="work">{#if p.href}<a class="link" href={p.href}>{p.name}</a>{:else}<span>{p.name}</span>{/if}</div>{/each}</section>
  </Page>
</AppShell>
