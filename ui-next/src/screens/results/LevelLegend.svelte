<!-- UI Next (v4) results lane: level legend strip (Results.dc.html, ResultsHeld.dc.html). Status: provisional.
     The five levels (design-system.md section 2 Level row; section 4 level words), the "Levels, not scores" line, and the
     imagery switch. Contract: design-system.md §8.11 "Compact level legend" (base.css .glass.lvl-legend, the note .small.mi-end
     at the end of the strip, the switch .seg[data-size=compact]: 36px labels at --t-13, content-wide), as the boards' legend()
     draws it. The switch sets the one shared imagery state (../../imagery.svelte.js), which AppShell puts on .app[data-imagery]
     for every Level skin, persisted per viewer. Light DOM, no <style>, no inline style. -->
<script>
  import Level, { SKINS } from "../../Level.svelte";
  import { imagery, setImagery } from "../../imagery.svelte.js";
  const KEYS = ["strong", "growing", "support", "urgent", "more"];
  const WORD = { bars: "Bars", faces: "Faces", jars: "Jars", plants: "Plants" };
</script>

<div class="glass lvl-legend" role="group" aria-label="Levels">
  {#each KEYS as level (level)}<Level {level} />{/each}
  <span class="small mi-end">Levels, not scores. <strong>More input needed</strong> means too few answers to say — not a low result.</span>
  <div class="seg" data-size="compact" role="group" aria-label="Show levels as">{#each SKINS as s (s)}<label><input type="radio" name="imagery" value={s} checked={imagery.skin === s} onchange={() => setImagery(s)} />{WORD[s]}</label>{/each}</div>
</div>
