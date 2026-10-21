<!-- UI Next (v4) Share the survey screen (review phase Collect). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/share.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     Share.dc.html (desktop), SharePhone.dc.html (phone, ?w=phone). Who may copy links comes from the current UI's pure share module
     (ui/assess/share.js CAN_SHARE, the issue_link roles); a role outside it sees share.js copy.readOnly instead of the copy actions.
     Link rows: Grid barbell (220px 1fr 220px) stands in for the board's 240px 1fr auto auto (canvas gap). Access codes: §2 Disclosure.
     One .btn-primary per page: desktop "Done" (page head), phone "Show QR codes for the room" (phone-bar). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Disclosure from "../../Disclosure.svelte";
  import LensDot from "../../LensDot.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { CAN_SHARE, copy as SHARE_COPY } from "../../../../ui/assess/share.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/share.json";

  let { phone = false, theme = "light" } = $props();
  const PROJECT = "?ui_next=on&screen=project", COLLECT = "?ui_next=on&screen=collect", QR = "?ui_next=on&screen=qr-room", PEOPLE = "?ui_next=on&screen=people";
  const w = (href) => (phone ? `${href}&w=phone` : href);
  const links = $derived(Object.fromEntries(Object.entries(R.links).map(([k, v]) => [k, w(v)])));
  const menu = R.menu.map((it) => (it.icon ? { ...it, icon: A[it.icon] } : it));
  const crumbs = [{ label: R.project, href: PROJECT }, { label: R.review.title }];
  const canShare = CAN_SHARE.has(R.role);
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Share the survey" parent="Collect" back={w(COLLECT)} initials={R.user.initials} menuHref="?ui_next=on&screen=menu&w=phone" />{:else}<TopBar who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Show QR codes for the room" href={w(QR)} />{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Updated just now{/snippet}
{#snippet copyI()}<Ico d={A.copy} />{/snippet}
{#snippet check()}<Ico d={A.check} />{/snippet}
{#snippet qr()}<Ico d={A.qr} />{/snippet}
{#snippet out()}<Ico d={A.out} />{/snippet}
{#snippet mail()}<Ico d={A.mail} />{/snippet}
{#snippet download()}<Ico d={A.download} />{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead phone title={R.review.title} project={R.project} projectHref={w(PROJECT)} stage="collecting" viewed="collect" live="collect" {links} menuHref="?ui_next=on&screen=collect-menu&w=phone" />
    <p class="small">{D.phoneLead}</p>
    <Card gap={2} label="Survey links">
      {#each R.surveys as s, i}
        {#if i}<hr class="hr" />{/if}
        <Row split gap={2}><Row gap={2}><LensDot lens={s.lens} decorative /><b>{s.name}</b></Row><span class="small">{s.n}/{s.of}</span></Row>
        <Row gap={1}>
          <input class="in small" readonly value={`${R.shortHost}${s.code}`} aria-label={`Link for ${s.name}`} />
          {#if canShare}<Button icon={copyI} ariaLabel={`Copy link for ${s.name}`} variant="quiet" /><Button icon={out} ariaLabel={`Share link for ${s.name}`} variant="quiet" />{/if}
          <Button icon={qr} ariaLabel={`QR for ${s.name}`} variant="quiet" href={w(QR)} />
        </Row>
      {/each}
      {#if !canShare}<p class="small">{SHARE_COPY.readOnly}</p>{/if}
    </Card>
    <Card gap={2} label="Access codes">
      <Disclosure label="Access codes, for people who lose the link" solid={false}><p class="small">{D.codes.unused} · <a class="link" href="#codes">Make more</a> · <a class="link" href="#csv">Download CSV</a></p></Disclosure>
    </Card>
    <a class="link" href={w(PEOPLE)}>Email the links to someone</a>
    <a class="link" href={`${w(COLLECT)}#offline`}>Meeting offline? Print and paper</a>
  {:else}
    <Page gap={5}>
      <ReviewHead title={R.review.title} stage="collecting" {meta} viewed="collect" live="collect" done={["prepare"]} {links} {menu} action={{ label: "Done", variant: "primary", href: COLLECT, trail: "check" }} />
      <Card hi gap={5} label="Share the survey">
        <div><h2 class="h2">Share the survey</h2><p class="small t-15">{D.lead}</p></div>
        <Stack gap={3}>
          {#each R.surveys as s, i}
            <Grid template="barbell" gap={3}>
              <Row gap={3}><LensDot lens={s.lens} decorative /><b>{s.name}</b></Row>
              <input class="in kbd" readonly value={`${R.host}${s.code}`} aria-label={`Link for ${s.name}`} />
              <Row gap={3}>
                {#if canShare}{#if i === D.copied}<Button label="Copied" trail={check} />{:else}<Button label="Copy" lead={copyI} />{/if}{/if}
                <Button icon={qr} ariaLabel={`QR code for ${s.name}`} variant="quiet" href={QR} />
              </Row>
            </Grid>
          {/each}
          {#if !canShare}<p class="small">{SHARE_COPY.readOnly}</p>{/if}
        </Stack>
        <hr class="hr" />
        <Row wrap gap={3}><Button label="Show QR codes for the room" href={QR} lead={qr} /><Button label="Email the links to someone" href={PEOPLE} lead={mail} /></Row>
        <p class="small">Meeting offline? Paper surveys and QR pages print from the <a class="link" href={`${COLLECT}#offline`}>Meeting offline? card on Collect</a>.</p>
        <Disclosure label="Access codes, for people who lose the link" gap={3}>
          <p class="small">A code opens the same survey from the home page. Codes are printed on paper surveys automatically.</p>
          <Row wrap gap={3}><span class="kbd">{D.codes.code}</span><span class="small">{D.codes.line}</span><Button label="Make more codes" /><Button label="Download as CSV" lead={download} /></Row>
        </Disclosure>
      </Card>
    </Page>
  {/if}
</AppShell>
