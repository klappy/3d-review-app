<!-- UI Next (v4) participant code entry. Status: provisional (playbook rule 12). Boards: PCode.dc.html (state default), PCodeError.dc.html (?state=error).
     Field per design-system.md section 2 Field: label.lbl + input.in.kbd.code (§9 participant row: 24px, .14em, 56px); on error aria-invalid +
     p.field-error[role=alert] in aria-describedby under the input inside the field (--sp-2, the Field row's help gap), no colour (ruling 2; the board at the PIN draws the same 2px --ink edge and --ink text).
     One .btn-primary in the phone-bar: "Open my survey" -> p-welcome; on error "Try again" stays on p-code (redemption not wired: debt 5).
     The field is a GET form whose hidden fields are that same link's query, so Enter in the code box goes where the bar's link goes. The
     code box has no name (nothing is redeemed yet, so the code is not put in the URL); the bar's primary stays a link because the shared
     Button renders no submit button (handed back).
     Any other ?state= renders the default. The QR hint chip is neutral: no survey (so no lens) before a code is redeemed. -->
<script module>
  export const STATES = Object.freeze(["error"]);
</script>
<script>
  import ParticipantShell from "./ParticipantShell.svelte";
  import ParticipantActions from "./ParticipantActions.svelte";
  import Chip from "./Chip.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Icon from "../../Icon.svelte";
  import { href } from "../href.js";
  import { P } from "./icons.js";
  import { DATA, pickState } from "./data.js";
  // onredeem(code) (live): redeems the typed code (POST /v2/participate/code) instead of following the link; error: the refusal to show.
  let { phone = false, theme = "light", state: asked, d = DATA, onredeem, message = "", busy = false } = $props(); // `state: asked`: a local named state would make $state a store read
  let code = $state("");
  const error = $derived(pickState(asked, STATES) === "error" || !!message);
  const submit = (e) => { if (!onredeem) return; e.preventDefault(); if (!busy) onredeem(code); };
  const target = $derived(error ? href("p-code") : href("p-welcome"));
  const fields = $derived([...new URLSearchParams(target)]);
</script>

{#snippet actions()}<ParticipantActions {phone} label={busy ? "Checking…" : error ? "Try again" : "Open my survey"} href={target} trail="arrow" onaction={onredeem ? () => { if (!busy) onredeem(code); } : undefined} disabled={busy} />{/snippet}

<ParticipantShell {phone} {theme} {actions}>
  <Card hi pad="hero" gap={4}>
    <h1 class="title-phone">Have a survey code?</h1>
    <p class="small t-15">It is printed on your paper survey, or the person who invited you can read it to you.</p>
    <a class="link" href="/participate/?demo=1">Try a sample survey in the current design — nothing is sent</a>
    <form method="get" id="p-code-form" onsubmit={submit}>
      {#each fields as [name, value] (name)}<input type="hidden" {name} {value} />{/each}
      <label class="lbl" for="p-code">Code</label>
      <Stack gap={2}>
        <input class="in kbd code" id="p-code" inputmode="text" autocapitalize="characters" autocomplete="off" placeholder={d.code.placeholder} value={onredeem ? code : error ? d.code.entered : ""} oninput={(e) => (code = e.currentTarget.value)} aria-invalid={error ? "true" : undefined} aria-describedby={error ? "p-code-err" : undefined} />
        {#if error}<p class="small field-error" id="p-code-err" role="alert"><Icon d={P.warn} />{message || "We don't recognise that code. Check each letter and number against your paper, or ask the person who invited you to read it again."}</p>{/if}
      </Stack>
    </form>
    <div class="solid l-card l-row" data-gap="3"><Chip icon="qr" lens={null} /><span class="small">Or point your camera at the QR code on the paper or the screen.</span></div>
  </Card>
</ParticipantShell>
