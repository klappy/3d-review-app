<!-- UI Next (v4) participant passage ("read it first"). Status: provisional (playbook rule 12). Board: PPassage.dc.html.
     The passage in the PIN's §9 reading frame: .solid.passage > .passage-text (Newsreader 16/27, 300px window) + .passage-foot (rule above).
     The foot stacks the page line over the Listen / Open as PDF row, so "Page 1 of 6" reads on one line at 390 (the board sets all three in
     one row and wraps it to three lines). Back (quiet) + "I've read it" (primary) in the phone-bar: to "About you" when the form turns it on,
     else straight to question 1. -->
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
  import { passage, hasAbout, LABELS, DATA } from "./data.js";
  let { phone = false, theme = "light", d = DATA } = $props();
  const p = $derived(passage(d));
</script>

{#snippet audio()}<Icon d={P.audio} />{/snippet}
{#snippet open()}<Icon d={P.open} />{/snippet}
{#snippet actions()}<ParticipantActions {phone} back={href("p-welcome")} backLabel={LABELS.back} backLead="back" label="I've read it" href={hasAbout(d) ? href("p-about") : href("p-question", { q: 1 })} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions} dir={d.dir}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">Before you answer</span>
    <h1 class="title-phone">{p.title}</h1>
    <p class="small t-15">Take your time. The questions are about this passage.</p>
    <div class="solid passage" role="group" aria-label="The passage">
      <div class="passage-text">{#each p.verses as [n, t], i}{i ? " " : ""}<strong>{n}</strong> {t}{/each}{#if !p.verses.length}{#if p.list.length}<ul class="l-stack" data-gap="1">{#each p.list as x (x.href || x.reference || x.title)}<li>{#if x.href}<a class="link" href={x.href} target="_blank" rel="noopener">{x.title || x.reference || "Open the passage"}</a>{:else}{x.reference || x.title}{/if}</li>{/each}</ul>{:else}The person who invited you will read or play the passage.{/if}{/if}</div>
      {#if p.page}<div class="passage-foot"><Stack gap={1}><span class="small">{p.page}</span><Row gap={2}><Button label="Listen" variant="quiet" lead={audio} /><Button label="Open as PDF" variant="quiet" lead={open} /></Row></Stack></div>{/if}
    </div>
  </Card>
</ParticipantShell>
