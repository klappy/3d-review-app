<!-- UI Next (v4) actions-lane mini barbell: one gap row of NextStep ("Where the perspectives disagree"): band axis with quarter ticks,
     the span between the outer points (--b-urgent when the gap is wide, --line-2 otherwise) and one point per perspective (--lens on a
     --field ring with a --line-2 edge), as the board draws it inline. Drawn as SVG so positions are attributes (no inline style); full
     barbell geometry is V-39 (not ported), so this stays lane-local and decorative-with-a-name (role img). Status: provisional. -->
<script>
  import { LENSES } from "../../LensDot.svelte";
  let { pts, span, wide = false, w = 184 } = $props();
  if (!Array.isArray(pts) || !pts.length) throw new TypeError("GapBar: pts is [[lens, pct, level words], ...]");
  const name = $derived(pts.map(([lens, , words]) => `${LENSES[lens]} · ${words}`).join(", "));
</script>

<svg width={w} height="28" role="img" aria-label={name}>
  <rect x="0" y="13" width="100%" height="2" rx="1" fill="var(--line)"></rect>
  {#each [25, 50, 75] as t}<rect x={`${t}%`} y="8" width="1" height="12" fill="var(--line-2)"></rect>{/each}
  <rect x={`${span[0]}%`} y="11" width={`${span[1] - span[0]}%`} height="6" rx="3" fill={wide ? "var(--b-urgent)" : "var(--line-2)"}></rect>
  {#each pts as [lens, pct]}
    <circle cx={`${pct}%`} cy="14" r="9.75" fill="var(--line-2)"></circle>
    <circle cx={`${pct}%`} cy="14" r="9" fill="var(--field)"></circle>
    <circle data-lens={lens} cx={`${pct}%`} cy="14" r="6" fill="var(--lens)"></circle>
  {/each}
</svg>
