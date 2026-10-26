<!-- UI Next (v4) results lane: coverage cue. Status: provisional (playbook rule 12). Quantity beside the Level's quality: three
     drops, filled by how many people from this perspective answered, with the count in words. Low coverage reads "A few drops", never
     a hold (3d-review-cookbook work/active/2026-10-26-3d-report-threshold-coverage, REQ-0018). Drops, not a jar: the Level's "Jars"
     imagery already draws a jar for quality, so the quantity cue does not reuse it. Tiers are ./data.js coverageOf.
     Placement: its own line under the perspective name (cards, report paper head). Light DOM, no <style>, no inline style. -->
<script>
  import { coverageOf, responsesText } from "./data.js";
  let { n } = $props();
  const c = $derived(coverageOf(n));
  const X = [5, 15, 25];
</script>

<span class="lvl-pair small" data-coverage={c.fill}>
  <svg width="22" height="18" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">{#each X as x, i (x)}<path d="M{x} 5c0 0-4 5.5-4 9a4 4 0 0 0 8 0c0-3.5-4-9-4-9z" fill={i < c.fill ? "currentColor" : "none"} stroke-dasharray={c.fill === 0 ? "2 2" : undefined}></path>{/each}</svg>
  <span>{c.word ? `${c.word} · ` : ""}{responsesText(n)}</span>
</span>
