<!-- UI Next (v4) results lane: the report barbell key ("red line = two bands apart or more"; Report.dc.html, ReportDetailed.dc.html). -->
<script>
  import Row from "../../Row.svelte";
  import PtDot from "./PtDot.svelte";
  import { LENS_ORDER, lensLabel } from "./data.js";
</script>

<Row split gap={4}>
  <Row gap={4}>{#each LENS_ORDER as lens}<Row gap={2}><PtDot {lens} size={12} /><span class="small">{lensLabel(lens)}</span></Row>{/each}</Row>
  <span class="small">red line = two bands apart or more</span>
</Row>
