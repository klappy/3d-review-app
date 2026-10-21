<!-- UI Next (v4) Report screen: the one-page overview report (desktop) and the reports list (phone). Status: provisional (rule 12).
     ?screen=report (&w=phone). Boards: Report.dc.html (desktop: document top bar + one A4 .paper sheet), ReportPhone.dc.html (phone).
     The sheet is the Paper contract (design-system.md section 2 Paper, 8.4: Paper is Card level) in .psheet (794px), stacked in the
     shell's main; the board's 56/64px sheet padding and 1120px min-height are inline there (canvas gap, RESULTS-results.md).
     Data: ui-next/fixtures/results/report.json through ./data.js. One .btn-primary: desktop "Download this report (PDF)"
     (document bar); phone the phone-bar. Copy: the boards. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Mark from "../../Mark.svelte";
  import Glyph from "./Glyph.svelte";
  import DocBar from "./DocBar.svelte";
  import PaperHead from "./PaperHead.svelte";
  import PaperLegend from "./PaperLegend.svelte";
  import BandBar from "./BandBar.svelte";
  import { G } from "./icons.js";
  import { REPORT, LEVEL_WORD, lensLabel, lensCards, bandRow } from "./data.js";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`Report: no board states (got "${String(state)}")`);
  const D = REPORT.desktop, P = REPORT.phone;
  const cards = lensCards(D.payload, D.counts);
  const rows = [...D.gaps.biggest, ...D.gaps.agree].map((n) => bandRow(D, D.counts, n));
  const next = D.lookNext.map(([lens, area]) => ({ lens, area, level: cards.find((c) => c.lens === lens).rows.find((r) => r.name === area).level }));
</script>

{#snippet eye()}<Glyph d={G.eye} />{/snippet}
{#snippet share()}<Glyph d={G.people} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Reports" parent="Results" back="?screen=results&w=phone" />{:else}<DocBar title={`Overview report · 1 page · ${D.review.title}`} other="Open the detailed report · 4 pages" otherHref="?screen=report-detailed" />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Download the overview (PDF)" href="#download" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <a class="link small" href="?screen=results&w=phone">{P.review.title} · results</a>
    <h1 class="title-phone">Reports</h1>
    <Card gap={3} label="Overview · 1 page">
      <Row gap={3}><span class="icn icn-lens" data-lens="team"><Glyph d={G.doc} /></span><Stack gap={1}><span class="h3">Overview · 1 page</span><span class="small">Levels, the three biggest gaps, the radar.</span></Stack></Row>
      <Row gap={2}><Button label="Preview" href="?screen=report" lead={eye} block /><Button label="Share PDF" href="#share" lead={share} block /></Row>
    </Card>
    <Card gap={3} label="Detailed · 4 pages">
      <Row gap={3}><span class="icn icn-lens" data-lens="community"><Glyph d={G.list} /></span><Stack gap={1}><span class="h3">Detailed · 4 pages</span><span class="small">Every area with its numbers. Best read on a bigger screen or on paper.</span></Stack></Row>
      <Row gap={2}><Button label="Share PDF" href="#share" lead={share} block /></Row>
    </Card>
    <Card pad="list" gap={2} label="Preview · overview">
      <span class="micro">Preview · overview</span>
      <Mark size={40} />
      <span class="small">A4 page rendered to fit the width; pinch to zoom.</span>
    </Card>
  {:else}
    <Stack gap={6}>
      <div class="psheet"><div class="paper l-card l-stack" data-gap="5">
        <PaperHead review={D.review} {cards} kind="overview" />
        <Stack gap={2}><h2 class="h3">What stands out</h2><p class="small">{D.standsOut}</p></Stack>
        <Stack gap={2}>
          <h2 class="h3">Where the perspectives disagree</h2>
          <p class="small">Each dot is one perspective on the same area, placed in its band; a red line means two bands apart or more.</p>
          {#each rows as row}
            <Grid template="barbell" gap={4}>
              <span class="small"><strong>{row.name}</strong></span>
              <BandBar {row} size="paper" />
              <span class="small">{row.verdict}{#each row.notAsked as who} · {who} not asked{/each}</span>
            </Grid>
          {/each}
          <PaperLegend />
        </Stack>
        <Stack gap={2}>
          <h2 class="h3">Where to look next</h2>
          <ol class="l-stack small" data-gap="1">{#each next as n}<li>{lensLabel(n.lens)} · {n.area} — {LEVEL_WORD[n.level]}</li>{/each}</ol>
        </Stack>
        <div class="pfoot"><span>Built from {D.review.responses} responses on {D.review.builtOn} · levels are bands, not scores · nothing here identifies a person</span><span>1 of 1</span></div>
      </div></div>
    </Stack>
  {/if}
</AppShell>
