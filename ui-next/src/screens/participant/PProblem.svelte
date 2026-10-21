<!-- UI Next (v4) participant problem states. Status: provisional (playbook rule 12). Boards: PProblem.dc.html (send not confirmed),
     PProblemBusy.dc.html (?state=busy: refused by the rate limiter, automatic retry). Without ?state= the fixture's error picks the board
     through the app's own ui/rate-limit.js isRateLimited. Two hero cards: what happened, then the other cases; one .btn-primary retry in the phone-bar.
     The boards paint the head chip in --b-support (a level colour on a non-level icon, section 1.1): neutral chip here, canvas gap. -->
<script module>
  export const STATES = Object.freeze(["busy"]);
</script>
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import { problem, go } from "./data.js";
  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined && !STATES.includes(state)) throw new TypeError(`PProblem: unknown state "${String(state)}" (busy)`);
  const p = $derived(problem(state));
  const OTHER = $derived([
    ["cal", "This survey has closed", `Collection ended on ${p.closedOn}. Ask the person who invited you if there is a new one.`],
    ["link", "This link doesn't work", "Check for missing characters, or ask for the code and enter it on the home page."],
    ["check", "You already answered", `Thank you — your receipt was ${p.receipt}. Interviewing someone else? Start a new one.`],
  ]);
  const KEEPS = [
    ["globe", "Switch to mobile data", "Shared Wi-Fi counts everyone as one visitor."],
    ["print", "Ask for a paper copy", "The facilitator can enter it later; nothing is lost."],
    ["people", "Show this screen to the facilitator", "The code at the bottom tells them what happened."],
  ];
</script>

{#snippet actions()}<ParticipantActions {phone} label={p.busy ? "Try now" : "Try sending again"} href={go("p-receipt", phone)} lead="refresh" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <Chip icon={p.busy ? "clock" : "warn"} lens={null} />
    {#if p.busy}
      <h1 class="title-phone">A lot of people are opening this at once</h1>
      <p class="small body-16">Your answers are safe on this phone. We will try again by ourselves in a moment — you do not need to do anything. If you are in a room with many people on the same Wi-Fi, this is normal.</p>
      <ProgressBar value={p.waited} max={100} label={p.retry} />
      <p class="small">{p.retry}</p>
    {:else}
      <h1 class="title-phone">We couldn't confirm your answers were received</h1>
      <p class="small body-16">Your answers are still here on this phone. Check your connection and try again — nothing is lost, and sending twice won't count twice.</p>
    {/if}
  </Card>
  <Card hi pad="hero" gap={3}>
    <span class="micro">{p.busy ? "If it keeps happening" : "Other things that can happen"}</span>
    <div class="l-stack" data-gap="3">
      {#each p.busy ? KEEPS : OTHER as [icon, t, d] (t)}<div class="l-row" data-gap="3"><Chip {icon} /><div><div class="h3 t-15">{t}</div><p class="small">{d}</p></div></div>{/each}
    </div>
    {#if p.busy}<p class="micro kbd">{p.diag}</p>{/if}
  </Card>
</ParticipantShell>
