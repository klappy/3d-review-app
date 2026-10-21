<!-- UI Next (v4) participant "About you". Status: provisional (playbook rule 12). Board: PAbout.dc.html.
     Shown only when the form turns demographics on (ui/participant-view.js aboutFields, S15a); one fieldset.opts per field, label.row-opt.answer
     (§9 participant row, 60px) + .rd rows. The eyebrow counts the fields drawn ("1 question, optional"; the board says 2 and draws one).
     Skip (quiet) + Next (primary) in the phone-bar. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import { href } from "../href.js";
  import { about, LABELS } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const a = about();
</script>

{#snippet actions()}<ParticipantActions {phone} back={href("p-question", { q: 1 })} backLabel="Skip" label={LABELS.next} href={href("p-question", { q: 1 })} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">{a.eyebrow}</span>
    <h1 class="title-phone">A little about you</h1>
    <p class="small t-15">This helps the team see whether the translation works for everyone. Nothing here names you.</p>
    {#each a.fields as f (f.key)}
      <fieldset class="opts">
        <legend class="lbl">{f.label}</legend>
        {#each f.options as o (o.code)}<label class="row-opt answer"><input class="rd" type="radio" name={f.key} value={o.code} checked={a.values[f.key] === o.code} /><span>{o.label}</span></label>{/each}
      </fieldset>
    {/each}
  </Card>
</ParticipantShell>
