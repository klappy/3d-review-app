<!-- UI Next (v4) Section. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     Optional heading (.h2/.h3) and help line, then the body; gap --sp-4. Never owns a background. -->
<script>
  let { heading, help, level = 2, children } = $props();
  if (level !== 2 && level !== 3) throw new TypeError("Section: level must be 2 or 3");
</script>

<section class="l-section">
  {#if heading}{#if level === 2}<h2 class="h2">{heading}</h2>{:else}<h3 class="h3">{heading}</h3>{/if}{/if}
  {#if help}<p class="small">{help}</p>{/if}
  {@render children?.()}
</section>
