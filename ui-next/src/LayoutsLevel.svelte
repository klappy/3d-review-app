<!-- UI Next (v4) Layouts gallery helper: one outlined nesting level (spec board Layouts.dc.html). Gallery only, not a contract component.
     Status: provisional. Outline colour by data-lv in gallery.css; no inline style. -->
<script>
  let { lv, name, cls, note, children } = $props();
</script>

<div class="gx-lv l-stack" data-lv={lv} data-gap="3">
  <span class="micro gx-lv-k"><b>{name}</b><span class="kbd">{cls}</span></span>
  {#if note}<span class="micro">{note}</span>{/if}
  {@render children?.()}
</div>
