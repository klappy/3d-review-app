<!-- UI Next (v4) results lane: answer-share bar (.bar, base.css: 8px --line track, pill radius, overflow hidden).
     Boards ResultsAnswers.dc.html / ResultsAnswersPhone.dc.html fill it with an inline-width span; the app draws the fill as an SVG
     rect width (presentation attribute, no inline style) in the perspective's colour. Status: provisional. -->
<script>
  let { lens, pct } = $props();
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new TypeError(`AnswerBar: pct must be 0..100, got ${String(pct)}`);
</script>

<svg class="bar" data-lens={lens} width="100%" height="8" aria-hidden="true"><rect width={`${pct}%`} height="8" rx="4" fill="var(--lens)" /></svg>
