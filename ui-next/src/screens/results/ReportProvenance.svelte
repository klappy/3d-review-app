<!-- Visible on screen and paper; report identity and build time come from the immutable saved report read. -->
<script>
  let { report } = $props();
  const payload = $derived(report?.payload ?? {});
</script>
<div aria-label="Report provenance" data-report-provenance>
  <p class="sheet-text">Report: {report?.reportId || "Not supplied"} · Built: {report?.created_at || report?.review?.builtOn || "Not supplied"} · Source: {payload.source_commit ?? "Not supplied"} · Scorer: {payload.versions?.scorer ?? "Not supplied"} · Narrative: {payload.versions?.narrative ?? "Not supplied"} · Policy: {payload.versions?.policy ?? "Not supplied"}</p>
  {#if report?.selectionKnown === false}<p class="sheet-text">Only perspectives recorded in this saved report are shown. Other perspectives’ participation is unknown.</p>{/if}
</div>
