<!-- UI Next (v4) review head for the actions lane: page head (title, Stage pill, optional practice Tag, meta line, ⋯ menu, one action)
     plus the review phase tabs, desktop and phone. Lane-local (screens fanout brief rule 2): the boards draw it inline
     (generator boards_fac.py review head, boards_fphone.py rhead() and phase_tabs()); a shared review-head waits on the canvas.
     Tabs follow what the boards draw today: nav.glass.tabs > a.tab with aria-current=page on the viewed phase, .dot / .dot.done, .now
     on the live phase (design-system.md "Tab states" R17: tablist roles and .tabs.compact are "not drawn yet"). Status: provisional. -->
<script module>
  export const PHASES = Object.freeze([["prepare", "Prepare"], ["collect", "Collect"], ["understand", "Understand"], ["improve", "Improve"]]);
</script>
<script>
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import Pill from "../../Pill.svelte";
  import Tag from "../../Tag.svelte";
  import Button from "../../Button.svelte";
  import Menu from "../../Menu.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";

  let { phone = false, title, project, projectHref = "#project", stage, practice = false, meta, viewed, live, done = [], links = {}, menu = [], menuHref = "#more", action } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("ReviewHead: title is required");
  const KEYS = PHASES.map(([k]) => k);
  if (!KEYS.includes(viewed) || !KEYS.includes(live)) throw new TypeError("ReviewHead: viewed and live are phases (prepare | collect | understand | improve)");
  if (action && !phone && !(typeof action.label === "string" && action.label.trim())) throw new TypeError("ReviewHead: the head action needs a label");
</script>

{#snippet dots()}<Ico d={A.dots} size={20} />{/snippet}
<!-- The ⋯ summary: type.css ".app details > summary{width:max-content}" outranks .btn-icon's 44px width, so the glyph's own box is drawn
     42px wide (viewBox padded) to keep the 44px target until the shared rule learns .btn-icon (app-line miss, RESULTS-actions). -->
{#snippet dotsWide()}<svg width="42" height="20" viewBox="-12 0 48 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d={A.dots}></path></svg>{/snippet}
{#snippet lead()}<Ico d={A[action.lead]} />{/snippet}
{#snippet trail()}<Ico d={A[action.trail]} />{/snippet}
{#snippet check()}<Ico d={A.check} size={14} />{/snippet}

{#if phone}
  <Stack gap={1}>
    <a class="link small" href={projectHref}>{project}</a>
    <Row split gap={2}><h1 class="title-phone">{title}</h1><Row gap={2}><Pill {stage} /><Button icon={dots} ariaLabel="More actions" variant="quiet" href={menuHref} /></Row></Row>
  </Stack>
  <nav class="glass tabs" aria-label="Review phases">
    {#each PHASES as [k, label]}<a class="tab" href={links[k] ?? `#${k}`} aria-current={k === viewed ? "page" : undefined}>{label}</a>{/each}
  </nav>
{:else}
  <Stack gap={2}>
    <Row split gap={5}>
      <Row wrap gap={3}><h1 class="title-page">{title}</h1><Pill {stage} />{#if practice}<Tag kind="practice" />{/if}</Row>
      <Row gap={2}>
        {#if menu.length}<Menu id="review-more" summary={dotsWide} summaryClass="btn btn-icon" label="More actions" title="More actions" items={menu} />{/if}
        {#if action}<Button label={action.label} variant={action.variant ?? "secondary"} href={action.href} lead={action.lead ? lead : undefined} trail={action.trail ? trail : undefined} />{/if}
      </Row>
    </Row>
    {#if meta}<p class="small t-15">{@render meta()}</p>{/if}
  </Stack>
  <nav class="glass tabs" aria-label="Review stages">
    {#each PHASES as [k, label], i}
      <a class="tab" href={links[k] ?? `#${k}`} aria-current={k === viewed ? "page" : undefined}>
        {#if done.includes(k)}<span class="dot done">{@render check()}</span>{:else}<span class="dot">{i + 1}</span>{/if}{label}{#if k === live}<span class="now">Now</span>{/if}
      </a>
    {/each}
  </nav>
{/if}
