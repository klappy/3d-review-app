<!-- UI Next (v4) Results screen ("Understand"). Status: provisional (playbook rule 12). ?screen=results (&w=phone).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Results.dc.html (desktop), ResultsPhone.dc.html (phone).
     Composed of AppShell > Page > Card / Stack / Row / Grid and the section 2 components; no <style>, no inline style.
     Data: ui-next/fixtures/results/report.json through ./data.js (levels by ui/assess/v3-assessment.js v3ScoreBand).
     One .btn-primary: desktop "Plan the next step" (review head); phone the phone-bar. Copy: the boards. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import LevelLegend from "./LevelLegend.svelte";
  import LensCard from "./LensCard.svelte";
  import { G } from "./icons.js";
  import { REPORT, lensCards } from "./data.js";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`Results: no board states (got "${String(state)}")`);
  const D = REPORT.desktop, P = REPORT.phone;
  const cards = $derived(phone ? lensCards(P.payload, P.counts) : lensCards(D.payload, D.counts));
  const review = $derived(phone ? P.review : D.review);
  const crumbs = $derived([{ label: review.project, href: "#project" }, { label: review.title }]);
</script>

{#snippet arrow()}<Glyph d={G.arrow} />{/snippet}
{#snippet refresh()}<Glyph d={G.refresh} />{/snippet}
{#snippet download()}<Glyph d={G.download} />{/snippet}
{#snippet people()}<Glyph d={G.people} />{/snippet}
{#snippet list()}<Glyph d={G.list} />{/snippet}
{#snippet doc()}<Glyph d={G.doc} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" />{:else}<TopBar {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Plan the next step" href="#next-step" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead {review} phone />
    <Row gap={2}>
      <Button label="See the answers" href="?screen=results-answers&w=phone" lead={list} />
      <Button label="Reports" href="?screen=report&w=phone" lead={doc} />
      <Button icon={refresh} ariaLabel="Refresh with new answers" variant="quiet" />
    </Row>
    {#each cards as card}<LensCard {card} phone />{/each}
    <a class="link" href="?screen=results-gaps&w=phone">See the three biggest gaps <Glyph d={G.arrow} /></a>
    <a class="link" href="#people">Share results with someone <Glyph d={G.arrow} /></a>
  {:else}
    <Page gap={5}>
      <ReviewHead {review} primary={{ label: "Plan the next step", href: "#next-step", trail: "arrow" }} />
      <LevelLegend />
      <Grid cols={3} gap={4}>{#each cards as card}<Stack><LensCard {card} /></Stack>{/each}</Grid>
      <Card hi gap={3} label="Where the perspectives disagree">
        <Row split gap={5}>
          <Stack gap={1}>
            <h2 class="h2">Where the perspectives disagree</h2>
            <p class="small t-15">The team feels strong about the brief and consistency; the community finds the text hard to follow and not yet part of daily life. That gap is the most useful thing in this review.</p>
          </Stack>
          <Button label="See the three biggest gaps" href="?screen=results-gaps" trail={arrow} />
        </Row>
      </Card>
      <Row split gap={2}>
        <Row gap={2}><span class="small">Report built {review.closed} from {review.responses} responses.</span><Button label="Refresh with new answers" variant="quiet" lead={refresh} /></Row>
        <Row gap={2}>
          <Button label="Overview report · 1 page" href="?screen=report" lead={download} />
          <Button label="Detailed report · 4 pages" href="?screen=report-detailed" lead={download} />
          <Button label="Share results with someone" href="#people" lead={people} />
        </Row>
      </Row>
    </Page>
  {/if}
</AppShell>
