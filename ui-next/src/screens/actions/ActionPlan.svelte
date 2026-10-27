<!-- UI Next (v4) Action plan screen ("Next steps", the one-page plan document). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/action-plan.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     ActionPlan.dc.html (desktop: document top bar + the paper sheet), ActionPlanPhone.dc.html (phone, ?w=phone).
     Desktop paper: the pinned base.css .paper[data-sheet] row (the 794px page, 56/64 padding, --sp-5 gap; the results lane's report
     sheet row) in the paper scope (.pfoot); its contents on the Paper sheet contents row (design-system.md §8.11). Links: ../href.js href()
     with this screen's w/theme. One .btn-primary per page: desktop "Download PDF" (top bar), phone "Share the PDF" (phone-bar).
     Controls: "Copy share link" / "Copy link" copy the plan link (./CopyButton.svelte); "Email it" goes to people (both widths); "Print"
     opens the browser's print (./ActButton.svelte). A refused copy says "Copy failed" (a short label, so the phone row keeps its width)
     and its status says to select the link: the desktop page prints the link; the phone card draws none, so it shows the link in a
     readonly field once the copy is refused, and the row wraps rather than clip at 320 (VALIDATION-actions-r4.md R4-1). "Download PDF" / "Share the PDF" (#pdf) wait on a PDF of the plan: RESULTS debt. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Mark from "../../Mark.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import DocTop from "./DocTop.svelte";
  import Qr from "./Qr.svelte";
  import CopyButton from "./CopyButton.svelte";
  import ActButton from "./ActButton.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import R0 from "../../../fixtures/actions/review.json";
  import D0 from "../../../fixtures/actions/action-plan.json";

  // data: the fixture shape (gallery) or app/data.js nextStepModel (live): the plan's talk rows are the built report's gaps and weakest
  // areas; noticed / next / facts / share have no store (no plan store, no plan share link in the API), so the sheet says so and draws
  // no link, no QR and no PDF.
  let { phone = false, theme = "light", data = null, user = R0.user } = $props();
  const live = $derived(!!data);
  const D = $derived(data ? { doc: data.doc, meta: data.meta, talk: data.talk, noticed: "", next: "", facts: [["Built on", data.review.builtOn || "—"], ["Responses", String(data.review.responses)], ["Agreed by", "—"]], share: null, foot: data.foot, phone: { crumb: `${data.review.title} · ${data.stage === "reviewed" ? "improve" : "understand"}`, meta: `${data.review.project} · ${data.talk.length} item${data.talk.length === 1 ? "" : "s"} · from the built report`, items: data.talk.map(([t, apart]) => [t, apart]) } } : D0);
  const R = $derived(data ? { ...R0, user, review: { title: data.review.title } } : R0);
  const at = $derived(carry(phone, theme));
  // "Print" prints this page through the browser, as the current UI's print buttons do (ui/stage-screens.js doc.defaultView.print()).
  const printPage = () => globalThis.print?.();
  let refused = $state(false);
  const NO_NOTES = "Not recorded: notes are not saved in this app yet (no plan store in the API).";
  const NO_SHARE = "A read-only link to the plan is not available yet: the API has no plan share link. Print this page instead.";
</script>

{#snippet mail()}<Ico d={A.mail} />{/snippet}
{#snippet download()}<Ico d={A.download} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Next steps" parent={live ? R.review.title : "Luke 1–2"} back={href("next-step", at)} initials={R.user.initials} menuHref={href("menu", at)} />{:else}<DocTop title={D.doc} home={href("next-step", at)}>{#if D.share}<CopyButton text={D.share.url} label="Copy share link" lead="link" />{/if}<Button label="Email it" href={href("people", at)} lead={mail} />{#if live}<ActButton label="Print" lead="print" onclick={printPage} />{:else}<Button label="Download PDF" variant="primary" href="#pdf" lead={download} /><ActButton label="Print" lead="print" onclick={printPage} />{/if}</DocTop>{/if}{/snippet}
{#snippet bar()}{#if phone}{#if live}<div class="glass phone-bar" role="group" aria-label="Page actions"><button class="btn btn-primary btn-lg" type="button" onclick={printPage}>Print</button></div>{:else}<PhoneBar label="Share the PDF" href="#pdf" />{/if}{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <a class="link small" href={href("next-step", at)}>{D.phone.crumb}</a>
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
      {#if D.share}<p class="small">Read-only link, expires in 90 days.</p>
      <Row wrap gap={2}><CopyButton text={D.share.url} label="Copy link" block bind:failed={refused} /><Button label="Email it" href={href("people", at)} lead={mail} block /></Row>
      {#if refused}<input class="in small" readonly value={D.share.url} aria-label="Link to this plan" />{/if}
      {:else}<p class="small">{NO_SHARE}</p><Row wrap gap={2}><Button label="Email it" href={href("people", at)} lead={mail} block /></Row>{/if}
    </Card>
  {:else}
    <!-- Paper sheet contents (design-system.md §8.11 row, provisional; the next-steps sheet): .paper-title-row (title + .sheet-meta, the
         40px mark), .plan-cols (the board's tile row, which draws no tiles), then each section a plain div > div.sheet-head (role heading)
         + .plan-row (.plan-check · text · .plan-gap); .plan-notes > p.plan-note; .plan-dates > .plan-dt + .plan-dd; .plan-share > .mono.
         No .small, .h3 or inline type inside the sheet. -->
    <article class="paper" data-sheet="page" aria-label={`Next steps, ${R.review.title}`}>
        <div class="paper-title-row"><div><div class="paper-title" role="heading" aria-level="1">{R.review.title}</div><div class="sheet-meta">{D.meta}</div></div><Mark size={40} /></div>
        <div class="plan-cols"></div>
        <div>
          <div class="sheet-head" role="heading" aria-level="2">What we will talk about</div>
          {#each D.talk as [t, apart]}<div class="plan-row"><span class="plan-check" aria-hidden="true">✓</span><span>{t}</span><span class="plan-gap">{apart}</span></div>{/each}
        </div>
        <div class="plan-notes">
          <div><div class="sheet-head" role="heading" aria-level="2">What we noticed</div><p class="plan-note">{D.noticed || NO_NOTES}</p></div>
          <div><div class="sheet-head" role="heading" aria-level="2">The next step</div><p class="plan-note">{D.next || NO_NOTES}</p></div>
        </div>
        <div class="plan-dates">{#each D.facts as [k, v]}<div><div class="plan-dt">{k}</div><div class="plan-dd">{v}</div></div>{/each}</div>
        <div class="plan-share">
          {#if D.share}<div><strong>Share this plan.</strong> Anyone with this link can read the plan and the overview report — no account, nothing editable. <span class="mono">{D.share.url}</span> · {D.share.line}</div>
          <Qr bits={R.qr.plan} size={72} />{:else}<div><strong>Share this plan.</strong> {NO_SHARE}</div>{/if}
        </div>
        <div class="pfoot"><span>{D.foot}</span><span>1 of 1</span></div>
    </article>
  {/if}
</AppShell>
