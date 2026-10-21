<!-- UI Next (v4) actions-lane icon: the boards' 18px, 1.75-stroke decorative glyph (shared ../../Icon.svelte draws 20px / 2).
     Lane-local variant of a shared part (screens fanout brief rule 2). Status: provisional. Always aria-hidden. -->
<script>
  let { d, size = 18 } = $props();
  if (!(typeof d === "string" && d)) throw new TypeError("Ico: d is a path string from ./icons.js");
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
