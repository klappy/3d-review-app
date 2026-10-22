<!-- UI Next (v4) participant actions (lane variant of the shared PhoneBar). Status: provisional (playbook rule 12).
     Contract: design-system.md section 2 Phone shell row + section 9 phone-bar: the thumb-zone glass bar holds the page's actions, Back
     and Next never above the question. Differs from PhoneBar only where the participant boards differ: the quiet Back can carry an
     icon or read "Skip" (PAbout), the main action can be secondary (PReceipt "Interview another person"), icons lead or trail.
     onback (optional) runs when the quiet Back/Skip link is activated, before it navigates (PAbout: Skip clears the choices); the shared
     Button takes no handler, so the bar listens for the click (mouse or keyboard) on its quiet link.
     The checks are derived, so they run again whenever a prop changes, not only at mount.
     Desktop (no participant desktop board yet): the same buttons as a Row at the end of the read-width Page. -->
<script>
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  // onaction (optional, live mode): runs instead of the main link's navigation (submit, redeem, interview another); the link stays a link.
  let { phone = false, label, href, primary = true, lead, trail, back, backLabel = "Back", backLead, onback, onaction, disabled = false } = $props();
  const glyph = (k) => {
    if (k === undefined) return undefined;
    if (!Object.hasOwn(P, k)) throw new TypeError(`ParticipantActions: unknown icon "${k}"`);
    return P[k];
  };
  const v = $derived.by(() => {
    if (!(typeof label === "string" && label.trim())) throw new TypeError("ParticipantActions: the main action needs a label");
    if (onback !== undefined && typeof onback !== "function") throw new TypeError("ParticipantActions: onback is a function");
    return { label, lead: glyph(lead), trail: glyph(trail), back: glyph(backLead) };
  });
  const listen = (el) => {
    const f = (e) => {
      if (!(e.target instanceof Element)) return;
      if (onback && back && e.target.closest(".btn-quiet")) return onback();
      if (onaction && e.target.closest(".btn:not(.btn-quiet)")) { e.preventDefault(); if (!disabled) onaction(); }
    };
    el.addEventListener("click", f);
    return () => el.removeEventListener("click", f);
  };
</script>

{#snippet leadIcon()}<Icon d={v.lead} />{/snippet}
{#snippet trailIcon()}<Icon d={v.trail} />{/snippet}
{#snippet backIcon()}<Icon d={v.back} />{/snippet}
{#snippet buttons()}
  {#if back}<Button label={backLabel} variant="quiet" href={back} lead={v.back ? backIcon : undefined} />{/if}
  <Button label={v.label} variant={primary ? "primary" : "secondary"} lg block={phone && !back} {href} lead={v.lead ? leadIcon : undefined} trail={v.trail ? trailIcon : undefined} />
{/snippet}

{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions" {@attach listen}>{@render buttons()}</div>
{:else}<div class="l-row" data-gap="2" data-split={back ? "" : undefined} role="group" aria-label="Page actions" {@attach listen}>{@render buttons()}</div>{/if}
