<!-- UI Next (v4) collect lane glyph. Status: provisional. Lane variant of the shared Icon.svelte: the boards' stroke 1.75 and their
     sizes (13 tab check, 18 menu/button, 20 icon button, 26 dialog). Decorative (aria-hidden); the control's label names it. -->
<script>
  import { G } from "./glyphs.js";
  let { name, size = 18 } = $props();
  if (!Object.hasOwn(G, name)) throw new TypeError(`Glyph: unknown glyph "${String(name)}"`);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={G[name]} /></svg>
