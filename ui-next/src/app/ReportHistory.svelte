<script>
  import { to } from "./router.js";
  import { orderedReports, reportLabel } from "./report-selection.js";
  let { aid, reports = [], selected = null, screen = "results", onselect } = $props();
  const options = $derived(orderedReports(reports));
  const select = (event) => {
    const id = event.currentTarget.value;
    if (!options.some((r) => r.id === id)) return;
    if (onselect) onselect(id);
    else globalThis.location.hash = to(screen, { aid }, { report: id });
  };
</script>

{#if options.length}
  <div class="glass l-card l-stack" data-gap="2" data-pad="list" role="group" aria-label="Report history">
    <label class="lbl" for="report-history">Report version</label>
    <select class="in" id="report-history" value={selected ?? options[0]?.id} onchange={select}>
      {#each options as report (report.id)}<option value={report.id}>{reportLabel(report)}</option>{/each}
    </select>
    <p class="small">Results, reports and the plan use the selected saved report. Building a new report keeps earlier versions available.</p>
  </div>
{/if}
