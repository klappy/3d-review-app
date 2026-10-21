<!-- UI Next (v4) Print QR code pages screen. Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): PrintQR.dc.html (wide dialog over the review's survey groups: which surveys,
     layout, text language, paper size, Cancel + Print, and the scaled A4 preview), PrintQRPhone.dc.html (adapted page, then the OS print
     sheet: "Dialog and sheet states" phone map, Print → hand-off). Contracts: §2 Option row (R10, .row-opt.compact), Field and button
     states (R16: a control that cannot act is disabled and says why), Paper (R5: the preview is the 794px A4 sheet, .paper[data-sheet=a4],
     scaled down, here by the SVG viewBox so no inline transform is needed), §1.3 paper scope, R14 (title row with Close; focus opens on the title, tabindex -1; Close,
     Escape and the backdrop go back to Collect).
     Controlled: the ticked surveys, the layout, the text language and the paper size are $state. "Print N pages", each layout's page count,
     the preview caption, the preview's survey (the first ticked) and its "1 of N" footer follow them. Nothing ticked: Print is disabled
     and the reason shows. One .btn-primary: "Print N pages". Print surveys (the questions) is a pointer to the Print screen, never a
     second print here (R32 one home). The boards draw one state (the open form): any ?state= renders it. -->
<script>
  import Button from "../../Button.svelte";
  import ReviewFrame from "./ReviewFrame.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import Dialog from "./Dialog.svelte";
  import Glyph from "./Glyph.svelte";
  import Qr from "./Qr.svelte";
  import { collectModel, printPages, pagesLabel } from "./model.js";
  import { href } from "../href.js";
  import fixture from "../../../fixtures/collect/collect.json";

  let { phone = false, theme = "light", data = fixture } = $props();
  const m = $derived(collectModel(data));
  const p = $derived(m.printQr);
  // The user's choices (initially what the board draws: the fixture's ticked rows, the first layout, language and paper).
  let ticked = $state(collectModel(data).surveys.map((_, i) => data.printQr.checked.includes(i)));
  let layout = $state(0);
  let language = $state(data.printQr.languages[0]);
  let paper = $state(data.printQr.papers[0]);
  const chosen = $derived(m.surveys.filter((_, i) => ticked[i]));
  const per = $derived(p.layouts[layout].per);
  const n = $derived(printPages(per, chosen.length));
  const first = $derived(chosen[0]);
  const WHY = "Tick at least one survey to print its page.";
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet chev()}<Glyph name="chev" />{/snippet}
{#snippet phoneBar()}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Cancel" variant="quiet" href={href("collect")} />{#if n}<Button label={`Print ${pagesLabel(n)}`} variant="primary" lg href={href("collect")} lead={print} />{:else}<Button label="Print" variant="primary" lg disabled lead={print} />{/if}</div>{/snippet}
{#snippet title()}
  <!-- svelte-ignore a11y_autofocus -->
  <h2 class="h2 t-24" id="print-qr-title" tabindex="-1" autofocus>Print QR code pages</h2>
{/snippet}

<ReviewFrame {m} {phone} {theme} shareKind="secondary" phoneTitle="Print QR code pages" {phoneBar}>
  {#if phone}
    <div class="glass l-card l-stack" data-gap="2" role="group" aria-labelledby="qr-pages-title">
      <span class="micro" id="qr-pages-title">QR code pages</span>
      <p class="small">One {paper} page per survey, with the link printed under the code.</p>
      {#each m.surveys as s, i (s.code)}<label class="row-opt"><input class="cb" type="checkbox" bind:checked={ticked[i]} /><span class="h3" data-grow>{s.name}</span><Glyph name="qr" size={16} /></label>{/each}
      {#if !n}<p class="small field-help" role="status">{WHY}</p>{/if}
    </div>
  {:else}
    <SurveyGroups groups={m.groups} />
    <Dialog labelledby="print-qr-title" cancel={href("collect")} wide gap={1} {title}>
      <div class="l-grid" data-gap="6" data-tpl="aside">
        <div class="l-stack" data-gap="5">
          <p class="small t-15">Pages people can scan or take away. These are not the surveys — to print the questions themselves, use <a class="link" href={href("print")}>Print paper surveys</a>.</p>
          <div class="l-grid" data-cols="2" data-gap="5">
            <div class="l-stack" data-gap="2" role="group" aria-labelledby="print-qr-which">
              <span class="lbl" id="print-qr-which">Which surveys</span>
              {#each m.surveys as s, i (s.code)}<label class="row-opt compact"><input class="cb" type="checkbox" bind:checked={ticked[i]} /><span class="h3" data-grow>{s.name}</span><span class="small kbd">{s.code}</span></label>{/each}
            </div>
            <div class="l-stack" data-gap="2" role="radiogroup" aria-labelledby="print-qr-layout">
              <span class="lbl" id="print-qr-layout">Layout</span>
              {#each p.layouts as l, i (l.title)}<label class="row-opt" data-align="start"><input class="rd" type="radio" name="print-qr-layout" value={i} bind:group={layout} /><span class="l-stack" data-gap="1"><span class="h3">{l.title}</span><span class="small">{l.help} {pagesLabel(printPages(l.per, chosen.length))}.</span></span></label>{/each}
            </div>
          </div>
          <div class="l-grid" data-cols="2" data-gap="4">
            <div class="l-stack" data-gap="1">
              <label class="lbl" for="print-qr-lang">Text on the page</label>
              <div class="sel"><select class="in" id="print-qr-lang" aria-describedby="print-qr-lang-help" bind:value={language}>{#each p.languages as l (l)}<option value={l}>{l}</option>{/each}</select>{@render chev()}</div>
              <p class="small field-help" id="print-qr-lang-help">The language of the "scan to answer" line. The survey itself opens in whatever language the person picks.</p>
            </div>
            <div class="l-stack" data-gap="1">
              <label class="lbl" for="print-qr-paper">Paper size</label>
              <div class="sel"><select class="in" id="print-qr-paper" bind:value={paper}>{#each p.papers as s (s)}<option value={s}>{s}</option>{/each}</select>{@render chev()}</div>
            </div>
          </div>
          {#if !n}<p class="small field-help" role="status">{WHY}</p>{/if}
          <div class="l-row" data-gap="2" data-justify="end">
            <Button label="Cancel" variant="quiet" href={href("collect")} />
            {#if n}<Button label={`Print ${pagesLabel(n)}`} variant="primary" lg href={href("collect")} lead={print} />{:else}<Button label="Print" variant="primary" lg disabled lead={print} />{/if}
          </div>
        </div>
        <div class="l-stack" data-gap="3" data-align="center">
          <span class="micro">Preview · {p.layouts[layout].title.toLowerCase()} · {paper} · {pagesLabel(n)}</span>
          {#if first}
            <svg class="psheet" width="300" viewBox="0 0 794 1123" aria-hidden="true"><foreignObject width="794" height="1123">
              <div class="paper" data-sheet="a4">
                <div class="l-stack" data-gap="5" data-align="center">
                  <span class="t-16">3D Review · {m.review.title}</span>
                  <Qr cells={first.qr} size="page" />
                  <span class="ptitle">{first.name}</span>
                  <span class="kbd">{first.link}</span>
                  <span class="t-16">Scan to answer · or enter code {first.code.slice(0, 3)} {first.code.slice(3)} at {m.linkHost.split("/")[0]} · {p.pageLanguages}</span>
                </div>
                <div class="pfoot"><span>1 of {n}</span></div>
              </div>
            </foreignObject></svg>
          {/if}
        </div>
      </div>
    </Dialog>
  {/if}
</ReviewFrame>
