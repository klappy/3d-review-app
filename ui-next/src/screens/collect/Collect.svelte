<!-- UI Next (v4) Collect screen ("Collect responses"). Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Collect.dc.html (state default), CollectMenu.dc.html (state "menu": the ⋯ menu
     open), CollectPhone.dc.html (phone), CollectMenuPhone.dc.html (phone, state "menu": the ⋯ sheet), CollectDark.dc.html (theme dark).
     One .btn-primary: "Share the survey" (desktop head; phone: the phone-bar). Offline actions have one home, the "Meeting offline?" card
     (design-system.md §2 Offline actions, R32). Room health row: retired 2026-10-22 (PR 198). Composed of AppShell > Page > Grid > Card / Stack / Row
     and the §2 components; no <style>, no inline style. -->
<script module>
  export const STATES = Object.freeze(["default", "menu"]);
</script>
<!-- An unknown ?state= renders the default state (model.js pickState); it never throws. -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import ReviewFrame from "./ReviewFrame.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import CollectPhoneCard from "./CollectPhoneCard.svelte";
  import MenuSheet from "./MenuSheet.svelte";
  import Glyph from "./Glyph.svelte";
  import { collectModel, pickState } from "./model.js";
  import { href } from "../href.js";
  import fixture from "../../../fixtures/collect/collect.json";

  let { phone = false, theme = "light", state, data = fixture } = $props();
  const st = $derived(pickState(state, STATES));
  const m = $derived(collectModel(data));
  const r = $derived(m.review);
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet qr()}<Glyph name="qr" />{/snippet}
{#snippet pen()}<Glyph name="pen" />{/snippet}

<ReviewFrame {m} {phone} {theme} menuOpen={st === "menu"}>
  {#if phone}
    <CollectPhoneCard {m} />
    {#if st === "menu"}<MenuSheet {m} />{/if}
  {:else}
    <div class="l-grid" data-gap="5" data-tpl="aside">
      <div class="l-stack" data-gap="3">
        <div class="l-row" data-gap="3" data-align="baseline"><h2 class="h2">Responses</h2><span class="num" data-size="40">{m.answered}</span><span class="small">of {m.expected ?? "—"} expected · updated {r.updated}</span></div>
        <SurveyGroups groups={m.groups} />
      </div>
      <aside class="l-stack" data-gap="4">
        <Card gap={3}>
          <h3 class="h3">Survey open</h3>
          <p class="small t-15">{r.opens} – {r.closes} · <strong>{r.daysLeft} days left</strong></p>
          <a class="link" href={href("setup1")}>Change dates</a>
          <p class="small">Results open on {r.closes}, or earlier if you close collection from the ⋯ menu.</p>
        </Card>
        <div class="glass l-card l-stack" data-gap="3" id="offline">
          <h3 class="h3">Meeting offline?</h3>
          <p class="small t-15">Print each survey on paper, then enter the answers here.</p>
          <Row wrap gap={2}>
            <Button label="Print surveys" href={href("print")} lead={print} />
            <Button label="Print QR pages" href={href("print-qr")} lead={qr} />
            <Button label="Enter paper answers" href={href("paper-entry")} lead={pen} />
          </Row>
        </div>
        <Card gap={3}>
          <h3 class="h3">Before people answer</h3>
          <p class="small t-15">Read or play <strong>{r.passage}</strong> to everyone answering. The survey shows it too.</p>
          <a class="link" href={href("setup2")}>Open the passage</a>
        </Card>
      </aside>
    </div>
  {/if}
</ReviewFrame>
