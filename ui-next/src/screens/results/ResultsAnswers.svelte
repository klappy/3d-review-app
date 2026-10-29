<!-- UI Next (v4) Results answers screen ("See the answers"). Status: provisional (playbook rule 12). ?screen=results-answers (&w=phone)
     (&state=team|community|church picks the perspective; any other value renders the default, community).
     Boards: ResultsAnswers.dc.html (desktop: perspective switch, split, CSV, one card per question with .ans rows), ResultsAnswersPhone.dc.html
     (phone: one list card, a disclosure per question). Data: ui-next/fixtures/results/answers.json (anonymous rows per perspective,
     counted by ./data.js answerView; nobody named). The perspective switch and the split drive the heading, the counts and the bars;
     a question shows its split only when every group has the minimum responses to it, else Everyone with a line saying so
     (complementary suppression: a hidden group could be worked out as Everyone minus the rest). The phone board draws its questions as details.dd; the app uses the
     Disclosure contract (details.disc in a list card, design-system.md V-12: .dd means a menu). The phone perspective button steps to
     the next perspective (?state=). Answer bars: ./AnswerBar.svelte. One .btn-primary: desktop review head; phone the phone-bar. -->
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
  import { href } from "../href.js";
  import { out } from "./links.js";
  import { REPORT, ANSWER_LENSES, SPLITS, MIN_RESPONSES, answerLens, answerView, lensLabel, pct } from "./data.js";

  // ?state= picks the perspective; renamed here so it never shadows the $state rune.
  let { phone = false, theme = "light", state: asked, report } = $props();
  const initial = answerLens(asked);
  let lens = $state(initial);
  let split = $state("everyone");
  const A = $derived(answerView(lens, phone ? "everyone" : split));
  const next = $derived(ANSWER_LENSES[(ANSWER_LENSES.indexOf(A.lens) + 1) % ANSWER_LENSES.length]);
  const review = $derived(report?.review ?? (phone ? REPORT.phone.review : REPORT.desktop.review));
  const crumbs = $derived([{ label: review.project, href: out("project") }, { label: review.title }]);
  const splitLabel = $derived(SPLITS.find((s) => s.key === A.split).label.replace(/^Split by /, "by "));
  // Live QA Q10: no answer CSV yet. The server discloses no answer-by-answer rows (src/handlers/response.ts list: D7, held for everyone,
  // owners included), and a raw-response export is a disclosure decision outside this screen, so both buttons are off and say why.
  const CSV_WHY = "Downloading answers is not available yet: the server does not release answer-by-answer rows, so there is nothing to export.";
</script>

{#snippet download()}<Glyph d={G.download} />{/snippet}
{#snippet back()}<Glyph d={G.back} />{/snippet}
{#snippet people()}<Glyph d={G.people} />{/snippet}
{#snippet doc()}<Glyph d={G.doc} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="The answers" parent="Results" back={href("results")} menuHref={out("menu")} />{:else}<TopBar {crumbs} home={out("workspace")} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Plan the next step" href={out("nextStep")} trail="arrow" />{/if}{/snippet}
{#snippet rows(lensKey, options, n)}
  <div class="ans">{#each options as [label, count]}<div class="r"><span>{label}</span><span class="num tab-n">{count}</span><AnswerBar lens={lensKey} pct={pct(count, n)} /></div>{/each}</div>
{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead {review} phone />
    <Row gap={2}>
      <Button label={`${A.label} · ${A.answers}`} ariaLabel={`Perspective: ${A.label}, ${A.answers} answers. Show ${lensLabel(next)}`} href={href("results-answers", { state: next })} lead={people} block />
      <Button label="Download CSV" lead={doc} disabled ariaDescribedby="csv-why" />
    </Row>
    <p class="small" id="csv-why">{CSV_WHY}</p>
    <Card pad="list" label="Questions">
      {#each A.questions as q, i (q.id)}
        <Disclosure label={q.q} open={i === 0} solid={false} gap={1}>
          {#each q.options as [label, count]}
            <Stack gap={1}><span class="small">{label}</span><Row gap={2}><AnswerBar lens={A.lens} pct={pct(count, q.n)} /><span class="small tab-n">{count}</span></Row></Stack>
          {/each}
          {#if q.others}<Stack gap={1}><span class="micro">Other, in their words</span><p class="small">{q.others[0]}</p></Stack>{/if}
        </Disclosure>
      {/each}
    </Card>
    <a class="link" href={href("results")}>Back to levels</a>
  {:else}
    <Page gap={5}>
      <ReviewHead {review} primary={{ label: "Plan the next step", href: out("nextStep"), trail: "arrow" }} />
      <Row split gap={3}>
        <!-- data-grow (contract row, 8.7): the switch takes the row's free width, so "Translation team" sits on one line (board: 520px inline). -->
        <div class="seg" role="radiogroup" aria-label="Perspective" data-grow>{#each ANSWER_LENSES as l (l)}<label><input type="radio" name="lens" value={l} bind:group={lens} />{lensLabel(l)}</label>{/each}</div>
        <Row gap={3}>
          <label class="sel"><select class="in" aria-label="Split by" bind:value={split}>{#each SPLITS as s (s.key)}<option value={s.key}>{s.label}</option>{/each}</select><Glyph d="M6 9l6 6 6-6" /></label>
          <Button label="Download answers (CSV)" lead={download} disabled ariaDescribedby="csv-why" />
        </Row>
      </Row>
      <p class="small" id="csv-why">{CSV_WHY}</p>
      <Row gap={3}>
        <h2 class="h2" aria-live="polite">{A.label} · {A.modality} · {A.answers} answers{A.split === "everyone" ? "" : ` · ${splitLabel}`}</h2>
        <Row gap={2}><LensDot lens={A.lens} decorative /><span>{A.focus.area} ·</span><Level level={A.focus.level} /></Row>
      </Row>
      {#each A.questions as q (q.id)}
        <Card gap={3} label={q.q}>
          <!-- The question's n shows only beside Everyone: beside a split it would let a reader subtract the shown groups. -->
          <Row split gap={3}><h3 class="h3">{q.q}</h3>{#if !q.groups.length}<span class="small">{q.n} answers</span>{/if}</Row>
          {#if q.groups.length}
            {#each q.groups as g (g.label)}<Stack gap={2}><span class="micro">{g.label} · {g.n} answers</span>{@render rows(A.lens, g.options, g.n)}</Stack>{/each}
          {:else}
            {@render rows(A.lens, q.options, q.n)}
            {#if q.held}<p class="small">Showing everyone: split {splitLabel}, a group has fewer than {MIN_RESPONSES} answers to this question.</p>{/if}
          {/if}
        </Card>
        {#if q.others}<div class="solid l-card l-stack" data-gap="2"><span class="micro">Other, in their words</span>{#each q.others as o}<p class="small t-15">{o}</p>{/each}</div>{/if}
      {/each}
      <Row split gap={3}><span class="small">Answers are confidential. Nothing here names a person; splits with fewer than 3 answers are hidden.</span><Button label="Back to levels" href={href("results")} lead={back} /></Row>
    </Page>
  {/if}
</AppShell>
