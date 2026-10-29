<!-- UI Next (v4) results lane: review head (design-system.md 9 review-head, 8.4 Page first child). Status: provisional.
     Desktop (Results.dc.html, ResultsAnswers/Gaps/Held.dc.html): title + stage pill, meta line, More actions menu (details.dd, R11:
     the refused delete is a button[aria-disabled] with its reason), the page's one primary, then the stage tabs. The head row is
     .l-row[data-align=start] (8.7 Collect lane rows): the buttons sit at the top of the title block, as the boards draw them.
     Phone (ResultsPhone and twins): project link, title + pill + quiet More actions (the collect menu sheet), then the stage tabs;
     the primary is the phone-bar's.
     hit: the project link is the page's only way up (ResultsPhone, a root-state phase page): a.link.small.crumb-hit, the 44px target
     (design-system.md §9 root header, base.css .crumb-hit; boards_fphone rhead(hit=True)), in a column with no gap, so the 44px box,
     not extra space, separates link and title. Off: the nested phone boards' gap 4 (--sp-1) under a plain link.
     responses: the count the meta line and the refused delete both say (default review.responses; ResultsHeld passes its closed count). -->
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
  import { out } from "./links.js";
  let { review, phone = false, primary, responses, hit = false } = $props();
  const collecting = $derived((review.stage ?? "") === "collecting"); // the close action exists only while collecting: from understand/improve the write would move the review backwards (Codex P1 on 26a86937)
  if (!review || typeof review.title !== "string") throw new TypeError("ReviewHead: review.title is required");
  if (!phone && !(primary && primary.label)) throw new TypeError("ReviewHead: the desktop head holds the page's one primary");
  const n = $derived(responses ?? review.responses);
  const MORE = $derived([
    { label: "Edit details and dates", href: out("setup1"), icon: G.edit },
    { label: "People with access", href: out("people"), icon: G.people },
    ...(collecting ? [{ label: "Close collection now", href: out("closeCollection"), icon: G.lock }] : []),
    { label: "Meeting offline? Print and paper", href: out("collect", {}, "offline"), icon: G.print },
    { kind: "hr" },
    { label: "Delete this review", icon: I.x, danger: true, refused: `Reviews with responses can't be deleted. This one has ${review.liveResponses ?? n}.` },
  ]);
</script>

{#snippet dots()}<Glyph d={G.more} size={20} />{/snippet}
{#snippet lead()}{#if primary?.lead}<Glyph d={G[primary.lead]} />{/if}{/snippet}
{#snippet trail()}{#if primary?.trail}<Glyph d={G[primary.trail]} />{/if}{/snippet}

{#if phone}
  {#snippet titleRow()}
    <Row split gap={2}>
      <h1 class="title-phone">{review.title}</h1>
      <Row gap={2}><StagePill stage={review.stage} /><Button icon={dots} ariaLabel="More actions" variant="quiet" href={out("collect", { state: "menu" })} /></Row>
    </Row>
  {/snippet}
  <!-- hit: a plain block column, so no inherited --g gap: the 44px .crumb-hit box alone separates link and title (gap 0) -->
  {#if hit}<div><a class="link small crumb-hit" href={out("project")}>{review.project}</a>{@render titleRow()}</div>
  {:else}<Stack gap={1}><a class="link small" href={out("project")}>{review.project}</a>{@render titleRow()}</Stack>{/if}
  <StageTabs phone />
{:else}
  <div class="l-row" data-gap="5" data-split data-align="start">
    <Stack gap={2}>
      <Row gap={3}><h1 class="title-page">{review.title}</h1><StagePill stage={review.stage} /></Row>
      <p class="small t-15">{review.project} · {review.language} · {review.modality} · {review.stage === "collecting" ? "Collecting" : review.closed ? `Closed ${review.closed}` : "Collection closed"} · {n} responses</p>
    </Stack>
    <Row gap={2}>
      <Menu id="more" summary={dots} summaryClass="btn btn-icon" label="More actions" title="More actions" items={MORE} />
      {#if primary.disabled}<span class="small" id="primary-why">{primary.why}</span><Button label={primary.label} variant="primary" disabled ariaDescribedby="primary-why" lead={primary.lead ? lead : undefined} trail={primary.trail ? trail : undefined} />
      {:else}<Button label={primary.label} variant="primary" href={primary.href} lead={primary.lead ? lead : undefined} trail={primary.trail ? trail : undefined} />{/if}
    </Row>
  </div>
  <StageTabs />
{/if}
