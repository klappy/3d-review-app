<!-- UI Next (v4) participant question. Status: provisional (playbook rule 12). Board: PQuestion.dc.html (question 3 of 13).
     Progress line (UI_EN.questionOf + the perspective) and bar above the card; the question is the fieldset legend (h1), answers are
     label.row-opt rows (radio for single, checkbox for multi), "I don't know" last (design row, cookbook CORRECTIONS R33).
     Back (quiet) + Next (primary) in the phone-bar, never above the question. Question and answers verbatim from the app instrument (fixture). -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import { question, LABELS, go } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const q = question();
  const multi = q.item.type === "multi";
  const on = (code) => (multi ? (q.value ?? []).includes(code) : q.value === code);
</script>

{#snippet actions()}<ParticipantActions {phone} back={go("p-about", phone)} backLabel={LABELS.back} backLead="back" label={LABELS.next} href={go("p-review", phone)} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Stack gap={2}>
    <div class="l-row micro" data-split><span>{q.of}</span><span>{q.perspective}</span></div>
    <ProgressBar value={q.n} max={q.total} label={q.of} />
  </Stack>
  <Card hi pad="hero" gap={4}>
    <fieldset class="opts">
      <legend><h1 class="title-phone">{q.item.text}</h1></legend>
      {#each q.options as o (o.code)}<label class="row-opt"><input class={multi ? "cb" : "rd"} type={multi ? "checkbox" : "radio"} name={q.item.id} value={o.code} checked={on(o.code)} /><span class="t-16">{o.text}</span></label>{/each}
    </fieldset>
  </Card>
</ParticipantShell>
