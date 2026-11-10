<!-- UI Next (v4) results lane glyph: the shared Icon (ui-next/src/Icon.svelte, fixed 20px, stroke 2) at the board's size and stroke
     (generator/gen.py ICONS: 24 viewBox, stroke-width 1.75; 18px in buttons and links, 13px in the tab check). Decorative, aria-hidden.
     Lane-specific variant of a shared part (fanout brief: never edit shared files). Status: provisional. -->
<script>
  let { d, size = 18, stroke = 1.75 } = $props();
  if (typeof d !== "string" || !d) throw new TypeError("Glyph: a path is required");
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
