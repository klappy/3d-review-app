<!-- UI Next (v4) Print QR code pages screen. Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): PrintQR.dc.html (wide dialog over the review's survey groups: which surveys,
     layout, text language, paper size, Cancel + Print, and the scaled A4 preview), PrintQRPhone.dc.html (adapted page, then the OS print
     sheet: "Dialog and sheet states" phone map, Print → hand-off). Contracts: §2 Option row (R10, .row-opt.compact), Field and button
     states (R16: a control that cannot act is disabled and says why), Paper (R5) on the section 2 Paper preview row (V-20, CORRECTIONS 31):
     .psheet[data-fit=a4|letter] fills the 340px aside and scales the whole 794px A4 or 816px Letter sheet to it in CSS (no script, no inline transform; it replaces the SVG viewBox stand-in), following the Paper size choice, §1.3 paper scope, R14 (title row with Close; focus opens on the title, tabindex -1; Close,
     Escape and the backdrop go back to Collect).
     Title block as the board draws it: the title with its intro line under it (the dialog's aria-describedby), Close at the block's top,
     so the form fits the 1280x800 modal with its bottom padding (no inner scroll at that size).
     Choices: the ticked surveys (keyed by survey code), the layout (keyed by its title), the text language and the paper size are the
     user's; they start from the data (writable deriveds, so new data resets them), and the layout falls back to the data's first when
     the data no longer has the chosen one (model.js pickLayout). "Print N pages", each layout's page count, the preview caption and the
     preview follow the ticks and the layout: the preview draws the first page of the chosen layout (one page per survey: the first
     ticked survey's full-page code; hand-out cards: that survey's cards; all on one page: every ticked code) with its "1 of N" footer.
     The text language is held but not drawn: the scan line has one (English) source (RESULTS-collect.md Round 3, handed back); the paper size
     picks the preview's sheet (A4 or Letter). Nothing ticked: Print is disabled and the reason shows in the action row, start-aligned
     beside Cancel and Print (a polite status kept in the row, so saying why adds no line and the form still fits the 1280x800 modal);
     the disabled Print names it with aria-describedby, the phone status is always mounted too (N1), and the preview column says
     what fills it instead of standing blank (N3, VALIDATION-collect-r4.md).
     One .btn-primary: "Print N pages".
     Print surveys (the questions) is a pointer to the Print screen, never a second print here (R32 one home). The boards draw one state
     (the open form): any ?state= renders it. -->
<script>
  import Button from "../../Button.svelte";
  import ReviewFrame from "./ReviewFrame.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import Dialog from "./Dialog.svelte";
  import Glyph from "./Glyph.svelte";
  import Qr from "./Qr.svelte";
  import { collectModel, pickedSurveys, pickLayout, printPages, pagesLabel } from "./model.js";
  import { href } from "../href.js";
  import fixture from "../../../fixtures/collect/collect.json";

  // onprint({ surveys, per, paper }): the live app prints the chosen pages for real (app/print.js); without it (gallery) the
  // control is the board's link back to Collect.
  let { phone = false, theme = "light", data = fixture, onprint } = $props();
  let blocked = $state(false);
  const doPrint = () => { blocked = false; const ok = onprint({ surveys: chosen, per: lay.per, paper }); if (ok === false) blocked = true; };
  const m = $derived(collectModel(data));
  const p = $derived(m.printQr);
  // The user's choices, initially what the board draws (the data's ticked codes, the first layout, language and paper).
  let picked = $derived(pickedSurveys(m.surveys, p.checked).map((s) => s.code));
  let layout = $derived(p.layouts[0]?.title);
  let language = $derived(p.languages[0]);
  let paper = $derived(p.papers[0]);
  const tick = (code, on) => { picked = m.surveys.map((s) => s.code).filter((c) => (c === code ? on : picked.includes(c))); };
  const chosen = $derived(pickedSurveys(m.surveys, picked));
  const lay = $derived(pickLayout(p.layouts, layout));
  const n = $derived(printPages(lay.per, chosen.length));
  const first = $derived(chosen[0]);
  // What the preview's first page holds: one survey's full page, or a grid of codes (that survey's cards, or every ticked code).
  const cells = $derived(!first || lay.per === "survey" ? [] : lay.per === "one" ? chosen : Array.from({ length: lay.cards }, () => first));
  const WHY = "Tick at least one survey to print its page.";
  const EMPTY = "Tick a survey to preview its page here.";
  // The preview takes the chosen paper size: the section 2 Paper preview row scales the 794px A4 or 816px Letter sheet to its column.
  const fit = $derived(paper === "Letter" ? "letter" : "a4");
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet chev()}<Glyph name="chev" />{/snippet}
{#snippet phoneBar()}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Cancel" variant="quiet" href={href("collect")} />{#if n && onprint}<button class="btn btn-primary btn-lg" type="button" onclick={doPrint}>{@render print()}Print {pagesLabel(n)}</button>{:else if n}<Button label={`Print ${pagesLabel(n)}`} variant="primary" lg href={href("collect")} lead={print} />{:else}<Button label="Print" variant="primary" lg disabled ariaDescribedby="print-qr-why" lead={print} />{/if}</div>{/snippet}
{#snippet title()}
  <div>
    <!-- The title sits in a row so its box hugs the words. Focused by script on open (R14, tabindex -1), it draws no ring:
         type.css drops the outline on a script-focused heading (VALIDATION-integration N2); every control keeps the kit's ring. -->
    <div class="l-row">
      <!-- svelte-ignore a11y_autofocus -->
      <h2 class="h2 t-24" id="print-qr-title" tabindex="-1" autofocus>Print QR code pages</h2>
    </div>
    <p class="small t-15" id="print-qr-about">Pages people can scan or take away. These are not the surveys — to print the questions themselves, use <a class="link" href={href("print")}>Print paper surveys</a>.</p>
  </div>
{/snippet}

<ReviewFrame {m} {phone} {theme} shareKind="secondary" phoneTitle="Print QR code pages" {phoneBar}>
  {#if phone}
    <div class="glass l-card l-stack" data-gap="2" role="group" aria-labelledby="qr-pages-title">
      <span class="micro" id="qr-pages-title">QR code pages</span>
      <p class="small">One {paper} page per survey, with the link printed under the code.</p>
      {#each m.surveys as s (s.code)}<label class="row-opt"><input class="cb" type="checkbox" checked={picked.includes(s.code)} onchange={(e) => tick(s.code, e.currentTarget.checked)} /><span class="h3" data-grow>{s.name}</span><Glyph name="qr" size={16} /></label>{/each}
      <!-- N1: the live region is always mounted (as on desktop); only its text changes, so the reason is announced when it appears. -->
      <p class="small field-help" role="status" id="print-qr-why">{#if !n}{WHY}{/if}</p>
    </div>
  {:else}
    <SurveyGroups groups={m.groups} />
    <Dialog labelledby="print-qr-title" describedby="print-qr-about" cancel={href("collect")} wide titleTop gap={5} {title}>
      <div class="l-grid" data-gap="6" data-tpl="aside">
        <div class="l-stack" data-gap="5">
          <div class="l-grid" data-cols="2" data-gap="5">
            <div class="l-stack" data-gap="2" role="group" aria-labelledby="print-qr-which">
              <span class="lbl" id="print-qr-which">Which surveys</span>
              {#each m.surveys as s (s.code)}<label class="row-opt compact"><input class="cb" type="checkbox" checked={picked.includes(s.code)} onchange={(e) => tick(s.code, e.currentTarget.checked)} /><span class="h3" data-grow>{s.name}</span><span class="small kbd">{s.code}</span></label>{/each}
            </div>
            <div class="l-stack" data-gap="2" role="radiogroup" aria-labelledby="print-qr-layout">
              <span class="lbl" id="print-qr-layout">Layout</span>
              {#each p.layouts as l (l.title)}<label class="row-opt" data-align="start"><input class="rd" type="radio" name="print-qr-layout" value={l.title} checked={l.title === lay.title} onchange={() => (layout = l.title)} /><span class="l-stack" data-gap="1"><span class="h3">{l.title}</span><span class="small">{l.help} {pagesLabel(printPages(l.per, chosen.length))}.</span></span></label>{/each}
            </div>
          </div>
          <div class="l-grid" data-cols="2" data-gap="4">
            <div class="l-stack" data-gap="1">
              <label class="lbl" for="print-qr-lang">Text on the page</label>
              <div class="sel"><select class="in" id="print-qr-lang" aria-describedby="print-qr-lang-help" value={language} onchange={(e) => (language = e.currentTarget.value)}>{#each p.languages as l (l)}<option value={l}>{l}</option>{/each}</select>{@render chev()}</div>
              <p class="small field-help" id="print-qr-lang-help">The language of the "scan to answer" line. The survey itself opens in whatever language the person picks.</p>
            </div>
            <div class="l-stack" data-gap="1">
              <label class="lbl" for="print-qr-paper">Paper size</label>
              <div class="sel"><select class="in" id="print-qr-paper" value={paper} onchange={(e) => (paper = e.currentTarget.value)}>{#each p.papers as s (s)}<option value={s}>{s}</option>{/each}</select>{@render chev()}</div>
            </div>
          </div>
          <div class="l-row" data-gap="2" data-justify="end">
            <p class="small field-help" role="status" id="print-qr-why" data-grow>{#if !n}{WHY}{:else if blocked}The browser blocked the print tab. Allow pop-ups for this site and try again.{/if}</p>
            <Button label="Cancel" variant="quiet" href={href("collect")} />
            {#if n && onprint}<button class="btn btn-primary btn-lg" type="button" onclick={doPrint}>{@render print()}Print {pagesLabel(n)}</button>{:else if n}<Button label={`Print ${pagesLabel(n)}`} variant="primary" lg href={href("collect")} lead={print} />{:else}<Button label="Print" variant="primary" lg disabled ariaDescribedby="print-qr-why" lead={print} />{/if}
          </div>
        </div>
        <div class="l-stack" data-gap="3" data-align="center">
          <span class="micro">Preview · {lay.title.toLowerCase()} · {paper} · {pagesLabel(n)}</span>
          {#if first}
            <div class="psheet" data-fit={fit} aria-hidden="true" data-layout={lay.per}>
              <div class="paper">
                {#if lay.per === "survey"}
                  <div class="l-stack" data-gap="5" data-align="center">
                    <span class="t-16">3D Review · {m.review.title}</span>
                    <Qr cells={first.qr} size="page" />
                    <span class="ptitle">{first.name}</span>
                    <span class="kbd">{first.link}</span>
                    <span class="t-16">{m.hasAccessCodes ? `Scan to answer · or enter code ${first.code.slice(0, 3)} ${first.code.slice(3)} at ${m.linkHost.split("/")[0]}` : "Scan to answer"} · {p.pageLanguages}</span>
                  </div>
                {:else}
                  <span class="t-16">3D Review · {m.review.title}</span>
                  <div class="l-grid" data-cols="2" data-gap="5">
                    {#each cells as c, i (i)}<div class="l-stack" data-gap="2" data-align="center"><Qr cells={c.qr} size="room" /><span class="ptitle">{c.name}</span><span class="kbd">{c.link}</span></div>{/each}
                  </div>
                {/if}
                <div class="pfoot"><span>1 of {n}</span></div>
              </div>
            </div>
          {:else}
            <!-- N3: nothing ticked draws no sheet; one line says what fills the column (no board draws this state). -->
            <p class="small" id="print-qr-empty">{EMPTY}</p>
          {/if}
        </div>
      </div>
    </Dialog>
  {/if}
</ReviewFrame>
