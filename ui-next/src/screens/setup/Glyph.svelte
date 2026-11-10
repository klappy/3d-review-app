<!-- UI Next (v4) setup lane icon: gen.py ic() (18px, stroke 1.75, round caps), decorative (aria-hidden). Status: provisional.
     A lane variant of src/Icon.svelte (20px, stroke 2, one path), which the setup boards do not draw. -->
<script>
  import { GLYPHS } from "./glyphs.js";
  let { name, size = 18 } = $props();
  if (!Object.hasOwn(GLYPHS, name)) throw new TypeError(`Glyph: unknown icon "${String(name)}"`);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{#each GLYPHS[name] as d}<path {d}></path>{/each}</svg>
