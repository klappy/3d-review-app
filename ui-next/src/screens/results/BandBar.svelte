<!-- UI Next (v4) results lane: band barbell (design-system.md section 2 "Lens dot / barbell": four-band axis, one point per perspective,
     span at two bands apart or more; "Barbell and radar rules" R18 short band words). Status: provisional.
     Boards: ResultsGaps.dc.html / ResultsGapsPhone.dc.html (card: a 60px box, axis at 30, 24px points, band words hanging 6px below
     the box, so the svg is overflow="visible") and Report.dc.html (paper: 46px, 18px points).
     The boards position .pt and the span with inline left/width; the app draws the same geometry as SVG presentation attributes
     (no inline style), points at band centres from ./data.js bandRow. Colours are tokens (paper scope keeps them light). -->
<script>
  import { BANDS, BAND_SHORT, LEVEL_WORD } from "./data.js";
  let { row, size = "card" } = $props();
  if (size !== "card" && size !== "paper") throw new TypeError(`BandBar: size must be card or paper, got ${String(size)}`);
  const g = $derived(size === "card" ? { h: 60, y: 30, tick: 7, pt: 12, ring: 1.5, label: 62 } : { h: 52, y: 20, tick: 6, pt: 9, ring: 1, label: 49 });
</script>

<svg data-part="band-barbell" width="100%" height={g.h} overflow="visible" role="group" aria-label={`${row.name}: ${row.verdict}`}>
  <rect x="0" y={g.y - 1} width="100%" height="2" rx="1.5" fill="var(--line)" />
  {#each [25, 50, 75] as t}<rect x={`${t}%`} y={g.y - g.tick} width="1" height={2 * g.tick} fill="var(--line-2)" />{/each}
  {#if row.span}<rect x={`${row.span.from}%`} y={g.y - 3} width={`${row.span.to - row.span.from}%`} height="6" rx="3" fill="var(--b-urgent)" opacity=".8" />{/if}
  {#each row.dots as d}
    <g role="img" aria-label={`${d.label} · ${LEVEL_WORD[d.level]}`} data-lens={d.lens}>
      <circle cx={`${d.x}%`} cy={g.y} r={g.pt + g.ring / 2} fill="none" stroke="var(--line-2)" stroke-width={g.ring} />
      <circle cx={`${d.x}%`} cy={g.y} r={g.pt - 1.5} fill="var(--lens)" stroke="var(--field)" stroke-width="3" />
    </g>
  {/each}
  {#each BANDS as b, i}<text x={`${12.5 + 25 * i}%`} y={g.label} text-anchor="middle" font-size="var(--t-11)" font-weight="550" fill="var(--ink-3)" aria-hidden="true">{BAND_SHORT[b]}</text>{/each}
</svg>
