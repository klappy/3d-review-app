<!-- UI Next (v4) results lane: band barbell (design-system.md section 2 "Lens dot / barbell": four-band axis, one point per perspective,
     span at two bands apart or more; "Barbell and radar rules" R18 short band words). Status: provisional.
     Boards: ResultsGaps.dc.html / ResultsGapsPhone.dc.html (card: a 60px box, axis at 30, 24px points, band words hanging 6px below
     the box, so the svg is overflow="visible") and Report.dc.html (paper: 46px, 18px points).
     The boards position .pt and the span with inline left/width; the app draws the same geometry as SVG presentation attributes
     (no inline style), points at band centres from ./data.js bandRow. A perspective under the minimum responses has no band, so
     bandRow gives it no dot (never an unplaced point); the verdict line names it ("Church more input needed"), and so does the
     group's aria-label. Colours are tokens (paper scope keeps them light).
     Q11 (design-system.md Band-barbell label row): div.band-axis > div.band-track (base.css: 40px on screen, 32px in .paper; holds the
     line, separators, span and dots as SVG at 100% of the track) + div.band-labels[aria-hidden] with the four FULL level words in
     glossary order, one per quarter, wrapping freely (no SVG text, no short forms, no inline style). -->
<script>
  import { BANDS, LEVEL_WORD, withNotes } from "./data.js";
  let { row, size = "card" } = $props();
  if (size !== "card" && size !== "paper") throw new TypeError(`BandBar: size must be card or paper, got ${String(size)}`);
  // Track geometry in its own box: card 40px (axis at 20), paper 32px (axis at 16).
  const g = $derived(size === "card" ? { y: 20, tick: 7, pt: 12, ring: 1.5 } : { y: 16, tick: 6, pt: 9, ring: 1 });
</script>

<div class="band-axis">
  <div class="band-track">
    <svg data-part="band-barbell" width="100%" height="100%" overflow="visible" role="group" aria-label={`${row.name}: ${withNotes(row.verdict, row)}`}>
      <rect x="0" y={g.y - 1} width="100%" height="2" rx="1.5" fill="var(--line)" />
      {#each [25, 50, 75] as t}<rect x={`${t}%`} y={g.y - g.tick} width="1" height={2 * g.tick} fill="var(--line-2)" />{/each}
      {#if row.span}<rect x={`${row.span.from}%`} y={g.y - 3} width={`${row.span.to - row.span.from}%`} height="6" rx="3" fill="var(--b-urgent)" opacity=".8" />{/if}
      {#each row.dots as d}
        <g role="img" aria-label={`${d.label} · ${LEVEL_WORD[d.level]}`} data-lens={d.lens}>
          <circle cx={`${d.x}%`} cy={g.y} r={g.pt + g.ring / 2} fill="none" stroke="var(--line-2)" stroke-width={g.ring} />
          <circle cx={`${d.x}%`} cy={g.y} r={g.pt - 1.5} fill="var(--lens)" stroke="var(--field)" stroke-width="3" />
        </g>
      {/each}
    </svg>
  </div>
  <div class="band-labels" aria-hidden="true">{#each BANDS as b (b)}<span>{LEVEL_WORD[b]}</span>{/each}</div>
</div>
