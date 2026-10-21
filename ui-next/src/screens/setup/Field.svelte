<!-- UI Next (v4) Field (setup lane). Status: provisional (playbook rule 12).
     Contract: design-system.md section 2 Field row (field(): .lbl + control, .field-help, .field-error) and "Field and button states" (R16):
     a single control has an id and a matching for; a set of controls is role=group + aria-labelledby on the span.lbl. Leaf inside a Stack (8.4). The field is the helmet's field(): a column with no gap, .lbl's own 6px margin, help/error 8px under the
     control (board 6 -> --sp-2, 8.2), so it is not a gapped Stack.
     The control is the children snippet; it carries aria-describedby `${id}-help` / `${id}-err` itself. -->
<script>
  import Glyph from "./Glyph.svelte";
  let { label, id, opt = false, help, error, group = false, children } = $props();
  if (!(typeof label === "string" && label.trim())) throw new TypeError("Field: a field needs a label");
  if (!(typeof id === "string" && id.trim())) throw new TypeError("Field: a field needs an id");
</script>

{#snippet text()}{label}{#if opt}{" "}<span class="opt">(optional)</span>{/if}{/snippet}

<div class="su-field" role={group ? "group" : undefined} aria-labelledby={group ? `${id}-lbl` : undefined}>
  {#if group}<span class="lbl" id={`${id}-lbl`}>{@render text()}</span>{:else}<label class="lbl" for={id}>{@render text()}</label>{/if}
  {@render children?.()}
  {#if help}<p class="small field-help" id={`${id}-help`}>{help}</p>{/if}
  {#if error}<p class="small field-error" id={`${id}-err`} role="alert"><Glyph name="warn" />{error}</p>{/if}
</div>
