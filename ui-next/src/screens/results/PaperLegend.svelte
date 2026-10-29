<!-- UI Next (v4) results lane: the report barbell key (Report.dc.html, ReportDetailed.dc.html). Paper sheet contents (design-system.md
     §8.11 row, provisional): .bb-legend > one .legend-item per perspective (i.bb-legend-dot[data-lens] + name), then .bb-legend-note. -->
<script>
  import { LENS_ORDER, lensLabel } from "./data.js";
</script>

<div class="bb-legend">{#each LENS_ORDER as lens}<span class="legend-item"><i class="bb-legend-dot" aria-hidden="true" data-lens={lens}></i>{lensLabel(lens)}</span>{/each}<span class="bb-legend-note">red line = two bands apart or more</span></div>
