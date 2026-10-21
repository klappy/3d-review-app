<!-- UI Next (v4) results lane stage pill. Status: provisional. The shared Pill (ui-next/src/Pill.svelte) refuses "closed" until V-09;
     the results boards draw it ("Collection closed", Results.dc.html, ResultsHeld.dc.html), and base.css already carries
     .pill[data-stage=closed] (--stage-closed, design-system.md section 1.7). Lane-specific variant; same markup, no <style>. -->
<script module>
  export const LABELS = Object.freeze({ closed: "Collection closed", results: "Results ready" });
</script>
<script>
  let { stage } = $props();
  if (!Object.hasOwn(LABELS, stage)) throw new TypeError(`StagePill: unknown stage "${String(stage)}" (closed | results)`);
</script>

<span class="pill" data-stage={stage}><i aria-hidden="true"></i>{LABELS[stage]}</span>
