<!-- UI Next (v4) participant welcome. Status: provisional (playbook rule 12). Board: cookbook design/2026-10-15-glass-redesign/canvas/PWelcome.dc.html (390x844).
     Hero card (Card pad=hero) with the survey line, title (.display.display-hero), lead (.lead-16) and the three facts (ul.facts, 36px chips in
     the survey's lens); one .btn-primary "Start" in the phone-bar (-> the passage first). Rows: the PIN's §9 participant rows.
     Data: ui-next/fixtures/participant/survey.json through data.js (passageNames, UI_EN.start). No <style>, no inline style. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import { href } from "../href.js";
  import { welcome, surveyLens, LABELS, DATA } from "./data.js";
  // onlang(code) (live): the participant picks a language the form offers (ui/participate/page.js language picker, reused through
  // app/participant.js setLanguage); d.languages / d.lang / d.translating / d.translateFailed come from the adapter.
  let { phone = false, theme = "light", d = DATA, onlang } = $props();
  const T = $derived(d.t ?? ((k, f) => f));
  const w = $derived(welcome(d));
  const lens = $derived(surveyLens(d));
</script>

{#snippet actions()}<ParticipantActions {phone} label={T("start", LABELS.start)} href={href("p-passage")} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions} dir={d.dir}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">{w.eyebrow}</span>
    <h1 class="display display-hero">We'd like your perspective</h1>
    <p class="lead-16">Tell us how this translation is working for your community. There are no wrong answers, and "I don't know" is fine.</p>
    <ul class="facts l-stack" data-gap="2">
      <li class="l-row" data-gap="3"><Chip icon="people" {lens} /><span class="t-16">Your perspective: <strong>{w.perspective}</strong></span></li>
      <li class="l-row" data-gap="3"><Chip icon="list" {lens} /><span class="t-16">{w.length}</span></li>
      <li class="l-row" data-gap="3"><Chip icon="lock" {lens} /><span class="t-16">Your answers are confidential</span></li>
    </ul>
    {#if onlang && d.languages?.length}
      <div class="l-stack" data-gap="1">
        <label class="lbl" for="p-lang">{T("language", "Language")}</label>
        <span class="sel"><select class="in" id="p-lang" value={d.lang ?? "en"} onchange={(e) => onlang(e.currentTarget.value)}><option value="en">English</option>{#each d.languages as l (l.code)}<option value={l.code}>{l.endonym ?? l.name} · {l.name}</option>{/each}</select></span>
        {#if d.translating}<p class="small field-help" role="status">{T("translating", "Translating")} · {d.translating.done} of {d.translating.total}</p>{:else if d.translateFailed}<p class="small field-error" role="alert">{d.translateFailed}</p>{:else if d.lang && d.lang !== "en"}<p class="small field-help">{T("machineNote", "Machine translated; the English is the original.")}</p>{/if}
      </div>
    {/if}
  </Card>
</ParticipantShell>
