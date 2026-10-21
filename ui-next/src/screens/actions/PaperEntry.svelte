<!-- UI Next (v4) Enter a paper answer screen (review phase Collect). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/paper-entry.json + review.json (paper.questions). Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     PaperEntry.dc.html (desktop), PaperEntryPhone.dc.html (phone, ?w=phone). Options are §2 option rows (.row-opt with .rd / .cb, R10).
     Wiring through the current UI's pure presentation module (ui/present.js): isOtherOption marks the write-in choice ("Other (please
     describe)" carries other: true) and receiptLine formats the last receipt the same way the participant receipt does. Saving answers
     (POST of a paper response) is not wired: debt in RESULTS-actions. One .btn-primary: "Save and enter the next paper" (desktop form;
     the head's "Share the survey" is secondary as on the board), phone "Next question" (phone-bar). -->
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
  import LensDot from "../../LensDot.svelte";
  import ReviewHead from "./ReviewHead.svelte";
  import Bar from "./Bar.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { isOtherOption, receiptLine } from "../../../../ui/present.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/paper-entry.json";

  let { phone = false, theme = "light" } = $props();
  const PROJECT = "?ui_next=on&screen=project", COLLECT = "?ui_next=on&screen=collect", SHARE = "?ui_next=on&screen=share", SELF = "?ui_next=on&screen=paper-entry";
  const w = (href) => (phone ? `${href}&w=phone` : href);
  const links = $derived(Object.fromEntries(Object.entries(R.links).map(([k, v]) => [k, w(v)])));
  const menu = R.menu.map((it) => (it.icon ? { ...it, icon: A[it.icon] } : it));
  const crumbs = [{ label: R.project, href: PROJECT }, { label: R.review.title }];
  // Survey items in the shape the current UI renders ({ id, type, text, options: [{ code, text, other? }] }).
  const items = R.paper.questions.map((q) => ({ id: String(q.n), type: q.type, text: q.text, options: q.options.map((t, i) => ({ code: `o${i}`, text: t, other: t.startsWith("Other (") || undefined })) }));
  const picked = (item, code) => { const v = D.answers[item.id]; return Array.isArray(v) ? v.includes(code) : v === code; };
  const pq = $derived(items[D.phone.question - 1]);
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Enter paper answers" parent="Collect" back={w(COLLECT)} initials={R.user.initials} menuHref="?ui_next=on&screen=menu&w=phone" />{:else}<TopBar who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Next question" href={w(SELF)} backHref={w(SELF)} backLabel="Back" />{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Updated just now{/snippet}
{#snippet arrow()}<Ico d={A.arrow} />{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <Row split gap={2}><span class="micro">{D.phone.progress}</span><a class="link micro" href={w(COLLECT)}>Discard</a></Row>
    <Bar pct={D.phone.pct} lens={D.survey.lens} label={`Question ${D.phone.question} of 13`} />
    <Card hi pad="hero" gap={3} label={`Question ${D.phone.question}`}>
      <h2 class="h2">{pq.text}</h2>
      <Stack gap={2}>
        {#each pq.options as o}<label class="row-opt"><input class="rd" type="radio" name="pq" checked={o.code === D.phone.answer} /><b>{o.text}</b></label>{/each}
      </Stack>
      <div><label class="lbl" for="pe-words">Their words <span class="opt">(optional)</span></label><textarea class="in" rows="2" placeholder="Copy anything written in the margin" id="pe-words"></textarea></div>
    </Card>
  {:else}
    <Page gap={5}>
      <ReviewHead title={R.review.title} stage="collecting" {meta} viewed="collect" live="collect" done={["prepare"]} {links} {menu} action={{ label: "Share the survey", href: SHARE, lead: "qr" }} />
      <Grid cols={2} gap={5}>
        <Card hi gap={5} label="Enter a paper answer">
          <div><h2 class="h2">Enter a paper answer</h2><p class="small t-15">Type the code from the top of the paper, or pick the survey. Enter the answers exactly as written — you are the participant's hands here.</p></div>
          <Grid template="barbell" gap={4}>
            <div><label class="lbl" for="pe-code">Code on the paper</label><input class="in kbd" value={D.code} id="pe-code" /></div>
            <div class="solid l-card l-row" data-gap="3"><LensDot lens={D.survey.lens} decorative /><b>{D.survey.name}</b><span class="small">{D.survey.line}</span></div>
          </Grid>
          <hr class="hr" />
          {#each items as it}
            <fieldset class="opts">
              <legend class="h3">{it.id}. {it.text}</legend>
              <Grid cols={2} gap={2}>
                {#each it.options as o}<label class="row-opt"><input class={it.type === "multi" ? "cb" : "rd"} type={it.type === "multi" ? "checkbox" : "radio"} name={`q${it.id}`} checked={picked(it, o.code)} data-other={isOtherOption(o) ? "" : undefined} /><span>{o.text}</span></label>{/each}
              </Grid>
            </fieldset>
          {/each}
          <p class="small">{D.more}</p>
          <Row split wrap gap={3}><span class="small">Left blank on paper? Leave it blank here.</span><Row gap={2}><Button label="Discard" variant="quiet" href={COLLECT} /><Button label="Save and enter the next paper" variant="primary" lg href={SELF} trail={arrow} /></Row></Row>
        </Card>
        <Stack gap={4}>
          <Card gap={3} label="Entered today">
            <h2 class="h3">Entered today</h2>
            {#each D.today as t}<p class="small">{t}</p>{/each}
            <hr class="hr" />
            <p class="small">Each entry gets its own receipt, the same as a phone answer. Write the receipt on the paper if you need to find it again.</p>
            <p class="kbd small">Last receipt · {receiptLine(D.lastReceipt)}</p>
          </Card>
        </Stack>
      </Grid>
    </Page>
  {/if}
</AppShell>
