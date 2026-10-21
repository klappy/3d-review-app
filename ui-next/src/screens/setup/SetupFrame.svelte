<!-- UI Next (v4) setup step frame (setup lane): the shared shell of Setup1-5 and their phone twins. Status: provisional (playbook rule 12).
     Desktop (Setup1-5.dc.html; gen.py setup_shell, design-system.md 8.5): AppShell + flow top bar (R12) > Page narrow (880, gap --sp-6) >
     setup stepper (ol.tabs.steps, R17) + one glass-hi step Card (h1, body, footer Row: quiet Back left, the page's one primary right).
     Phone (Setup1Phone, Setup2Phone, SetupPhone = step 3, Setup4Phone, Setup5Phone; boards_fphone.setup_step): AppShell phone + phone header
     in the setup step state (R13: Close · "Step n of 5", no avatar) > progress bar + "Draft saved" > hero Card > phone-bar (Back + primary).
     R13 note: the phone boards still draw the root header with the step line in the content (boards_fphone.py:108-112); the port follows R13.
     No <style>, no inline style: lane classes in ./setup.css. -->
<script module>
  // Step n's screen URL (registered in ./index.js); the phone twin keeps &w=phone.
  export const stepHref = (n, phone = false) => `?screen=setup${n}${phone ? "&w=phone" : ""}`;
</script>
<script>
  import "./setup.css";
  import AppShell from "../../AppShell.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import FlowTop from "./FlowTop.svelte";
  import SetupBar from "./SetupBar.svelte";
  import Glyph from "./Glyph.svelte";
  import data from "../../../fixtures/setup/setup.json";

  let { phone = false, theme = "light", step, title, phoneTitle, next = {}, children } = $props();
  if (!(Number.isInteger(step) && step >= 1 && step <= data.steps.length)) throw new TypeError(`SetupFrame: step must be 1..${data.steps.length}`);
  const label = $derived(next.label ?? "Continue");
  const href = $derived(next.href ?? stepHref(step + 1, phone));
  const backHref = $derived(step > 1 ? stepHref(step - 1, phone) : undefined);
  const HOME = "?screen=home";
</script>

{#snippet back()}<Glyph name="back" />{/snippet}
{#snippet arrow()}<Glyph name="arrow" />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="setup-step" {step} steps={data.steps.length} home={HOME} />{:else}<FlowTop flow={data.flow} home={HOME} close={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<SetupBar {label} {href} {backHref} play={!!next.play} />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <div class="l-stack" data-gap="2">
      <Row split gap={3}><span class="micro">{data.flow}</span><span class="micro" role="status">Draft saved</span></Row>
      <div class="bar" data-step={step} role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax={data.steps.length} aria-valuenow={step} aria-valuetext={`Step ${step} of ${data.steps.length}`}><span></span></div>
    </div>
    <section class="glass-hi l-card l-stack su-form enter" data-pad="hero" data-gap="4" aria-labelledby="step-title">
      <h1 class="title-phone" id="step-title">{phoneTitle ?? title}</h1>
      {@render children?.()}
    </section>
  {:else}
    <div class="l-page su-page" data-w="narrow" data-gap="6">
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
        <Row split gap={3}>
          {#if backHref}<Button label="Back" variant="quiet" href={backHref} lead={back} />{:else}<span></span>{/if}
          {#if next.blocked}
            <Row gap={3}><span class="small" id="cont-why">{next.blocked}</span><button class="btn btn-primary btn-lg" type="button" disabled aria-describedby="cont-why">{label}<Glyph name="arrow" /></button></Row>
          {:else}<Button {label} variant="primary" lg {href} trail={arrow} />{/if}
        </Row>
      </section>
    </div>
  {/if}
</AppShell>
