<!-- UI Next (v4) results lane: coverage cue. Status: provisional (playbook rule 12). Quantity beside the Level's quality: a jar
     filled by how many people from this perspective answered, with the count in words. Low coverage reads "A few drops", never a
     hold (3d-review-cookbook work/active/2026-10-26-3d-report-threshold-coverage, REQ-0018). The jar outline is Level.svelte's
     jars skin; tiers are ./data.js coverageOf. Light DOM, no <style>, no inline style. -->
<script>
  import { coverageOf, responsesText } from "./data.js";
  let { n } = $props();
  const c = $derived(coverageOf(n));
  const H = [0, 3, 7, 12];
</script>

<span class="lvl-pair small" data-coverage={c.fill}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray={c.fill === 0 ? "2.5 2.5" : undefined} aria-hidden="true"><path d="M8 4h8"></path><path d="M7 7h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"></path>{#if H[c.fill]}<rect x="7" y={19 - H[c.fill]} width="10" height={H[c.fill]} fill="currentColor" opacity=".55"></rect>{/if}</svg>
  <span>{c.word ? `${c.word} · ` : ""}{responsesText(n)}</span>
</span>
