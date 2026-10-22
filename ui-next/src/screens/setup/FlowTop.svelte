<!-- UI Next (v4) top bar, flow variant (setup lane). Status: provisional (playbook rule 12).
     Contract: design-system.md "Top bar variants and breadcrumb" (R12) flow: brand -> .crumb whose current item is the flow's name ->
     right: "Draft saved" status (.micro) + quiet Close. No switcher, no account menu while a flow is open; the stepper sits under the bar.
     A lane variant of src/TopBar.svelte (signed-in | public only). Desktop only. Board: Setup1-5.dc.html header. -->
<script>
  import Mark from "../../Mark.svelte";
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  import { href } from "../href.js";
  let { flow = "Start a 3D Review", status = "Draft saved", home = href("home"), close = href("home") } = $props();
  if (!(typeof flow === "string" && flow.trim())) throw new TypeError("FlowTop: the crumb names the flow");
</script>

{#snippet x()}<Glyph name="x" />{/snippet}

<header class="top" data-variant="flow">
  <a class="brand" href={home}><Mark /><span>3D Review</span></a>
  <nav class="crumb" aria-label="Breadcrumb"><ol><li><span aria-current="page" title={flow}>{flow}</span></li></ol></nav>
  <div class="top-end">
    {#if status}<span class="micro" role="status">{status}</span>{/if}
    <Button label="Close" variant="quiet" href={close} lead={x} />
  </div>
</header>
