<!-- UI Next (v4) Page. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     Owns max-width (--page-max, narrow 880, read 520) and the gap between Sections. Never owns glass or borders. -->
<script>
  import { gapAttr } from "./gap.js";
  let { width, gap, children } = $props();
  if (width !== undefined && width !== "narrow" && width !== "read") throw new TypeError(`Page: width must be narrow or read, got ${String(width)}`);
  const g = $derived(gapAttr(gap, "Page"));
</script>

<div class="l-page" data-w={width} data-gap={g}>{@render children?.()}</div>
