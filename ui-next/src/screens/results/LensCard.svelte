<!-- UI Next (v4) results lane: perspective card (design-system.md section 2 "Perspective card": .glass[data-lens] accent bar from
     base.css; Level row: meter + name always). Status: provisional. Boards: Results.dc.html (desktop: lens chip, name, count, level,
     one row per area, "See the answers"), ResultsPhone.dc.html (phone: name · count, level, rows), ResultsHeld.dc.html (first rows only).
     Area rows are the contract .lvl-row (8.11: 44px over a --line edge, 36px on a phone); desktop in a Stack, phone as the card's direct
     children (§8.11 Phone perspective card). Spacing is gap, never a margin.
     "See the answers" opens that perspective's answers (?screen=results-answers&state=<lens>). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import Level from "../../Level.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  import Coverage from "./Coverage.svelte";
  import { newerText } from "./data.js";
  let { card, phone = false, rows, answers = true } = $props(); // answers: false hides "See the answers" (the response list needs owner/member)
  const shown = $derived(rows === undefined ? card.rows : card.rows.slice(0, rows));
</script>

{#if phone}
  <!-- design-system.md §8.11 Phone perspective card: section.lens-card[data-gap=1] > head (name · level) · cue · [newer] · area rows,
       the rows direct children (no Stack); base.css .lens-card-head and .lens-card>.lvl-row>.small -->
  <section class="glass l-card l-stack lens-card" data-lens={card.lens} data-gap="1" aria-label={card.label}>
    <div class="lens-card-head"><span class="h3">{card.label}</span><Level level={card.level} /></div>
    <Coverage n={card.n} />{#if card.newer}<span class="small" data-newer>{newerText(card.newer)}</span>{/if}
    {#each shown as r (r.name)}<div class="lvl-row"><span class="small">{r.name}</span><Level level={r.level} /></div>{/each}
  </section>
{:else}
  <Card gap={4} lens={card.lens} label={card.label}>
    <Row split gap={3}>
      <Row gap={3}><span class="icn icn-lens" data-lens={card.lens}><Glyph d={G.people} size={20} /></span><span class="h2">{card.label}</span></Row>
      <Level level={card.level} />
    </Row>
    <Coverage n={card.n} />{#if card.newer}<span class="small" data-newer>{newerText(card.newer)}</span>{/if}
    <Stack gap={1}>{#each shown as r (r.name)}<div class="lvl-row"><span class="t-15">{r.name}</span><Level level={r.level} /></div>{/each}</Stack>
    {#if answers}<a class="link" href={href("results-answers", { state: card.lens })}>See the answers <Glyph d={G.arrow} /></a>{/if}
  </Card>
{/if}
