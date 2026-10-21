<!-- UI Next (v4) participant passage ("read it first"). Status: provisional (playbook rule 12). Board: PPassage.dc.html.
     The passage in the PIN's §9 reading frame: .solid.passage > .passage-text (Newsreader 16/27, 300px window) + .passage-foot (rule above).
     The foot stacks the page line over the Listen / Open as PDF row, so "Page 1 of 6" reads on one line at 390 (the board sets all three in
     one row and wraps it to three lines). Back (quiet) + "I've read it" (primary) in the phone-bar. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { href } from "../href.js";
  import { P } from "./icons.js";
  import { passage, LABELS } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const p = passage();
</script>

{#snippet audio()}<Icon d={P.audio} />{/snippet}
{#snippet open()}<Icon d={P.open} />{/snippet}
{#snippet actions()}<ParticipantActions {phone} back={href("p-welcome")} backLabel={LABELS.back} backLead="back" label="I've read it" href={href("p-about")} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">Before you answer</span>
    <h1 class="title-phone">{p.title}</h1>
    <p class="small t-15">Take your time. The questions are about this passage.</p>
    <div class="solid passage" role="group" aria-label="The passage">
      <div class="passage-text">{#each p.verses as [n, t], i}{i ? " " : ""}<strong>{n}</strong> {t}{/each}</div>
      <div class="passage-foot"><Stack gap={1}><span class="small">{p.page}</span><Row gap={2}><Button label="Listen" variant="quiet" lead={audio} /><Button label="Open as PDF" variant="quiet" lead={open} /></Row></Stack></div>
    </div>
  </Card>
</ParticipantShell>
