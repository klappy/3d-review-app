<!-- UI Next (v4) Explore screen ("Explore reviews"). Status: provisional (playbook rule 12). Explore lane of the screens fanout
     (cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md). Mock data: ui-next/fixtures/explore/explore.json, adapted through
     ./explore-data.js (levels from ui/assess/v3-assessment.js v3ScoreBand; stage ids to the Stage pill).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Explore.dc.html (desktop), ExplorePhone.dc.html (phone),
     ExploreFiltersPhone.dc.html (phone, ?state=filters: the filters sheet open).
     Composed only of AppShell > Page > Section > Card / Stack / Row / Grid and the section 2 components; no <style>, no inline style.
     The filters sheet is a native <dialog> opened with showModal() (design-system.md "Dialog and sheet states": one element, .sheet on phone).
     Contract gaps (rule 11, cookbook PR canvas-explore-gaps; RESULTS-explore.md): the 1fr/300px table+aside grid, the in-flow menu panel,
     the table row (width, collapsed borders), the selected filter chip, the phone review list row, the sheet geometry and handle,
     the segmented control width. Until they land the screen uses the nearest contract primitive (listed in RESULTS).
     One .btn-primary per page: none on desktop (the board draws none); phone "Open the filters" in the phone-bar. -->
<script module>
  export const STATES = Object.freeze(["filters"]);
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Section from "../../Section.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import Pill from "../../Pill.svelte";
  import Level from "../../Level.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { E } from "./icons.js";
  import { exploreRows, phoneRows } from "./explore-data.js";
  import data from "../../../fixtures/explore/explore.json";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined && !STATES.includes(state)) throw new TypeError(`Explore: unknown state "${String(state)}" (filters)`);
  if (state === "filters" && !phone) throw new TypeError("Explore: the filters sheet is the phone board's (ExploreFiltersPhone.dc.html)");
  const PHONE = "?screen=explore&w=phone", SHEET = "?screen=explore&w=phone&state=filters", RESULTS = "?screen=results&w=phone";
  const HEADS = ["Review", "Project", "Language", "Region", "Organisations", "Stage", "Responses", "Team", "Community", "Church", "Updated"];
  const rows = exploreRows(data.reviews);
  const prows = phoneRows(data.phone.rows);
  // The sheet opens as a modal dialog (top layer, inert page, ::backdrop); a backdrop click or Escape closes it (design-system.md Dialog and sheet states).
  const modal = (el) => {
    if (typeof el.showModal === "function") { try { el.showModal(); return; } catch { /* not connected yet: fall through */ } }
    el.setAttribute("open", "");
  };
  const dismiss = (e) => { if (e.target === e.currentTarget && typeof e.currentTarget.close === "function") e.currentTarget.close(); };
</script>

