<!-- UI Next (v4) results lane: perspective card (design-system.md section 2 "Perspective card": .glass[data-lens] accent bar from
     base.css; Level row: meter + name always). Status: provisional. Boards: Results.dc.html (desktop: lens chip, name, count, level,
     one row per area, "See the answers"), ResultsPhone.dc.html (phone: name · count, level, rows), ResultsHeld.dc.html (first rows only).
     Area rows are the contract .lvl-row (8.11: 44px over a --line edge, 36px on a phone) in a Stack; spacing is gap, never a margin.
     "See the answers" opens that perspective's answers (?screen=results-answers&state=<lens>). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import Level from "../../Level.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import { responsesText } from "./data.js";
  let { card, phone = false, rows, answers = true } = $props(); // answers: false hides "See the answers" (the response list needs owner/member)
  const shown = $derived(rows === undefined ? card.rows : card.rows.slice(0, rows));
</script>

{#if phone}
  <Card gap={2} lens={card.lens} label={card.label}>
    <Row split gap={3}><span class="h3">{card.label} <span class="small">· {card.n ?? responsesText(card.n)}</span></span><Level level={card.level} /></Row>
    <Stack gap={1}>{#each shown as r (r.name)}<div class="lvl-row"><span class="small">{r.name}</span><Level level={r.level} /></div>{/each}</Stack>
  </Card>
{:else}
  <Card gap={4} lens={card.lens} label={card.label}>
    <Row split gap={3}>
      <Row gap={3}><span class="icn icn-lens" data-lens={card.lens}><Glyph d={G.people} size={20} /></span><Stack gap={1}><span class="h2">{card.label}</span><span class="small">{responsesText(card.n)}</span></Stack></Row>
      <Level level={card.level} />
    </Row>
    <Stack gap={1}>{#each shown as r (r.name)}<div class="lvl-row"><span class="t-15">{r.name}</span><Level level={r.level} /></div>{/each}</Stack>
    {#if answers}<a class="link" href={href("results-answers", { state: card.lens })}>See the answers <Glyph d={G.arrow} /></a>{/if}
  </Card>
{/if}
