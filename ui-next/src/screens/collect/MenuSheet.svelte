<!-- UI Next (v4) collect lane ⋯ sheet (CollectMenuPhone.dc.html). Status: provisional. Contract: "Dialog and sheet states" phone map
     (Collect ⋯ menu → CollectMenuPhone sheet) + Menu row (R11) + §9 sheet rows on the PIN (dialog.glass-hi.sheet[data-pad=menu], .sheet-handle,
     .sheet-title, .mi[data-size=lg] 52px rows): the handle, the review's micro title with the visible Close, then the rows; focus opens on the
     first row (R14 "Sheets of menu rows"). The refused delete is a button[aria-disabled] that says why (.mi-why), never a link (the board
     draws an a.mi.danger with no reason: generator line). Close, Escape and a tap outside go back to Collect. -->
<script>
  import Dialog from "./Dialog.svelte";
  import Glyph from "./Glyph.svelte";
  import { href } from "../href.js";
  let { m } = $props();
  const ROWS = $derived([["pen", "Edit details and dates", href("setup1")], ["people", "People with access", href("people")], ["doc", "Open the passage", href("setup2")],
    ["print", "Meeting offline? Print and paper", `${href("collect")}#offline`], ["lock", "Close collection now", href("close-collection")]]);
</script>

{#snippet title()}<span class="micro sheet-title" id="collect-sheet-title">{m.review.title}</span>{/snippet}

<Dialog labelledby="collect-sheet-title" cancel={href("collect")} sheet handle pad="menu" gap={1} {title}>
  {#each ROWS as [icon, label, to], i (label)}
    <!-- svelte-ignore a11y_autofocus -->
    <a class="mi" data-size="lg" href={to} autofocus={i === 0}><Glyph name={icon} /><span>{label}</span></a>
  {/each}
  <button class="mi danger" type="button" data-size="lg" aria-disabled="true" aria-describedby="collect-sheet-delete-why"><Glyph name="x" /><span>Delete this review</span></button>
  <p class="mi-why small" id="collect-sheet-delete-why">Reviews with responses can't be deleted. This one has {m.answered}.</p>
</Dialog>
