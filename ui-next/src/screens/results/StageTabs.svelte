<!-- UI Next (v4) results lane: review-stage tabs. Status: provisional. Contract: design-system.md section 2 "Stepper / tabs"
     (.tabs > .tab + .dot.done / .now, R17) and 8.4 (phase-tabs: Page, first child above Sections). Boards: Results.dc.html (desktop:
     done dots, "3", "Now"); ResultsPhone.dc.html (phone: labels only, the compact tab row 8.7 "Phone tabs" under .app[data-w=phone]).
     Destinations as the boards link them: Prepare Setup5, Collect Collect, Understand Results, Improve NextStep. Current stage: Understand. -->
<script>
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import { out } from "./links.js";
  let { phone = false, current = "understand" } = $props();
  const TABS = [["prepare", "Prepare", out("setup5")], ["collect", "Collect", out("collect")], ["understand", "Understand", href("results")], ["improve", "Improve", out("nextStep")]];
  const at = $derived(TABS.findIndex((t) => t[0] === current));
  if (!TABS.some((t) => t[0] === current)) throw new TypeError(`StageTabs: unknown stage "${String(current)}"`);
</script>

<nav class="glass tabs" aria-label="Review stages">
  {#each TABS as [id, label, to], i (id)}
    <a class="tab" href={to} aria-current={i === at ? "page" : undefined}>
      {#if !phone}<span class={i < at ? "dot done" : "dot"}>{#if i < at}<Glyph d={G.check} size={13} stroke={2.5} />{:else}{i + 1}{/if}</span>{/if}{label}{#if !phone && i === at}<span class="now">Now</span>{/if}
    </a>
  {/each}
</nav>
