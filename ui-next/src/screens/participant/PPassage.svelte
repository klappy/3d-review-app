<!-- UI Next (v4) participant passage ("read it first"). Status: provisional (playbook rule 12). Board: PPassage.dc.html.
     The passage sits in a .solid card with its page line and the Listen / Open as PDF actions; Back (quiet) + "I've read it" (primary) in the phone-bar.
     The board's serif reading frame (Newsreader 16/27, 300px window, full-bleed footer rule) is a canvas gap: body-16 stands in. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  import { passage, LABELS, go } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const p = passage();
</script>

{#snippet audio()}<Icon d={P.audio} />{/snippet}
{#snippet open()}<Icon d={P.open} />{/snippet}
{#snippet actions()}<ParticipantActions {phone} back={go("p-welcome", phone)} backLabel={LABELS.back} backLead="back" label="I've read it" href={go("p-about", phone)} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">Before you answer</span>
    <h1 class="title-phone">{p.title}</h1>
    <p class="small t-15">Take your time. The questions are about this passage.</p>
    <div class="solid l-card l-stack" data-gap="3" role="group" aria-label="The passage">
      <p class="body-16">{#each p.verses as [n, t], i}{i ? " " : ""}<strong>{n}</strong> {t}{/each}</p>
      <Row split gap={2}><span class="small">{p.page}</span><Row gap={1}><Button label="Listen" variant="quiet" lead={audio} /><Button label="Open as PDF" variant="quiet" lead={open} /></Row></Row>
    </div>
  </Card>
</ParticipantShell>
