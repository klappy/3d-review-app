<!-- Existing dialog/sheet patterns; user-controlled draft with a selectable message. Nothing is sent by this app. -->
<script>
  import { copyText } from "./copy.js";
  import Ico from "./Ico.svelte";
  import IconAction from "./IconAction.svelte";
  import Row from "../../Row.svelte";
  import { A } from "./icons.js";
  import { modal, closeDialog } from "./modal.js";
  let { subject, body, label = "Prepare email", phone = false } = $props();
  const uid = $props.id();
  const titleId = `${uid}-email-title`;
  let dialog;
  let status = $state("");
  function show() {
    status = "";
    dialog.showModal();
    dialog.querySelector("[data-autofocus]")?.focus();
  }
  // Reuse the existing backdrop-dismissal attachment without opening the draft on mount.
  const dismiss = el => modal(el, { open: false });
  const mailto = $derived(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  async function copy() {
    status = await copyText(body) ? "Message copied. Paste it into your email." : "Copy failed. Select the message below and copy it.";
  }
</script>

<button class={phone ? "btn btn-block" : "btn"} type="button" aria-haspopup="dialog" onclick={show}><Ico d={A.mail} />{label}</button>
<dialog bind:this={dialog} class={phone ? "glass-hi sheet" : "glass-hi"} aria-labelledby={titleId} closedby="any" {@attach dismiss}>
  {#if phone}<div class="sheet-handle" aria-hidden="true"></div>{/if}
  <div class="l-stack" data-gap="3">
    <Row split gap={2}><h2 class={phone ? "micro sheet-title" : "h2 t-24"} id={titleId}>Email draft</h2><IconAction d={A.x} ariaLabel="Close" onclick={() => closeDialog(dialog)} /></Row>
    <p class="small">Review this message, then open your email app to choose recipients and send it. Nothing is sent from 3D Review.</p>
    <label class="small l-stack" data-gap="1">Message<textarea class="in small" readonly rows="7" value={body}></textarea></label>
    <Row wrap gap={2}><a class="btn btn-primary" href={mailto} data-autofocus>Open email app</a><button class="btn" type="button" onclick={copy}>Copy message</button></Row>
    <p class="small">If your email app does not open, copy the message into your email.</p>
    <p class="small" role="status">{status}</p>
  </div>
</dialog>
