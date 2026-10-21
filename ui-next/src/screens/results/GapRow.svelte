<!-- UI Next (v4) results lane: one area's gap row (ResultsGaps.dc.html: a card holding the barbell Grid template 220px 1fr 220px,
     design-system.md 8.4 "barbell row is a named Grid template"; ResultsGapsPhone.dc.html: name · perspectives, barbell, verdict).
     Status: provisional. Levels: ./data.js bandRow (v3ScoreBand per perspective). -->
<script>
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import BandBar from "./BandBar.svelte";
  import { LEVEL_WORD } from "./data.js";
  let { row, phone = false } = $props();
  const levels = $derived(row.dots.map((d) => `${d.label} ${LEVEL_WORD[d.level]}`).join(" · "));
</script>

{#snippet verdict()}
  <span class="small"><strong>{row.verdict}</strong></span>
  <span class="small">{levels}{#each row.notAsked as who} <span class="small">· {who} not asked</span>{/each}</span>
{/snippet}

{#if phone}
  <Card gap={2} label={row.name}>
    <Row split gap={3}><span class="h3">{row.name}</span><span class="small">{row.perspectives} perspectives</span></Row>
    <Stack gap={1}><BandBar {row} />{@render verdict()}</Stack>
  </Card>
{:else}
  <Card gap={3} label={row.name}>
    <Grid template="barbell" gap={5}>
      <Stack gap={1}><h3 class="h3">{row.name}</h3>{#if row.question}<span class="small">{row.question}</span>{/if}</Stack>
      <BandBar {row} />
      <Stack gap={1}>{@render verdict()}</Stack>
    </Grid>
  </Card>
{/if}
