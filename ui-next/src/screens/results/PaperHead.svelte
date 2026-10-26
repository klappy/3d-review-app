<!-- UI Next (v4) results lane: report sheet head (Report.dc.html, ReportDetailed.dc.html page 1): title and meta line with the 40px
     brand mark at the top right (.l-row[data-split][data-align=start], 8.1 + 8.7 rows: the board's flex space-between, flex-start), then
     one bordered perspective box per lens (accent bar from .l-card[data-lens]; .l-card[data-pad=bar] 12/16, the nearest contract pad to
     the board's 14px inline) with its coverage cue (drops + count, Coverage.svelte) and level. Paper scope (design-system.md 1.3). Status: provisional. -->
<script>
  import Stack from "../../Stack.svelte";
  import Grid from "../../Grid.svelte";
  import Level from "../../Level.svelte";
  import Mark from "../../Mark.svelte";
  import Coverage from "./Coverage.svelte";
  let { review, cards, kind } = $props();
</script>

<div class="l-row" data-gap="4" data-split data-align="start">
  <Stack gap={1}>
    <h1 class="title-page ptitle">{review.title}</h1>
    <p class="small">{review.project} · {review.language} · 3D Review {kind} · {review.closedLong ? `closed ${review.closedLong}` : "collection closed"} · {review.responses} responses</p>
  </Stack>
  <Mark size={40} />
</div>
<Grid cols={3} gap={3}>
  {#each cards as c (c.lens)}<div class="solid l-card l-stack" data-pad="bar" data-lens={c.lens} data-gap="2"><span class="h3">{c.label}</span><Coverage n={c.n} /><Level level={c.level} /></div>{/each}
</Grid>
