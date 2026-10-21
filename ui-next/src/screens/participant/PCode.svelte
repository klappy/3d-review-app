<!-- UI Next (v4) participant code entry. Status: provisional (playbook rule 12). Boards: PCode.dc.html (state default), PCodeError.dc.html (?state=error).
     Field per design-system.md section 2 Field: label.lbl + input.in.kbd; on error aria-invalid + p.field-error[role=alert] in aria-describedby,
     no colour (ruling 2; the board's --b-urgent edge and text are the known finding the contract names). One .btn-primary in the phone-bar. -->
<script module>
  export const STATES = Object.freeze(["error"]);
</script>
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  import { DATA, go } from "./data.js";
  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined && !STATES.includes(state)) throw new TypeError(`PCode: unknown state "${String(state)}" (error)`);
  const error = $derived(state === "error");
</script>

{#snippet actions()}<ParticipantActions {phone} label={error ? "Try again" : "Open my survey"} href={go("p-welcome", phone)} trail="arrow" />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <h1 class="title-phone">Have a survey code?</h1>
    <p class="small t-15">It is printed on your paper survey, or the person who invited you can read it to you.</p>
    <div>
      <label class="lbl" for="p-code">Code</label>
      <input class="in kbd" id="p-code" inputmode="text" autocapitalize="characters" autocomplete="off" placeholder={DATA.code.placeholder} value={error ? DATA.code.entered : ""} aria-invalid={error ? "true" : undefined} aria-describedby={error ? "p-code-err" : undefined} />
    </div>
    {#if error}<p class="small field-error" id="p-code-err" role="alert"><Icon d={P.warn} />We don't recognise that code. Check each letter and number against your paper, or ask the person who invited you to read it again.</p>{/if}
    <div class="solid l-card l-row" data-gap="3"><Chip icon="qr" /><span class="small">Or point your camera at the QR code on the paper or the screen.</span></div>
  </Card>
</ParticipantShell>
