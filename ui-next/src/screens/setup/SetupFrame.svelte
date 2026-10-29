<!-- UI Next (v4) setup step frame (setup lane): the shared shell of Setup1-5 and their phone twins. Status: provisional (playbook rule 12).
     Desktop (Setup1-5.dc.html; gen.py setup_shell, design-system.md 8.5): AppShell + flow top bar (R12) > Page narrow (880, gap --sp-6) >
     setup stepper (ol.tabs.steps, R17) + one glass-hi step Card (h1, body, footer Row: quiet Back left, the page's one primary right).
     Phone (Setup1Phone, Setup2Phone, SetupPhone = step 3, Setup4Phone, Setup5Phone; boards_fphone.setup_step): AppShell phone + phone header
     in the setup step state (R13: Close · "Step n of 5", no avatar) > progress bar + "Draft saved" > hero Card > phone-bar (Back + primary).
     R13 note: the phone boards still draw the root header with the step line in the content (boards_fphone.py:108-112); the port follows R13.
     No <style>, no inline style: the setup rows are base.css (design-system.md 8.10 "Setup lane rows", PIN). Links: screens/href.js. -->
<script module>
  import { href } from "../href.js";
  // Step n's screen URL (setup1..setup5, registered in ./index.js), carrying the current ?w= and ?theme= (href.js);
  // phone pins &w=phone where the caller knows it renders the phone twin.
  export const stepHref = (n, phone = false) => href(`setup${n}`, phone ? { w: "phone" } : {});
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import FlowTop from "./FlowTop.svelte";
  import SetupBar from "./SetupBar.svelte";
  import Glyph from "./Glyph.svelte";
  import data from "../../../fixtures/setup/setup.json";

  // Live (app/Live.svelte): onnext runs the step's save and moves on (the primary is a button, never a link, so nothing moves before
  // the write answers); busy disables it while the write runs; error is the server's or the step's own message, shown inline
  // (R16) just above the footer; status is the top bar's draft line ("Draft saved" | "Saving…" | "" before the first save).
  let { phone = false, theme = "light", step, title, phoneTitle, next = {}, onnext, busy = false, error = "", status = "Draft saved", children } = $props();
  // The primary intercepts its click only when a live step owns it (Setup5.svelte's launching does the same for Launch).
  const going = (el) => { const f = (e) => { if (onnext && !busy && e.target instanceof Element && e.target.closest(".btn-primary")) { e.preventDefault(); onnext(); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
  if (!(Number.isInteger(step) && step >= 1 && step <= data.steps.length)) throw new TypeError(`SetupFrame: step must be 1..${data.steps.length}`);
  const label = $derived(next.label ?? "Continue");
  const nextHref = $derived(next.href ?? stepHref(step + 1, phone));
  const backHref = $derived(step > 1 ? stepHref(step - 1, phone) : undefined);
  const HOME = href("home");
</script>

{#snippet back()}<Glyph name="back" />{/snippet}
{#snippet arrow()}<Glyph name="arrow" />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="setup-step" {step} steps={data.steps.length} home={HOME} />{:else}<FlowTop flow={data.flow} {status} home={HOME} close={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<SetupBar {label} href={onnext ? undefined : nextHref} {backHref} play={!!next.play} blocked={next.blocked ?? ""} disabled={busy} />{/if}{/snippet}
{#snippet err()}{#if error}<p class="small field-error" id="step-err" role="alert"><Glyph name="warn" />{error}</p>{/if}{/snippet}

<div {@attach going}><AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <div class="l-stack" data-gap="2">
      <Row split gap={3}><span class="micro">{data.flow}</span><span class="micro" role="status">{status}</span></Row>
      <div class="bar" data-step={step} role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax={data.steps.length} aria-valuenow={step} aria-valuetext={`Step ${step} of ${data.steps.length}`}><span></span></div>
    </div>
    <section class="glass-hi l-card l-stack su-form enter" data-pad="hero" data-gap="4" aria-labelledby="step-title">
      <h1 class="title-phone" id="step-title">{phoneTitle ?? title}</h1>
      {@render children?.()}
      {@render err()}
    </section>
  {:else}
    <Page width="narrow" gap={6}>
      <ol class="glass tabs steps" aria-label="Setup steps">
        {#each data.steps as name, i}
          <li>
            {#if i + 1 < step}<a class="tab" href={stepHref(i + 1)}><span class="dot done"><Glyph name="check" size={14} /></span>{name}</a>
            {:else if i + 1 === step}<span class="tab" aria-current="step"><span class="dot">{i + 1}</span>{name}</span>
            {:else}<span class="tab" aria-disabled="true"><span class="dot">{i + 1}</span>{name}</span>{/if}
          </li>
        {/each}
      </ol>
      <section class="glass-hi l-card l-stack enter" data-pad="setup" data-gap="6" aria-labelledby="step-title">
        <h1 class="h1" id="step-title">{title}</h1>
        {@render children?.()}
        {@render err()}
        <Row split gap={3}>
          {#if backHref}<Button label="Back" variant="quiet" href={backHref} lead={back} />{:else}<span></span>{/if}
          {#if next.blocked}
            <!-- R16 V-41: a blocked primary says why beside it: the reason is the text just before it in reading order, and the shared
                 Button (registry f3c4238) ties it to the disabled Continue with aria-describedby="cont-why" (setup N7). -->
            <Row gap={3}><span class="small" id="cont-why">{next.blocked}</span><Button {label} variant="primary" lg disabled ariaDescribedby="cont-why" trail={arrow} /></Row>
          {:else if onnext}<Button label={busy ? "Saving…" : label} variant="primary" lg disabled={busy} ariaDescribedby={error ? "step-err" : undefined} trail={arrow} />
          {:else}<Button {label} variant="primary" lg href={nextHref} trail={arrow} />{/if}
        </Row>
      </section>
    </Page>
  {/if}
</AppShell></div>
