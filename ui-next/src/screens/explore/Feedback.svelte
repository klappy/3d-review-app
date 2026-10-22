<!-- UI Next (v4) Feedback screen ("Send app feedback"). Status: provisional (playbook rule 12). Explore lane of the screens fanout.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Feedback.dc.html (desktop: a dialog over the page the user was on),
     FeedbackPhone.dc.html (phone: a full page, design-system.md "Dialog and sheet states" phone map). Mock data: ui-next/fixtures/explore/feedback.json.
     Desktop is a native <dialog class="glass-hi"> opened with showModal() (top layer, inert page, ::backdrop; geometry and backdrop from the
     dialog.glass-hi rows); focus on the first field (autofocus, contract "Focus on open"). Close, Cancel and Escape all go Home: the dialog's
     cancel event is prevented and routed like Close, so Escape never leaves an empty page under the TopBar. The route's one h1 is the dialog
     title (the page under a desktop dialog draws nothing else), styled by the board's .h2.t-24 row.
     The page line names the page and review the dialog came from, with no version string (design-lens@1 rule 5: a version string
     on screen is a NO): the server stamps every submission with the version and the build stamp (src/handlers/feedback-provenance.ts).
     The board's version literal is handed back to the canvas (RESULTS-explore.md). Composed of AppShell > Card > Stack / Row and the section 2 components
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
  import { modal } from "./dialog.js";
  import data0 from "../../../fixtures/explore/feedback.json";

  // Live (ui-next/src/app/Live.svelte): user/workspace from the session, from = { page, review } the screen the visitor came from,
  // allowed = a signed-in, non-anonymous account (ui/assess/feedback.js load: the sample tour and the signed-out never send), and
  // onsend(body) posts the existing contract (POST /v2/feedback, the current UI's body fields plus require_authenticated) and resolves
  // to the receipt { feedback_id } or throws with the words to show. The board's kind / feel / about choices ride in the note and in
  // sentiment_journey (128 code units), the fields the contract has; nothing from the page is attached automatically.
  let { phone = false, theme = "light", user = data0.user, workspace = data0.workspace, from = data0.from, allowed = true, onsend } = $props();
  const data = data0;
  const HOME = $derived(href("home", { w: phone ? "phone" : null }));
  const context = $derived(from ? [from.page, from.review].filter(Boolean).join(" · ") : "");
  let note = $state(""), kind = $state(data0.kind), feel = $state(data0.feel), about = $state(data0.about[0]), withPage = $state(true);
  let sending = $state(false), sent = $state(""), error = $state("");
  const SIGN_IN = "Sign in to share feedback about using 3D Review. The sample tour does not send feedback.";
  function body() {
    const text = note.trim();
    const lead = phone ? [about, withPage && context ? `from ${context}` : ""] : [kind, context ? `from ${context}` : ""];
    return { note: [lead.filter(Boolean).join(" · "), text].filter(Boolean).join("\n\n"), ...(phone ? {} : { sentiment_journey: feel }), require_authenticated: true };
  }
  async function send() {
    if (!onsend || sending || sent) return;
    error = "";
    if (!note.trim()) { error = "Add a note before sending."; return; }
    if (new TextEncoder().encode(note).length > 4000) { error = "Your note is too long. Shorten it and send again."; return; }
    sending = true;
    try { const r = await onsend(body()); sent = r?.feedback_id ?? "sent"; }
    catch (e) { error = e?.message || "We could not confirm whether your feedback was recorded. Your text is still here."; }
    finally { sending = false; }
  }
  const sendLabel = $derived(sent ? "Feedback sent" : sending ? "Sending…" : "Send");
</script>

{#snippet x()}<Icon d={I.x} />{/snippet}
{#snippet arrow()}<Icon d={I.arrow} />{/snippet}
{#snippet mail()}<Icon d={E.mail} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Send app feedback" parent="Home" back={HOME} initials={user.initials} />{:else}<TopBar who={user.first} initials={user.initials} workspace={workspace} home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Cancel" variant="quiet" href={HOME} />{#if onsend}<button class="btn btn-primary btn-lg" type="button" disabled={!allowed || sending || !!sent} onclick={send}><Icon d={E.mail} />{sendLabel}</button>{:else}<Button label="Send" variant="primary" lg lead={mail} />{/if}</div>{/if}{/snippet}
{#snippet status()}{#if !allowed}<p class="small" role="status">{SIGN_IN} <a class="link" href={href("sign-in", { w: phone ? "phone" : null })}>Sign in</a></p>{:else if sent}<p class="small" role="status">Thank you. Your feedback was recorded. Feedback reference: {sent}</p>{:else if error}<p class="small" role="status">{error}</p>{:else if sending}<p class="small" role="status">Sending feedback…</p>{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">App feedback</h1>
    <Card hi pad="hero" gap={3} label="App feedback">
      <div><label class="lbl" for="feedback-note">What happened, or what would help?</label><textarea class="in" id="feedback-note" rows="5" placeholder="Tell us in your own words" bind:value={note} disabled={!allowed || !!sent}></textarea></div>
      <div><label class="lbl" for="feedback-about">What is it about?</label><label class="sel"><select class="in" id="feedback-about" bind:value={about}>{#each data.about as o}<option value={o}>{o}</option>{/each}</select><Icon d={I.chev} /></label></div>
      <label class="row-opt"><input class="cb" type="checkbox" bind:checked={withPage} /><span class="small">Include the screen name</span></label>
      {@render status()}
    </Card>
  {:else}
    <dialog class="glass-hi" aria-labelledby="feedback-title" {@attach modal} oncancel={cancelTo(HOME)}>
      <div class="l-stack" data-gap="4">
        <Row split gap={3}><h1 class="h2 t-24" id="feedback-title">Send app feedback</h1><Button icon={x} ariaLabel="Close" variant="quiet" href={HOME} /></Row>
        <p class="small t-15">Tell us what happened and what would help. It reaches the team with the page you were on.</p>
        <div class="seg" role="radiogroup" aria-label="Kind of feedback">{#each data.kinds as k}<label><input type="radio" name="feedback-kind" value={k} bind:group={kind} />{k}</label>{/each}</div>
        <div><label class="lbl" for="feedback-what">What happened?</label><!-- svelte-ignore a11y_autofocus --><textarea class="in" id="feedback-what" placeholder="I tried to … and …" autofocus bind:value={note} disabled={!allowed || !!sent}></textarea></div>
        <div role="group" aria-labelledby="feedback-feel-lbl"><span class="lbl" id="feedback-feel-lbl">How did it feel? <span class="opt">(optional)</span></span><div class="seg">{#each data.feels as f}<label><input type="radio" name="feedback-feel" value={f} bind:group={feel} />{f}</label>{/each}</div></div>
        {@render status()}
        <Row split wrap gap={2}><span class="small">{context}</span><Row gap={2}><Button label="Cancel" variant="quiet" href={HOME} />{#if onsend}<button class="btn btn-primary" type="button" disabled={!allowed || sending || !!sent} onclick={send}>{sendLabel}<Icon d={I.arrow} /></button>{:else}<Button label="Send" variant="primary" trail={arrow} />{/if}</Row></Row>
      </div>
    </dialog>
  {/if}
</AppShell>
