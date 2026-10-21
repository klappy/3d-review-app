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
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/print.json";

  let { phone = false, theme = "light" } = $props();
  const at = $derived(carry(phone, theme));
  const crumbs = $derived([{ label: R.project, href: href("project", at) }, { label: R.review.title }]);
  let dialog = $state();
  const langs = printLanguages(R.lwc.assessment, R.lwc.project);
  // As legacy printLanguageField: no picker when the review has no participant language (./legacy.js showPrintLanguage).
  const showLanguage = showPrintLanguage(langs);
  const options = ["English", ...langs.map((l) => l.name)];
  const chosen = langs[0]?.name ?? "English";
  // The ticked surveys (indexes into R.surveys): the checkboxes are bound to this list, so the count follows every tick.
  // Seeded once from the board's ticks for this width (phone is a route prop, fixed for the page's life).
  let picked = $state(untrack(() => [...(phone ? D.phoneChecked : D.checked)]));
  const count = $derived(picked.length);
  const printLabel = $derived(count === 0 ? "Print surveys" : count === 1 ? "Print 1 survey" : `Print ${count} surveys`);
  const NONE = "Tick at least one survey to print.";
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Print paper surveys" parent="Collect" back={href("collect", at)} initials={R.user.initials} menuHref={href("menu", at)} />{:else}<TopBar home={href("home", at)} who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label={printLabel} href={href("collect", at)} backHref={href("collect", at)} backLabel="Cancel" disabled={!count} ariaDescribedby="pp-why" />{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Updated just now{/snippet}
{#snippet print()}<Ico d={A.print} />{/snippet}
{#snippet language(id, label)}
  {#if showLanguage}<div><label class="lbl" for={id}>{label}</label><label class="sel"><select class="in" {id}>{#each options as o}<option selected={o === chosen}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>{/if}
{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead phone {theme} title={R.review.title} project={R.project} stage="collecting" viewed="collect" live="collect" />
    <Card gap={2} label="Paper surveys">
      <span class="micro">Paper surveys</span>
      <p class="small">Pick the surveys. Your phone opens its print or share sheet so you can send the PDF to a printer or to someone with one.<span role="status" id="pp-why">{#if !count} {NONE}{/if}</span></p>
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
        <Grid cols={2} gap={6}>
          <Stack gap={5}>
            <!-- R14 Focus on open: long content focuses the title (tabindex -1; ./modal.js focuses [data-autofocus]). -->
            <div><h2 class="h2 t-24" id="pt" tabindex="-1" data-autofocus>Print paper surveys</h2><p class="small t-15">Each paper survey carries its QR code and an access code, so answers can be entered later and still land in the right survey.</p></div>
            <div role="group" aria-labelledby="pt-which">
              <span class="lbl" id="pt-which">Which surveys</span>
              <Stack gap={2}>
                {#each R.surveys as s, i}
                  <label class="row-opt l-row" data-split><span class="l-row" data-gap="3"><input class="cb" type="checkbox" value={i} bind:group={picked} /><b>{s.name}</b></span><span class="small">{s.pages} pages</span></label>
                {/each}
              </Stack>
            </div>
            <Grid cols={2} gap={4}>
              {@render language("pt-lang", "Language on paper")}
              <div><label class="lbl" for="pt-size">Paper size</label><label class="sel"><select class="in" id="pt-size">{#each D.sizes as o, i}<option selected={i === 0}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>
            </Grid>
            <div class="solid l-card l-row" data-align="start" data-gap="3">
              <Ico d={A.warn} size={20} />
              <Stack gap={1}><h3 class="h3 t-15">{D.missing.title}</h3><p class="small">{D.missing.text} <a class="link" href={href("print", at)}>Try translating again</a> or print as is.</p></Stack>
            </div>
            <!-- Nothing ticked: the primary is the shared Button disabled, with the reason beside it (design-system.md section 2
                 Disabled, "say why next to it"); the status line is always present (empty), so the reason is announced when it appears. -->
            <div class="l-row" data-justify="end" data-gap="2"><p class="small" role="status" id="pt-why">{#if !count}{NONE}{/if}</p><Button label="Cancel" variant="quiet" href={href("collect", at)} />{#if count}<Button label={printLabel} variant="primary" lg href={href("collect", at)} lead={print} />{:else}<Button label={printLabel} variant="primary" lg disabled ariaDescribedby="pt-why" lead={print} />{/if}</div>
          </Stack>
          <Stack gap={3}>
            <Row split gap={2}><span class="micro">{D.preview}</span><IconAction d={A.x} ariaLabel="Close" onclick={() => closeDialog(dialog)} /></Row>
            <Paper paper={R.paper} qr={R.qr.survey} />
          </Stack>
        </Grid>
      </dialog>
    </Page>
  {/if}
</AppShell>
