<!-- UI Next (v4) results lane: level legend strip (Results.dc.html, ResultsHeld.dc.html). Status: provisional.
     The five levels (design-system.md section 2 Level row; section 4 level words), the "Levels, not scores" line, and the
     imagery switch as a Segmented control (.seg, 2-4 options). The switch is drawn, not wired: AppShell owns .app and sets no
     data-imagery yet (wiring debt in RESULTS-results.md), so the app shows bars, the boards' default. -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Level from "../../Level.svelte";
  const KEYS = ["strong", "growing", "support", "urgent", "more"];
  const SKINS = ["Bars", "Faces", "Jars", "Plants"];
</script>

<Card pad="list" label="Levels">
  <Row split wrap gap={4}>
    <Row wrap gap={5}>{#each KEYS as level}<Level {level} />{/each}</Row>
    <Row gap={4}>
      <span class="small">Levels, not scores. <strong>More input needed</strong> means too few answers to say — not a low result.</span>
      <div class="seg" role="group" aria-label="Show levels as">{#each SKINS as s, i}<label><input type="radio" name="imagery" checked={i === 0} />{s}</label>{/each}</div>
    </Row>
  </Row>
</Card>
