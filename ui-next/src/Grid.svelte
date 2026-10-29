<!-- UI Next (v4) Grid. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     A track template, gap only: cols 2..4 (data-cols) or a named template (data-tpl, barbell = 220px 1fr 220px; hero-landing = 1fr 440px, hero-about = 1fr 380px, from base.css gen.EXTRA). -->
<script module>
  export const TEMPLATES = Object.freeze(["barbell", "hero-landing", "hero-about"]);
</script>
<script>
  import { gapAttr } from "./gap.js";
  let { gap, cols, template, children } = $props();
  if (cols !== undefined && template !== undefined) throw new TypeError("Grid: cols or template, not both");
  if (cols !== undefined && ![2, 3, 4].includes(cols)) throw new TypeError(`Grid: cols must be 2, 3 or 4, got ${String(cols)}`);
  if (template !== undefined && !TEMPLATES.includes(template)) throw new TypeError(`Grid: unknown template "${String(template)}"`);
  const g = $derived(gapAttr(gap, "Grid"));
</script>

<div class="l-grid" data-gap={g} data-cols={cols === undefined ? undefined : String(cols)} data-tpl={template}>{@render children?.()}</div>
