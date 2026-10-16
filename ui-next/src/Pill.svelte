<!-- UI Next (v4) Stage pill. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 2, Stage pill row. Ported: the five neutral stages; closed waits on V-09. -->
<script module>
  export const STAGE_LABELS = Object.freeze({ setup: "Setting up", collecting: "Collecting", results: "Results ready", reviewed: "Reviewed", done: "Completed" });
  export const STAGES = Object.freeze(Object.keys(STAGE_LABELS));
</script>
<script>
  let { stage, ...rest } = $props();
  if ("label" in rest) throw new TypeError("Pill: the label comes from the stage, not the caller");
  if (stage === "closed") throw new TypeError('Pill: stage "closed" is not in the ported contract yet');
  if (typeof stage !== "string" || !Object.hasOwn(STAGE_LABELS, stage)) throw new TypeError(`Pill: unknown stage "${String(stage)}"`);
</script>

<span class="pill" data-stage={stage}><i aria-hidden="true"></i>{STAGE_LABELS[stage]}</span>
