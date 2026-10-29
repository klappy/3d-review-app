<!-- UI Next (v4) Report screen: the one-page overview report (desktop) and the reports list (phone). Status: provisional (rule 12).
     ?screen=report (&w=phone). Boards: Report.dc.html (desktop: document top bar + one A4 .paper sheet), ReportPhone.dc.html (phone).
     The sheet is the contract .paper[data-sheet=a4] (design-system.md 8.11: 794px, 56/64 padding, 1120px; Paper is Card level, 8.4),
     directly in the shell's main as the board draws it. Phone: the chip rows are .l-row[data-align=start] and the preview mark and
     line .l-stack[data-align=center] (8.7 rows). Any ?state= renders the default.
     Data: ui-next/fixtures/results/report.json through ./data.js. One .btn-primary: desktop "Download this report (PDF)"
     (document bar); phone the phone-bar. Copy: the boards.
     report: the built report (default the fixture, REPORT.desktop on the sheet and REPORT.phone on the phone list; the route
     passes none). Both branches read it (R4-4). A payload without a perspective, a gap area or a "look next" area still renders
     (validator R3-3): cards and rows are iterated, unresolved areas are left out, never thrown. The detailed report's page count
     is its sheets for this report (data.js detailedPages, R4-5). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import { liveContext } from "../href.js";
  const live = !!liveContext(); // live: PDF export is receipt debt 8 (DocBar says so on desktop); the phone controls say the same
  import Button from "../../Button.svelte";
  import Mark from "../../Mark.svelte";
  import Glyph from "./Glyph.svelte";
  import DocBar from "./DocBar.svelte";
  import PaperHead from "./PaperHead.svelte";
  import PaperLegend from "./PaperLegend.svelte";
  import BandBar from "./BandBar.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import { out } from "./links.js";
  import { REPORT, LEVEL_WORD, lensLabel, lensCards, snapshotTotal, footPrivacy, detailedPages, countWord, gapList, agreeList } from "./data.js";

  // state "overview" (phone): the overview reading view (design-system.md Phone report reading); the hub otherwise.
  let { phone = false, theme = "light", report, state: view } = $props();
  const reading = $derived(phone && view === "overview");
  const D = $derived(report ?? (phone && !reading ? REPORT.phone : REPORT.desktop)); // the reading view draws the overview sheet
  const cards = $derived(lensCards(D.payload, D.counts, { sent: D.sent }));
  const pages = $derived(detailedPages(cards));
  // The gaps (two placed perspectives a band or more apart) then at most the first area where the placed perspectives share a band,
  // as the board draws it (design-system.md §4 "Results gaps agreement", Q13): a one-band row is never drawn as agreement.
  const gapRowsDrawn = $derived(gapList(D));
  const rows = $derived([...gapRowsDrawn, ...agreeList(D).slice(0, 1)]);
  // The phone list's line names what the overview sheet draws, counted (R5-5): its levels and the biggest gaps it resolves.
  // The sheet draws no radar (that is the detailed report), so the board's "the radar" is not claimed here.
  const biggest = $derived(gapRowsDrawn.length);
  const overviewLine = $derived(`Levels${biggest > 1 ? `, the ${countWord(biggest)} biggest gaps` : biggest === 1 ? ", the biggest gap" : ""}.`);
  const next = $derived((D.lookNext ?? []).map(([lens, area]) => ({ lens, area, row: cards.find((c) => c.lens === lens)?.rows.find((r) => r.name === area) }))
    .filter((n) => n.row).map((n) => ({ lens: n.lens, area: n.area, level: n.row.level })));
</script>

