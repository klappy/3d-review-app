<!-- UI Next (v4) Results screen ("Understand"). Status: provisional (playbook rule 12). ?screen=results (&w=phone); any ?state= renders the default.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Results.dc.html (desktop), ResultsPhone.dc.html (phone).
     Composed of AppShell > Page > Card / Stack / Row / Grid and the section 2 components; no <style>, no inline style.
     Data: ui-next/fixtures/results/report.json through ./data.js (levels by ui/assess/v3-assessment.js v3ScoreBand).
     "Refresh with new answers" is a no-op that says so: the screens read a fixture, not the live report build (receipt debt 1, 8),
     so it reports that no answers arrived after the report was built. The shared Button takes no click handler, hence the literal
     button.btn markup. One .btn-primary: desktop "Plan the next step" (review head); phone the phone-bar. Copy: the boards. -->
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
  import { href } from "../href.js";
  import { out } from "./links.js";
  import { REPORT, lensCards, detailedPages, bandRows, LEVEL_WORD } from "./data.js";

  // report (live): { review, counts, payload } from app/data.js resultsModel; default the fixture. onrefresh (live): rebuilds from new answers.
  let { phone = false, theme = "light", report, onrefresh, refreshed = "" } = $props();
  const D = $derived(report ?? (phone ? REPORT.phone : REPORT.desktop));
  const cards = $derived(lensCards(D.payload, D.counts));
  const review = $derived(D.review);
  // The disagreement line: the board's sentence for the fixture; for a live report, the widest cross-perspective gap in its own words.
  const gap = $derived(report ? bandRows(D, D.counts, D.gaps?.biggest ?? []).find((r) => r.dots.length >= 2) : null);
  const disagree = $derived(!report ? "The team feels strong about the brief and consistency; the community finds the text hard to follow and not yet part of daily life. That gap is the most useful thing in this review." : gap ? `${gap.name}: ${gap.dots.map((d) => `${d.label} ${LEVEL_WORD[d.level].toLowerCase()}`).join(", ")} — ${gap.verdict}. That gap is the most useful thing in this review.` : "No area has two perspectives to compare yet; levels above are per perspective.");
  const built = $derived(report ? `Report built ${review.builtOn} from ${review.responses} responses.` : `Report built ${review.closed} from ${review.responses} responses.`);
  const crumbs = $derived([{ label: review.project, href: out("project") }, { label: review.title }]);
  let checked = $state(false);
  const NO_NEW = "No new answers since this report was built.";
  const refresh = () => { if (onrefresh) onrefresh(); else checked = true; };
  const line = $derived(refreshed || (checked ? NO_NEW : ""));
</script>

{#snippet arrow()}<Glyph d={G.arrow} />{/snippet}
{#snippet download()}<Glyph d={G.download} />{/snippet}
{#snippet people()}<Glyph d={G.people} />{/snippet}
{#snippet list()}<Glyph d={G.list} />{/snippet}
{#snippet doc()}<Glyph d={G.doc} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" home={href("home")} menuHref={out("menu")} />{:else}<TopBar {crumbs} home={out("workspace")} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Plan the next step" href={out("nextStep")} trail="arrow" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead {review} phone linkGap={5} />
    <Row gap={2}>
      <Button label="See the answers" href={href("results-answers")} lead={list} block />
      <Button label="Reports" href={href("report")} lead={doc} block />
      <button class="btn btn-quiet btn-icon" type="button" aria-label="Refresh with new answers" onclick={refresh}><Glyph d={G.refresh} /></button>
    </Row>
    {#if line}<p class="small" role="status">{line}</p>{/if}
    {#each cards as card (card.lens)}<LensCard {card} phone />{/each}
    <a class="link" href={href("results-gaps")}>See the three biggest gaps <Glyph d={G.arrow} /></a>
    <a class="link" href={out("people")}>Share results with someone <Glyph d={G.arrow} /></a>
  {:else}
    <Page gap={5}>
      <ReviewHead {review} primary={{ label: "Plan the next step", href: out("nextStep"), trail: "arrow" }} />
      <LevelLegend />
      <Grid cols={3} gap={4}>{#each cards as card (card.lens)}<Stack><LensCard {card} /></Stack>{/each}</Grid>
      <Card hi gap={3} label="Where the perspectives disagree">
        <Row split gap={5}>
          <Stack gap={1}>
            <h2 class="h2">Where the perspectives disagree</h2>
            <p class="small t-15">{disagree}</p>
          </Stack>
          <Button label="See the three biggest gaps" href={href("results-gaps")} trail={arrow} />
        </Row>
      </Card>
      <Row split gap={2}>
        <Row gap={2}>
          <span class="small" role="status">{built}{line ? ` ${line}` : ""}</span>
          <button class="btn btn-quiet" type="button" onclick={refresh}><Glyph d={G.refresh} />Refresh with new answers</button>
        </Row>
        <Row gap={2}>
          <Button label="Overview report · 1 page" href={href("report")} lead={download} />
          <Button label={`Detailed report · ${detailedPages(cards)} pages`} href={href("report-detailed")} lead={download} />
          <Button label="Share results with someone" href={out("people")} lead={people} />
        </Row>
      </Row>
    </Page>
  {/if}
</AppShell>
