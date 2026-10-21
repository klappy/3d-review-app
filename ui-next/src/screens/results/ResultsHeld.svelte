<!-- UI Next (v4) Results held screen. Status: provisional (playbook rule 12). ?screen=results-held (&w=phone).
     Boards: ResultsHeld.dc.html (desktop), ResultsHeldPhone.dc.html (phone). A perspective under the minimum
     (ui/assess/v3-assessment.js V3_BAND_CUTOFFS.minResponses) holds the results; every level of that perspective is
     More input needed (v3ScoreBand), shown as a preview of the first rows. The board dims the preview grid with an inline
     opacity: no contract row (canvas gap, RESULTS-results.md), so the preview is drawn undimmed.
     One .btn-primary: desktop "Reopen collection" (review head); phone the phone-bar. Copy: the boards. -->
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
  import LensDot from "../../LensDot.svelte";
  import Glyph from "./Glyph.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import LevelLegend from "./LevelLegend.svelte";
  import LensCard from "./LensCard.svelte";
  import { G } from "./icons.js";
  import { REPORT, MIN_RESPONSES, lensCards, heldLines } from "./data.js";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`ResultsHeld: no board states (got "${String(state)}")`);
  const D = REPORT.desktop, H = REPORT.held, P = REPORT.phone;
  const cards = lensCards(D.payload, H.counts);
  const lines = heldLines(H.counts);
  const short = lines.filter((l) => l.short > 0);
  if (!short.length) throw new TypeError("ResultsHeld: the fixture holds no perspective under the minimum");
  const first = short[0];
  const phoneN = H.phoneCounts[first.lens];
  const crumbs = [{ label: D.review.project, href: "#project" }, { label: D.review.title }];
  const without = `Show results without the ${first.label.toLowerCase()}`;
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title={P.review.title} parent={P.review.project} back="#project" />{:else}<TopBar {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Reopen collection" href="#share" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead review={{ ...P.review, stage: "closed" }} phone />
    <Card gap={3} label="Results are held">
      <Row gap={3}>
        <span class="icn icn-lens" data-lens={first.lens}><Glyph d={G.clock} /></span>
        <Stack gap={1}><span class="h3">Results are held</span><span class="small">The {first.label.toLowerCase()} survey has {phoneN} answers; we show a perspective at {MIN_RESPONSES} or more so no one can be picked out.</span></Stack>
      </Row>
      <a class="link" href="?screen=results&w=phone">{without}</a>
      <a class="link" href="?screen=results-answers&w=phone">See the answers so far</a>
    </Card>
  {:else}
    <Page gap={5}>
      <ReviewHead review={D.review} closedResponses={H.review.closedResponses} primary={{ label: "Reopen collection", href: "#share", lead: "qr" }} />
      <LevelLegend />
      <Card hi gap={3} label="Results are held">
        <Row split gap={6}>
          <Row gap={6}>
            <span class="icn icn-lens" data-lens="team"><Glyph d={G.lock} size={30} /></span>
            <Stack gap={2}>
              <h2 class="h2">Results are held until every perspective has enough answers</h2>
              <p class="small t-15">Levels need at least {MIN_RESPONSES} answers from a perspective so no one can be picked out. {first.label} has {first.n} of {MIN_RESPONSES}. Keep collecting, or go on without the {first.label.toLowerCase()} perspective.</p>
              <Row wrap gap={5}>{#each lines as l}<span class="small"><LensDot lens={l.lens} decorative /> {l.text}</span>{/each}</Row>
            </Stack>
          </Row>
          <Stack gap={2}><Button label="Reopen collection" href="#share" /><Button label={without} variant="quiet" href="?screen=results" /></Stack>
        </Row>
      </Card>
      <Grid cols={3} gap={4}>{#each cards as card}<Stack><LensCard {card} rows={H.preview} /></Stack>{/each}</Grid>
    </Page>
  {/if}
</AppShell>
