<!-- UI Next (v4) Close collection screen. Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): CloseCollection.dc.html (desktop dialog over the review's survey groups),
     CloseCollectionPhone.dc.html (phone sheet over the Collect card). Contract: "Dialog and sheet states" (R14): destructive confirm,
     native modal <dialog>, title row with the visible Close (desktop title .h2.t-24, the §1.2 dialog-heading row); focus opens on the least destructive action ("Keep collecting", autofocus);
     Close, Escape and the backdrop go back to Collect; the confirm reads "Yes, …" (0.22.7).
     One .btn-primary: the dialog's / sheet's own "Yes, close and see results"; the head Share and the phone bar go secondary behind it.
     "Every perspective has at least 3 answers, so results can show" is said only when it is true (0.27.0 held line).
     The boards draw one state (the open confirm): any ?state= renders it. -->
<script>
  import Button from "../../Button.svelte";
  import ReviewFrame from "./ReviewFrame.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import CollectPhoneCard from "./CollectPhoneCard.svelte";
  import Dialog from "./Dialog.svelte";
  import Glyph from "./Glyph.svelte";
  import { collectModel } from "./model.js";
  import { href } from "../href.js";
  import fixture from "../../../fixtures/collect/collect.json";

  let { phone = false, theme = "light", data = fixture } = $props();
  const m = $derived(collectModel(data));
  const enough = $derived(m.groups.every((g) => g.answered >= 3));
</script>

{#snippet arrow()}<Glyph name="arrow" />{/snippet}
{#snippet phoneTitle()}<h2 class="h2" id="close-title">Close collection now?</h2>{/snippet}
{#snippet deskTitle()}<div class="l-stack" data-gap="4"><span class="icn icn-lens" data-lens="team"><Glyph name="lock" size={26} /></span><h2 class="h2 t-24" id="close-title">Close collection now?</h2></div>{/snippet}

<ReviewFrame {m} {phone} {theme} shareKind="secondary">
  {#if phone}
    <CollectPhoneCard {m} />
    <Dialog labelledby="close-title" cancel={href("collect")} sheet gap={3} title={phoneTitle}>
      <p class="small">{m.answered} of {m.expected} expected have answered. Links stop working; you can reopen later.</p>
      <Button label="Yes, close and see results" variant="primary" lg block href={href("results")} />
      <!-- svelte-ignore a11y_autofocus -->
      <a class="btn btn-quiet btn-block" href={href("collect")} autofocus>Keep collecting</a>
    </Dialog>
  {:else}
    <SurveyGroups groups={m.groups} />
    <Dialog labelledby="close-title" cancel={href("collect")} titleTop title={deskTitle}>
      <p class="small t-15">Links and codes stop working and the review moves to <strong>Understand</strong>. {m.answered} responses are in. You can reopen collection later — results refresh when you do.</p>
      <div class="solid l-card l-stack"><span class="small">{m.byLens}.{#if enough}{" "}Every perspective has at least 3 answers, so results can show.{/if}</span></div>
      <div class="l-row" data-gap="2" data-justify="end">
        <!-- svelte-ignore a11y_autofocus -->
        <a class="btn btn-quiet" href={href("collect")} autofocus>Keep collecting</a>
        <Button label="Yes, close and see results" variant="primary" lg href={href("results")} trail={arrow} />
      </div>
    </Dialog>
  {/if}
</ReviewFrame>
