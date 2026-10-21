<!-- UI Next (v4) phone bar for the setup steps (setup lane). Status: provisional (playbook rule 12).
     Contract: design-system.md section 9 phone-bar: fixed bottom glass bar, exactly one btn-primary (flex-grow) plus an optional quiet Back.
     A lane variant of src/PhoneBar.svelte: the setup boards draw Back with its arrow and the primary with a trailing arrow
     (Setup1Phone, Setup2Phone, SetupPhone, Setup4Phone); Setup5Phone's "Launch the survey" leads with the play icon (play). -->
<script>
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  let { label = "Continue", href, backHref, play = false } = $props();
  if (!(typeof label === "string" && label.trim())) throw new TypeError("SetupBar: the bar holds one primary, which needs a label");
</script>

{#snippet back()}<Glyph name="back" />{/snippet}
{#snippet arrow()}<Glyph name="arrow" />{/snippet}
{#snippet launch()}<Glyph name="play" />{/snippet}

<div class="glass phone-bar" role="group" aria-label="Page actions">
  {#if backHref}<Button label="Back" variant="quiet" href={backHref} lead={back} />{/if}
  {#if play}<Button {label} variant="primary" lg {href} lead={launch} />{:else}<Button {label} variant="primary" lg {href} trail={arrow} />{/if}
</div>
