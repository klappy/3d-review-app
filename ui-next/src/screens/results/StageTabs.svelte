<!-- UI Next (v4) results lane: review-stage tabs. Status: provisional. Contract: design-system.md section 2 "Stepper / tabs"
     (.tabs > .tab + .dot.done / .now, R17) and 8.4 (phase-tabs: Page, first child above Sections). Boards: Results.dc.html (desktop:
     done dots, "3", "Now"); ResultsPhone.dc.html (phone: labels only). The phone board's compact tab (40px, --t-13) is drawn inline:
     a canvas gap (RESULTS-results.md), so the phone twin uses the contract tab. Current stage: Understand. -->
<script>
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  let { phone = false, current = "understand" } = $props();
  const TABS = [["prepare", "Prepare", "#setup"], ["collect", "Collect", "#collect"], ["understand", "Understand", "?screen=results"], ["improve", "Improve", "#next-step"]];
  const at = $derived(TABS.findIndex((t) => t[0] === current));
  if (!TABS.some((t) => t[0] === current)) throw new TypeError(`StageTabs: unknown stage "${String(current)}"`);
</script>

<nav class="glass tabs" aria-label="Review stages">
  {#each TABS as [id, label, href], i}
    <a class="tab" href={phone && id === "understand" ? `${href}&w=phone` : href} aria-current={i === at ? "page" : undefined}>
      {#if !phone}<span class={i < at ? "dot done" : "dot"}>{#if i < at}<Glyph d={G.check} size={13} stroke={2.5} />{:else}{i + 1}{/if}</span>{/if}{label}{#if !phone && i === at}<span class="now">Now</span>{/if}
    </a>
  {/each}
</nav>
