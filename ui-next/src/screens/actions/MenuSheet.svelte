<!-- UI Next (v4) phone account menu sheet (MenuPhone): HomePhone's list under the workspace-and-account sheet. Status: provisional (rule 12).
     Mock data: ui-next/fixtures/actions/menu.json. Board (cookbook design/2026-10-15-glass-redesign/canvas): MenuPhone.dc.html. Phone only:
     on desktop the account menu stays a details.dd disclosure in the top bar (design-system.md "Dialog and sheet states", R14 map), so this
     screen always renders the phone shell. The sheet is the R14 port: a native <dialog class="glass-hi sheet" data-pad="menu"> opened with
     showModal() (top layer, inert page, Escape, focus return) on the pinned base.css rows (dialog.glass-hi.sheet geometry, ::backdrop
     --scrim, the menu-rows padding, .sheet-handle decoration, 52px .mi rows). Dismissal (R14 Escape and dismissal): Escape (native), the
     visible "×" Close at the end of the micro title row, and a tap on the backdrop (closedby="any" where supported, plus ./modal.js's
     one click listener that closes when the tap lands outside the sheet's box). Closing leaves HomePhone's list, which is what the sheet sits on.
     One .btn-primary: the phone-bar's "Start a 3D Review" (inert behind the open sheet, as R13 sheet stacking says). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Pill from "../../Pill.svelte";
  import Ico from "./Ico.svelte";
  import IconAction from "./IconAction.svelte";
  import { A } from "./icons.js";
  import { href } from "../href.js";
  import { carry } from "./links.js";
  import { modal, closeDialog } from "./modal.js";
  import D0 from "../../../fixtures/actions/menu.json";

  // data: the fixture shape (gallery) or app/data.js menuModel (live: the account's reviews with their real links, the signed-in
  // account, and rows that act: an item [icon, label, href, onclick] with an onclick is a button (sign out), the rest are links).
  let { theme = "light", data = null } = $props();
  const D = $derived(data ?? D0);
  const at = $derived(carry(true, theme));
  const explore = $derived(href("explore", at));
  // Where each review card goes, by its stage (the boards: CollectPhone, SetupPhone, ResultsPhone); a live card carries its own href.
  const byStage = $derived({ collecting: href("collect", at), setup: href("setup1", at), results: href("results", at) });
  // The sheet's rows in the board's order (fixture labels): workspace, invitations, help, about, feedback, another account, sign out.
  const to = $derived([href("workspace", at), href("invitations", at), href("help", at), href("about", at), href("feedback", at), href("sign-in", at), href("sign-in", at)]);
  if (D.items.length !== 7) throw new TypeError("MenuSheet: the sheet draws the board's seven rows");
  const initials = $derived(D.initials ?? "BK");

  let sheet = $state();
</script>

{#snippet top()}<PhoneHeader state="root" {initials} home={href("home", at)} menuHref={href("menu", at)} />{/snippet}
{#snippet bar()}<PhoneBar label="Start a 3D Review" lead="plus" href={href("setup1", at)} />{/snippet}

<AppShell phone {theme} screen {top} {bar}>
  <Row split gap={3}><h1 class="title-phone">Your reviews</h1><a class="link small" href={explore}>Explore all</a></Row>
  {#if D.invitation}<Card href={href("invitations", at)} gap={2}><Row gap={3}><span class="icn icn-lens" data-lens="church"><Ico d={A.mail} /></span><span class="small"><b>1 invitation</b> · {D.invitation}</span></Row></Card>{/if}
  <Row wrap gap={2}>{#each D.chips as c}<span class="chip">{c}</span>{/each}<a class="link small" href={explore}>+ filter</a></Row>
  {#each D.reviews as r}
    <Card href={r.href ?? byStage[r.stage]} gap={2}>
      <span class="micro">{r.project}</span>
      <Row wrap gap={2}><span class="h2">{r.title}</span><Pill stage={r.stage} /></Row>
      <span class="small">{r.meta}</span>
      <span class="link">{r.action}</span>
    </Card>
  {/each}
  <Card href={href("sandbox", at)} gap={2}><Row gap={3}><span class="icn icn-lens" data-lens="team"><Ico d={A.sparkle} /></span><span class="small"><b>Practice</b> · {data ? "open the sample review" : "open the sample or make a practice copy"}</span></Row></Card>
  <details class="dd"><summary class="link small">Completed · {D.completed}</summary></details>
  <dialog class="glass-hi sheet" data-pad="menu" aria-labelledby="menu-who" closedby="any" bind:this={sheet} {@attach modal}>
    <div class="sheet-handle" aria-hidden="true"></div>
    <Row split gap={2}><p class="micro sheet-title" id="menu-who">{D.who}</p><IconAction d={A.x} ariaLabel="Close" onclick={() => closeDialog(sheet)} /></Row>
    <!-- R14 Focus on open: a sheet of menu rows focuses its first row (./modal.js focuses [data-autofocus]). -->
    <nav aria-label="Workspace and account">
      {#each D.items as [icon, label, link, onclick], i}{#if typeof onclick === "function"}<button class="mi" data-size="lg" type="button" {onclick} data-autofocus={i === 0 ? "" : undefined}><Ico d={A[icon]} /><span>{label}</span></button>{:else}<a class="mi" data-size="lg" href={link ?? to[i]} data-autofocus={i === 0 ? "" : undefined}><Ico d={A[icon]} /><span>{label}</span></a>{/if}{/each}
    </nav>
  </dialog>
</AppShell>
