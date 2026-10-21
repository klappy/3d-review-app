<!-- UI Next (v4) Print QR code pages screen. Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): PrintQR.dc.html (wide dialog over the review's survey groups: which surveys,
     layout, text language, paper size, Cancel + Print, and the scaled A4 preview), PrintQRPhone.dc.html (adapted page, then the OS print
     sheet: "Dialog and sheet states" phone map, Print → hand-off). Contracts: §2 Option row (R10, .row-opt.compact), Field and button
     states, Paper (R5: the preview is the 794px sheet scaled down, here by the SVG viewBox so no inline transform is needed), §1.3 paper scope.
     One .btn-primary: "Print N pages", N = the ticked surveys for one page per survey (the board's 3). Print surveys (the questions) is a
     pointer to the Print screen, never a second print here (R32 one home). -->
<script>
  import Button from "../../Button.svelte";
  import ReviewFrame from "./ReviewFrame.svelte";
  import SurveyGroups from "./SurveyGroups.svelte";
  import Dialog from "./Dialog.svelte";
  import Glyph from "./Glyph.svelte";
  import Qr from "./Qr.svelte";
  import { collectModel, href } from "./model.js";
  import fixture from "../../../fixtures/collect/collect.json";

  let { phone = false, theme = "light", state, data = fixture } = $props();
  if (state !== undefined) throw new TypeError(`PrintQR: the boards draw one state (the open print form), got "${String(state)}"`);
  const m = $derived(collectModel(data));
  const p = $derived(m.printQr);
  const n = $derived(p.checked.length);
  const first = $derived(m.surveys[p.checked[0]]);
  const pages = (k) => `${k} ${k === 1 ? "page" : "pages"}`;
</script>

{#snippet print()}<Glyph name="print" />{/snippet}
{#snippet chev()}<Glyph name="chev" />{/snippet}
{#snippet phoneBar()}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Cancel" variant="quiet" href={href("collect", { phone: true })} /><Button label={`Print ${pages(n)}`} variant="primary" lg href={href("collect", { phone: true })} lead={print} /></div>{/snippet}

<ReviewFrame {m} {phone} {theme} shareKind="secondary" phoneTitle="Print QR code pages" {phoneBar}>
  {#if phone}
    <div class="glass l-card l-stack" data-gap="2" role="group" aria-labelledby="qr-pages-title">
      <span class="micro" id="qr-pages-title">QR code pages</span>
      <p class="small">One {data.printQr.papers[0]} page per survey, with the link printed under the code.</p>
      {#each m.surveys as s, i (s.code)}<label class="row-opt"><input class="cb" type="checkbox" checked={p.checked.includes(i)} /><span class="h3" data-grow>{s.name}</span><Glyph name="qr" size={16} /></label>{/each}
    </div>
  {:else}
    <SurveyGroups groups={m.groups} />
    <Dialog labelledby="print-qr-title" wide>
      <div class="l-grid" data-gap="6" data-tpl="aside">
        <div class="l-stack" data-gap="5">
          <div class="l-stack" data-gap="1">
            <h2 class="h2" id="print-qr-title">Print QR code pages</h2>
            <p class="small t-15">Pages people can scan or take away. These are not the surveys — to print the questions themselves, use <a class="link" href={href("print")}>Print paper surveys</a>.</p>
          </div>
          <div class="l-grid" data-cols="2" data-gap="5">
            <div class="l-stack" data-gap="2" role="group" aria-labelledby="print-qr-which">
              <span class="lbl" id="print-qr-which">Which surveys</span>
              {#each m.surveys as s, i (s.code)}<label class="row-opt compact"><input class="cb" type="checkbox" checked={p.checked.includes(i)} /><span class="h3" data-grow>{s.name}</span><span class="small kbd">{s.code}</span></label>{/each}
            </div>
            <div class="l-stack" data-gap="2" role="radiogroup" aria-labelledby="print-qr-layout">
              <span class="lbl" id="print-qr-layout">Layout</span>
              {#each p.layouts as [title, help], i (title)}<label class="row-opt" data-align="start"><input class="rd" type="radio" name="print-qr-layout" checked={i === 0} /><span class="l-stack" data-gap="1"><span class="h3">{title}</span><span class="small">{help}</span></span></label>{/each}
            </div>
          </div>
          <div class="l-grid" data-cols="2" data-gap="4">
            <div class="l-stack" data-gap="1">
              <label class="lbl" for="print-qr-lang">Text on the page</label>
              <div class="sel"><select class="in" id="print-qr-lang" aria-describedby="print-qr-lang-help">{#each p.languages as l, i (l)}<option selected={i === 0}>{l}</option>{/each}</select>{@render chev()}</div>
              <p class="small field-help" id="print-qr-lang-help">The language of the "scan to answer" line. The survey itself opens in whatever language the person picks.</p>
            </div>
            <div class="l-stack" data-gap="1">
              <label class="lbl" for="print-qr-paper">Paper size</label>
              <div class="sel"><select class="in" id="print-qr-paper">{#each p.papers as s, i (s)}<option selected={i === 0}>{s}</option>{/each}</select>{@render chev()}</div>
            </div>
          </div>
          <div class="l-row" data-gap="2" data-justify="end">
            <Button label="Cancel" variant="quiet" href={href("collect")} />
            <Button label={`Print ${pages(n)}`} variant="primary" lg href={href("collect")} lead={print} />
          </div>
        </div>
        <div class="l-stack" data-gap="3" data-align="center">
          <span class="micro">Preview · {p.layouts[0][0].toLowerCase()} · {p.papers[0]} · {pages(n)}</span>
          <svg class="psheet" width="300" viewBox="0 0 794 1123" aria-hidden="true"><foreignObject width="794" height="1123">
            <div class="paper l-card l-stack" data-gap="5" data-align="center">
              <span class="t-16">3D Review · {m.review.title}</span>
              <Qr cells={p.qr} size="page" />
              <span class="ptitle">{first.name}</span>
              <span class="kbd">{first.link}</span>
              <span class="t-16">Scan to answer · or enter code {first.code.slice(0, 3)} {first.code.slice(3)} at {m.linkHost.split("/")[0]} · {p.pageLanguages}</span>
              <div class="pfoot"><span>1 of {n}</span></div>
            </div>
          </foreignObject></svg>
        </div>
      </div>
    </Dialog>
  {/if}
</ReviewFrame>
