<!-- UI Next (v4) results lane: band barbell (design-system.md section 2 "Lens dot / barbell": four-band axis, one point per perspective,
     span at two bands apart or more; "Barbell and radar rules" R18 short band words). Status: provisional.
     Boards: ResultsGaps.dc.html / ResultsGapsPhone.dc.html (card: a 60px box, axis at 30, 24px points, band words hanging 6px below
     the box, so the svg is overflow="visible") and Report.dc.html (paper: the board's own spans, below).
     On a card the app draws the geometry as SVG presentation attributes (no inline style), points at band centres from ./data.js bandRow. A perspective under the minimum responses has no band, so
     bandRow gives it no dot (never an unplaced point); the verdict line names it ("Church more input needed"), and so does the
     group's aria-label. Colours are tokens (paper scope keeps them light).
     Q11 (design-system.md Band-barbell label row): div.band-axis > div.band-track (base.css: 40px on screen, 32px in .paper; holds the
     line, separators, span and dots as SVG at 100% of the track) + div.band-labels[aria-hidden] with the four FULL level words in
     glossary order, one per quarter, wrapping freely (no SVG text, no short forms, no inline style). -->
<script>
  import { BANDS, LEVEL_WORD, withNotes } from "./data.js";
  let { row, size = "card" } = $props();
  if (size !== "card" && size !== "paper") throw new TypeError(`BandBar: size must be card or paper, got ${String(size)}`);
  // Card track geometry in its own 40px box (axis at 20); the paper branch draws the board's spans instead.
  const g = { y: 20, tick: 7, pt: 12, ring: 1.5 };
  // Paper span: from the lowest to the highest placed band's centre (12.5 + 25 * band index), when they differ.
  const paperSpan = $derived.by(() => {
    const idx = row.dots.map((d) => BANDS.indexOf(d.level)).filter((i) => i >= 0);
    if (row.apart < 1 || idx.length < 2) return null;
    const lo = Math.min(...idx), hi = Math.max(...idx);
    return { left: 12.5 + 25 * lo, width: 25 * (hi - lo) };
  });
</script>

{#if size === "paper"}
<!-- Paper (design-system.md:861 Paper sheet contents @697c974d): .band-track > span.band-line, span.band-sep, span.band-span[data-wide],
     .pt as the board draws them; only the value-driven left/width % are inline (§8.11 Data geometry). The span joins the outermost
     bands' centres when the perspectives sit apart (red at two bands or more, quiet at one), as the board's paper barbell does. -->
<div class="band-axis">
  <div class="band-track" role="group" aria-label={`${row.name}: ${withNotes(row.verdict, row)}`}>
    <span class="band-line"></span>{#each [25, 50, 75] as t}<span class="band-sep" style:left={`${t}%`}></span>{/each}
    {#if paperSpan}<span class="band-span" data-wide={row.apart >= 2 ? "" : undefined} style:left={`${paperSpan.left}%`} style:width={`${paperSpan.width}%`}></span>{/if}
    {#each row.dots as d}<span class="pt" data-lens={d.lens} style:left={`${d.x}%`} role="img" aria-label={`${d.label} · ${LEVEL_WORD[d.level]}`} title={`${d.label} · ${LEVEL_WORD[d.level]}`}></span>{/each}
  </div>
  <div class="band-labels" aria-hidden="true">{#each BANDS as b (b)}<span>{LEVEL_WORD[b]}</span>{/each}</div>
</div>
{:else}
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
{/if}
