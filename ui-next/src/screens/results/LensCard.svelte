<!-- UI Next (v4) results lane: perspective card (design-system.md section 2 "Perspective card": .glass[data-lens] accent bar from
     base.css; Level row: meter + name always). Status: provisional. Boards: Results.dc.html (desktop: lens chip, name, count, level,
     one row per area, "See the answers"), ResultsPhone.dc.html (phone: name · count, level, rows), ResultsHeld.dc.html (first rows only).
     Rows are separated by .hr (the board's 1px --line row edge); spacing is the Card's gap, never a margin. -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import Level from "../../Level.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  let { card, phone = false, rows, answers = "?screen=results-answers" } = $props();
  const shown = $derived(rows === undefined ? card.rows : card.rows.slice(0, rows));
</script>

{#if phone}
  <Card gap={2} lens={card.lens} label={card.label}>
    <Row split gap={3}><span class="h3">{card.label} <span class="small">· {card.n}</span></span><Level level={card.level} /></Row>
    {#each shown as r}<hr class="hr" /><Row split gap={3}><span class="small">{r.name}</span><Level level={r.level} /></Row>{/each}
  </Card>
{:else}
  <Card gap={3} lens={card.lens} label={card.label}>
    <Row split gap={3}>
      <Row gap={3}><span class="icn icn-lens" data-lens={card.lens}><Glyph d={G.people} size={20} /></span><Stack gap={1}><span class="h2">{card.label}</span><span class="small">{card.n} responses</span></Stack></Row>
      <Level level={card.level} />
    </Row>
    {#each shown as r}<hr class="hr" /><Row split gap={1}><span class="t-15">{r.name}</span><Level level={r.level} /></Row>{/each}
    <a class="link" href={answers}>See the answers <Glyph d={G.arrow} /></a>
  </Card>
{/if}
