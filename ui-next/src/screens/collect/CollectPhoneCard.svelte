<!-- UI Next (v4) collect lane phone hero card (CollectPhone.dc.html; behind the CollectMenuPhone and CloseCollectionPhone sheets).
     Status: provisional. boards_fphone.py f_collect: count, room health, the survey list, the "Meeting offline?" block (offline actions'
     one home on phone, §2 Offline actions R32), then the open-until line. Card hero pad (design-system.md 8.2, data-pad=hero). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import RoomHealth from "./RoomHealth.svelte";
  import Glyph from "./Glyph.svelte";
  import { href } from "./model.js";
  let { m } = $props();
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet qr()}<Glyph name="qr" />{/snippet}
{#snippet pen()}<Glyph name="pen" />{/snippet}

<Card hi pad="hero" gap={3}>
  <div class="l-row" data-gap="2" data-align="baseline"><span class="num" data-size="40">{m.answered}</span><span class="small">of {m.expected} · {m.surveys.length} surveys</span></div>
  <RoomHealth opened={m.room.phone.opened} refused={m.room.phone.refused} wrap />
  <SurveyGroups groups={m.groups} phone />
  <div class="l-stack" data-gap="2" id="offline">
    <span class="h3">Meeting offline?</span>
    <Row wrap gap={2}>
      <Button label="Print surveys" href={href("print", { phone: true })} lead={print} />
      <Button label="Print QR pages" href={href("print-qr", { phone: true })} lead={qr} />
      <Button label="Enter paper answers" href={href("paper-entry", { phone: true })} lead={pen} />
    </Row>
  </div>
  <p class="small">Open until {m.review.closes} · <a class="link" href={href("setup1", { phone: true })}>Change dates</a> · <a class="link" href={href("setup2", { phone: true })}>Open the passage</a></p>
</Card>
