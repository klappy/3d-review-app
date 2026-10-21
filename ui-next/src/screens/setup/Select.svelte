<!-- UI Next (v4) select field control (setup lane): helmet .sel > select.in + chevron (design-system.md section 2 Field row). Status: provisional. -->
<script>
  import Glyph from "./Glyph.svelte";
  let { id, options = [], value, describedby } = $props();
</script>

<span class="sel"><select class="in" {id} aria-describedby={describedby}>{#each options as o}<option selected={o === value}>{o}</option>{/each}</select><Glyph name="chev" /></span>
