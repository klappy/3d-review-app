<!-- UI Next (v4) Button. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Button row.
     Ported states: default and hover (CSS); disabled = the native disabled attribute, styled by the helmet's .btn:disabled / .btn-primary:disabled
     (design-system.md section 2 "Field and button states", R16 Disabled). A link cannot be disabled. -->
<script>
  const VARIANT_CLASS = { secondary: "", primary: "btn-primary", quiet: "btn-quiet" };
  let { label, variant = "secondary", icon, ariaLabel, lead, trail, lg = false, block = false, href, disabled = false } = $props();
  if (!Object.hasOwn(VARIANT_CLASS, variant)) throw new TypeError(`Button: unknown variant "${variant}"`);
  if (typeof disabled !== "boolean") throw new TypeError("Button: disabled is true or false");
  if (disabled && href) throw new TypeError("Button: a link cannot be disabled (render a button, or leave it enabled)");
  const iconOnly = $derived(icon !== undefined && icon !== null);
  const name = $derived(typeof ariaLabel === "string" ? ariaLabel.trim() : "");
  if (iconOnly && !name) throw new TypeError("Button: an icon-only button needs an aria-label");
  if (iconOnly && (label || lead || trail)) throw new TypeError("Button: an icon-only button takes no label, lead or trail");
  if (!iconOnly && !(typeof label === "string" && label.trim())) throw new TypeError("Button: a button needs a label");
  // Icons are decorative (the label or aria-label names the button): hide every element child from assistive tech,
  // as button.js decorative() did. Svelte attachment on the button/link itself; no markup is parsed.
  const decorate = (el) => { for (const c of el.children) c.setAttribute("aria-hidden", "true"); };
  const cls = $derived(["btn", VARIANT_CLASS[variant], iconOnly && "btn-icon", lg && "btn-lg", block && "btn-block"].filter(Boolean).join(" "));
</script>

{#if href}
  <a {@attach decorate} class={cls} {href} aria-label={name || undefined}>{#if iconOnly}{@render icon()}{:else}{@render lead?.()}{label}{@render trail?.()}{/if}</a>
{:else}
  <button {@attach decorate} class={cls} type="button" aria-label={name || undefined} disabled={disabled || undefined}>{#if iconOnly}{@render icon()}{:else}{@render lead?.()}{label}{@render trail?.()}{/if}</button>
{/if}
