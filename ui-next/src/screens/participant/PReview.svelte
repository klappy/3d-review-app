<!-- UI Next (v4) participant "Check your answers". Status: provisional (playbook rule 12). Board: PReview.dc.html (four rows), ?state=all (every answer).
     Rows: the question (small) over the answer (ui/present.js reviewAnswer, the app's own review wording) and its Change link to that question
     (?q=<n>), rules between rows (.hr); the list and its "Show all" share a Stack (--sp-5 = the board's 12px row padding + 12px card gap).
     "Show all N answers" (quiet link) opens ?state=all, which lists all N; any other ?state= renders the four. One .btn-primary
     "Send my answers" in the phone-bar. The answer line borrows .cap-name (600 / --t-15, the board's inline values; no review-answer row yet). -->
<script module>
  export const STATES = Object.freeze(["all"]);
</script>
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { href } from "../href.js";
  import { P } from "./icons.js";
  import { review, pickState, LABELS } from "./data.js";
  let { phone = false, theme = "light", state } = $props();
  const r = $derived(review(pickState(state, STATES) === "all"));
</script>

{#snippet chev()}<Icon d={P.chev} />{/snippet}
{#snippet actions()}<ParticipantActions {phone} label="Send my answers" href={href("p-receipt")} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={3}>
    <h1 class="title-phone">Check your answers</h1>
    <p class="small t-15">You can change any answer before you send.</p>
    <Stack gap={5}>
    <div class="l-stack" data-gap="3">
      {#each r.rows as row (row.id)}
        <hr class="hr" />
        <div class="l-stack" data-gap="1"><span class="small">{row.q}</span><div class="l-row" data-gap="3" data-split><span class="cap-name">{row.a}</span><a class="link" href={href("p-question", { q: row.n })} aria-label={`${LABELS.change}: ${row.q}`}>{LABELS.change}</a></div></div>
      {/each}
    </div>
    {#if !r.all}<Button label={`Show all ${r.total} answers`} variant="quiet" trail={chev} href={href("p-review", { state: "all" })} />{/if}
    </Stack>
  </Card>
</ParticipantShell>