{#snippet eye()}<Glyph d={G.eye} />{/snippet}
{#snippet share()}<Glyph d={G.share} />{/snippet}
{#snippet top()}{#if reading}<PhoneHeader state="nested" title="Overview" parent="Reports" back={href("report")} menuHref={out("menu")} />{:else if phone}<PhoneHeader state="nested" title="Reports" parent="Results" back={href("results")} menuHref={out("menu")} />{:else}<DocBar title={`Overview report · 1 page · ${D.review.title}`} other={`Open the detailed report · ${pages} pages`} otherHref={href("report-detailed")} />{/if}{/snippet}
{#snippet bar()}{#if reading}<div class="glass phone-bar" role="group" aria-label="Page actions"><button class="btn btn-primary btn-lg btn-block" type="button" disabled aria-describedby="pdf-why">Download the overview (PDF)</button></div>{:else if phone}<PhoneBar label="Download the overview (PDF)" href={live ? undefined : "#download"} disabled={live} ariaDescribedby={live ? "doc-pdf-why" : undefined} />{/if}{/snippet}

<AppShell {phone} {theme} screen rhythm="report" {top} {bar}><!-- §8.3 Report frame: main.l-main[data-rhythm=report] > .paper sheets (desktop) -->
  {#if reading}
    <!-- design-system.md Phone report reading (QA-LIVE N2): the overview sheet scaled to the width, the PDF reason in the page. -->
    <span class="micro">Overview · 1 page · A4 scaled to the width; pinch to zoom</span>
    <p class="small" id="pdf-why">PDF export is not in the new design yet; the current design's report page downloads it.</p>
    <div class="report-sheets"><div class="psheet" data-fit="a4">{@render overview()}</div></div>
    <a class="link" href={href("report-detailed")}>Open the detailed report <Glyph d={G.arrow} /></a>
  {:else if phone}
    <a class="link small" href={href("results")}>{D.review.title} · results</a>
    {#if live}<p class="small" id="doc-pdf-why">PDF export is not in the new design yet; the current design's report page downloads it.</p>{/if}
    <h1 class="title-phone">Reports</h1>
    <Card gap={3} label="Overview · 1 page">
      <div class="l-row" data-gap="3" data-align="start"><span class="icn icn-lens" data-lens="team"><Glyph d={G.doc} /></span><Stack gap={1}><span class="h3">Overview · 1 page</span><span class="small">{overviewLine}</span></Stack></div>
      <Row gap={2}><Button label="Preview" href={href("report", { state: "overview" })} lead={eye} block /><Button label="Share PDF" href={live ? undefined : "#share-pdf"} disabled={live} ariaDescribedby={live ? "doc-pdf-why" : undefined} lead={share} block /></Row>
    </Card>
    <Card gap={3} label={`Detailed · ${pages} pages`}>
      <div class="l-row" data-gap="3" data-align="start"><span class="icn icn-lens" data-lens="community"><Glyph d={G.list} /></span><Stack gap={1}><span class="h3">Detailed · {pages} pages</span><span class="small">Every area with its numbers. Best read on a bigger screen or on paper.</span></Stack></div>
      <Row gap={2}><Button label="Read" href={href("report-detailed")} lead={eye} block /><Button label="Share PDF" href={live ? undefined : "#share-pdf"} disabled={live} ariaDescribedby={live ? "doc-pdf-why" : undefined} lead={share} block /></Row>
    </Card>
    <Card pad="list" gap={4} label="Preview · overview">
      <span class="micro">Preview · overview</span>
      <div class="l-stack" data-gap="4" data-align="center"><Mark size={40} /><span class="small">A4 page rendered to fit the width; pinch to zoom.</span></div>
    </Card>
  {:else}
    {@render overview()}
  {/if}
</AppShell>
{#snippet overview()}
    <!-- Paper sheet contents (design-system.md §8.11 row, provisional): each section a plain div > div.sheet-head (role heading, level 2;
         [data-v] the space under) + p.sheet-lead / p.sheet-text / ol.sheet-list, as the board draws them; no .small, .h3 or inline type
         inside the sheet. The not-asked and more-input notes after a verdict are span.small.bb-na, the board's own. -->
    <div class="paper" data-sheet="a4">
      <PaperHead review={D.review} {cards} kind="overview" />
      <div><div class="sheet-head" role="heading" aria-level="2">What stands out</div><p class="sheet-text" data-v="14">{D.standsOut}</p></div>
      <div>
        <div class="sheet-head" data-v="2" role="heading" aria-level="2">Where the perspectives disagree</div>
        <p class="sheet-lead">Each dot is one perspective on the same area, placed in its band; a red line means two bands apart or more.</p>
        {#each rows as row}
          <div class="barbell-row"><!-- design-system.md barbell rows: .paper .barbell-row 180px minmax(0,1fr) 150px, gap 14; bb-label / bb-verdict -->
            <span class="bb-label">{row.name}</span>
            <BandBar {row} size="paper" />
            <span class="bb-verdict">{row.verdict}{#if row.notes.length}<span class="small bb-na">{` · ${row.notes.join(" · ")}`}</span>{/if}</span>
          </div>
        {/each}
        <PaperLegend />
      </div>
      <div>
        <div class="sheet-head" role="heading" aria-level="2">Where to look next</div>
        {#if next.length}<ol class="sheet-list">{#each next as n}<li>{lensLabel(n.lens)} · {n.area} — {LEVEL_WORD[n.level]}</li>{/each}</ol>
        {:else}<p class="sheet-text" data-v="14">No area reads Needs support or Needs urgent attention.</p>{/if}
      </div>
      <div class="pfoot"><span class="pf-text">Built from {snapshotTotal(cards)} responses on {D.review.builtOn} · levels are bands, not scores · {footPrivacy()}</span><span class="pn">1 of 1</span></div>
    </div>
{/snippet}

