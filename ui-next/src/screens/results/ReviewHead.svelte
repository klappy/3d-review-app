<!-- UI Next (v4) results lane: review head (design-system.md 9 review-head, 8.4 Page first child). Status: provisional.
     Desktop (Results.dc.html, ResultsAnswers/Gaps/Held.dc.html): title + stage pill, meta line, More actions menu (details.dd, R11:
     the refused delete is a button[aria-disabled] with its reason), the page's one primary, then the stage tabs.
     Phone (ResultsPhone and twins): project link, title + pill + quiet More actions, then the stage tabs; the primary is the phone-bar's.
     linkGap: the --sp step under the project link (ResultsPhone draws that link as a 44px target with an inline min-height, so it passes 5). -->
<script>
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import Button from "../../Button.svelte";
  import Menu from "../../Menu.svelte";
  import { I } from "../../icons.js";
  import Glyph from "./Glyph.svelte";
  import StagePill from "./StagePill.svelte";
  import StageTabs from "./StageTabs.svelte";
  import { G } from "./icons.js";
  let { review, phone = false, primary, closedResponses, linkGap = 2 } = $props();
  if (!review || typeof review.title !== "string") throw new TypeError("ReviewHead: review.title is required");
  if (!phone && !(primary && primary.label)) throw new TypeError("ReviewHead: the desktop head holds the page's one primary");
  const n = $derived(closedResponses ?? review.responses);
  const MORE = $derived([
    { label: "Edit details and dates", href: "#setup", icon: G.edit },
    { label: "People with access", href: "#people", icon: G.people },
    { label: "Close collection now", href: "#close-collection", icon: G.lock },
    { label: "Meeting offline? Print and paper", href: "#collect-offline", icon: G.print },
    { kind: "hr" },
    { label: "Delete this review", icon: I.x, danger: true, refused: `Reviews with responses can't be deleted. This one has ${review.responses}.` },
  ]);
</script>

{#snippet dots()}<Glyph d={G.more} size={20} />{/snippet}
<!-- summary.btn.btn-icon: type.css `.app details > summary{width:max-content}` outranks .btn-icon width (app-line miss, RESULTS-results.md),
     so the menu summary carries its glyph in the 40px .icn box to keep the 44px target. -->
{#snippet more()}<span class="icn icn-lens"><Glyph d={G.more} size={20} /></span>{/snippet}
{#snippet lead()}{#if primary?.lead}<Glyph d={G[primary.lead]} />{/if}{/snippet}
{#snippet trail()}{#if primary?.trail}<Glyph d={G[primary.trail]} />{/if}{/snippet}

{#if phone}
  <Stack gap={linkGap}>
    <a class="link small" href="#project">{review.project}</a>
    <Row split gap={2}>
      <h1 class="title-phone">{review.title}</h1>
      <Row gap={2}><StagePill stage={review.stage} /><Button icon={dots} ariaLabel="More actions" variant="quiet" href="#collect-menu" /></Row>
    </Row>
  </Stack>
  <StageTabs phone />
{:else}
  <Row split gap={5}>
    <Stack gap={2}>
      <Row gap={3}><h1 class="title-page">{review.title}</h1><StagePill stage={review.stage} /></Row>
      <p class="small t-15">{review.project} · {review.language} · {review.modality} · Closed {review.closed} · {n} responses</p>
    </Stack>
    <Row gap={2}>
      <Menu id="more" summary={more} summaryClass="btn btn-icon" label="More actions" title="More actions" items={MORE} />
      <Button label={primary.label} variant="primary" href={primary.href} lead={primary.lead ? lead : undefined} trail={primary.trail ? trail : undefined} />
    </Row>
  </Row>
  <StageTabs />
{/if}
