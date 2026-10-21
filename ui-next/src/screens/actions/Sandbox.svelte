<!-- UI Next (v4) Practice copy screen (Sandbox: simulated responses on a practice copy, review phase Collect). Status: provisional (rule 12).
     Mock data: ui-next/fixtures/actions/sandbox.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     Sandbox.dc.html (desktop), SandboxPhone.dc.html (phone, ?w=phone). The practice badge is the §2 Tag practice slot (R9) on the head and
     on the printed preview (.pbadge). The board's --b-support accent bar on the simulate card and the urgent-coloured phone delete link have
     no contract row (canvas gap). Wiring: the current UI has no practice-copy store to adapt (ui/assess/sandbox-tools.js is the dev
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
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/sandbox.json";

  let { phone = false, theme = "light" } = $props();
  const PROJECT = "?ui_next=on&screen=project", COLLECT = "?ui_next=on&screen=collect", RESULTS = "?ui_next=on&screen=results", SHARE = "?ui_next=on&screen=share", HOME = "?ui_next=on&screen=home", SELF = "?ui_next=on&screen=sandbox";
  const w = (href) => (phone ? `${href}&w=phone` : href);
  const links = $derived(Object.fromEntries(Object.entries(R.links).map(([k, v]) => [k, w(v)])));
  const menu = D.menu.map((it) => (it.icon ? { ...it, icon: A[it.icon] } : it));
  const crumbs = [{ label: R.project, href: PROJECT }, { label: D.title }];
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Practice copy" parent="Home" back={w(HOME)} initials={R.user.initials} menuHref="?ui_next=on&screen=menu&w=phone" />{:else}<TopBar who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Fill with simulated responses" href={w(RESULTS)} />{/if}{/snippet}
{#snippet meta()}Copied from <a class="link" href={COLLECT}>{R.review.title}</a> · same questions, surveys and languages · nothing here counts{/snippet}
{#snippet sparkle()}<Ico d={A.sparkle} />{/snippet}
{#snippet qr()}<Ico d={A.qr} />{/snippet}
{#snippet refresh()}<Ico d={A.refresh} />{/snippet}
{#snippet select(id, label, opts)}<div><label class="lbl" for={id}>{label}</label><label class="sel"><select class="in" {id}>{#each opts as o, i}<option selected={i === 0}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <Row><Tag kind="practice" /></Row>
    <ReviewHead phone title={D.phoneTitle} project={R.project} projectHref={w(PROJECT)} stage="collecting" viewed="collect" live="collect" {links} menuHref="?ui_next=on&screen=collect-menu&w=phone" />
    <Card gap={3} label="Simulated responses">
      <p class="small">Try every screen without touching the real review. Responses here are made up and never counted.</p>
      <Row gap={2}><span class="num title-page">{D.simulated}</span><span class="small">of {D.expected} simulated</span></Row>
      {@render select("sb-many", "How many", D.phoneHowMany)}
    </Card>
    <Row gap={2}><Button label="Share the practice survey" href={w(SHARE)} lead={qr} block /><Button label="Clear" href={w(SELF)} lead={refresh} /></Row>
    <a class="link small" href={w(HOME)}>Delete this practice copy</a>
  {:else}
    <Page gap={5}>
      <ReviewHead title={D.title} stage="collecting" practice {meta} viewed="collect" live="collect" done={["prepare"]} {links} {menu} action={{ label: "Fill with simulated responses", variant: "primary", href: RESULTS, lead: "sparkle" }} />
      <Card hi gap={5} label="Simulated responses">
        <Grid cols={2} gap={6}>
          <Stack gap={4}>
            <div><h2 class="h2">Simulated responses</h2><p class="small t-15">Describe the team and the setting in a sentence or two. Personas answer every survey the way such people might, so you can see what results and reports will look like. They are marked as simulated everywhere and never mix with real answers.</p></div>
            <Stack gap={2}>
              <div><label class="lbl" for="sb-about">About this team and setting <span class="opt">(optional)</span></label><textarea class="in" id="sb-about" aria-describedby="sb-about-help">{D.about}</textarea></div>
              <p class="small field-help" id="sb-about-help">Leave it blank for a neutral mix of answers.</p>
            </Stack>
            <Grid cols={2} gap={4}>{@render select("sb-count", "How many per survey", D.howMany)}{@render select("sb-lean", "Lean", D.lean)}</Grid>
            <Row split gap={2}><span></span><Row gap={2}><Button label="Cancel" variant="quiet" href={SELF} /><Button label={`Generate ${D.expected} responses`} lg href={RESULTS} lead={sparkle} /></Row></Row>
          </Stack>
          <aside class="solid l-card l-stack" data-gap="3" aria-label="Where this stays">
            <h3 class="h3">Where this stays</h3>
            <p class="small">Practice copies are excluded from Explore, project roll-ups, reports to partners and the "over time" chart. The badge is on every screen and on anything printed from here.</p>
            <p class="small">Simulated answers are generated by the app's personas, reviewed by nobody — treat them as a dress rehearsal, not evidence.</p>
            <span class="micro">{D.preview}</span>
            <Paper paper={R.paper} qr={R.qr.survey} practice note="Answers go to the practice copy only." />
          </aside>
        </Grid>
      </Card>
      <Stack gap={3}>
        <Row gap={3}><h2 class="h2">Responses</h2><span class="num title-page">{D.simulated}</span><span class="small">of {D.expected} expected · nothing simulated yet</span></Row>
        <CollectGroups groups={R.groups} surveys={R.surveys} host={R.host} />
      </Stack>
    </Page>
  {/if}
</AppShell>
