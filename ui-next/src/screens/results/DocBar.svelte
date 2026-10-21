<!-- UI Next (v4) results lane: document top bar for the reports (Report.dc.html, ReportDetailed.dc.html). Status: provisional.
     design-system.md "Top bar variants" (R12) names a document variant the shared TopBar does not port yet ("flow, document and room
     are not ported yet"), so this lane variant draws it from the same contract classes: header.top > .brand, the document title (.h3),
     then .top-end with the two-reports line, the switch to the other report (quiet), the page's one primary and Print. -->
<script>
  import Mark from "../../Mark.svelte";
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  let { title, other, otherHref } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("DocBar: the document title is required");
</script>

{#snippet doc()}<Glyph d={G.doc} />{/snippet}
{#snippet download()}<Glyph d={G.download} />{/snippet}
{#snippet print()}<Glyph d={G.printer} />{/snippet}

<header class="top" data-variant="document">
  <a class="brand" href="?screen=results"><Mark /><span>3D Review</span></a>
  <span class="small" aria-hidden="true">/</span>
  <span class="h3">{title}</span>
  <div class="top-end">
    <span class="small">Two reports, built from the same answers.</span>
    <Button label={other} variant="quiet" href={otherHref} lead={doc} />
    <Button label="Download this report (PDF)" variant="primary" href="#download" lead={download} />
    <Button label="Print" lead={print} />
  </div>
</header>
