<!-- UI Next (v4) participant progress bar. Status: provisional. The boards' .bar > span (helmet .bar: 8px, pill radius, --line track)
     with a data width; the width is an SVG rect attribute, never an inline style (lint L4). role=progressbar names the value. -->
<script>
  let { value, max, label } = $props();
  if (!(Number.isFinite(value) && Number.isFinite(max) && max > 0)) throw new TypeError("ProgressBar: value and max must be numbers, max > 0");
  if (!(typeof label === "string" && label.trim())) throw new TypeError("ProgressBar: needs a label");
  const pct = $derived(Math.max(0, Math.min(100, (100 * value) / max)));
</script>

<svg class="bar" width="100%" height="8" role="progressbar" aria-valuemin="0" aria-valuemax={max} aria-valuenow={value} aria-label={label}><rect width={`${pct}%`} height="8" rx="4" fill="var(--primary)"></rect></svg>
