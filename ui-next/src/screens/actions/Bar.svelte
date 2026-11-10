<!-- UI Next (v4) actions-lane progress bar: base.css .bar (8px --line track, pill radius, overflow hidden) with the fill drawn as an
     SVG rect, so the percentage is an attribute, never an inline width (lint 8.6 L4). lens colours the fill (--lens); w is the SVG width
     attribute (a number in px inside a Row, where .bar has no track width). display="block" (an SVG presentation attribute, not a style)
     takes the svg off the text baseline: inline, it sat 9px down and the 8px overflow:hidden track clipped the whole fill. Status: provisional. -->
<script>
  let { pct, lens, label, w = "100%" } = $props();
  if (!(typeof pct === "number" && pct >= 0 && pct <= 100)) throw new TypeError("Bar: pct is a number 0..100");
  if (!["team", "community", "church"].includes(lens)) throw new TypeError("Bar: lens must be team, community or church");
</script>

<div class="bar" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}><svg width={w} height="8" display="block" aria-hidden="true"><rect data-lens={lens} width={`${pct}%`} height="8" fill="var(--lens)"></rect></svg></div>
