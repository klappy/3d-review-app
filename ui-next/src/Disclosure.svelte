<!-- UI Next (v4) Disclosure. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md "Disclosure, menu roles and the refused item" (V-12): native details.disc > summary.disc-sum
     (text only, chevron aria-hidden) + div.disc-body. No role, aria-expanded or aria-controls: <details> supplies them (WHATWG; APG Disclosure).
     Never .dd or .menu (those mean a menu). The body is a Stack. -->
<script>
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  import { gapAttr } from "./gap.js";
  let { label, open = false, solid = true, gap, children } = $props();
  if (!(typeof label === "string" && label.trim())) throw new TypeError("Disclosure: the summary needs a text label");
  const g = $derived(gapAttr(gap, "Disclosure"));
</script>

<details class={solid ? "disc solid" : "disc"} {open}><summary class="disc-sum h3">{label}<span class="disc-chev" aria-hidden="true"><Icon d={I.chev} /></span></summary><div class="disc-body l-stack" data-gap={g}>{@render children?.()}</div></details>
