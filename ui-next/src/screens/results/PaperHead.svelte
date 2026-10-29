<!-- UI Next (v4) results lane: report sheet head (Report.dc.html, ReportDetailed.dc.html page 1). Paper sheet contents (design-system.md
     §8.11 row, provisional): .paper-title-row (flex, space-between, start) > the title and meta (.paper-title, .sheet-meta) with the 40px
     brand mark at the top right; then .sheet-tiles (three columns, gap 14) > one .sheet-tile[data-lens] per perspective: its name
     (.sheet-tile-name), the coverage cue (drops + count, Coverage.svelte) and its level (.sheet-tile-level). The title keeps its heading
     role (role=heading, level 1) on the board's div. No inline type or spacing. Paper scope (design-system.md 1.3). Status: provisional. -->
<script>
  import Level from "../../Level.svelte";
  import Mark from "../../Mark.svelte";
  import Coverage from "./Coverage.svelte";
  import { snapshotTotal } from "./data.js";
  let { review, cards, kind } = $props();
</script>

<div class="paper-title-row">
  <div>
    <div class="paper-title" role="heading" aria-level="1">{review.title}</div>
    <div class="sheet-meta">{review.project} · {review.language} · 3D Review {kind} · {review.closedLong ? `closed ${review.closedLong}` : "collection closed"} · {snapshotTotal(cards)} responses</div><!-- the report's own total: the sum of the counts below -->
  </div>
  <Mark size={40} />
</div>
<div class="sheet-tiles">
  {#each cards as c (c.lens)}<div class="sheet-tile" data-lens={c.lens}><div class="sheet-tile-name">{c.label}</div><Coverage n={c.n} /><div class="sheet-tile-level"><Level level={c.level} /></div></div>{/each}
</div>
