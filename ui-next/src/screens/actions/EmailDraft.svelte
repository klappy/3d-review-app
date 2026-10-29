<!-- A user-controlled email draft, with the same message available when no mail app is configured. Nothing is sent by this app. -->
<script>
  import { copyText } from "./copy.js";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  let { subject, body, label = "Prepare email" } = $props();
  let dialog;
  function show() { status = ""; dialog.showModal(); }
  let status = $state("");
  const mailto = $derived(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  async function copy() {
    status = await copyText(body) ? "Message copied. Paste it into your email." : "Copy failed. Select the message below and copy it.";
  }
</script>

<button class="btn" type="button" aria-haspopup="dialog" onclick={show}><Ico d={A.mail} />{label}</button>
<dialog bind:this={dialog} class="glass-hi" aria-label="Email draft">
  <div class="l-stack" data-gap="2">
    <h2 class="h2">Email draft</h2>
    <button class="btn" type="button" onclick={() => dialog.close()}>Close</button>
    <p class="small">Review this message, then open your email app to choose recipients and send it. Nothing is sent from 3D Review.</p>
    <label class="small">Message<textarea class="in small" readonly rows="7" value={body}></textarea></label>
    <div class="l-row" data-wrap="true" data-gap="2"><a class="btn" href={mailto}>Open email app</a><button class="btn" type="button" onclick={copy}>Copy message</button></div>
    <p class="small">If your email app does not open, copy the message into your email.</p>
    <p class="small" role="status">{status}</p>
  </div>
</dialog>