{#snippet pen()}<Icon d={E.pen} />{/snippet}
{#snippet download()}<Icon d={E.download} />{/snippet}
{#snippet plus()}<Icon d={I.plus} />{/snippet}
{#snippet list()}<Icon d={E.list} />{/snippet}
{#snippet search()}<Icon d={E.search} />{/snippet}
{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet doc()}<Icon d={E.doc} />{/snippet}
{#snippet chip(label, aria)}<span class="chip">{label}<button type="button" aria-label={`Remove ${aria} filter`}><Icon d={I.x} /></button></span>{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={data.user.initials} home="?screen=home" />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.workspace} home="?screen=home" />{/if}{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Open the filters" variant="primary" lg block href={SHEET} lead={list} /></div>{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Explore</h1>
    <p class="small">All reviews you can see · {data.visible}</p>
    <Row wrap gap={2}>{#each data.phone.chips as c}{@render chip(c, c)}{/each}</Row>
    <Row gap={2}>
      <Button label={`Filters · ${data.phone.chips.length}`} href={SHEET} lead={list} block />
      <Button label="Sort" href={PHONE} lead={download} />
      <Button icon={search} ariaLabel="Search reviews" variant="quiet" />
    </Row>
    <Card pad="list" gap={2} label="Reviews">
      {#each prows as r}
        <a class="card-link l-row" data-gap="3" data-split href={RESULTS}>
          <Row gap={3}><span class="icn icn-lens" data-lens="team" aria-hidden="true"><Icon d={E.doc} /></span><Stack gap={1}><span class="h3">{r.title}</span><span class="small">{r.meta}</span></Stack></Row>
          <Level level={r.level} />
        </a>
      {/each}
    </Card>
    <Grid cols={2} gap={2}><Button label="Save this view" href={PHONE} lead={check} block /><Button label="Download CSV" href={PHONE} lead={doc} block /></Grid>
    {#if state === "filters"}
      <dialog class="glass-hi sheet l-card" aria-labelledby="explore-filters-title" {@attach modal} onclick={dismiss}>
        <div class="l-stack" data-gap="1">
          <p class="micro" id="explore-filters-title">Filters · tap to change, swipe a row left to remove</p>
          {#each data.phone.sheet as s}<a class="mi" href={PHONE}><Icon d={E[s.icon]} /><span>{s.label}</span></a>{/each}
        </div>
      </dialog>
    {/if}
  {:else}
    <Page gap={5}>
      <Row split wrap gap={4}>
        <Stack gap={1}>
          <h1 class="title-page">Explore reviews</h1>
          <p class="small t-15">Every review you can see, as one table. Filter by any cross-section; group or save the view.</p>
        </Stack>
        <Row gap={2}>
          <div class="seg" role="radiogroup" aria-label="Show reviews as"><label><input type="radio" name="explore-view" value="cards" />Cards</label><label><input type="radio" name="explore-view" value="table" checked />Table</label></div>
          <Button label="Save this view" lead={pen} />
          <Button label="Download CSV" lead={download} />
        </Row>
      </Row>
      <Section>
        <Card gap={3} label="Filters">
          <Row split wrap gap={3}>
            <Row wrap gap={2}>
              <span class="small">Filters</span>
              {#each data.filters as f}{@render chip(`${f.key} · ${f.value}`, f.key)}{/each}
              <Button label="Add filter" variant="quiet" lead={plus} />
            </Row>
            <Row gap={2}>
              <span class="small">Group by</span>
              <label class="sel"><select class="in" aria-label="Group by">{#each data.groupBy.options as o}<option selected={o === data.groupBy.selected}>{o}</option>{/each}</select><Icon d={I.chev} /></label>
            </Row>
          </Row>
        </Card>
        <Card gap={3} label="Reviews">
          <table>
            <thead><tr>{#each HEADS as h}<th class="th" scope="col">{h}</th>{/each}</tr></thead>
            <tbody>
              {#each rows as r}
                <tr>
                  <td class="td"><b>{r.title}</b></td><td class="td">{r.project}</td><td class="td">{r.language}</td><td class="td">{r.region}</td><td class="td">{r.orgs}</td>
                  <td class="td"><Pill stage={r.pill} /></td><td class="td">{r.responsesText}</td>
                  {#each ["team", "community", "church"] as k}<td class="td">{#if r.levels[k]}<Level level={r.levels[k]} />{:else}<span class="small">—</span>{/if}</td>{/each}
                  <td class="td">{r.updated}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <Row split wrap gap={3}>
            <span class="small">{rows.length} of {data.visible} reviews match · {data.match.projects} projects · {data.match.languages} languages</span>
            <span class="small">Nothing here identifies a participant.</span>
          </Row>
        </Card>
      </Section>
      <Section heading="Add a filter" level={3}>
        <Card hi gap={1} label="Add a filter">
          {#each data.addFilter as f}<button class="mi" type="button"><span>{f}</span><span class="small">Any</span></button>{/each}
        </Card>
        <p class="small">Workspace and project are filters like any other. The Workspace and Project pages are the same table with those filters saved.</p>
      </Section>
    </Page>
  {/if}
</AppShell>
