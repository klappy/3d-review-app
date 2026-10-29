<!-- UI Next (v4) Print paper surveys screen (review phase Collect). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/print.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     Print.dc.html (desktop: the print dialog over Collect), PrintPhone.dc.html (phone, ?w=phone; hands off to the OS print sheet).
     Languages come from the current UI's print rules (ui/assess/print-lang.js PRINT_IN_LANGUAGE, printLanguages over the review's and the
     project's LWCs, English always offered first as the legacy picker does, and no picker when the review has no participant language,
     as printLanguageField), through the lane adapter ./legacy.js, which a test holds equal to print-lang.js. Desktop: the R14 port (design-system.md "Dialog and sheet states"): the review's collect list is the page, and the
     print panel is a native <dialog class="glass-hi" data-w="wide"> opened with showModal() on mount (./modal.js) on the pinned base.css
     dialog rows (1000px wide, 32/36, --dialog, ::backdrop --scrim, scroll lock); the title takes focus (tabindex -1, long content); a
     visible "×" Close tops the preview column, Escape and a backdrop tap close it, Cancel goes back to Collect. One .btn-primary per page:
     "Print 2 surveys" (the dialog's; the head's "Share the survey" is secondary as on the board), phone the phone-bar. Its count follows the
     bound checkboxes; with none ticked the primary is disabled on both widths and names its reason with aria-describedby (desktop: the
     status line beside it; phone: the shared PhoneBar's disabled + ariaDescribedby, the reason in the card; VALIDATION-actions-r4.md
     R4-2, R4-3). It is a stand-in link to Collect until printing is wired (RESULTS-actions debt 2). Links: ../href.js. -->
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
  import ReviewHead from "./ReviewHead.svelte";
  import Paper from "./Paper.svelte";
  import CollectGroups from "./CollectGroups.svelte";
  import IconAction from "./IconAction.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { printLanguages, showPrintLanguage } from "./legacy.js";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import { modal, closeDialog } from "./modal.js";
  import { untrack } from "svelte";
  import R0 from "../../../fixtures/actions/review.json";
  import D0 from "../../../fixtures/actions/print.json";

  // data: the fixture shape (gallery) or app/data.js printPageModel (live: this review's surveys, links and languages). onprint({ picked, lang,
  // paper }) prints for real (app/print.js preparePapers → openPapersPrint; live only): the primary is then a button, never a link to
  // Collect; status is the live run's line (preparing, translating, blocked tab, the ready line); previews: each survey's read form by
  // survey id (app/print.js paperPreview) for the sheet of the first ticked survey (live), else the board's paper.
  let { phone = false, theme = "light", data = null, onprint, status = "", busy = false, previews = {} } = $props();
  const live = $derived(!!data);
  const R = $derived(data ?? R0);
  const D = $derived(data ? { checked: data.checked, phoneChecked: data.checked, phoneStatus: data.surveys.map((s) => (s.open ? "" : "not collecting")), sizes: ["A4", "Letter"], missing: null, preview: "" } : D0);
  const at = $derived(carry(phone, theme));
  const crumbs = $derived([{ label: R.project, href: href("project", at) }, { label: R.review.title }]);
  let dialog = $state();
  const langs = $derived(printLanguages(R.lwc.assessment, R.lwc.project));
  // As legacy printLanguageField: no picker when the review has no participant language (./legacy.js showPrintLanguage).
  const showLanguage = $derived(showPrintLanguage(langs));
  const options = $derived([{ code: "en", name: "English" }, ...langs.map((l) => ({ code: l.code, name: l.name }))]);
  let lang = $state(untrack(() => (data ? "en" : (printLanguages(R0.lwc.assessment, R0.lwc.project)[0]?.code ?? "en"))));
  let paper = $state("A4");
  // The ticked surveys (indexes into R.surveys): the checkboxes are bound to this list, so the count follows every tick.
  // Seeded once from the board's ticks for this width (phone is a route prop, fixed for the page's life).
  let picked = $state(untrack(() => [...(data ? data.checked : phone ? D0.phoneChecked : D0.checked)]));
  const count = $derived(picked.length);
  const printLabel = $derived(count === 0 ? "Print surveys" : count === 1 ? "Print 1 survey" : `Print ${count} surveys`);
  const NONE = "Tick at least one survey to print.";
  const previewLine = $derived(live ? `Preview · ${R.surveys[picked[0]]?.name ?? "no survey ticked"} · ${paper}` : D.preview);
  const preview = $derived(live ? previews[R.surveys[picked[0]]?.id] ?? null : null);
  const print = () => onprint?.({ picked: picked.map((i) => R.surveys[i].id), lang, paper });
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Print paper surveys" parent="Collect" back={href("collect", at)} initials={R.user.initials} menuHref={href("menu", at)} />{:else}<TopBar home={href("home", at)} who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}{#if onprint}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Cancel" variant="quiet" href={href("collect", at)} /><button class="btn btn-primary btn-lg" type="button" disabled={!count || busy} aria-describedby="pp-why" onclick={print}>{printLabel}</button></div>{:else}<PhoneBar label={printLabel} href={href("collect", at)} backHref={href("collect", at)} backLabel="Cancel" disabled={!count} ariaDescribedby="pp-why" />{/if}{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Updated {R.review.updated ?? "just now"}{/snippet}
{#snippet printIco()}<Ico d={A.print} />{/snippet}
{#snippet language(id, label)}
  {#if showLanguage}<div><label class="lbl" for={id}>{label}</label><label class="sel"><select class="in" {id} bind:value={lang}>{#each options as o}<option value={o.code}>{o.name}</option>{/each}</select><Ico d={A.chev} /></label></div>{/if}
{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead phone {theme} title={R.review.title} project={R.project} stage="collecting" viewed="collect" live="collect" />
    <Card gap={2} label="Paper surveys">
      <span class="micro">Paper surveys</span>
      <p class="small">Pick the surveys. Your phone opens its print or share sheet so you can send the PDF to a printer or to someone with one.<span role="status" id="pp-why">{#if !count} {NONE}{:else if status} {status}{/if}</span></p>
      {#each R.surveys as s, i}
        <label class="row-opt l-row" data-split><span class="l-row" data-gap="3"><input class="cb" type="checkbox" value={i} bind:group={picked} /><b>{s.name}</b></span><span class="small">{D.phoneStatus[i]}</span></label>
      {/each}
      {@render language("pp-lang", "Language")}
    </Card>
  {:else}
    <Page gap={5}>
      <ReviewHead {theme} title={R.review.title} stage="collecting" {meta} viewed="collect" live="collect" done={["prepare"]} deleteRefused={R.deleteRefused} action={{ label: "Share the survey", href: href("share", at), lead: "qr" }} />
      <Stack gap={4}><CollectGroups groups={R.groups} surveys={R.surveys} host={R.host} {theme} /></Stack>
      <dialog class="glass-hi" data-w="wide" aria-labelledby="pt" bind:this={dialog} {@attach modal}>
        <!-- Fit on arrival at 1280x800 (VALIDATION-integration N1): the preview sits on the section 2 Paper preview row (./Paper.svelte,
             .psheet[data-fit]), the form column steps at --sp-4 (the board's 20), the notice takes the .solid form well (16/18; the board
             draws 12/14) and the preview column at --sp-2 (the board's 10), so the content is 748px in the 750px box and "Print 2 surveys"
             shows whole without scrolling (Chromium 1194; was 1102px, then 790px with the scaled preview). -->
        <Grid cols={2} gap={6}>
          <Stack gap={4}>
            <!-- R14 Focus on open: long content focuses the title (tabindex -1; ./modal.js focuses [data-autofocus]). -->
            <div><h2 class="h2 t-24" id="pt" tabindex="-1" data-autofocus>Print paper surveys</h2><p class="small t-15">Each paper survey carries its QR code and an access code, so answers can be entered later and still land in the right survey.</p></div>
            <div role="group" aria-labelledby="pt-which">
              <span class="lbl" id="pt-which">Which surveys</span>
              <Stack gap={2}>
                {#each R.surveys as s, i}
                  <label class="row-opt l-row" data-split><span class="l-row" data-gap="3"><input class="cb" type="checkbox" value={i} bind:group={picked} /><b>{s.name}</b></span><span class="small">{#if typeof s.pages === "string"}{s.pages}{:else if s.pages}{s.pages} {s.pages === 1 ? "page" : "pages"}{:else if s.linkError}{s.linkError}{:else if !s.open}not collecting{/if}</span></label>
                {/each}
              </Stack>
            </div>
            <Grid cols={2} gap={4}>
              {@render language("pt-lang", "Language on paper")}
              <div><label class="lbl" for="pt-size">Paper size</label><label class="sel"><select class="in" id="pt-size" bind:value={paper}>{#each D.sizes as o}<option value={o}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>
            </Grid>
            {#if D.missing}<div class="solid l-card l-row" data-pad="form" data-align="start" data-gap="3">
              <Ico d={A.warn} size={20} />
              <Stack gap={1}><h3 class="h3 t-15">{D.missing.title}</h3><p class="small">{D.missing.text} <a class="link" href={href("print", at)}>Try translating again</a> or print as is.</p></Stack>
            </div>{/if}
            <!-- Nothing ticked: the primary is the shared Button disabled, with the reason beside it (design-system.md section 2
                 Disabled, "say why next to it"); the status line is always present (empty), so the reason is announced when it appears. -->
            <div class="l-row" data-justify="end" data-gap="2"><p class="small" role="status" id="pt-why">{#if !count}{NONE}{:else}{status}{/if}</p><Button label="Cancel" variant="quiet" href={href("collect", at)} />{#if onprint}<button class="btn btn-primary btn-lg" type="button" disabled={!count || busy} aria-describedby="pt-why" onclick={print}><Ico d={A.print} />{printLabel}</button>{:else if count}<Button label={printLabel} variant="primary" lg href={href("collect", at)} lead={printIco} />{:else}<Button label={printLabel} variant="primary" lg disabled ariaDescribedby="pt-why" lead={printIco} />{/if}</div>
          </Stack>
          <Stack gap={2}>
            <Row split gap={2}><span class="micro">{previewLine}</span><IconAction d={A.x} ariaLabel="Close" onclick={() => closeDialog(dialog)} /></Row>
            {#if live}{#if preview}<Paper paper={preview} cells={R.surveys[picked[0]]?.qr ?? null} fit={paper === "Letter" ? "letter" : "a4"} page="" />{:else}<p class="small">{picked.length ? "The sheet is drawn once the form is read: press Print." : NONE}</p>{/if}{:else}<Paper paper={R.paper} qr={R.qr.survey} />{/if}
          </Stack>
        </Grid>
      </dialog>
    </Page>
  {/if}
</AppShell>
