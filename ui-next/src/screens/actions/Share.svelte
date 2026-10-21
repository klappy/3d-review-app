<!-- UI Next (v4) Share the survey screen (review phase Collect). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/share.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     Share.dc.html (desktop), SharePhone.dc.html (phone, ?w=phone). Who may copy links comes from the current UI's share rules
     (ui/assess/share.js CAN_SHARE, the issue_link roles, and copy.readOnly, through the lane adapter ./legacy.js, which a test holds
     equal to share.js); a role outside it sees the readOnly line instead of the copy actions. Copy controls copy (./CopyButton.svelte); the phone
     share-out icon opens the share sheet, else copies (./ShareOut.svelte). Access codes "Make more codes" / "Download as CSV" (phone
     #codes / #csv) wait on the codes API (cap.survey.issue_codes / export_codes): RESULTS debt.
     Work card: the pinned .glass-hi.l-card[data-pad=work]. Link rows: Grid barbell (220px 1fr 220px) stands in for the board's
     240px 1fr auto auto (no contract row: generator line). Access codes: §2 Disclosure. Links: ../href.js href() with this screen's w/theme.
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
  import CopyButton from "./CopyButton.svelte";
  import ShareOut from "./ShareOut.svelte";
  import { CAN_SHARE, READ_ONLY } from "./legacy.js";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/share.json";

  let { phone = false, theme = "light", role = R.role } = $props();
  const at = $derived(carry(phone, theme));
  const crumbs = $derived([{ label: R.project, href: href("project", at) }, { label: R.review.title }]);
  const canShare = $derived(CAN_SHARE.has(role));
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Share the survey" parent="Collect" back={href("collect", at)} initials={R.user.initials} menuHref={href("menu", at)} />{:else}<TopBar home={href("home", at)} who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Show QR codes for the room" href={href("qr-room", at)} />{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Updated just now{/snippet}
{#snippet qr()}<Ico d={A.qr} />{/snippet}
{#snippet mail()}<Ico d={A.mail} />{/snippet}
{#snippet download()}<Ico d={A.download} />{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead phone {theme} title={R.review.title} project={R.project} stage="collecting" viewed="collect" live="collect" />
    <p class="small">{D.phoneLead}</p>
    <Card gap={2} label="Survey links">
      {#each R.surveys as s, i}
        {#if i}<hr class="hr" />{/if}
        <Row split gap={2}><Row gap={2}><LensDot lens={s.lens} decorative /><b>{s.name}</b></Row><span class="small">{s.n}/{s.of}</span></Row>
        <Row gap={1}>
          <input class="in small" data-grow readonly value={`${R.shortHost}${s.code}`} aria-label={`Link for ${s.name}`} />
          {#if canShare}<CopyButton icon text={`${R.shortHost}${s.code}`} name={s.name} /><ShareOut text={`${R.shortHost}${s.code}`} name={s.name} title={R.review.title} />{/if}
          <Button icon={qr} ariaLabel={`QR for ${s.name}`} variant="quiet" href={href("qr-room", at)} />
        </Row>
      {/each}
      {#if !canShare}<p class="small">{READ_ONLY}</p>{/if}
    </Card>
    <Card gap={2} label="Access codes">
      <Disclosure label="Access codes, for people who lose the link" solid={false}><p class="small">{D.codes.unused} · <a class="link" href="#codes">Make more</a> · <a class="link" href="#csv">Download CSV</a></p></Disclosure>
    </Card>
    <a class="link" href={href("people", at)}>Email the links to someone</a>
    <a class="link" href={`${href("collect", at)}#offline`}>Meeting offline? Print and paper</a>
  {:else}
    <Page gap={5}>
      <ReviewHead {theme} title={R.review.title} stage="collecting" {meta} viewed="collect" live="collect" done={["prepare"]} deleteRefused={R.deleteRefused} action={{ label: "Done", variant: "primary", href: href("collect", at), trail: "check" }} />
      <div class="glass-hi l-card l-stack" data-pad="work" data-gap="5" role="group" aria-label="Share the survey">
        <div><h2 class="h2 t-24">Share the survey</h2><p class="small t-15">{D.lead}</p></div>
        <Stack gap={3}>
          {#each R.surveys as s, i}
            <Grid template="barbell" gap={3}>
              <Row gap={3}><LensDot lens={s.lens} decorative /><b>{s.name}</b></Row>
              <input class="in kbd" readonly value={`${R.host}${s.code}`} aria-label={`Link for ${s.name}`} />
              <Row gap={3}>
                {#if canShare}<CopyButton text={`${R.host}${s.code}`} name={s.name} copied={i === D.copied} />{/if}
                <Button icon={qr} ariaLabel={`QR code for ${s.name}`} variant="quiet" href={href("qr-room", at)} />
              </Row>
            </Grid>
          {/each}
          {#if !canShare}<p class="small">{READ_ONLY}</p>{/if}
        </Stack>
        <hr class="hr" />
        <Row wrap gap={3}><Button label="Show QR codes for the room" href={href("qr-room", at)} lead={qr} /><Button label="Email the links to someone" href={href("people", at)} lead={mail} /></Row>
        <p class="small">Meeting offline? Paper surveys and QR pages print from the <a class="link" href={`${href("collect", at)}#offline`}>Meeting offline? card on Collect</a>.</p>
        <Disclosure label="Access codes, for people who lose the link" gap={3}>
          <p class="small">A code opens the same survey from the home page. Codes are printed on paper surveys automatically.</p>
          <Row wrap gap={3}><span class="kbd">{D.codes.code}</span><span class="small">{D.codes.line}</span><Button label="Make more codes" /><Button label="Download as CSV" lead={download} /></Row>
        </Disclosure>
      </div>
    </Page>
  {/if}
</AppShell>
