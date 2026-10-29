<!-- UI Next (v4) Practice copy screen (Sandbox: simulated responses on a practice copy, review phase Collect). Status: provisional (rule 12).
     Mock data: ui-next/fixtures/actions/sandbox.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     Sandbox.dc.html (desktop), SandboxPhone.dc.html (phone, ?w=phone). The practice badge is the §2 Tag practice slot (R9) on the head and
     on the printed preview (.pbadge). Pinned base.css rows: the simulate card .glass-hi.l-card[data-pad=work][data-accent=practice] (the
     --b-support accent bar), its work + aside track .l-grid[data-tpl=aside] (340px; the board's 1fr 320px and 28/32 padding have no row:
     generator line), the phone delete link .link[data-tone=danger]. Links: ../href.js href() with this screen's w/theme. Wiring: the current UI has no practice-copy store to adapt (ui/assess/sandbox-tools.js is the dev
     sign-in gate, not practice copies): debt in RESULTS-actions. One .btn-primary: "Fill with simulated responses" (head / phone-bar). -->
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
  import Tag from "../../Tag.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import CollectGroups from "./CollectGroups.svelte";
  import Paper from "./Paper.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/sandbox.json";

  let { phone = false, theme = "light" } = $props();
  const at = $derived(carry(phone, theme));
  const crumbs = $derived([{ label: R.project, href: href("project", at) }, { label: D.title }]);
  // The practice copy's ⋯ menu as the board draws it: share, clear, then delete (always allowed on a practice copy) last after an hr.
  const menu = $derived([
    { label: "Share the practice survey", href: href("share", at), icon: A.qr },
    { label: "Clear simulated responses", href: href("results", at), icon: A.refresh },
    { kind: "hr" },
    { label: "Delete this practice copy", href: href("home", at), icon: A.x, danger: true },
  ]);
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Practice copy" parent="Home" back={href("home", at)} initials={R.user.initials} menuHref={href("menu", at)} />{:else}<TopBar home={href("home", at)} who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Fill with simulated responses" href={href("results", at)} />{/if}{/snippet}
{#snippet meta()}Copied from <a class="link" href={href("collect", at)}>{R.review.title}</a> · same questions, surveys and languages · nothing here counts{/snippet}
{#snippet sparkle()}<Ico d={A.sparkle} />{/snippet}
{#snippet qr()}<Ico d={A.qr} />{/snippet}
{#snippet refresh()}<Ico d={A.refresh} />{/snippet}
{#snippet select(id, label, opts)}<div><label class="lbl" for={id}>{label}</label><label class="sel"><select class="in" {id}>{#each opts as o, i}<option selected={i === 0}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <Row><Tag kind="practice" /></Row>
    <ReviewHead phone {theme} title={D.phoneTitle} project={R.project} stage="collecting" viewed="collect" live="collect" />
    <Card gap={3} label="Simulated responses">
      <p class="small">Try every screen without touching the real review. Responses here are made up and never counted.</p>
      <Row gap={2}><span class="num title-page">{D.simulated}</span><span class="small">of {D.expected} simulated</span></Row>
      {@render select("sb-many", "How many", D.phoneHowMany)}
    </Card>
    <Row gap={2}><Button label="Share the practice survey" href={href("share", at)} lead={qr} block /><Button label="Clear" href={href("sandbox", at)} lead={refresh} /></Row>
    <a class="link small" data-tone="danger" href={href("home", at)}>Delete this practice copy</a>
  {:else}
    <Page gap={5}>
      <ReviewHead {theme} title={D.title} stage="collecting" practice {meta} viewed="collect" live="collect" done={["prepare"]} {menu} action={{ label: "Fill with simulated responses", variant: "primary", href: href("results", at), lead: "sparkle" }} />
      <div class="glass-hi l-card" data-pad="work" data-accent="practice" role="group" aria-label="Simulated responses">
        <div class="l-grid" data-tpl="aside" data-gap="6">
          <Stack gap={4}>
            <div><h2 class="h2 t-24">Simulated responses</h2><p class="small t-15">Describe the team and the setting in a sentence or two. Personas answer every survey the way such people might, so you can see what results and reports will look like. They are marked as simulated everywhere and never mix with real answers.</p></div>
            <Stack gap={2}>
              <div><label class="lbl" for="sb-about">About this team and setting <span class="opt">(optional)</span></label><textarea class="in" id="sb-about" aria-describedby="sb-about-help">{D.about}</textarea></div>
              <p class="small field-help" id="sb-about-help">Leave it blank for a neutral mix of answers.</p>
            </Stack>
            <Grid cols={2} gap={4}>{@render select("sb-count", "How many per survey", D.howMany)}{@render select("sb-lean", "Lean", D.lean)}</Grid>
            <div class="l-row" data-justify="end" data-gap="2"><Button label="Cancel" variant="quiet" href={href("sandbox", at)} /><Button label={`Generate ${D.expected} responses`} lg href={href("results", at)} lead={sparkle} /></div>
          </Stack>
          <aside class="solid l-card l-stack" data-gap="3" aria-label="Where this stays">
            <h3 class="h3">Where this stays</h3>
            <p class="small">Practice copies are excluded from Explore, project roll-ups, reports to partners and the "over time" chart. The badge is on every screen and on anything printed from here.</p>
            <p class="small">Simulated answers are generated by the app's personas, reviewed by nobody — treat them as a dress rehearsal, not evidence.</p>
            <span class="micro">{D.preview}</span>
            <Paper paper={R.paper} qr={R.qr.survey} practice note="Answers go to the practice copy only." />
          </aside>
        </div>
      </div>
      <Stack gap={3}>
        <Row gap={3}><h2 class="h2">Responses</h2><span class="num title-page">{D.simulated}</span><span class="small">of {D.expected} expected · nothing simulated yet</span></Row>
        <CollectGroups groups={R.groups} surveys={R.surveys} host={R.host} {theme} />
      </Stack>
    </Page>
  {/if}
</AppShell>
