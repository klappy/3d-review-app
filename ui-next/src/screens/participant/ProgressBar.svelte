<!-- UI Next (v4) participant progress bar. Status: provisional. The boards' .bar > span (helmet .bar: 8px, pill radius, --line track)
     with a data width; the width is an SVG rect attribute, never an inline style (lint L4).
     Default: role=progressbar with its value, max and label (the question line). decorative: aria-hidden, no role; the caller puts the
     words beside it as the live text (PProblemBusy: the retry line is a role=status, the bar only draws attempt of attempts). -->
<script>
  let { value, max, label, decorative = false } = $props();
  if (!(Number.isFinite(value) && Number.isFinite(max) && max > 0)) throw new TypeError("ProgressBar: value and max must be numbers, max > 0");
  if (!decorative && !(typeof label === "string" && label.trim())) throw new TypeError("ProgressBar: needs a label (or decorative)");
  if (decorative && label !== undefined) throw new TypeError("ProgressBar: a decorative bar takes no label (the text beside it is the label)");
  const pct = $derived(Math.max(0, Math.min(100, (100 * value) / max)));
</script>

{#if decorative}<svg class="bar" width="100%" height="8" aria-hidden="true"><rect width={`${pct}%`} height="8" rx="4" fill="var(--primary)"></rect></svg>
{:else}<svg class="bar" width="100%" height="8" role="progressbar" aria-valuemin="0" aria-valuemax={max} aria-valuenow={value} aria-label={label}><rect width={`${pct}%`} height="8" rx="4" fill="var(--primary)"></rect></svg>{/if}
