<!-- UI Next (v4) participant welcome. Status: provisional (playbook rule 12). Board: cookbook design/2026-10-15-glass-redesign/canvas/PWelcome.dc.html (390x844).
     Hero card (Card pad=hero) with the survey line, title, lead and the three facts; one .btn-primary "Start" in the phone-bar (-> the passage first).
     Data: ui-next/fixtures/participant/survey.json through data.js (passageNames, UI_EN.start). No <style>, no inline style. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import { welcome, LABELS, go } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const w = welcome();
</script>

{#snippet actions()}<ParticipantActions {phone} label={LABELS.start} href={go("p-passage", phone)} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">{w.eyebrow}</span>
    <h1 class="display">We'd like your perspective</h1>
    <p class="small body-16">Tell us how this translation is working for your community. There are no wrong answers, and "I don't know" is fine.</p>
    <div class="l-stack" data-gap="2" role="list">
      <div class="l-row" data-gap="3" role="listitem"><Chip icon="people" /><span class="t-16">Your perspective: <strong>{w.perspective}</strong></span></div>
      <div class="l-row" data-gap="3" role="listitem"><Chip icon="list" /><span class="t-16">{w.length}</span></div>
      <div class="l-row" data-gap="3" role="listitem"><Chip icon="lock" /><span class="t-16">Your answers are confidential</span></div>
    </div>
  </Card>
</ParticipantShell>
