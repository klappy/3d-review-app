<!-- UI Next (v4) participant "About you". Status: provisional (playbook rule 12). Board: PAbout.dc.html.
     Shown only when the form turns demographics on (ui/participant-view.js aboutFields, S15a); one fieldset.opts per field, label.row-opt.answer
     (§9 participant row, 60px) + .rd rows. The eyebrow counts the fields drawn ("1 question, optional"; the board says 2 and draws one).
     Skip (quiet) + Next (primary) in the phone-bar, both to question 1: Next keeps the choices, Skip clears them first (data.js skipAbout:
     an untouched field sends nothing). No field (demographics off): no eyebrow and no Skip; the flow does not link here then (data.js hasAbout). -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import { href } from "../href.js";
  import { about, skipAbout, LABELS, DATA } from "./data.js";
  let { phone = false, theme = "light", d = DATA, onabout } = $props();
  const a = about(d);
  let values = $state({ ...a.values });
  $effect(() => { onabout?.({ ...values }); });
</script>

{#snippet actions()}<ParticipantActions {phone} back={a.fields.length ? href("p-question", { q: 1 }) : undefined} backLabel="Skip" onback={() => (values = skipAbout())} label={LABELS.next} href={href("p-question", { q: 1 })} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions} dir={d.dir}>
  <Card hi pad="hero" gap={4}>
    {#if a.eyebrow}<span class="micro">{a.eyebrow}</span>{/if}
    <h1 class="title-phone">A little about you</h1>
    <p class="small t-15">This helps the team see whether the translation works for everyone. Nothing here names you.</p>
    {#each a.fields as f (f.key)}
      <fieldset class="opts">
        <legend class="lbl">{f.label}</legend>
        {#each f.options as o (o.code)}<label class="row-opt answer"><input class="rd" type="radio" name={f.key} value={o.code} checked={values[f.key] === o.code} onchange={() => (values[f.key] = o.code)} /><span>{o.label}</span></label>{/each}
      </fieldset>
    {/each}
  </Card>
</ParticipantShell>
