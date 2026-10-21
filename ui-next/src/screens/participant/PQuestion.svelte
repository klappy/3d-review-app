<!-- UI Next (v4) participant question. Status: provisional (playbook rule 12). Board: PQuestion.dc.html (question 3 of 13).
     Progress line (UI_EN.questionOf + the perspective) and bar above the card. Choice items: the question is the fieldset legend (h1), answers
     are label.row-opt.answer rows (§9 participant row, 60px; radio for single, checkbox for multi), "I don't know" last (cookbook CORRECTIONS R33).
     On a multi item "I don't know" is exclusive (the app's option flag): ticking it clears the other boxes, ticking another box clears it (data.js pick).
     Text items (3 of 13): the question is the h1 and labels a textarea.in (section 2 Field). ?q=<n> picks the question (Change links on the
     review); no or unknown ?q= shows the fixture's current one. Back / Next walk the questions (About first when the form turns it on, else
     the passage; the review last), in the phone-bar. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import { href } from "../href.js";
  import { question, qParam, pick, hasAbout, LABELS } from "./data.js";
  let { phone = false, theme = "light", q = qParam() } = $props();
  const x = $derived(question(q));
  const kind = $derived(x.item.type);
  // The participant's answer on this page: starts from the fixture's, follows each tick (a new ?q= starts over).
  let value = $derived(x.value);
  const on = (code) => (kind === "multi" ? (value ?? []).includes(code) : value === code);
  const tick = (code) => (e) => { value = pick(x.item, value, code, e.currentTarget.checked); };
  const back = $derived(x.n > 1 ? href("p-question", { q: x.n - 1 }) : hasAbout() ? href("p-about") : href("p-passage"));
  const next = $derived(x.n < x.total ? href("p-question", { q: x.n + 1 }) : href("p-review"));
</script>

{#snippet actions()}<ParticipantActions {phone} {back} backLabel={LABELS.back} backLead="back" label={LABELS.next} href={next} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Stack gap={2}>
    <div class="l-row micro" data-split><span>{x.of}</span><span>{x.perspective}</span></div>
    <ProgressBar value={x.n} max={x.total} label={x.of} />
  </Stack>
  <Card hi pad="hero" gap={4}>
    {#if kind === "text"}
      <h1 class="title-phone" id="p-q-text">{x.item.text}</h1>
      <textarea class="in" id="p-q-answer" name={x.item.id} aria-labelledby="p-q-text" value={x.value ?? ""}></textarea>
    {:else}
      <fieldset class="opts">
        <legend><h1 class="title-phone">{x.item.text}</h1></legend>
        {#each x.options as o (o.code)}<label class="row-opt answer"><input class={kind === "multi" ? "cb" : "rd"} type={kind === "multi" ? "checkbox" : "radio"} name={x.item.id} value={o.code} checked={on(o.code)} onchange={tick(o.code)} /><span>{o.text}</span></label>{/each}
      </fieldset>
    {/if}
  </Card>
</ParticipantShell>
