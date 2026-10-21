<!-- UI Next (v4) participant "About you". Status: provisional (playbook rule 12). Board: PAbout.dc.html.
     Shown only when the form turns demographics on (ui/participant-view.js aboutFields, S15a); one fieldset.opts per field, label.row-opt + .rd rows.
     Skip (quiet) + Next (primary) in the phone-bar. The board's 60px participant answer rows are a design-system row the helmet does not generate yet (canvas gap). -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import { about, LABELS, go } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const a = about();
</script>

{#snippet actions()}<ParticipantActions {phone} back={go("p-question", phone)} backLabel="Skip" label={LABELS.next} href={go("p-question", phone)} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <span class="micro">{a.eyebrow}</span>
    <h1 class="title-phone">A little about you</h1>
    <p class="small t-15">This helps the team see whether the translation works for everyone. Nothing here names you.</p>
    {#each a.fields as f (f.key)}
      <fieldset class="opts">
        <legend class="lbl">{f.label}</legend>
        {#each f.options as o (o.code)}<label class="row-opt"><input class="rd" type="radio" name={f.key} value={o.code} checked={a.values[f.key] === o.code} /><span class="t-16">{o.label}</span></label>{/each}
      </fieldset>
    {/each}
  </Card>
</ParticipantShell>
