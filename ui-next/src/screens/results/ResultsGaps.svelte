<!-- UI Next (v4) Results gaps screen ("The three biggest gaps"). Status: provisional (playbook rule 12). ?screen=results-gaps (&w=phone).
     Boards: ResultsGaps.dc.html (desktop), ResultsGapsPhone.dc.html (phone). Rows: the board's areas (fixture gaps.biggest / gaps.agree),
     each perspective's band from ./data.js bandRow over ui/report-lenses.js lensSpreadRows + v3ScoreBand.
     Any ?state= renders the default. One .btn-primary: desktop review head; phone the phone-bar. Copy: the boards. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import GapRow from "./GapRow.svelte";
  import PtDot from "./PtDot.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import { out } from "./links.js";
  import { REPORT, LENS_ORDER, lensLabel, bandRows } from "./data.js";

  let { phone = false, theme = "light", report } = $props();
  const src = $derived(report ?? (phone ? REPORT.phone : REPORT.desktop));
  const biggest = $derived(bandRows(src, src.counts, src.gaps.biggest));
  const agree = $derived(bandRows(src, src.counts, src.gaps.agree));
  const review = $derived(src.review);
  const crumbs = $derived([{ label: review.project, href: out("project") }, { label: review.title }]);
</script>

{#snippet arrow()}<Glyph d={G.arrow} />{/snippet}
{#snippet doc()}<Glyph d={G.doc} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Biggest gaps" parent="Results" back={href("results")} menuHref={out("menu")} />{:else}<TopBar {crumbs} home={out("workspace")} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Plan the next step" href={out("nextStep")} trail="arrow" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead {review} phone />
    <p class="small">The three biggest gaps between how the perspectives see the same thing.</p>
    {#each biggest as row}<GapRow {row} phone />{/each}
    <a class="link" href={href("report")}>Open the detailed report</a>
  {:else}
    <Page gap={5}>
      <ReviewHead {review} primary={{ label: "Plan the next step", href: out("nextStep"), trail: "arrow" }} />
      <Card pad="list" label="Who each dot is">
        <Row wrap gap={6}>
          <span class="h3">Who each dot is</span>
          {#each LENS_ORDER as lens}<Row gap={2}><PtDot {lens} /><strong>{lensLabel(lens)}</strong></Row>{/each}
          <div class="l-row" data-justify="end" data-grow><span class="small">Each perspective sits in one of four bands. The line between dots is the gap; it turns red at two bands or more.</span></div>
        </Row>
      </Card>
      <Row gap={3}><h2 class="h2">The three biggest gaps</h2><span class="small">Each row is one area; each perspective that was asked lands in a band.</span></Row>
      {#each biggest as row}<GapRow {row} />{/each}
      {#if agree.length}<h2 class="h2">Where everyone agrees</h2>{#each agree as row}<GapRow {row} />{/each}{/if}
      <Card hi gap={3} label="What this does not tell you">
        <Row split gap={5}>
          <Stack gap={1}>
            <h2 class="h2">What this does not tell you</h2>
            <p class="small t-15">Who is right. A gap is an invitation to ask, not a verdict. Take the two biggest to the team and the community together. The full report adds every area and a radar of the three shapes.</p>
          </Stack>
          <Row gap={2}><Button label="Open the detailed report" href={href("report-detailed")} lead={doc} /><Button label="Plan the next step" href={out("nextStep")} trail={arrow} /></Row>
        </Row>
      </Card>
    </Page>
  {/if}
</AppShell>
