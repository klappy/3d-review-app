<!-- UI Next (v4) Action plan screen ("Next steps", the one-page plan document). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/action-plan.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     ActionPlan.dc.html (desktop: document top bar + the paper sheet), ActionPlanPhone.dc.html (phone, ?w=phone).
     Desktop paper: base.css paper scope (.psheet > .paper is the 794px sheet, .pfoot); the board's 56/64 sheet padding and 36px title
     have no contract row yet (canvas gap). One .btn-primary per page: desktop "Download PDF" (top bar), phone "Share the PDF" (phone-bar). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import Mark from "../../Mark.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import DocTop from "./DocTop.svelte";
  import Qr from "./Qr.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/action-plan.json";

  let { phone = false, theme = "light" } = $props();
  const NEXT = "?ui_next=on&screen=next-step";
</script>

{#snippet link()}<Ico d={A.link} />{/snippet}
{#snippet mail()}<Ico d={A.mail} />{/snippet}
{#snippet download()}<Ico d={A.download} />{/snippet}
{#snippet print()}<Ico d={A.print} />{/snippet}
{#snippet copy()}<Ico d={A.copy} />{/snippet}
{#snippet check()}<Ico d={A.check} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Next steps" parent="Luke 1–2" back={`${NEXT}&w=phone`} initials={R.user.initials} menuHref="?ui_next=on&screen=menu&w=phone" />{:else}<DocTop title={D.doc} home={NEXT}><Button label="Copy share link" lead={link} /><Button label="Email it" lead={mail} /><Button label="Download PDF" variant="primary" href="#pdf" lead={download} /><Button label="Print" lead={print} /></DocTop>{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Share the PDF" href="#pdf" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <a class="link small" href={`${NEXT}&w=phone`}>{D.phone.crumb}</a>
    <h1 class="title-phone">Next steps</h1>
    <p class="small">{D.phone.meta}</p>
    <Card gap={2} label="Plan items">
      {#each D.phone.items as [t, owner], i}
        {#if i}<hr class="hr" />{/if}
        <Row gap={3}><span class="num h2">{i + 1}</span><Stack gap={1}><b>{t}</b><span class="small">{owner}</span></Stack></Row>
      {/each}
    </Card>
    <Card gap={2} label="Share">
      <span class="micro">Share</span>
      <p class="small">Read-only link, expires in 90 days.</p>
      <Row gap={2}><Button label="Copy link" lead={copy} block /><Button label="Email it" href="?ui_next=on&screen=people&w=phone" lead={mail} block /></Row>
    </Card>
  {:else}
    <div class="psheet">
      <article class="paper l-card l-stack" data-gap="5" aria-label={`Next steps, ${R.review.title}`}>
        <Row split gap={4}><Stack gap={1}><h1 class="title-page">{R.review.title}</h1><p class="small">{D.meta}</p></Stack><Mark size={48} /></Row>
        <Stack gap={2}>
          <h2 class="h3 t-15">What we will talk about</h2>
          {#each D.talk as [t, apart]}<hr class="hr" /><Row split gap={3}><Row gap={3}><Ico d={A.check} /><span class="small">{t}</span></Row><span class="small">{apart}</span></Row>{/each}
        </Stack>
        <Grid cols={2} gap={5}>
          <Stack gap={2}><h2 class="h3 t-15">What we noticed</h2><p class="in small">{D.noticed}</p></Stack>
          <Stack gap={2}><h2 class="h3 t-15">The next step</h2><p class="in small">{D.next}</p></Stack>
        </Grid>
        <Grid cols={3} gap={3}>{#each D.facts as [k, v]}<Stack gap={1}><span class="micro">{k}</span><b class="small">{v}</b></Stack>{/each}</Grid>
        <div class="solid l-card l-row" data-split data-gap="3">
          <p class="small"><strong>Share this plan.</strong> Anyone with this link can read the plan and the overview report — no account, nothing editable. <span class="kbd">{D.share.url}</span> · {D.share.line}</p>
          <Qr bits={R.qr.plan} size={72} />
        </div>
        <div class="pfoot"><span>{D.foot}</span><span>1 of 1</span></div>
      </article>
    </div>
  {/if}
</AppShell>
