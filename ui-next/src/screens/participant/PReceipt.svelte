<!-- UI Next (v4) participant receipt ("Thank you"). Status: provisional (playbook rule 12). Board: PReceipt.dc.html.
     64px check chip (survey lens), display title, .lead-16, the receipt in a .solid card as .kbd.receipt (R-2048-731 format, design-system.md
     section 4; §9 participant row 20 / .12em), "You can close this page". The bar holds one secondary "Interview another person"
     (ui/participate/i18n.js SURVEYOR_EN, S29 surveyor mode): no primary on this page, as drawn. -->
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import { href } from "../href.js";
  import { DATA, surveyLens, LABELS } from "./data.js";
  let { phone = false, theme = "light", d = DATA, onanother, notice = "" } = $props();
</script>

{#snippet actions()}<ParticipantActions {phone} primary={false} label={LABELS.interviewAnother} href={href("p-welcome")} lead="people" onaction={onanother} />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <Chip icon="check" size={64} lens={surveyLens(d)} />
    <h1 class="display">Thank you</h1>
    <p class="lead-16">{notice || "Your answers were received. Your perspective helps the translation grow."}</p>
    <div class="solid l-card l-stack" data-gap="1" role="group" aria-label="Receipt"><span class="micro">Receipt</span><span class="kbd receipt">{d.receipt}</span><span class="small">Keep this in case the person who invited you asks for it.</span></div>
    <p class="small">You can close this page.</p>
  </Card>
</ParticipantShell>
