<!-- UI Next (v4) Explore screen ("Explore reviews"). Status: provisional (playbook rule 12). Explore lane of the screens fanout
     (cookbook work/active/2026-10-21-ui-next-screens-fanout/TICKET.md). Mock data: ui-next/fixtures/explore/explore.json, adapted through
     ./explore-data.js (levels from ui/assess/v3-assessment.js v3ScoreBand; stage ids to the Stage pill).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Explore.dc.html (desktop), ExplorePhone.dc.html (phone),
     ExploreFiltersPhone.dc.html (phone, ?state=filters: the filters sheet open). Any other ?state= renders the default board.
     Composed of AppShell > Page > Stack / Row / Grid and contract rows (design-system.md 8.1, 8.7 Explore-lane rows at the PIN):
     .l-grid[data-tpl=aside-end] (table + 300px aside), .l-card[data-pad=bar|table|rows], .tbl-wrap (the table card scrolls sideways,
     the page never does), .tbl-foot, .chip[data-on], .menu[data-flow] + .mi-end, .sel[data-size=compact], .seg[data-inline],
     .list-row/.icn-row/.list-body/.list-title, .sheet[data-pad=menu]/.sheet-handle/.sheet-title, .mi[data-size=lg]; no <style>, no inline style.
     The filters sheet is a native <dialog class="glass-hi sheet"> opened with showModal() (design-system.md "Dialog and sheet states";
     geometry and ::backdrop from the dialog.glass-hi rows): Escape, or a press that starts and ends on the backdrop (outside the
     sheet's box), closes it (./dialog.js, shared with Feedback); on close the address is replaced with the closed state (closeTo),
     so Reload or Back does not reopen it (validator R3-1).
     Links through ../href.js (carries ?theme=); a phone review row opens the results lane's "results" screen. The desktop rows are
     plain, as the board draws them. The match line counts the rows the table shows (./explore-data.js matchCounts).
     Group by shows "None": the rows are not grouped, so it does not claim the board's "Stage" (validator R3-4). Live QA Q5: the
     controls the explore model cannot serve yet (chip remove, Add filter, Cards/Table, Save this view, Download CSV, Group by, Sort,
     Search, Filters, the aside rows) are drawn disabled, each described by one visible reason line (WHY), never a silent no-op.
     One .btn-primary per page: none on desktop (the board draws none); phone "Open the filters" in the phone-bar. -->
<script module>
  export const STATES = Object.freeze(["filters"]);
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import Pill from "../../Pill.svelte";
  import Level from "../../Level.svelte";
  import Coverage from "../results/Coverage.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { E } from "./icons.js";
  import { href } from "../href.js";
  import { exploreRows, phoneRows, matchCounts, LENS_KEYS, tableAssurance } from "./explore-data.js";
  import { currentLevelMin } from "../results/data.js";
  import { modal, backdropClose, closeTo } from "./dialog.js";
  import fixture from "../../../fixtures/explore/explore.json";

  // data: the fixture, or every review the account can see in the same shape (app/data.js exploreModel).
  let { phone = false, theme = "light", state, data = fixture } = $props();
  // Unknown states, and the phone-only sheet asked for on desktop, render the default board (never throw on a URL value).
  const sheet = $derived(phone && state === "filters");
  const W = $derived({ w: phone ? "phone" : null });
  const HOME = $derived(href("home", W)), SELF = $derived(href("explore", W));
  const RESULTS = $derived(href("results", W));
  const HEADS = ["Review", "Project", "Language", "Region", "Organisations", "Stage", "Responses", "Team", "Community", "Church", "Updated"];
  const rows = exploreRows(data.reviews);
  const prows = phoneRows(data.phone.rows);
  const match = matchCounts(rows);
  const many = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const closer = backdropClose();
  // Live QA Q5: one visible reason for every control the explore model cannot serve yet (no filter, group, sort, saved-view or export store).
  const WHY = "Filters, grouping, sorting, search, saved views, the card view and CSV download are not in the new design yet; the table lists every review you can see.";
</script>

{#snippet pen()}<Icon d={E.pen} />{/snippet}
{#snippet download()}<Icon d={E.download} />{/snippet}
{#snippet plus()}<Icon d={I.plus} />{/snippet}
{#snippet list()}<Icon d={E.list} />{/snippet}
{#snippet search()}<Icon d={E.search} />{/snippet}
{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet doc()}<Icon d={E.doc} />{/snippet}
{#snippet chip(label, aria, on = false)}<span class="chip" data-on={on ? "" : undefined}>{label}<button type="button" aria-label={`Remove ${aria} filter`} disabled aria-describedby="explore-why"><Icon d={I.x} /></button></span>{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={data.user.initials} home={HOME} />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.workspace} home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Open the filters" variant="primary" lg block lead={list} disabled ariaDescribedby="explore-why" /></div>{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Explore</h1>
    <p class="small">All reviews you can see · {data.visible}</p>
    <p class="small" id="explore-why">{WHY}</p>
    <Row wrap gap={2}>{#each data.phone.chips as c}{@render chip(c, c)}{/each}</Row>
    <Row gap={2}>
      <Button label={`Filters · ${data.phone.chips.length}`} lead={list} block disabled ariaDescribedby="explore-why" />
      <Button label="Sort" lead={download} disabled ariaDescribedby="explore-why" />
      <Button icon={search} ariaLabel="Search reviews" variant="quiet" disabled ariaDescribedby="explore-why" />
    </Row>
    <section class="glass l-card" data-pad="rows" aria-label="Reviews">
      {#each prows as r}
        <a class="card-link list-row" href={r.href ?? RESULTS}>
          <span class="icn icn-row" data-lens="team" aria-hidden="true"><Icon d={E.doc} /></span>
          <div class="list-body"><div class="list-title">{r.title}</div><div class="small">{r.meta}</div></div>
          <span class="l-stack" data-gap="1"><Level level={r.level} /><Coverage n={r.n} variant="count" /></span>
        </a>
      {/each}
    </section>
    <Row gap={2}><Button label="Save this view" lead={check} block disabled ariaDescribedby="explore-why" /><Button label="Download CSV" lead={doc} block disabled ariaDescribedby="explore-why" /></Row>
    {#if sheet}
      <dialog class="glass-hi sheet" data-pad="menu" aria-labelledby="explore-filters-title" {@attach modal} onpointerdown={closer.onpointerdown} onclick={closer.onclick} onclose={closeTo(SELF)}>
        <div class="l-stack" data-gap="1">
          <div class="sheet-handle" aria-hidden="true"></div>
          <p class="micro sheet-title" id="explore-filters-title">Filters · tap to change, swipe a row left to remove</p>
          {#each data.phone.sheet as s}<a class="mi" data-size="lg" href={SELF}><Icon d={E[s.icon]} /><span>{s.label}</span></a>{/each}
        </div>
      </dialog>
    {/if}
  {:else}
    <Page gap={5}>
      <Row split gap={4}>
        <Stack gap={1}>
          <h1 class="title-page">Explore reviews</h1>
          <p class="small t-15">Every review you can see, as one table. Filter by any cross-section; group or save the view.</p>
          <p class="small" id="explore-why">{WHY}</p>
        </Stack>
        <Row gap={2}>
          <div class="seg" data-inline role="radiogroup" aria-label="Show reviews as" aria-describedby="explore-why"><label><input type="radio" name="explore-view" value="cards" disabled />Cards</label><label><input type="radio" name="explore-view" value="table" checked />Table</label></div>
          <Button label="Save this view" lead={pen} disabled ariaDescribedby="explore-why" />
          <Button label="Download CSV" lead={download} disabled ariaDescribedby="explore-why" />
        </Row>
      </Row>
      <div class="l-grid" data-tpl={data.addFilter.length ? "aside-end" : undefined} data-gap="5">
        <Stack gap={4}>
          <div class="glass l-card l-row" data-pad="bar" data-split data-wrap data-gap="2" role="group" aria-label="Filters">
            <Row wrap gap={2}>
              <span class="small">Filters</span>
              {#each data.filters as f}{@render chip(`${f.key} · ${f.value}`, f.key, true)}{/each}
              <Button label="Add filter" variant="quiet" lead={plus} disabled ariaDescribedby="explore-why" />
            </Row>
            <Row gap={2}>
              <span class="small">Group by</span>
              <label class="sel" data-size="compact"><select class="in" aria-label="Group by" disabled aria-describedby="explore-why">{#each data.groupBy.options as o}<option selected={o === data.groupBy.selected}>{o}</option>{/each}</select><Icon d={I.chev} /></label>
            </Row>
          </div>
          <!-- The table card scrolls sideways (.tbl-wrap), so it takes keyboard focus to be scrollable without a pointer. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <section class="glass l-card tbl-wrap" data-pad="table" aria-label="Reviews" tabindex="0">
            <table class="tbl">
              <thead><tr>{#each HEADS as h}<th class="th" scope="col">{h}</th>{/each}</tr></thead>
              <tbody>
                {#each rows as r}
                  <tr>
                    <td class="td">{r.title}</td><td class="td">{r.project}</td><td class="td">{r.language}</td><td class="td">{r.region}</td><td class="td">{r.orgs}</td>
                    <td class="td"><Pill stage={r.pill} /></td><td class="td">{r.responsesText}</td>
                    {#each LENS_KEYS as k}<td class="td">{#if r.levels[k]}<span class="l-stack" data-gap="1"><Level level={r.levels[k]} /><Coverage n={r.counts[k]} variant="count" /></span>{:else}<span class="micro">—</span>{/if}</td>{/each}
                    <td class="td">{r.updated}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <div class="l-row tbl-foot" data-split data-gap="3">
              <span class="small">{match.reviews} of {data.visible} reviews match · {many(match.projects, "project")} · {many(match.languages, "language")}</span>
              <span class="small">{tableAssurance(data.levelMinimum ?? currentLevelMin())}</span>
            </div>
          </section>
        </Stack>
        {#if data.addFilter.length}<aside class="l-stack" data-gap="3" aria-labelledby="explore-add-title">
          <h2 class="h3" id="explore-add-title">Add a filter</h2>
          <div class="glass-hi menu" data-flow role="group" aria-labelledby="explore-add-title">
            {#each data.addFilter as f}<button class="mi" type="button" disabled aria-describedby="explore-why"><span>{f}</span><span class="small mi-end">Any</span></button>{/each}
          </div>
          <p class="small">Workspace and project are filters like any other. The Workspace and Project pages are the same table with those filters saved.</p>
        </aside>{/if}
      </div>
    </Page>
  {/if}
</AppShell>
