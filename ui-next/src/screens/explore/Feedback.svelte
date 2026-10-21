<!-- UI Next (v4) Feedback screen ("Send app feedback"). Status: provisional (playbook rule 12). Explore lane of the screens fanout.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Feedback.dc.html (desktop: a dialog over the page the user was on),
     FeedbackPhone.dc.html (phone: a full page, design-system.md "Dialog and sheet states" phone map). Mock data: ui-next/fixtures/explore/feedback.json.
     Desktop is a native <dialog class="glass-hi"> opened with showModal() (top layer, inert page, ::backdrop; geometry and backdrop from the
     dialog.glass-hi rows); focus on the first field (autofocus, contract "Focus on open"). Close, Cancel and Escape all go Home: the dialog's
     cancel event is prevented and routed like Close, so Escape never leaves an empty page under the TopBar. The route's one h1 is the dialog
     title (the page under a desktop dialog draws nothing else), styled by the board's .h2.t-24 row.
     The version on the page line is the app's stamped version (package.json "version", the value scripts/stamp-version.mjs validates
     against the release manifest), never a fixture literal. Composed of AppShell > Card > Stack / Row and the section 2 components
     (TopBar, PhoneHeader nested, Button, Segmented .seg, Field .lbl/.in/.sel, Option row); no <style>, no inline style. Any ?state= renders the open form.
     Not wired: the board's fields do not map onto the /v2/feedback contract (ui/assess/feedback.js), and no board draws the signed-out or
     sample-tour (feedback not allowed) state; both itemised in RESULTS-explore.md.
     One .btn-primary per page: "Send" (desktop dialog actions; phone: the phone-bar). -->
<script module>
  /** The dialog's cancel (Escape) handler: keep the dialog open and go where Close and Cancel go. nav is injectable for tests. */
  export function cancelTo(url, nav = (u) => globalThis.location.assign(u)) {
    return (e) => { e.preventDefault(); nav(url); };
  }
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { E } from "./icons.js";
  import { href } from "../href.js";
  import { APP_VERSION } from "./explore-data.js";
  import data from "../../../fixtures/explore/feedback.json";

  let { phone = false, theme = "light" } = $props();
  const HOME = $derived(href("home", { w: phone ? "phone" : null }));
  const context = `${data.from.page} · ${data.from.review} · ${APP_VERSION}`;
  const modal = (el) => {
    if (typeof el.showModal === "function") { try { el.showModal(); return; } catch { /* not connected yet: fall through */ } }
    el.setAttribute("open", "");
  };
</script>

{#snippet x()}<Icon d={I.x} />{/snippet}
{#snippet arrow()}<Icon d={I.arrow} />{/snippet}
{#snippet mail()}<Icon d={E.mail} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Send app feedback" parent="Home" back={HOME} initials={data.user.initials} />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.workspace} home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Cancel" variant="quiet" href={HOME} /><Button label="Send" variant="primary" lg lead={mail} /></div>{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">App feedback</h1>
    <Card hi pad="hero" gap={3} label="App feedback">
      <div><label class="lbl" for="feedback-note">What happened, or what would help?</label><textarea class="in" id="feedback-note" rows="5" placeholder="Tell us in your own words"></textarea></div>
      <div><label class="lbl" for="feedback-about">What is it about?</label><label class="sel"><select class="in" id="feedback-about">{#each data.about as o, i}<option selected={i === 0}>{o}</option>{/each}</select><Icon d={I.chev} /></label></div>
      <label class="row-opt"><input class="cb" type="checkbox" checked /><span class="small">Include the screen name and app version</span></label>
    </Card>
  {:else}
    <dialog class="glass-hi" aria-labelledby="feedback-title" {@attach modal} oncancel={cancelTo(HOME)}>
      <div class="l-stack" data-gap="4">
        <Row split gap={3}><h1 class="h2 t-24" id="feedback-title">Send app feedback</h1><Button icon={x} ariaLabel="Close" variant="quiet" href={HOME} /></Row>
        <p class="small t-15">Tell us what happened and what would help. It reaches the team with the page you were on.</p>
        <div class="seg" role="radiogroup" aria-label="Kind of feedback">{#each data.kinds as k}<label><input type="radio" name="feedback-kind" value={k} checked={k === data.kind} />{k}</label>{/each}</div>
        <div><label class="lbl" for="feedback-what">What happened?</label><!-- svelte-ignore a11y_autofocus --><textarea class="in" id="feedback-what" placeholder="I tried to … and …" autofocus></textarea></div>
        <div role="group" aria-labelledby="feedback-feel-lbl"><span class="lbl" id="feedback-feel-lbl">How did it feel? <span class="opt">(optional)</span></span><div class="seg">{#each data.feels as f}<label><input type="radio" name="feedback-feel" value={f} checked={f === data.feel} />{f}</label>{/each}</div></div>
        <Row split wrap gap={2}><span class="small">{context}</span><Row gap={2}><Button label="Cancel" variant="quiet" href={HOME} /><Button label="Send" variant="primary" trail={arrow} /></Row></Row>
      </div>
    </dialog>
  {/if}
</AppShell>
