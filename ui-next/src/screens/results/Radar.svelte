<!-- UI Next (v4) results lane: radar, detailed report only (design-system.md section 2 Radar row + R18: inline SVG, shared areas as
     spokes, one polygon per perspective, 2px strokes, markers >= 8px, wrapping labels; a perspective not asked about an area has no
     point on that spoke). Status: provisional. Board: ReportDetailed.dc.html (420 x 370, rings at 25/50/75/100).
     Outline (design-system.md "The skipped spoke", V-29): a closed polygon only when the perspective scored every spoke; otherwise one
     open line per run of adjacent scored spokes (wrapping past the last), so nothing is drawn across a skipped spoke, and a lone
     scored spoke is a marker only (as ui/report-radar.js). ReportDetailed names each skip under the chart.
     Geometry from ./data.js radar() over ui/report-radar.js radarModel + wrap; colours are tokens (paper scope). Only placed
     scores reach the model: a perspective under the minimum responses has no polygon, point or <title> (validator R3-1). -->
<script>
  import { fmtScore } from "./data.js";
  let { model } = $props();
</script>

<svg width="420" height="370" viewBox="0 0 420 370" overflow="visible" role="img" aria-label={`Radar of ${model.legend.map((l) => l.label).join(", ")} across ${model.spokes.length} shared areas`}>
  {#each model.rings as points}<polygon {points} fill="none" stroke="var(--line)" stroke-width="1" />{/each}
  {#each model.spokes as s}<line x1="210" y1="185" x2={s.x} y2={s.y} stroke="var(--line)" />{/each}
  {#each model.lenses as l}
    {#if l.closed}<polygon data-lens={l.lens} points={l.points} fill="var(--lens)" fill-opacity=".12" stroke="var(--lens)" stroke-width="2" stroke-linejoin="round" />
    {:else}{#each l.runs as points}<polyline data-lens={l.lens} {points} fill="none" stroke="var(--lens)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />{/each}{/if}
    {#each l.marks as m}<circle data-lens={l.lens} cx={m.xy[0]} cy={m.xy[1]} r="4.5" fill="var(--lens)" stroke="var(--field)" stroke-width="2"><title>{l.label} · {m.area} · {fmtScore(m.score)}</title></circle>{/each}
  {/each}
  {#each model.spokes as s}
    <text x={s.lx} y={s.ly} font-size="var(--t-11)" fill="var(--ink-2)" text-anchor={s.anchor} dominant-baseline="middle">{#each s.lines as line, i}<tspan x={s.lx} dy={i === 0 ? 0 : 13}>{line}</tspan>{/each}</text>
  {/each}
</svg>
