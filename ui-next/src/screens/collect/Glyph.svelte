<!-- UI Next (v4) collect lane glyph. Status: provisional. Only for the sizes the shared Icon.svelte cannot draw (it is 20px, stroke 2,
     no size prop: RESULTS-shared.md Open 5 "Icon size"): 13 tab check, 16 phone option-row QR, 18 button / menu-row lead, 26 dialog tile.
     Every 20px glyph uses the shared Icon. Size and stroke are the generator's ic() defaults (gen.py ic(n, s=18, w=1.75)), not contract
     rows: canvas rows owed (RESULTS-collect.md Round 2, F9). Decorative (aria-hidden); the control's label names it. -->
<script>
  import { G } from "./glyphs.js";
  const SIZES = [13, 16, 18, 26];
  let { name, size = 18 } = $props();
  if (!Object.hasOwn(G, name)) throw new TypeError(`Glyph: unknown glyph "${String(name)}"`);
  if (!SIZES.includes(size)) throw new TypeError(`Glyph: size ${String(size)} — 20px glyphs use the shared Icon; the lane draws only ${SIZES.join(", ")}`);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={G[name]} /></svg>
