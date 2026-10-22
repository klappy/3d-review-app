<!-- UI Next (v4) collect lane survey groups. Status: provisional. The survey is the row (boards_fac.py group_rows, Collect provenance
     "each has its own count, link, QR and print; groups are headers"): one glass Card per perspective, a head Row (lens icon, perspective,
     survey count, n of N expected) and one row per survey: name + short link · bar · n of N · copy link, QR, print.
     phone: the CollectPhone list (boards_fphone.py f_collect): lens dot · name over bar · n/N · copy link, QR.
     Row geometry: desktop .l-grid[data-tpl=survey-row], phone [data-grow] (§8.7 rows on the PIN). The phone's two icon buttons sit in their
     own Row (the desktop row's pattern), so the flex row cannot shrink them below 44x44 (R13): the shared .btn-icon has no flex:none
     (handed back, RESULTS-collect.md Round 2 F2). Each row's QR link names its survey (?state=<n>, as on phone; the projector shows
     every code, the phone that one). Print links to the actions lane's Print screen, which takes no survey yet (wiring debt 4). -->
<script>
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import Glyph from "./Glyph.svelte";
  import Bar from "./Bar.svelte";
  import { G } from "./glyphs.js";
  import { href } from "../href.js";
  let { groups, phone = false } = $props();
</script>

{#snippet copy()}<Icon d={G.copy} />{/snippet}
{#snippet qr()}<Icon d={G.qr} />{/snippet}
{#snippet print()}<Icon d={G.print} />{/snippet}

{#if phone}
  <div class="l-stack" data-gap="2">
    {#each groups as g (g.lens)}{#each g.surveys as s (s.code)}
      <div class="l-row" data-gap="2">
        <span class="lensdot" data-lens={g.lens} aria-hidden="true"></span>
        <div class="l-stack" data-gap="1" data-grow><span class="h3">{s.name}</span><Bar value={s.answered} max={s.expected ?? "—"} lens={g.lens} /></div>
        <span class="small tab-n">{s.answered}/{s.expected ?? "—"}</span>
        <Row gap={2}>
          <Button icon={copy} ariaLabel={`Copy link for ${s.name}`} variant="quiet" href={href("share")} />
          <Button icon={qr} ariaLabel={`QR for ${s.name}`} variant="quiet" href={href("qr-room", { state: String(s.n) })} />
        </Row>
      </div>
    {/each}{/each}
  </div>
{:else}
  {#each groups as g (g.lens)}
    <Card gap={1}>
      <Row split gap={3}>
        <Row gap={3}><span class="icn icn-lens" data-lens={g.lens}><Glyph name="people" /></span><span class="h3">{g.label}</span><span class="small">· {g.surveys.length} {g.surveys.length === 1 ? "survey" : "surveys"}</span></Row>
        <span class="small tab-n">{g.answered} of {g.expected ?? "—"} expected</span>
      </Row>
      {#each g.surveys as s (s.code)}
        <div class="l-grid" data-gap="3" data-tpl="survey-row">
          <div class="l-stack" data-gap="1"><span class="h3">{s.name}</span><span class="micro kbd">{s.link}</span></div>
          <Bar value={s.answered} max={s.expected ?? "—"} lens={g.lens} />
          <span class="num tab-n" data-size="20">{s.answered} <span class="small">of {s.expected ?? "—"}</span></span>
          <Row gap={1}>
            <Button icon={copy} ariaLabel={`Copy link for ${s.name}`} variant="quiet" href={href("share")} />
            <Button icon={qr} ariaLabel={`QR code for ${s.name}`} variant="quiet" href={href("qr-room", { state: String(s.n) })} />
            <Button icon={print} ariaLabel={`Print ${s.name} survey`} variant="quiet" href={href("print")} />
          </Row>
        </div>
      {/each}
    </Card>
  {/each}
{/if}
