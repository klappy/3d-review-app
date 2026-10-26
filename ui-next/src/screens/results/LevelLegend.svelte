<!-- UI Next (v4) results lane: level legend strip (Results.dc.html, ResultsHeld.dc.html). Status: provisional.
     The five levels (design-system.md section 2 Level row; section 4 level words), the "Levels, not scores" line, and the
     imagery switch. Contract: design-system.md §8.11 "Compact level legend" (base.css .glass.lvl-legend, the note .small.mi-end
     at the end of the strip, the switch .seg[data-size=compact]: 36px labels at --t-13, content-wide), as the boards' legend()
     draws it. The switch is drawn, not wired: AppShell owns .app and sets no data-imagery yet (wiring debt in the cookbook
     receipt), so the app shows bars, the boards' default. Light DOM, no <style>, no inline style. -->
<script>
  import Level from "../../Level.svelte";
  const KEYS = ["strong", "growing", "support", "urgent", "more"];
  const SKINS = ["Bars", "Faces", "Jars", "Plants"];
</script>

<div class="glass lvl-legend" role="group" aria-label="Levels">
  {#each KEYS as level (level)}<Level {level} />{/each}
  <span class="small mi-end">Levels, not scores. <strong>More input needed</strong> means too few answers to say — not a low result.</span>
  <div class="seg" data-size="compact" role="group" aria-label="Show levels as">{#each SKINS as s, i (s)}<label><input type="radio" name="imagery" checked={i === 0} />{s}</label>{/each}</div>
</div>
