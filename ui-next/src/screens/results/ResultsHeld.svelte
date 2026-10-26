<!-- UI Next (v4) Results held screen. Status: provisional (playbook rule 12). ?screen=results-held (&w=phone).
     Boards: ResultsHeld.dc.html (desktop), ResultsHeldPhone.dc.html (phone). A perspective under the minimum
     (./data.js currentLevelMin: the server's level minimum, else the safe 3) holds the results; every level of that perspective is
     More input needed (v3ScoreBand), shown as a preview of the first rows, dimmed by the contract .l-grid[data-state=held] (8.11)
     and inert (the board marks it aria-hidden; inert also keeps its links out of the tab order). Hero: the 64px chip
     .icn[data-size="64"] and the --t-24 heading .h2.t-24 (contract rows); the held card is design-system.md §8.11
     "Held card" (base.css .glass-hi.held-card: 40px pad, grid auto 1fr auto; lines .l-row.held-lines; actions .l-stack). Any ?state= renders the default.
     One .btn-primary: desktop "Reopen collection" (review head); phone the phone-bar. Copy: the boards. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import LensDot from "../../LensDot.svelte";
  import Glyph from "./Glyph.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import LevelLegend from "./LevelLegend.svelte";
  import LensCard from "./LensCard.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import { out } from "./links.js";
  import { REPORT, currentLevelMin, lensCards, heldLines } from "./data.js";
  const MIN = currentLevelMin(), fromWords = MIN === 1 ? "its first answer" : `${MIN} answers`;

  // report (live): { review, counts, payload } with too few responses in some perspective; default the fixture's held state.
  // onreopen (live): moves the review back to Collect (setStage) before Share, so the links the page asks people to use are open.
  // The shared Button takes no click handler (Setup5's launching pattern): every "Reopen collection" link is intercepted here.
  const reopening = (el) => { const f = (e) => { if (onreopen && e.target instanceof Element && e.target.closest(`a[href="${out("share")}"]`)) { e.preventDefault(); onreopen(); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
  let { onreopen, phone = false, theme = "light", report } = $props();
  const D = report ?? REPORT.desktop, H = report ? { counts: report.counts, phoneCounts: report.counts, preview: REPORT.held.preview, review: { closedResponses: report.review.responses } } : REPORT.held, P = report ?? REPORT.phone;
  // The held preview shows the collection as it stands (H.counts, the live survey counts), not a built report's snapshot.
  const cards = lensCards(D.payload ?? { lenses: [] }, H.counts, { prefer: "live", sent: report?.sent });
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
  // Reopening sets the stage (owner/member, src/handlers/assessment.ts): a viewer sees the primary disabled with the reason; the
  // response list is owner/member too, so a viewer gets no "See the answers so far" (the fixture: everyone).
  const canReopen = $derived(!report || report.review?.canReopen !== false);
  const canRead = $derived(!report || report.review?.canReadResponses !== false);
  const WHY = "Only an owner or member of the review can reopen collection.";
  const primary = $derived(collecting ? { label: "Back to Collect", href: out("collect"), lead: "qr" } : canReopen ? { label: "Reopen collection", href: out("share"), lead: "qr" } : { label: "Reopen collection", lead: "qr", disabled: true, why: WHY });
</script>

{#snippet qr()}<Glyph d={G.qr} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title={P.review.title} parent={P.review.project} back={out("project")} menuHref={out("menu")} />{:else}<TopBar {crumbs} home={out("workspace")} />{/if}{/snippet}
<!-- The phone bar is PhoneBar's markup with the board's QR lead (PhoneBar takes a plus/arrow lead only), as collect/ReviewFrame.svelte does. -->
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label={primary.label} variant="primary" lg href={primary.disabled ? undefined : primary.href} disabled={!!primary.disabled} ariaDescribedby={primary.disabled ? "reopen-why" : undefined} lead={qr} /></div>{/if}{/snippet}

<div class="l-stack" {@attach reopening}><AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead review={{ ...P.review, stage: "closed" }} phone />
    <Card gap={3} label="Results are held">
      <div class="l-row" data-gap="3" data-align="start">
        <span class="icn icn-lens" data-lens={first.lens}><Glyph d={G.clock} /></span>
        <Stack gap={1}><span class="h3">Results are held</span><span class="small">{#if srv}{srv.responses_in} of {srv.responses_needed} responses so far; the server holds the report until then.{:else}The {first.label.toLowerCase()} survey has {phoneN} answers; a perspective shows its level from {fromWords}.{/if}</span></Stack>
      </div>
      {#if escape}<a class="link" href={href("results")}>{without} <Glyph d={G.arrow} /></a>{/if}
      {#if canRead}<a class="link" href={href("results-answers")}>See the answers so far <Glyph d={G.arrow} /></a>{/if}
      {#if primary.disabled}<p class="small" id="reopen-why">{primary.why}</p>{/if}
    </Card>
  {:else}
    <Page gap={5}>
      <ReviewHead review={D.review} responses={H.review.closedResponses} {primary} />
      <LevelLegend />
      <section class="glass-hi held-card" aria-label="Results are held">
        <span class="icn" data-size="64" data-lens="team"><Glyph d={G.lock} size={30} /></span>
        <div class="l-stack" data-gap="2">
          <h2 class="h2 t-24">{srv ? "Results are held until enough answers are in" : "Results are held until every perspective has enough answers"}</h2>
          <p class="small t-15">{#if srv}The server holds this report: {srv.responses_in} of {srv.responses_needed} responses so far{srv.reason ? ` (${srv.reason})` : ""}. {collecting ? "Collection is still open: share the links and come back." : "Keep collecting."}{:else}Levels need at least {MIN} {MIN === 1 ? "answer" : "answers"} from a perspective. {first.label} has {first.n} of {MIN}. Keep collecting, or go on without the {first.label.toLowerCase()} perspective.{/if}</p>
          <div class="l-row held-lines" data-gap="5" data-wrap>{#each lines as l}<span class="small"><LensDot lens={l.lens} decorative /> {l.text}</span>{/each}</div>
        </div>
        <div class="l-stack" data-gap="2">{#if primary.disabled}<Button label={primary.label} lead={qr} disabled ariaDescribedby="primary-why" />{:else}<Button label={primary.label} href={primary.href} lead={qr} />{/if}{#if escape}<Button label={without} variant="quiet" href={href("results")} />{/if}</div>
      </section>
      <div class="l-grid" data-cols="3" data-gap="4" data-state="held" inert>{#each cards as card (card.lens)}<Stack><LensCard {card} rows={H.preview} /></Stack>{/each}</div>
    </Page>
  {/if}
</AppShell></div>
