<!-- UI Next (v4) collect lane progress bar. Status: provisional. Contract: base.css .bar (8px --line track, --radius-pill) filled in the
     survey's perspective colour (--lens, R15). The fill width is data (answered of expected, floored as the boards draw it), so it is an SVG
     rect width, never an inline style. Decorative: the "n of N" text beside it carries the value. -->
<script>
  import { pct } from "./model.js";
  let { value, max, lens } = $props();
  if (!["team", "community", "church"].includes(lens)) throw new TypeError(`Bar: lens must be team, community or church, got ${String(lens)}`);
  const w = $derived(`${pct(value, max)}%`);
</script>

<div class="bar" aria-hidden="true"><svg width="100%" height="100%" display="block" data-lens={lens}><rect width={w} height="100%" rx="4" fill="var(--lens)" /></svg></div>
