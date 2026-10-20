<!-- UI Next (v4) Stack. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     One axis, gap only (data-gap 1..7). Never owns padding or surface. -->
<script>
  import { gapAttr } from "./gap.js";
  let { gap, children } = $props();
  const g = $derived(gapAttr(gap, "Stack"));
</script>

<div class="l-stack" data-gap={g}>{@render children?.()}</div>
