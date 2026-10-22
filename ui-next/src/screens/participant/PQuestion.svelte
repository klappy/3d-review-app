<!-- UI Next (v4) participant question. Status: provisional (playbook rule 12). Board: PQuestion.dc.html (question 3 of 13).
     Progress line (UI_EN.questionOf + the perspective) and bar above the card. Choice items: the question is the fieldset legend (h1), answers
     are label.row-opt.answer rows (§9 participant row, 60px; radio for single, checkbox for multi), "I don't know" last (cookbook CORRECTIONS R33).
     On a multi item an exclusive row ("I don't know"; CW-Q8 "We don't use it") stands alone: ticking it clears the other boxes, ticking another
     box clears it (data.js pick); the app's UI_EN.exclusionNote sits under such a field (p.small.field-help, as ui/participate/page.js draws it)
     and describes each exclusive row (aria-describedby). No board draws a multi item; the note's place and type are the Field row's help line.
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
  import { question, qParam, pick, hasAbout, exclusionNote, LABELS, DATA } from "./data.js";
  // d: the survey model (fixture, or the live journey's form); onanswer(id, value): live mode saves the draft on every tick.
  let { phone = false, theme = "light", q = qParam(), d = DATA, onanswer } = $props();
  const x = $derived(question(q, d));
  const kind = $derived(x.item.type);
  const note = $derived(exclusionNote(x.item, d));
  // The participant's answer on this page: starts from the fixture's, follows each tick (a new ?q= starts over).
  let value = $derived(x.value);
  const on = (code) => (kind === "multi" ? (value ?? []).includes(code) : value === code);
  const tick = (code) => (e) => { value = pick(x.item, value, code, e.currentTarget.checked, d); onanswer?.(x.item.id, value); };
  const typed = (e) => { value = e.currentTarget.value; onanswer?.(x.item.id, value); };
  // scale: a bounded whole number (ui/participate/page.js: input type=number, min/max from item.scale, saved as a Number).
  const scaled = (e) => { const v = e.currentTarget.value; value = v === "" ? null : Number(v); onanswer?.(x.item.id, value); };
  // "Other (please describe)": the description rides beside the answer (ui/present.js OTHER_TEXT_KEY "_other", choseOther) and is
  // sent only when that option is chosen; onother(itemId, text) stores it in the draft.
  const isOther = (o) => o?.other === true || o?.code === "other";
  const choseOther = $derived((x.item.options ?? []).some((o) => isOther(o) && (kind === "multi" ? (value ?? []).includes(o.code) : value === o.code)));
  const otherText = $derived(x.other ?? "");
  const described = (e) => onother?.(x.item.id, e.currentTarget.value);
  const back = $derived(x.n > 1 ? href("p-question", { q: x.n - 1 }) : hasAbout(d) ? href("p-about") : href("p-passage"));
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
      <textarea class="in" id="p-q-answer" name={x.item.id} aria-labelledby="p-q-text" value={x.value ?? ""} oninput={typed}></textarea>
    {:else if kind === "scale"}
      <h1 class="title-phone" id="p-q-text">{x.item.text}</h1>
      <input class="in" id="p-q-answer" type="number" inputmode="numeric" name={x.item.id} min={x.item.scale?.min ?? 1} max={x.item.scale?.max ?? 5} step="1" aria-labelledby="p-q-text" aria-describedby="p-q-scale" value={value ?? ""} oninput={scaled} />
      <p class="small field-help" id="p-q-scale">A whole number from {x.item.scale?.min ?? 1} to {x.item.scale?.max ?? 5}.</p>
    {:else}
      <fieldset class="opts">
        <legend><h1 class="title-phone">{x.item.text}</h1></legend>
        {#each x.options as o (o.code)}<label class="row-opt answer"><input class={kind === "multi" ? "cb" : "rd"} type={kind === "multi" ? "checkbox" : "radio"} name={x.item.id} value={o.code} checked={on(o.code)} aria-describedby={note && o.exclusive ? "p-q-note" : undefined} onchange={tick(o.code)} /><span>{o.text}</span></label>{/each}
        {#if note}<p class="small field-help" id="p-q-note">{note}</p>{/if}
        {#if choseOther}<input class="in" type="text" name={`${x.item.id}::other`} maxlength="500" placeholder="Please describe" aria-label="Please describe" value={otherText} oninput={described} />{/if}
      </fieldset>
    {/if}
  </Card>
</ParticipantShell>
