<!-- UI Next (v4) phone account menu sheet (MenuPhone): HomePhone's list under the workspace-and-account sheet. Status: provisional (rule 12).
     Mock data: ui-next/fixtures/actions/menu.json. Board (cookbook design/2026-10-15-glass-redesign/canvas): MenuPhone.dc.html. Phone only:
     on desktop the account menu stays a details.dd disclosure in the top bar (design-system.md "Dialog and sheet states", R14 map), so this
     screen always renders the phone shell. The sheet is the R14 port: a native <dialog> opened with showModal() (top layer, inert page,
     Escape, focus return), never a drawn scrim div; its bottom-sheet geometry (.sheet) and ::backdrop --scrim are not in the generated
     base.css yet (canvas gap), so the browser's default dialog box and backdrop show until they land. One .btn-primary: the phone-bar's
     "Start a 3D Review" (inert behind the open sheet, as R13 sheet stacking says). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import Stack from "../../Stack.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Pill from "../../Pill.svelte";
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import D from "../../../fixtures/actions/menu.json";

  let { theme = "light" } = $props();
  const EXPLORE = "?ui_next=on&screen=explore&w=phone";
  const open = (el) => { if (typeof el.showModal === "function") { try { el.showModal(); return; } catch { /* not connected yet */ } } el.setAttribute("open", ""); };
</script>

{#snippet top()}<PhoneHeader state="root" initials="BK" home="?ui_next=on&screen=home&w=phone" menuHref="?ui_next=on&screen=menu&w=phone" />{/snippet}
{#snippet bar()}<PhoneBar label="Start a 3D Review" lead="plus" href="?ui_next=on&screen=setup&w=phone" />{/snippet}

<AppShell phone {theme} screen {top} {bar}>
  <Row split gap={3}><h1 class="title-phone">Your reviews</h1><a class="link small" href={EXPLORE}>Explore all</a></Row>
  <Card href="?ui_next=on&screen=invitations&w=phone" gap={2}><Row gap={3}><span class="icn icn-lens" data-lens="church"><Ico d={A.mail} /></span><span class="small"><b>1 invitation</b> · {D.invitation}</span></Row></Card>
  <Row wrap gap={2}>{#each D.chips as c}<span class="chip">{c}</span>{/each}<a class="link small" href={EXPLORE}>+ filter</a></Row>
  {#each D.reviews as r}
    <Card href={r.href} gap={2}>
      <span class="micro">{r.project}</span>
      <Row wrap gap={2}><span class="h2">{r.title}</span><Pill stage={r.stage} /></Row>
      <span class="small">{r.meta}</span>
      <span class="link">{r.action}</span>
    </Card>
  {/each}
  <Card href="?ui_next=on&screen=sandbox&w=phone" gap={2}><Row gap={3}><span class="icn icn-lens" data-lens="team"><Ico d={A.sparkle} /></span><span class="small"><b>Practice</b> · open the sample or make a practice copy</span></Row></Card>
  <details class="dd"><summary class="link small">Completed · {D.completed}</summary></details>
  <dialog class="glass-hi" aria-labelledby="menu-who" {@attach open}>
    <Stack gap={1}>
      <p class="micro" id="menu-who">{D.who}</p>
      <nav aria-label="Workspace and account"><Stack gap={1}>{#each D.items as [icon, label, href]}<a class="mi" {href}><Ico d={A[icon]} /><span>{label}</span></a>{/each}</Stack></nav>
    </Stack>
  </dialog>
</AppShell>
