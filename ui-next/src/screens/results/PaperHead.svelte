<!-- UI Next (v4) results lane: report sheet head (Report.dc.html, ReportDetailed.dc.html page 1): title, meta line, one bordered
     perspective box per lens (accent bar from .l-card[data-lens]) with its count and level. Paper scope (design-system.md 1.3).
     Status: provisional. -->
<script>
  import Stack from "../../Stack.svelte";
  import Grid from "../../Grid.svelte";
  import Level from "../../Level.svelte";
  let { review, cards, kind } = $props();
</script>

<Stack gap={1}>
  <h1 class="title-page ptitle">{review.title}</h1>
  <p class="small">{review.project} · {review.language} · 3D Review {kind} · closed {review.closedLong} · {review.responses} responses</p>
</Stack>
<Grid cols={3} gap={4}>
  {#each cards as c}<div class="solid l-card l-stack" data-lens={c.lens} data-gap="2"><span class="h3">{c.label}</span><span class="small">{c.n} responses</span><Level level={c.level} /></div>{/each}
</Grid>
