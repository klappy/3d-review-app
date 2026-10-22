<!-- UI Next (v4) participant shell. Status: provisional (playbook rule 12). AppShell + the participant header + the actions.
     Phone (every participant board is a 390x844 phone board): content sits in the shell's .l-page.l-phone, actions in the phone-bar.
     Desktop: no participant desktop board is drawn (canvas gap, cookbook RESULTS-participant.md); the same composition sits in a
     read-width Page (520) with the actions as its last Row. No <style>, no inline style. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import ParticipantHeader from "./ParticipantHeader.svelte";
  // dir (live): the chosen language's direction (i18n.js isRtl) on the shell, so a right-to-left translation reads right to left.
  let { phone = false, theme = "light", actions, children, dir } = $props();
</script>

{#snippet top()}<ParticipantHeader />{/snippet}
{#snippet bar()}{#if phone}{@render actions?.()}{/if}{/snippet}

<div class="l-stack" dir={dir === "rtl" ? "rtl" : undefined}><AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}{@render children?.()}{:else}<Page width="read" gap={4}>{@render children?.()}{@render actions?.()}</Page>{/if}
</AppShell></div>
