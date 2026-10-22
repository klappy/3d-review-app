<!-- UI Next (v4) actions-lane collect list: one glass card per perspective with its survey rows (link, progress, count, icon actions),
     as Print (behind the dialog) and Sandbox (Responses) draw it from generator boards_fac.py collect rows. Lane-local. Status: provisional.
     Row geometry: the pinned .l-grid[data-tpl=survey-row] (1fr 180px 100px auto, 56px, top rule) with the .num[data-size="20"] count;
     rows sit in a plain block so they stack with no gap, as drawn (a Stack would inherit the card's --g).
     The copy control copies (./CopyButton.svelte); QR and Print are links (../href.js href() with the screen's w/theme). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import Bar from "./Bar.svelte";
  import CopyButton from "./CopyButton.svelte";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";

  let { groups, surveys, host, phone = false, theme = "light" } = $props();
  const at = $derived(carry(phone, theme));
  // Bar takes 0..100: a survey with no expected count draws an empty bar, and more answers than expected draw a full one.
  const pct = (s) => { const v = s.of > 0 ? Math.round((100 * s.n) / s.of) : 0; return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0; };
</script>

{#snippet qr()}<Ico d={A.qr} />{/snippet}
{#snippet print()}<Ico d={A.print} />{/snippet}

{#each groups as g}
  <Card gap={2} label={g.name}>
    <Row gap={3}><span class="icn icn-lens" data-lens={g.lens}><Ico d={A.people} /></span><span class="h3">{g.name}</span><span class="small" data-grow>· {g.count}</span><span class="small tab-n">{g.expected}</span></Row>
    <div>
      {#each g.surveys.map((i) => surveys[i]) as s}
        <div class="l-grid" data-tpl="survey-row" data-gap="3">
          <div><b>{s.name}</b><div class="micro kbd">{host}{s.code}</div></div>
          <Bar pct={pct(s)} lens={s.lens} />
          <span class="num tab-n" data-size="20">{s.n} <span class="small">of {s.of}</span></span>
          <Row gap={1}>
            {#if `${host}${s.code}`.trim()}<CopyButton icon text={`${host}${s.code}`} name={s.name} />{:else}<span class="small" aria-label={`${s.name}: no link yet`}>No link yet</span>{/if}
            <Button icon={qr} ariaLabel={`QR code for ${s.name}`} variant="quiet" href={href("qr-room", at)} />
            <Button icon={print} ariaLabel={`Print ${s.name} survey`} variant="quiet" href={href("print", at)} />
          </Row>
        </div>
      {/each}
    </div>
  </Card>
{/each}
