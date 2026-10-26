<!-- UI Next (v4) results lane: document top bar for the reports (Report.dc.html, ReportDetailed.dc.html). Status: provisional.
     design-system.md "Top bar variants" (R12) names a document variant the shared TopBar does not port yet ("flow, document and room
     are not ported yet"), so this lane variant draws it from the same contract classes: header.top > .brand, the document title (.h3),
     then .top-end with the two-reports line, the switch to the other report (quiet, trailing arrow as the boards), the page's one
     primary and Print. Print prints this document (window.print(): the sheets are .paper[data-sheet], break-inside:avoid); the
     shared Button takes no click handler, hence the literal button.btn. The PDF download is receipt debt 8 (#download).
     Live QA N3: the disabled download's reason is its accessible description (.sr-only) and its tooltip, never a wrapped line that
     spills out of the 64px bar; the document bar does not print (topbar.css), so a printed report is its sheets only. -->
<script>
  import { liveContext } from "../href.js";
  const live = !!liveContext(); // live: the PDF export is receipt debt 8, so the control says so instead of linking nowhere
  import Mark from "../../Mark.svelte";
  import Button from "../../Button.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  import { href } from "../href.js";
  let { title, other, otherHref } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("DocBar: the document title is required");
  const print = () => globalThis.print?.();
</script>

{#snippet arrow()}<Glyph d={G.arrow} />{/snippet}
{#snippet download()}<Glyph d={G.download} />{/snippet}

<header class="top" data-variant="document">
  <a class="brand" href={href("results")}><Mark /><span>3D Review</span></a>
  <span class="small" aria-hidden="true">/</span>
  <span class="h3">{title}</span>
  <div class="top-end">
    <span class="small">Two reports, built from the same answers.</span>
    <Button label={other} variant="quiet" href={otherHref} trail={arrow} />
    {#if live}<span title="PDF export is not in the new design yet; print this page, or export from the current design."><Button label="Download this report (PDF)" variant="primary" disabled ariaDescribedby="doc-pdf-why" lead={download} /></span><span class="sr-only" id="doc-pdf-why">PDF export is not in the new design yet; print this page, or export from the current design.</span>{:else}<Button label="Download this report (PDF)" variant="primary" href="#download" lead={download} />{/if}
    <button class="btn" type="button" onclick={print}><Glyph d={G.printer} />Print</button>
  </div>
</header>
