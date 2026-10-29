<!-- UI Next (v4) results lane: one area's gap row (ResultsGaps.dc.html: the glass card .glass.barbell-row, label · track · verdict,
     design-system.md barbell rows @186fab0a; ResultsGapsPhone.dc.html: name · perspectives, barbell, verdict).
     Status: provisional. Levels: ./data.js bandRow (v3ScoreBand per perspective). -->
<script>
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import BandBar from "./BandBar.svelte";
  import { LEVEL_WORD, withNotes } from "./data.js";
  let { row, phone = false } = $props();
  // Levels of the placed dots, then the notes (more input needed, not asked), " · "-joined in data.js so no separator is lost.
  const levels = $derived(withNotes(row.dots.map((d) => `${d.label} ${LEVEL_WORD[d.level]}`).join(" · "), row));
</script>

{#snippet verdict()}
  <span class="small"><strong>{row.verdict}</strong></span>
  <span class="small">{levels}</span>
{/snippet}

{#if phone}
  <Card gap={2} label={row.name}>
    <Row split gap={3}><span class="h3">{row.name}</span><span class="small">{row.perspectives} perspectives</span></Row>
    <Stack gap={1}><BandBar {row} />{@render verdict()}</Stack>
  </Card>
{:else}
  <div class="glass barbell-row" role="group" aria-label={row.name}><!-- the screen card: .glass.barbell-row (220px minmax(0,1fr) 220px, gap 20) -->
    <Stack gap={1}><h3 class="h3">{row.name}</h3>{#if row.question}<span class="small">{row.question}</span>{/if}</Stack>
    <BandBar {row} />
    <Stack gap={1}>{@render verdict()}</Stack>
  </div>
{/if}
