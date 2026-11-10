<!-- UI Next (v4) results lane: numeric barbell, detailed report only (design-system.md section 2 "Lens dot / barbell": 0-100 axis +
     value labels; R18: --b-urgent span at two bands apart or more, else the quiet span). Status: provisional.
     Board: ReportDetailed.dc.html ("The biggest tensions", "All areas compared"). Paper sheet contents (design-system.md §8.11 row):
     .score-track > span.score-line, span.score-band[data-wide], span.score-val per value, span.pt per perspective; only the
     value-driven left/width % are inline (§8.11 Data geometry). Dots, span and gap come from ./data.js scoreRows: placed perspectives
     only (a perspective under the minimum has none, R3-1); positions are the exact scores. -->
<script>
  import { withNotes, gapLead, fmtScore } from "./data.js";
  let { row } = $props();
</script>

<div class="score-track" role="group" aria-label={`${row.name}: ${withNotes(gapLead(row), row)}`}>
  <span class="score-line"></span><span class="score-band" data-wide={row.alarm ? "" : undefined} style:left={`${row.from}%`} style:width={`${row.to - row.from}%`}></span>
  {#each row.dots as d}<span aria-hidden="true" class="score-val" style:left={`${d.score}%`}>{fmtScore(d.score)}</span>{/each}
  {#each row.dots as d}<span class="pt" data-lens={d.lens} style:left={`${d.score}%`} role="img" aria-label={`${d.label} ${fmtScore(d.score)}`} title={`${d.label} ${fmtScore(d.score)}`}></span>{/each}
</div>
