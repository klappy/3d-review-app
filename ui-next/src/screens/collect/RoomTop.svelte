<!-- UI Next (v4) collect lane room top bar (QRRoom.dc.html). Status: provisional. Lane variant of the shared TopBar, whose room variant
     is not ported ("flow, document and room are not ported yet"). Contract: design-system.md "Top bar variants and breadcrumb" (R12)
     room — projector view: brand → .crumb ending in the review → right: the room-health line only (no instruction in the bar), the live
     stage pill, the answer count as a neutral .tag beside it (§1.4 QR room pill), the offline pointer (R32: "Meeting offline? Print and
     paper", the board's words for the row's "Print these as pages") and a quiet "Exit room view". No menus and no help. -->
<script>
  import Mark from "../../Mark.svelte";
  import Pill from "../../Pill.svelte";
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  import { href } from "../href.js";
  let { m } = $props();
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet x()}<Glyph name="x" />{/snippet}

<header class="top" data-variant="room">
  <a class="brand" href={href("collect")}><Mark /><span>3D Review</span></a>
  <nav class="crumb" aria-label="Breadcrumb"><ol><li><span aria-current="page" title={m.review.title}>{m.review.title}</span></li></ol></nav>
  <div class="top-end">
    <Pill stage={m.review.stage} />
    <span class="tag">{m.answered} answered</span>
    <Button label="Meeting offline? Print and paper" href={`${href("collect")}#offline`} lead={print} />
    <Button label="Exit room view" variant="quiet" href={href("collect")} lead={x} />
  </div>
</header>
