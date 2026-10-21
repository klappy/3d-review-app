<!-- UI Next (v4) Results answers screen ("See the answers"). Status: provisional (playbook rule 12). ?screen=results-answers (&w=phone).
     Boards: ResultsAnswers.dc.html (desktop: perspective switch, split, CSV, one card per question with .ans rows), ResultsAnswersPhone.dc.html
     (phone: one list card, a disclosure per question). Data: ui-next/fixtures/results/answers.json (counts only; nobody named).
     The phone board draws its questions as details.dd; the app uses the Disclosure contract (details.disc in a list card,
     design-system.md V-12: .dd means a menu). Answer bars: ./AnswerBar.svelte. One .btn-primary: desktop review head; phone the phone-bar. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import LensDot from "../../LensDot.svelte";
  import Level from "../../Level.svelte";
  import Disclosure from "../../Disclosure.svelte";
  import Glyph from "./Glyph.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import AnswerBar from "./AnswerBar.svelte";
  import { G } from "./icons.js";
  import { REPORT, ANSWERS as A, LENS_ORDER, lensLabel, pct } from "./data.js";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`ResultsAnswers: no board states (got "${String(state)}")`);
  const review = $derived(phone ? REPORT.phone.review : REPORT.desktop.review);
  const crumbs = $derived([{ label: review.project, href: "#project" }, { label: review.title }]);
  const SPLITS = ["Everyone", "Split by age range", "Split by gender", "Split by where people met"];
</script>

{#snippet download()}<Glyph d={G.download} />{/snippet}
{#snippet back()}<Glyph d={G.back} />{/snippet}
{#snippet people()}<Glyph d={G.people} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="The answers" parent="Results" back="?screen=results&w=phone" />{:else}<TopBar {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Plan the next step" href="#next-step" />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead {review} phone />
    <Row gap={2}><Button label={`${lensLabel(A.lens)} · ${A.answers}`} href="#perspective" lead={people} block /><Button label="Download CSV" href="#csv" /></Row>
    <Card pad="list" label="Questions">
      {#each A.questions as q, i}
        <Disclosure label={q.q} open={i === 0} solid={false} gap={1}>
          {#each q.options as [label, count]}
            <Stack gap={1}><span class="small">{label}</span><Row gap={2}><AnswerBar lens={A.lens} pct={pct(count, q.n)} /><span class="small tab-n">{count}</span></Row></Stack>
          {/each}
          {#if q.others}<Stack gap={1}><span class="micro">Other, in their words</span><p class="small">{q.others[0]}</p></Stack>{/if}
        </Disclosure>
      {/each}
    </Card>
    <a class="link" href="?screen=results&w=phone">Back to levels</a>
  {:else}
    <Page gap={5}>
      <ReviewHead {review} primary={{ label: "Plan the next step", href: "#next-step", trail: "arrow" }} />
      <Row split gap={3}>
        <div class="seg" role="radiogroup" aria-label="Perspective">{#each LENS_ORDER as lens}<label><input type="radio" name="lens" checked={lens === A.lens} />{lensLabel(lens)}</label>{/each}</div>
        <Row gap={3}>
          <label class="sel"><select class="in" aria-label="Split by">{#each SPLITS as s}<option>{s}</option>{/each}</select><Glyph d="M6 9l6 6 6-6" /></label>
          <Button label="Download answers (CSV)" href="#csv" lead={download} />
        </Row>
      </Row>
      <Row gap={3}>
        <h2 class="h2">{lensLabel(A.lens)} · {A.modality} · {A.answers} answers</h2>
        <Row gap={2}><LensDot lens={A.lens} decorative /><span>{A.focus.area} ·</span><Level level={A.focus.level} /></Row>
      </Row>
      {#each A.questions as q}
        <Card gap={3} label={q.q}>
          <Row split gap={3}><h3 class="h3">{q.q}</h3><span class="small">{q.n} answers</span></Row>
          <div class="ans">{#each q.options as [label, count]}<div class="r"><span>{label}</span><span class="num tab-n">{count}</span><AnswerBar lens={A.lens} pct={pct(count, q.n)} /></div>{/each}</div>
        </Card>
        {#if q.others}<div class="solid l-card l-stack" data-gap="2"><span class="micro">Other, in their words</span>{#each q.others as o}<p class="small t-15">{o}</p>{/each}</div>{/if}
      {/each}
      <Row split gap={3}><span class="small">Answers are confidential. Nothing here names a person; splits with fewer than 3 answers are hidden.</span><Button label="Back to levels" href="?screen=results" lead={back} /></Row>
    </Page>
  {/if}
</AppShell>
