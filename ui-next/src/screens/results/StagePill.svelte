<!-- UI Next (v4) results lane stage pill. Status: provisional. The shared Pill (ui-next/src/Pill.svelte) refuses "closed": whether
     closed is a stage is R8, captain-held (design-system.md 1.7 and the 4 R25 glossary row; shared-slice receipt fix e). The results
     boards draw it ("Collection closed", Results.dc.html, ResultsHeld.dc.html) and base.css carries .pill[data-stage=closed], so this
     lane variant stays until R8 is ruled. Same markup as the shared Pill, no <style>. -->
<script module>
  export const LABELS = Object.freeze({ closed: "Collection closed", results: "Results ready", collecting: "Collecting" }); // collecting: the live results route of a review still in Collect (the contract pill state the collect lane draws)
</script>
<script>
  let { stage } = $props();
  if (!Object.hasOwn(LABELS, stage)) throw new TypeError(`StagePill: unknown stage "${String(stage)}" (closed | results | collecting)`);
</script>

<span class="pill" data-stage={stage}><i aria-hidden="true"></i>{LABELS[stage]}</span>
