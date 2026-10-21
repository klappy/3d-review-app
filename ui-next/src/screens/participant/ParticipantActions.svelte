<!-- UI Next (v4) participant actions (lane variant of the shared PhoneBar). Status: provisional (playbook rule 12).
     Contract: design-system.md section 2 Phone shell row + section 9 phone-bar: the thumb-zone glass bar holds the page's actions, Back
     and Next never above the question. Differs from PhoneBar only where the participant boards differ: the quiet Back can carry an
     icon or read "Skip" (PAbout), the main action can be secondary (PReceipt "Interview another person"), icons lead or trail.
     Desktop (no participant desktop board yet): the same buttons as a Row at the end of the read-width Page. -->
<script>
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  let { phone = false, label, href, primary = true, lead, trail, back, backLabel = "Back", backLead } = $props();
  for (const k of [lead, trail, backLead]) if (k !== undefined && !Object.hasOwn(P, k)) throw new TypeError(`ParticipantActions: unknown icon "${k}"`);
  if (!(typeof label === "string" && label.trim())) throw new TypeError("ParticipantActions: the main action needs a label");
</script>

{#snippet leadIcon()}<Icon d={P[lead]} />{/snippet}
{#snippet trailIcon()}<Icon d={P[trail]} />{/snippet}
{#snippet backIcon()}<Icon d={P[backLead]} />{/snippet}
{#snippet buttons()}
  {#if back}<Button label={backLabel} variant="quiet" href={back} lead={backLead ? backIcon : undefined} />{/if}
  <Button {label} variant={primary ? "primary" : "secondary"} lg block={phone && !back} {href} lead={lead ? leadIcon : undefined} trail={trail ? trailIcon : undefined} />
{/snippet}

{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions">{@render buttons()}</div>
{:else}<div class="l-row" data-gap="2" data-split={back ? "" : undefined} role="group" aria-label="Page actions">{@render buttons()}</div>{/if}
