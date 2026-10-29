<!-- UI Next (v4) results lane: a perspective point used as a legend key ("Who each dot is", ResultsGaps.dc.html; report legends).
     Same skin as the barbell point (.pt: --lens fill, 3px --field edge, --line-2 ring), drawn as SVG at the board's legend size. -->
<script>
  let { lens, size = 18 } = $props();
  const r = $derived(size / 2);
</script>

<svg width={size + 2} height={size + 2} data-lens={lens} aria-hidden="true"><circle cx={r + 1} cy={r + 1} r={r + 0.5} fill="none" stroke="var(--line-2)" stroke-width="1" /><circle cx={r + 1} cy={r + 1} r={r - 1.5} fill="var(--lens)" stroke="var(--field)" stroke-width="3" /></svg>
