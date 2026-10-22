<!-- UI Next (v4) participant problem state. Status: provisional (playbook rule 12). Board: PProblem.dc.html (send not confirmed; the other
     cases listed under it). The former PProblemBusy board (?state=busy, refused by the app rate limiter, automatic retry) is RETIRED
     (cookbook PR 198; RULING-2026-10-16-scrap-app-ratelimit): no such state exists in the product, so ?state= is ignored. Two hero cards:
     what happened, then the other cases; one .btn-primary retry in the phone-bar. Rows: the PIN's §9 participant rows (56px neutral head
     chip, .lead-16, 32px list chips in the survey's lens beside a two-line block, .l-row[data-align=start]). Live: the journey's own
     notice explains the headline; a server-asked wait is stated, never auto-retried. -->
<script module>
  export const STATES = Object.freeze([]);
</script>
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import { href } from "../href.js";
  import { problem, surveyLens, DATA } from "./data.js";
  let { phone = false, theme = "light", state, d = DATA, onretry } = $props();
  const p = $derived(problem(state, d));
  const lens = $derived(surveyLens(d));
  const OTHER = $derived([
    ["cal", "This survey has closed", `Collection ended on ${p.closedOn}. Ask the person who invited you if there is a new one.`],
    ["link", "This link doesn't work", "Check for missing characters, or ask for the code and enter it on the home page."],
    ["check", "You already answered", `Thank you — your receipt was ${p.receipt}. Interviewing someone else? Start a new one.`],
  ]);
</script>

{#snippet actions()}{#if p.saved}<ParticipantActions {phone} label="Enter a code instead" href={href("p-code")} lead="link" />{:else}<ParticipantActions {phone} label="Try sending again" href={href("p-receipt")} lead="refresh" onaction={onretry} />{/if}{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <Chip icon="warn" size={56} lens={null} />
    <h1 class="title-phone">{p.saved ? "The last answers were saved" : "We couldn't confirm your answers were received"}</h1>
    <p class="lead-16">{p.notice || "Your answers are still here on this phone. Check your connection and try again — nothing is lost, and sending twice won't count twice."}{#if p.retryAfter} The server asked for a wait of about {p.retryAfter} s before the next try.{/if}</p>
  </Card>
  {#if !p.saved}<Card hi pad="hero" gap={3}>
    <span class="micro">Other things that can happen</span>
    <div class="l-stack" data-gap="3">
      {#each OTHER as [icon, t, d] (t)}<div class="l-row" data-gap="3" data-align="start"><Chip {icon} size={32} {lens} /><div><div class="h3 t-15">{t}</div><p class="small">{d}</p></div></div>{/each}
    </div>
  </Card>{/if}
</ParticipantShell>
