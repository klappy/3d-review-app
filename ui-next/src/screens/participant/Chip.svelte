<!-- UI Next (v4) participant icon chip. Status: provisional. The boards' icn() (gen.py:139) at 32/36/56/64px; the contract has one
     sized chip, .icn.icn-lens (40px, --lens-soft ground, --lens icon), so every chip renders at 40 until the sizes are rows (canvas gap).
     lens null = neutral (the problem states: the boards paint --b-support, a level colour, on a non-level icon; section 1.1 refuses that). -->
<script>
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  let { icon, lens = "team" } = $props();
  if (!Object.hasOwn(P, icon)) throw new TypeError(`Chip: unknown icon "${String(icon)}"`);
  if (lens !== null && !["team", "community", "church"].includes(lens)) throw new TypeError("Chip: lens must be team, community, church or null");
</script>

<span class="icn icn-lens" data-lens={lens ?? undefined} aria-hidden="true"><Icon d={P[icon]} /></span>
