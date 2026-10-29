<!-- UI Next (v4) Theme control (design-system.md section 2 Theme control + placement rows, copy row): a menu row, not a menu item:
     div.mi-theme[role=group] > "Theme" + .seg[data-size=compact][role=radiogroup] of Light · Dark · System (System checked for a new
     viewer). Choosing does not close the menu; native radios move with the arrow keys inside the group. Sets the viewer's theme
     (./theme.svelte.js). Light DOM, no <style>, no inline style. Status: provisional. -->
<script>
  import { viewerTheme, setTheme } from "./theme.svelte.js";
  let { uid } = $props();
  const WORD = { light: "Light", dark: "Dark", system: "System" };
</script>

<div class="mi-theme" role="group" aria-labelledby={`theme-${uid}`}>
  <span id={`theme-${uid}`}>Theme</span>
  <div class="seg" data-size="compact" role="radiogroup" aria-labelledby={`theme-${uid}`}>{#each ["light", "dark", "system"] as t (t)}<label><input type="radio" name={`theme-${uid}`} value={t} checked={viewerTheme.choice === t} onchange={() => setTheme(t)} />{WORD[t]}</label>{/each}</div>
</div>
