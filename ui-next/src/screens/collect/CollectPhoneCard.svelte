<!-- UI Next (v4) collect lane phone hero card (CollectPhone.dc.html; behind the CollectMenuPhone and CloseCollectionPhone sheets).
     Status: provisional. boards_fphone.py f_collect: count, the survey list (room health retired 2026-10-22, cookbook PR 198), the "Meeting offline?" block (offline actions'
     one home on phone, §2 Offline actions R32), then the open-until line. Card hero pad (design-system.md 8.2, data-pad=hero). The offline
     buttons grow to fill their row (§8.8 Growing button, .l-row > .btn-block on the PIN). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import Glyph from "./Glyph.svelte";
  import { plural } from "./model.js";
  import { href } from "../href.js";
  let { m } = $props();
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet qr()}<Glyph name="qr" />{/snippet}
{#snippet pen()}<Glyph name="pen" />{/snippet}

<Card hi pad="hero" gap={3}>
  <div class="l-row" data-gap="2" data-align="baseline"><span class="num" data-size="40">{m.answered ?? "—"}</span><span class="small">of {m.expected ?? "—"} · {plural(m.surveys.length, "survey", "surveys")}</span></div>
  <SurveyGroups groups={m.groups} phone />
  <div class="l-stack" data-gap="2" id="offline">
    <span class="h3">Meeting offline?</span>
    <Row wrap gap={2}>
      <Button label="Print surveys" block href={href("print")} lead={print} />
      <Button label="Print QR pages" block href={href("print-qr")} lead={qr} />
      <Button label="Enter paper answers" block href={href("paper-entry")} lead={pen} />
    </Row>
  </div>
  <p class="small">Open until {m.review.closes} · <a class="link" href={href("setup1")}>Change dates</a> · <a class="link" href={href("setup2")}>Open the passage</a></p>
</Card>
