<!-- UI Next (v4) collect lane ⋯ sheet (CollectMenuPhone.dc.html). Status: provisional. Contract: "Dialog and sheet states" phone map
     (Collect ⋯ menu → CollectMenuPhone sheet) + Menu row (R11): the review's micro title, then .mi rows; the refused delete is a
     button[aria-disabled] that says why (.mi-why), never a link (the board draws an a.mi.danger with no reason: generator line). -->
<script>
  import Dialog from "./Dialog.svelte";
  import Glyph from "./Glyph.svelte";
  import { href } from "./model.js";
  let { m } = $props();
  const ROWS = [["pen", "Edit details and dates", "setup1"], ["people", "People with access", "people"], ["doc", "Open the passage", "setup2"],
    ["print", "Meeting offline? Print and paper", "collect"], ["lock", "Close collection now", "close-collection"]];
</script>

<Dialog labelledby="collect-sheet-title" sheet>
  <div class="l-stack" data-gap="1">
    <span class="micro" id="collect-sheet-title">{m.review.title}</span>
    {#each ROWS as [icon, label, screen] (label)}<a class="mi" href={href(screen, { phone: true, hash: screen === "collect" ? "offline" : undefined })}><Glyph name={icon} /><span>{label}</span></a>{/each}
    <button class="mi danger" type="button" aria-disabled="true" aria-describedby="collect-sheet-delete-why"><Glyph name="x" /><span>Delete this review</span></button>
    <p class="mi-why small" id="collect-sheet-delete-why">Reviews with responses can't be deleted. This one has {m.answered}.</p>
  </div>
</Dialog>
