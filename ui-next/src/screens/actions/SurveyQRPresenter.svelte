<!-- One existing Share link at a time; native modal isolates the projected code and restores focus on dismissal. -->
<script>
  import Qr from "../collect/Qr.svelte";
  import { qrModules } from "../../app/data.js";
  import { modal, closeDialog } from "./modal.js";
  import "../../../components/survey-qr-presenter.css";
  let { surveys, start = 0, host = "", project, review, onclose } = $props();
  let at = $state(start);
  let dialog;
  const uid = $props.id();
  const survey = $derived(surveys[at]);
  const link = $derived(survey?.code ? `${host}${survey.code}` : "");
  const cells = $derived.by(() => {
    if (!link) return null;
    try { return qrModules(link).cells; } catch { return null; }
  });
  function move(delta) { at = Math.max(0, Math.min(surveys.length - 1, at + delta)); }
  function keydown(e) {
    if (!dialog?.open) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault(); move(e.key === "ArrowRight" ? 1 : -1);
    }
  }
</script>

<!-- A disabled boundary button can release focus to body; keep arrows working while this modal is open. -->
<svelte:window onkeydown={keydown} />
<dialog class="survey-qr-presenter" bind:this={dialog} aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-help`} onclose={onclose} {@attach modal}>
  <div class="survey-qr-heading">
    <p class="small">{project} · {review}</p>
    <button type="button" class="btn" data-autofocus onclick={() => closeDialog(dialog)}>Close QR code</button>
  </div>
  <div class="survey-qr-content">
    <div aria-live="polite" aria-atomic="true">
      <p class="micro">Survey {at + 1} of {surveys.length}</p>
      <h2 class="h1" id={`${uid}-title`}>{survey?.name ?? "Survey unavailable"}</h2>
    </div>
    {#if cells}
      <Qr {cells} size="page" />
      <p class="small survey-qr-link">{link}</p>
    {:else}
      <p role="status">This survey's link is unavailable. Close this view and check its link before sharing.</p>
    {/if}
    <p class="small" id={`${uid}-help`}>Scan to open this survey. Use Previous / Next or the left and right arrow keys to change surveys.</p>
    <div class="survey-qr-controls" role="group" aria-label="Survey navigation">
      <button class="btn" type="button" disabled={at <= 0} onclick={() => move(-1)}>Previous survey</button>
      <button class="btn btn-primary" type="button" disabled={at >= surveys.length - 1} onclick={() => move(1)}>Next survey</button>
    </div>
  </div>
</dialog>
