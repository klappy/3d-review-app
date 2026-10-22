<!-- UI Next (v4) select field control (setup lane): helmet .sel > select.in + chevron (design-system.md section 2 Field row). Status: provisional. -->
<script>
  import Glyph from "./Glyph.svelte";
  // onchange (live): called with the chosen option's text.
  let { id, options = [], value, describedby, onchange } = $props();
</script>

<span class="sel"><select class="in" {id} aria-describedby={describedby} onchange={(e) => onchange?.(e.currentTarget.value)}>{#each options as o}<option selected={o === value}>{o}</option>{/each}</select><Glyph name="chev" /></span>
