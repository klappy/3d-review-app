<!-- UI Next (v4) Card. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     Owns surface (.glass / .glass-hi), radius and inner padding; inner axis is a Stack. Never owns its width or outer margin. -->
<script>
  import { gapAttr } from "./gap.js";
  let { hi = false, gap, label, children, ...rest } = $props();
  for (const k of ["width", "style", "margin"]) if (k in rest) throw new TypeError(`Card: no ${k} (the parent Grid or Page track sets width; the parent gap spaces it)`);
  const g = $derived(gapAttr(gap, "Card"));
</script>

<div class={hi ? "glass-hi l-card l-stack" : "glass l-card l-stack"} data-gap={g} aria-label={label} role={label ? "group" : undefined}>{@render children?.()}</div>
