<!-- UI Next (v4) participant "Check your answers". Status: provisional (playbook rule 12). Board: PReview.dc.html.
     Rows: the question (small) over the answer (ui/present.js reviewAnswer, the app's own review wording) and its Change link, rules between rows (.hr); the list and its "Show all" share a Stack (--sp-5 = the board's 12px row padding + 12px card gap).
     "Show all N answers" (quiet) closes the card; one .btn-primary "Send my answers" in the phone-bar. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  import { review, LABELS, go } from "./data.js";
  let { phone = false, theme = "light" } = $props();
  const r = review();
</script>

{#snippet chev()}<Icon d={P.chev} />{/snippet}
{#snippet actions()}<ParticipantActions {phone} label="Send my answers" href={go("p-receipt", phone)} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={3}>
    <h1 class="title-phone">Check your answers</h1>
    <p class="small t-15">You can change any answer before you send.</p>
    <Stack gap={5}>
    <div class="l-stack" data-gap="3">
      {#each r.rows as row (row.id)}
        <hr class="hr" />
        <div class="l-stack" data-gap="1"><span class="small">{row.q}</span><div class="l-row" data-gap="3" data-split><span class="cap-name">{row.a}</span><a class="link" href={go("p-question", phone)} aria-label={`${LABELS.change}: ${row.q}`}>{LABELS.change}</a></div></div>
      {/each}
    </div>
    <Button label={`Show all ${r.total} answers`} variant="quiet" trail={chev} />
    </Stack>
  </Card>
</ParticipantShell>
