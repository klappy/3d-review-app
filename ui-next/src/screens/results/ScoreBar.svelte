<!-- UI Next (v4) results lane: numeric barbell, detailed report only (design-system.md section 2 "Lens dot / barbell": 0-100 axis +
     value labels; R18: --b-urgent span at two bands apart or more, else a quiet --line-2 span). Status: provisional.
     Board: ReportDetailed.dc.html ("The biggest tensions", "All areas compared"); inline left/width there, SVG attributes here.
     Dots, span and gap come from ./data.js scoreRows: placed perspectives only (a perspective under the minimum has none, R3-1). -->
<script>
  import { withNotes, gapLead } from "./data.js";
  let { row } = $props();
</script>

<svg data-part="score-barbell" width="100%" height="40" overflow="visible" role="group" aria-label={`${row.name}: ${withNotes(gapLead(row), row)}`}>
  <rect x={`${row.from}%`} y="17" width={`${row.to - row.from}%`} height="6" rx="3" fill={row.alarm ? "var(--b-urgent)" : "var(--line-2)"} />
  {#each row.dots as d}<text x={`${d.score}%`} y="6" text-anchor="middle" font-size="var(--t-11)" font-weight="650" fill="var(--ink)" aria-hidden="true">{d.score}</text>{/each}
  {#each row.dots as d}
    <g role="img" aria-label={`${d.label} ${d.score}`} data-lens={d.lens}>
      <circle cx={`${d.score}%`} cy="20" r="9.5" fill="none" stroke="var(--line-2)" stroke-width="1" />
      <circle cx={`${d.score}%`} cy="20" r="7.5" fill="var(--lens)" stroke="var(--field)" stroke-width="3" />
    </g>
  {/each}
</svg>
