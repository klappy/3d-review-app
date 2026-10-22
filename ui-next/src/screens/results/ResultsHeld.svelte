<!-- UI Next (v4) Results held screen. Status: provisional (playbook rule 12). ?screen=results-held (&w=phone).
     Boards: ResultsHeld.dc.html (desktop), ResultsHeldPhone.dc.html (phone). A perspective under the minimum
     (ui/assess/v3-assessment.js V3_BAND_CUTOFFS.minResponses) holds the results; every level of that perspective is
     More input needed (v3ScoreBand), shown as a preview of the first rows, dimmed by the contract .l-grid[data-state=held] (8.11)
     and inert (the board marks it aria-hidden; inert also keeps its links out of the tab order). Hero: the 64px chip
     .icn[data-size="64"] and the --t-24 heading .h2.t-24 (contract rows); the board's 40px hero padding stays inline there (res-5),
     so the card is the Card pad=hero contract. Any ?state= renders the default.
     One .btn-primary: desktop "Reopen collection" (review head); phone the phone-bar. Copy: the boards. -->
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
  import LensDot from "../../LensDot.svelte";
  import Glyph from "./Glyph.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import LevelLegend from "./LevelLegend.svelte";
  import LensCard from "./LensCard.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import { out } from "./links.js";
  import { REPORT, MIN_RESPONSES, lensCards, heldLines } from "./data.js";

  // report (live): { review, counts, payload } with too few responses in some perspective; default the fixture's held state.
  // onreopen (live): moves the review back to Collect (setStage) before Share, so the links the page asks people to use are open.
  // The shared Button takes no click handler (Setup5's launching pattern): every "Reopen collection" link is intercepted here.
  const reopening = (el) => { const f = (e) => { if (onreopen && e.target instanceof Element && e.target.closest(`a[href="${out("share")}"]`)) { e.preventDefault(); onreopen(); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
  let { onreopen, phone = false, theme = "light", report } = $props();
  const D = report ?? REPORT.desktop, H = report ? { counts: report.counts, phoneCounts: report.counts, preview: REPORT.held.preview, review: { closedResponses: report.review.responses } } : REPORT.held, P = report ?? REPORT.phone;
  const cards = lensCards(D.payload ?? { lenses: [] }, H.counts);
  // Live: the server's own hold (results.ts MinimumHold: responses_in / responses_needed / reason, an assessment-wide gate) is the
  // condition shown; the per-perspective lines keep only perspectives the review has surveys for (count > 0 or a lens the report names).
  const srv = $derived(report?.held && typeof report.held.responses_needed === "number" ? report.held : null);
  const lines = $derived(report ? heldLines(H.counts).filter((l) => l.n > 0 || (report.payload?.lenses ?? []).some((x) => x.lens === l.lens || x.lens === l.label)) : heldLines(H.counts));
  const short = $derived(lines.filter((l) => l.short > 0));
  if (!report && !heldLines(H.counts).some((l) => l.short > 0)) throw new TypeError("ResultsHeld: the fixture holds no perspective under the minimum");
  const first = $derived(short[0] ?? lines[0] ?? heldLines(H.counts)[0]);
  const phoneN = $derived(H.phoneCounts[first.lens]);
  const crumbs = [{ label: D.review.project, href: out("project") }, { label: D.review.title }];
  const without = `Show results without the ${first.label.toLowerCase()}`;
  // Live: a server (assessment-wide) hold cannot be worked around per perspective, so the "without" escape is not offered; while the
  // review is still collecting the primary goes back to Collect (nothing to reopen), otherwise it reopens collection.
  const collecting = $derived(report?.review?.stage === "collecting");
  const escape = $derived(!report || !srv);
  const primary = $derived(collecting ? { label: "Back to Collect", href: out("collect"), lead: "qr" } : { label: "Reopen collection", href: out("share"), lead: "qr" });
</script>

{#snippet qr()}<Glyph d={G.qr} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title={P.review.title} parent={P.review.project} back={out("project")} menuHref={out("menu")} />{:else}<TopBar {crumbs} home={out("workspace")} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label={primary.label} href={primary.href} />{/if}{/snippet}

<div class="l-stack" {@attach reopening}><AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead review={{ ...P.review, stage: "closed" }} phone />
    <Card gap={3} label="Results are held">
      <div class="l-row" data-gap="3" data-align="start">
        <span class="icn icn-lens" data-lens={first.lens}><Glyph d={G.clock} /></span>
        <Stack gap={1}><span class="h3">Results are held</span><span class="small">{#if srv}{srv.responses_in} of {srv.responses_needed} responses so far; the server holds the report until then.{:else}The {first.label.toLowerCase()} survey has {phoneN} answers; we show a perspective at {MIN_RESPONSES} or more so no one can be picked out.{/if}</span></Stack>
      </div>
      {#if escape}<a class="link" href={href("results")}>{without} <Glyph d={G.arrow} /></a>{/if}
      <a class="link" href={href("results-answers")}>See the answers so far <Glyph d={G.arrow} /></a>
    </Card>
  {:else}
    <Page gap={5}>
      <ReviewHead review={D.review} responses={H.review.closedResponses} {primary} />
      <LevelLegend />
      <Card hi pad="hero" gap={3} label="Results are held">
        <Row split gap={6}>
          <Row gap={6}>
            <span class="icn" data-size="64" data-lens="team"><Glyph d={G.lock} size={30} /></span>
            <Stack gap={2}>
              <h2 class="h2 t-24">{srv ? "Results are held until enough answers are in" : "Results are held until every perspective has enough answers"}</h2>
              <p class="small t-15">{#if srv}The server holds this report: {srv.responses_in} of {srv.responses_needed} responses so far{srv.reason ? ` (${srv.reason})` : ""}. {collecting ? "Collection is still open: share the links and come back." : "Keep collecting."}{:else}Levels need at least {MIN_RESPONSES} answers from a perspective so no one can be picked out. {first.label} has {first.n} of {MIN_RESPONSES}. Keep collecting, or go on without the {first.label.toLowerCase()} perspective.{/if}</p>
              <Row wrap gap={5}>{#each lines as l}<span class="small"><LensDot lens={l.lens} decorative /> {l.text}</span>{/each}</Row>
            </Stack>
          </Row>
          <Stack gap={2}><Button label={primary.label} href={primary.href} lead={qr} />{#if escape}<Button label={without} variant="quiet" href={href("results")} />{/if}</Stack>
        </Row>
      </Card>
      <div class="l-grid" data-cols="3" data-gap="4" data-state="held" inert>{#each cards as card (card.lens)}<Stack><LensCard {card} rows={H.preview} /></Stack>{/each}</div>
    </Page>
  {/if}
</AppShell></div>
