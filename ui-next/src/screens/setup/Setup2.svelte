<!-- UI Next (v4) Setup step 2 "The passage". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (passage).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup2.dc.html (desktop: the passage left unnamed, so the field shows its
     error and Continue is disabled with its reason beside it, R16), Setup2Phone.dc.html (phone, w=phone).
     Wiring: the file input accepts ui/assess/passages.js PASSAGE_ACCEPT (the formats the current passages panel uploads).
     One .btn-primary: Continue (disabled on desktop through the shared Button, R16 V-41: reason said beside it; phone-bar on phone).
     "Choose file" is a .btn button that opens one hidden file input, so Tab lands on a visible control with the helmet's
     .app button:focus-visible ring (a label.btn around an .sr-only input showed no ring, VALIDATION-setup F4).
     Preview is the shared Button on both widths (the phone board draws a.link href="#", which goes nowhere: VALIDATION-setup-r2 N5);
     still a mock, wiring debt 3. -->
<script>
  import Stack from "../../Stack.svelte";
  import Button from "../../Button.svelte";
  import SetupFrame from "./SetupFrame.svelte";
  import Field from "./Field.svelte";
  import Glyph from "./Glyph.svelte";
  import { PASSAGE_ACCEPT } from "../../../../ui/assess/passages.js";
  import data from "../../../fixtures/setup/setup.json";

  // The board draws one state; the route's ?state= prop is not read, so any value (unknown included) renders it and never throws.
  let { phone = false, theme = "light" } = $props();
  const p = data.passage;
  const blocked = p.name.trim() ? undefined : "Name what people will respond to first.";
  let fileInput = $state();
</script>

{#snippet link()}<Glyph name="link" />{/snippet}
{#snippet eye()}<Glyph name="eye" />{/snippet}
{#snippet x()}<Glyph name="x" />{/snippet}
{#snippet plus()}<Glyph name="plus" />{/snippet}
{#snippet choose(label, block)}<button class={block ? "btn btn-block" : "btn"} type="button" onclick={() => fileInput?.click()}>{#if block}<Glyph name="upload" />{/if}{label}</button>{/snippet}

<SetupFrame {phone} {theme} step={2} title="What will people respond to?" phoneTitle="The passage" next={phone ? {} : { blocked }}>
  <input type="file" accept={PASSAGE_ACCEPT} hidden bind:this={fileInput} />
  {#if phone}
    <p class="small">What participants will read, hear or watch.</p>
    <div class="dz su-col">{@render choose("Choose a file", true)}<Button label="Paste a link" lead={link} block /></div>
    <div class="l-row small" data-gap="2"><Glyph name="file" size={16} />{p.phoneFile.name} · {p.phoneFile.size} <Button label="Preview" variant="quiet" lead={eye} /></div>
    <Field label="Survey languages" id="sl" group help="Participants pick their language on the first screen.">
      <div class="l-row" data-wrap data-gap="2">{#each p.languages as [, short]}<span class="chip">{short} <button type="button" aria-label={`Remove ${short}`}><Glyph name="x" size={14} /></button></span>{/each}<Button label="Add" lead={plus} /></div>
    </Field>
  {:else}
    <Stack gap={5}>
      <p class="small t-15">Participants read, hear or watch this before they answer. You can attach it here, or just name it and play it for the group yourself.</p>
      <Field label="What will people respond to?" id="pass" help="Participants see this on their first screen." error={blocked ? "Name the passage, for example “Mark 1–4, printed draft booklet”, to continue." : undefined}>
        <input class="in" id="pass" value={p.name} required aria-describedby={blocked ? "pass-help pass-err" : "pass-help"} aria-invalid={blocked ? "true" : undefined} />
      </Field>
      <Stack gap={3}>
        <span class="lbl">Attach the passage <span class="opt">(optional)</span></span>
        <div class="dz">
          <span class="icn icn-lens" data-lens="team" aria-hidden="true"><Glyph name="upload" /></span>
          <div class="l-stack" data-gap="1" data-grow><div class="h3">Drop a file or choose one</div><p class="small">Scripture as USFM, SFM or USX — we typeset it into a readable PDF. Or a PDF, an MP3, or a link to a video (for example a sign-language recording).</p></div>
          {@render choose("Choose file", false)}
          <Button label="Paste a link" lead={link} />
        </div>
        <div class="solid su-tile l-row" data-gap="4">
          <span class="icn icn-lens" data-lens="team" aria-hidden="true"><Glyph name="file" /></span>
          <div class="l-stack" data-gap="1" data-grow><div class="h3">{p.file.name} <span class="micro">{p.file.note}</span></div><p class="small">{p.file.shows}</p></div>
          <Button label="Preview" lead={eye} />
          <Button icon={x} ariaLabel="Remove file" variant="quiet" />
        </div>
      </Stack>
      <Stack gap={3}>
        <span class="lbl">Languages people can answer in</span>
        <p class="small">The survey is shown in these languages. Participants pick one on their phone; printed surveys can be printed in any of them.</p>
        <div class="l-row" data-wrap data-gap="2">{#each p.languages as [name, short]}<span class="chip">{name} <button type="button" aria-label={`Remove ${short}`}><Glyph name="x" size={12} /></button></span>{/each}</div>
        <span class="su-search"><Glyph name="search" /><input class="in" aria-label="Add a language" placeholder="Add a language…" /></span>
        <p class="small">{p.signNote}</p>
      </Stack>
    </Stack>
  {/if}
</SetupFrame>
