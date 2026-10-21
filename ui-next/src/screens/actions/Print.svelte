<!-- UI Next (v4) Print paper surveys screen (review phase Collect). Status: provisional (playbook rule 12).
     Mock data: ui-next/fixtures/actions/print.json + review.json. Boards (cookbook design/2026-10-15-glass-redesign/canvas):
     Print.dc.html (desktop: the print dialog over Collect), PrintPhone.dc.html (phone, ?w=phone; hands off to the OS print sheet).
     Languages come from the current UI's pure print module (ui/assess/print-lang.js PRINT_IN_LANGUAGE, printLanguages: the review's and the
     project's LWCs, English always offered first as the legacy picker does). Desktop: the dialog's panel renders in flow under the head;
     the modal <dialog> + showModal() + ::backdrop (design-system.md "Dialog and sheet states", R14) waits on dialog geometry rows in the
     generator (canvas gap), so the faded Collect list and scrim behind it are not drawn. One .btn-primary per page: "Print 2 surveys"
     (desktop panel; the head's "Share the survey" is secondary as on the board), phone the phone-bar. -->
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
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { PRINT_IN_LANGUAGE, printLanguages } from "../../../../ui/assess/print-lang.js";
  import R from "../../../fixtures/actions/review.json";
  import D from "../../../fixtures/actions/print.json";

  let { phone = false, theme = "light" } = $props();
  const PROJECT = "?ui_next=on&screen=project", COLLECT = "?ui_next=on&screen=collect", SHARE = "?ui_next=on&screen=share";
  const w = (href) => (phone ? `${href}&w=phone` : href);
  const links = $derived(Object.fromEntries(Object.entries(R.links).map(([k, v]) => [k, w(v)])));
  const menu = R.menu.map((it) => (it.icon ? { ...it, icon: A[it.icon] } : it));
  const crumbs = [{ label: R.project, href: PROJECT }, { label: R.review.title }];
  const langs = printLanguages(R.lwc.assessment, R.lwc.project);
  const options = ["English", ...langs.map((l) => l.name)];
  const chosen = langs[0]?.name ?? "English";
  const count = $derived((phone ? D.phoneChecked : D.checked).length);
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Print paper surveys" parent="Collect" back={w(COLLECT)} initials={R.user.initials} menuHref="?ui_next=on&screen=menu&w=phone" />{:else}<TopBar who={R.user.first} initials={R.user.initials} workspace={R.workspace} {crumbs} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label={`Print ${count} surveys`} href={w(COLLECT)} backHref={w(COLLECT)} backLabel="Cancel" />{/if}{/snippet}
{#snippet meta()}{R.project} · {R.review.language} · {R.review.modality} · Updated just now{/snippet}
{#snippet print()}<Ico d={A.print} />{/snippet}
{#snippet language(id, label)}
  {#if PRINT_IN_LANGUAGE}<div><label class="lbl" for={id}>{label}</label><label class="sel"><select class="in" {id}>{#each options as o}<option selected={o === chosen}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>{/if}
{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <ReviewHead phone title={R.review.title} project={R.project} projectHref={w(PROJECT)} stage="collecting" viewed="collect" live="collect" {links} menuHref="?ui_next=on&screen=collect-menu&w=phone" />
    <Card gap={2} label="Paper surveys">
      <span class="micro">Paper surveys</span>
      <p class="small">Pick the surveys. Your phone opens its print or share sheet so you can send the PDF to a printer or to someone with one.</p>
      {#each R.surveys as s, i}
        <label class="row-opt l-row" data-split><span class="l-row" data-gap="3"><input class="cb" type="checkbox" checked={D.phoneChecked.includes(i)} /><b>{s.name}</b></span><span class="small">{D.phoneStatus[i]}</span></label>
      {/each}
      {@render language("pp-lang", "Language")}
    </Card>
  {:else}
    <Page gap={5}>
      <ReviewHead title={R.review.title} stage="collecting" {meta} viewed="collect" live="collect" done={["prepare"]} {links} {menu} action={{ label: "Share the survey", href: SHARE, lead: "qr" }} />
      <Card hi gap={5} label="Print paper surveys">
        <Grid cols={2} gap={6}>
          <Stack gap={5}>
            <div><h2 class="h2" id="pt">Print paper surveys</h2><p class="small t-15">Each paper survey carries its QR code and an access code, so answers can be entered later and still land in the right survey.</p></div>
            <div role="group" aria-labelledby="pt-which">
              <span class="lbl" id="pt-which">Which surveys</span>
              <Stack gap={2}>
                {#each R.surveys as s, i}
                  <label class="row-opt l-row" data-split><span class="l-row" data-gap="3"><input class="cb" type="checkbox" checked={D.checked.includes(i)} /><b>{s.name}</b></span><span class="small">{s.pages} pages</span></label>
                {/each}
              </Stack>
            </div>
            <Grid cols={2} gap={4}>
              {@render language("pt-lang", "Language on paper")}
              <div><label class="lbl" for="pt-size">Paper size</label><label class="sel"><select class="in" id="pt-size">{#each D.sizes as o, i}<option selected={i === 0}>{o}</option>{/each}</select><Ico d={A.chev} /></label></div>
            </Grid>
            <div class="solid l-card l-row" data-gap="3">
              <Ico d={A.warn} size={20} />
              <Stack gap={1}><h3 class="h3 t-15">{D.missing.title}</h3><p class="small">{D.missing.text} <a class="link" href="?ui_next=on&screen=print">Try translating again</a> or print as is.</p></Stack>
            </div>
            <Row split gap={2}><span></span><Row gap={2}><Button label="Cancel" variant="quiet" href={COLLECT} /><Button label={`Print ${count} surveys`} variant="primary" lg href={COLLECT} lead={print} /></Row></Row>
          </Stack>
          <Stack gap={3}>
            <span class="micro">{D.preview}</span>
            <Paper paper={R.paper} qr={R.qr.survey} />
          </Stack>
        </Grid>
      </Card>
    </Page>
  {/if}
</AppShell>
