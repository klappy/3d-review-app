<!-- UI Next (v4) review head for the actions lane: page head (title, Stage pill, optional practice Tag, meta line, ⋯ menu, one action)
     plus the review phase tabs, desktop and phone. Lane-local (screens fanout brief rule 2): the boards draw it inline
     (generator boards_fac.py review head, boards_fphone.py rhead() and phase_tabs()); a shared review-head waits on the canvas.
     Tabs follow what the boards draw today: nav.glass.tabs > a.tab with aria-current=page on the viewed phase, .dot / .dot.done, .now
     on the live phase (design-system.md "Tab states" R17: tablist roles and .tabs.compact are "not drawn yet"); the phone row's 40px
     tabs are the pinned base.css phone .tabs row. Every link is the shared ../href.js href() with the screen's w/theme (./links.js):
     phase tabs Prepare setup5 · Collect collect · Understand results · Improve next-step; the phone ⋯ opens Collect's menu sheet
     (collect, state menu); the desktop ⋯ is the review menu below unless the screen passes its own. Status: provisional. -->
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
  import { href } from "../href.js";
  import { carry } from "./links.js";

  let { phone = false, theme = "light", title, project, stage, practice = false, meta, viewed, live, done = [], menu, deleteRefused, action, canClose = true } = $props(); // canClose: owners and members (viewers never see the close row — the stage write would be refused)
  if (!(typeof title === "string" && title.trim())) throw new TypeError("ReviewHead: title is required");
  const KEYS = PHASES.map(([k]) => k);
  if (!KEYS.includes(viewed) || !KEYS.includes(live)) throw new TypeError("ReviewHead: viewed and live are phases (prepare | collect | understand | improve)");
  if (action && !phone && !(typeof action.label === "string" && action.label.trim())) throw new TypeError("ReviewHead: the head action needs a label");
  if (!phone && menu === undefined && !(typeof deleteRefused === "string" && deleteRefused.trim())) throw new TypeError("ReviewHead: the review menu's refused delete says why (deleteRefused)");

  const at = $derived(carry(phone, theme));
  const tabs = $derived({ prepare: href("setup5", at), collect: href("collect", at), understand: href("results", at), improve: href("next-step", at) });
  // The review's ⋯ menu as the boards draw it (Print, Share, PaperEntry, NextStep): danger last after an hr, refused with its reason (R11).
  const reviewMenu = $derived([
    { label: "Edit details and dates", href: href("setup1", at), icon: A.pen },
    { label: "People with access", href: href("people", at), icon: A.people },
    ...(canClose ? [{ label: "Close collection now", href: href("close-collection", at), icon: A.lock }] : []),
    { label: "Meeting offline? Print and paper", href: `${href("collect", at)}#offline`, icon: A.print },
    { kind: "hr" },
    { label: "Delete this review", danger: true, icon: A.x, refused: deleteRefused },
  ]);
  const items = $derived(menu ?? reviewMenu);
</script>

{#snippet dots()}<Ico d={A.dots} size={20} />{/snippet}
{#snippet lead()}<Ico d={A[action.lead]} />{/snippet}
{#snippet trail()}<Ico d={A[action.trail]} />{/snippet}
{#snippet check()}<Ico d={A.check} size={14} />{/snippet}

{#if phone}
  <Stack gap={1}>
    <a class="link small" href={href("project", at)}>{project}</a>
    <Row split gap={2}><h1 class="title-phone">{title}</h1><Row gap={2}><Pill {stage} /><Button icon={dots} ariaLabel="More actions" variant="quiet" href={href("collect", { ...at, state: "menu" })} /></Row></Row>
  </Stack>
  <nav class="glass tabs" aria-label="Review phases">
    {#each PHASES as [k, label]}<a class="tab" href={tabs[k]} aria-current={k === viewed ? "page" : undefined}>{label}</a>{/each}
  </nav>
{:else}
  <Stack gap={2}>
    <Row split gap={5}>
      <Row wrap gap={3}><h1 class="title-page">{title}</h1><Pill {stage} />{#if practice}<Tag kind="practice" />{/if}</Row>
      <Row gap={2}>
        {#if items.length}<Menu id="review-more" summary={dots} summaryClass="btn btn-icon" label="More actions" title="More actions" {items} />{/if}
        {#if action}<Button label={action.label} variant={action.variant ?? "secondary"} href={action.href} lead={action.lead ? lead : undefined} trail={action.trail ? trail : undefined} />{/if}
      </Row>
    </Row>
    {#if meta}<p class="small t-15">{@render meta()}</p>{/if}
  </Stack>
  <nav class="glass tabs" aria-label="Review stages">
    {#each PHASES as [k, label], i}
      <a class="tab" href={tabs[k]} aria-current={k === viewed ? "page" : undefined}>
        {#if done.includes(k)}<span class="dot done">{@render check()}</span>{:else}<span class="dot">{i + 1}</span>{/if}{label}{#if k === live}<span class="now">Now</span>{/if}
      </a>
    {/each}
  </nav>
{/if}
