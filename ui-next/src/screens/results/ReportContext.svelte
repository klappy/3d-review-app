<script>
  import { agreementSentence } from "../../../../ui/report-view.js";
  let { report } = $props();
  const payload = $derived(report?.payload ?? {});
  const rows = (value) => Array.isArray(value) ? value : [];
  const narrative = $derived(rows(payload.narrative));
  const indicators = $derived(rows(payload.standalone_indicators));
  const evidence = $derived(rows(payload.evidence));
  const agreement = $derived(payload.translation_type_agreement);
</script>

{#if narrative.length || indicators.length || evidence.length || agreement || payload.source_commit || payload.versions}
  <section class="l-stack" data-gap="4" aria-label="Saved report details">
    {#if narrative.length}<div><div class="sheet-head" role="heading" aria-level="3">Narrative</div>{#each narrative as line}<p class="sheet-text">{String(line)}</p>{/each}</div>{/if}
    {#if indicators.length}
      <div><div class="sheet-head" role="heading" aria-level="3">Standalone indicators</div>
        {#each indicators as indicator}
          <div><div class="sheet-head" role="heading" aria-level="4">{indicator.question_text}</div><p class="sheet-text">{indicator.lens} · {indicator.sub_dimension} · Score (out of 100): {indicator.score ?? "—"} · Responses: {indicator.n_responses ?? "—"}</p></div>
        {/each}
      </div>
    {/if}
    {#if agreement && typeof agreement === "object"}<div><div class="sheet-head" role="heading" aria-level="3">Translation type agreement</div><p class="sheet-text">{agreementSentence(agreement)}</p></div>{/if}
    {#if evidence.length}<div><div class="sheet-head" role="heading" aria-level="3">Evidence</div>{#each evidence as entry}<p class="sheet-text">{entry.label} · Submissions: {entry.n ?? "—"}</p>{/each}</div>{/if}
    {#if payload.source_commit || payload.versions}
      <details><summary>Technical details</summary>
        <p class="sheet-text">{payload.synthetic === true ? "Synthetic data · " : ""}Source: {payload.source_commit ?? "Not supplied"} · Scorer: {payload.versions?.scorer ?? "Not supplied"} · Narrative: {payload.versions?.narrative ?? "Not supplied"} · Policy: {payload.versions?.policy ?? "Not supplied"}{report.reportId ? ` · Report: ${report.reportId}` : ""}{report.created_at ? ` · Built: ${report.created_at}` : ""}</p>
      </details>
    {/if}
  </section>
{/if}
