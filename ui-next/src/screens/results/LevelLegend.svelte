<!-- UI Next (v4) results lane: level legend strip (Results.dc.html, ResultsHeld.dc.html). Status: provisional.
     The five levels (design-system.md section 2 Level row; section 4 level words), the "Levels, not scores" line, and the
     imagery switch as a Segmented control. The boards draw a compact switch (36px, --t-13) with inline styles (cookbook
     CORRECTIONS res-4, no contract row yet), so the app takes the contract .seg[data-size=wide] (8.9, 320px): four equal
     segments, never a run of words. The note + switch group is [data-grow] + .l-row[data-justify=end] (8.7), so it sits at
     the end of its line as the board's margin-left:auto does. The switch is drawn, not wired: AppShell owns .app and sets no
     data-imagery yet (wiring debt in the cookbook receipt), so the app shows bars, the boards' default. -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Level from "../../Level.svelte";
  const KEYS = ["strong", "growing", "support", "urgent", "more"];
  const SKINS = ["Bars", "Faces", "Jars", "Plants"];
</script>

<Card pad="list" label="Levels">
  <Row split wrap gap={4}>
    <Row wrap gap={5}>{#each KEYS as level (level)}<Level {level} />{/each}</Row>
    <div class="l-row" data-gap="4" data-justify="end" data-grow>
      <span class="small">Levels, not scores. <strong>More input needed</strong> means too few answers to say — not a low result.</span>
      <div class="seg" data-size="wide" role="group" aria-label="Show levels as">{#each SKINS as s, i (s)}<label><input type="radio" name="imagery" checked={i === 0} />{s}</label>{/each}</div>
    </div>
  </Row>
</Card>
