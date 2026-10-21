<!-- UI Next (v4) Next step screen (review phase Improve). Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/actions/next-step.json + review.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): NextStep.dc.html (desktop), NextStepPhone.dc.html (phone, ?w=phone).
     Composed of AppShell > Page > Card / Stack / Row and the section 2 components (TopBar, PhoneHeader, PhoneBar, Button, Menu, Pill,
     Tag, Level, LensDot) plus lane parts (ReviewHead, GapBar, Ico); no <style>, no inline style. Desktop body: the pinned base.css rows the
     board draws: .l-grid[data-tpl=aside-wide] (work card + 380px aside, top-aligned), the work card .glass-hi.l-card[data-pad=work], the
     gap rows .row-opt[data-kind=gap] (tick · area · mini barbell · bands apart); the shared Grid/Card do not offer these values yet, so the
     contract classes are written here. Links: the shared ../href.js href() with this screen's w/theme. One .btn-primary per page:
     desktop "Complete the review" (page head), phone "Complete the review" (phone-bar). Copy is the boards'. -->
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
  import Level from "../../Level.svelte";
  import LensDot, { LENSES } from "../../LensDot.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import GapBar from "./GapBar.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/next-step.json";

  let { phone = false, theme = "light" } = $props();
  const at = $derived(carry(phone, theme));
  const crumbs = $derived([{ label: R.project, href: href("project", at) }, { label: R.review.title }]);
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title={D.phone.title} parent={R.project} back={href("project", at)} initials={R.user.initials} menuHref={href("menu", at)} />{:else}<TopBar home={href("home", at)} who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Complete the review" href={href("home", at)} />{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Saved just now{/snippet}
{#snippet plus()}<Ico d={A.plus} />{/snippet}
{#snippet check()}<Ico d={A.check} />{/snippet}
{#snippet list()}<Ico d={A.list} />{/snippet}
{#snippet print()}<Ico d={A.print} />{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead phone {theme} title={D.phone.title} project={R.project} stage={D.phone.stage} viewed="improve" live="improve" />
    <p class="small">{D.phone.lead}</p>
    {#each D.phone.items as it}
      <Card gap={3} label={it.title}>
        <Row gap={2}><Tag label={it.kind} /><span class="h3">{it.title}</span></Row>
        <p class="small">{it.text}</p>
        <Row gap={2}><Button label={it.inPlan ? "In the plan" : "Add to plan"} lead={it.inPlan ? check : plus} block /><Button label="Not this one" variant="quiet" /></Row>
      </Card>
    {/each}
    <Row wrap gap={2}><Button label="See all results" href={href("results", at)} lead={list} block /><Button label="Print or share the plan" href={href("action-plan", at)} lead={print} block /></Row>
  {:else}
    <Page gap={5}>
      <ReviewHead {theme} title={R.review.title} stage="reviewed" {meta} viewed="improve" live="improve" done={["prepare", "collect", "understand"]} deleteRefused={R.deleteRefused} action={{ label: "Complete the review", variant: "primary", href: href("home", at), trail: "check" }} />
      <div class="l-grid" data-tpl="aside-wide" data-gap="5">
        <div class="glass-hi l-card l-stack" data-pad="work" data-gap="5" role="group" aria-label="What will you talk about?">
          <div><h2 class="h2 t-24">What will you talk about?</h2><p class="small t-15">Suggested from the results. Keep the ones that matter; add your own.</p></div>
          <Stack gap={2}>
            <Row gap={3}><span class="h3">Where the perspectives disagree</span><span class="small">the three widest gaps</span></Row>
            {#each D.gaps as g}
              <label class="row-opt" data-kind="gap"><input class="cb" type="checkbox" checked={g.checked} /><b>{g.area}</b><GapBar pts={g.pts} span={g.span} wide={g.wide} w="100%" /><strong class="small">{g.apart}</strong></label>
            {/each}
          </Stack>
          <Stack gap={2}>
            <Row gap={3}><span class="h3">Weakest areas</span><span class="small">Needs support or urgent attention</span></Row>
            {#each D.weak as a}
              <label class="row-opt l-row" data-split><span class="l-row" data-gap="3"><input class="cb" type="checkbox" checked={a.checked} /><LensDot lens={a.lens} decorative /><b>{a.label}</b></span><Level level={a.level} /></label>
            {/each}
            <input class="in" placeholder="Something else" aria-label="Something else" />
          </Stack>
          <div><label class="lbl" for="ns-noticed">What you noticed</label><textarea class="in" id="ns-noticed">{D.noticed}</textarea></div>
          <div><label class="lbl" for="ns-next">The next step</label><textarea class="in" id="ns-next">{D.next}</textarea></div>
          <Grid cols={2} gap={4}>
            <div><label class="lbl" for="ns-follow">Follow up on <span class="opt">(optional)</span></label><input class="in" type="date" value={D.followUp} id="ns-follow" /></div>
            <Stack gap={1}>
              <div><label class="lbl" for="ns-again">Review again</label><label class="sel"><select class="in" id="ns-again" aria-describedby="ns-again-help">{#each D.again as o, i}<option selected={i === 0}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>
              <p class="small field-help" id="ns-again-help">Starts a new review in this project, so you can compare over time.</p>
            </Stack>
          </Grid>
          <p class="small">Everyone with access to this review can read these notes.</p>
        </div>
        <Stack gap={4}>
          <Card gap={3} label="Recommended for this review">
            <Row gap={2}><h2 class="h3">Recommended for this review</h2><span class="small">{D.recs.length}</span></Row>
            <p class="small">Matched to the gaps and weak areas above. Options, not a prescription — add the ones that fit, dismiss the rest.</p>
            {#each D.recs as r}
              <div class="solid l-card l-stack" data-gap="2">
                <Row split gap={3}><Row gap={3}><span class="micro">Because of</span><b class="small">{r.because}</b></Row><Tag state={r.state} /></Row>
                <h3 class="h3 t-15">{r.title}</h3>
                <p class="small">{r.text}</p>
                <Row split wrap gap={2}><span class="micro">{r.from}</span>{#if r.wait}<span class="small">{r.wait}</span>{:else}<Row gap={2}><Button label="Add to plan" lead={plus} /><Button label="Not this one" variant="quiet" /></Row>{/if}</Row>
              </div>
            {/each}
          </Card>
          <Card gap={2} label="At a glance">
            <h2 class="h3">At a glance</h2>
            {#each D.glance as [lens, level]}<Row split><span class="small">{LENSES[lens]}</span><Level {level} /></Row>{/each}
            <a class="link" href={href("results", at)}>See all results</a>
          </Card>
          <Card gap={3} label="Take it out of the room">
            <h2 class="h3">Take it out of the room</h2>
            <p class="small">Print the plan or share a read-only link with people who won't sign in — the same way as the reports.</p>
            <Row wrap gap={2}><Button label="Print or share the plan" href={href("action-plan", at)} lead={print} /></Row>
          </Card>
        </Stack>
      </div>
    </Page>
  {/if}
</AppShell>
