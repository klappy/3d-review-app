<!-- UI Next (v4) actions-lane collect list: one glass card per perspective with its survey rows (link, progress, count, icon actions),
     as Print (behind the dialog) and Sandbox (Responses) draw it from generator boards_fac.py collect rows. Lane-local. Status: provisional.
     Row geometry: the boards' 1fr 180px 100px auto grid is drawn as Row split + Bar w=180 (no grid template row yet: canvas gap). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import Button from "../../Button.svelte";
  import Bar from "./Bar.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";

  let { groups, surveys, host, shareHref = "?ui_next=on&screen=share", qrHref = "?ui_next=on&screen=qr-room", printHref = "?ui_next=on&screen=print" } = $props();
  const pct = (s) => Math.round((100 * s.n) / s.of);
</script>

{#snippet copy()}<Ico d={A.copy} />{/snippet}
{#snippet qr()}<Ico d={A.qr} />{/snippet}
{#snippet print()}<Ico d={A.print} />{/snippet}

{#each groups as g}
  <Card gap={2} label={g.name}>
    <Row gap={3}><span class="icn icn-lens" data-lens={g.lens}><Ico d={A.people} /></span><span class="h3">{g.name}</span><span class="small">· {g.count}</span><span class="small tab-n">{g.expected}</span></Row>
    {#each g.surveys.map((i) => surveys[i]) as s}
      <hr class="hr" />
      <Row split gap={3}>
        <Stack gap={1}><b>{s.name}</b><span class="micro kbd">{host}{s.code}</span></Stack>
        <Row gap={3}>
          <Bar pct={pct(s)} lens={s.lens} w={180} />
          <span class="num h2 tab-n">{s.n} <span class="small">of {s.of}</span></span>
          <Row gap={1}>
            <Button icon={copy} ariaLabel={`Copy link for ${s.name}`} variant="quiet" href={shareHref} />
            <Button icon={qr} ariaLabel={`QR code for ${s.name}`} variant="quiet" href={qrHref} />
            <Button icon={print} ariaLabel={`Print ${s.name} survey`} variant="quiet" href={printHref} />
          </Row>
        </Row>
      </Row>
    {/each}
  </Card>
{/each}
