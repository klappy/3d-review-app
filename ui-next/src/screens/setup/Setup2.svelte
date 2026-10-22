<!-- UI Next (v4) Setup step 2 "The passage". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (passage).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup2.dc.html (desktop: the passage left unnamed, so the field shows its
     error and Continue is disabled with its reason beside it, R16), Setup2Phone.dc.html (phone, w=phone).
     Wiring: the file input accepts ui/assess/passages.js PASSAGE_ACCEPT (the formats the current passages panel uploads).
     One .btn-primary: Continue (disabled on desktop through the shared Button, R16 V-41: reason said beside it; phone-bar on phone).
     "Choose file" is a .btn button that opens one hidden file input, so Tab lands on a visible control with the helmet's
     .app button:focus-visible ring (a label.btn around an .sr-only input showed no ring, VALIDATION-setup F4).
     Preview is the shared Button on both widths (the phone board draws a.link href="#", which goes nowhere: VALIDATION-setup-r2 N5).
     Live (app/setup.js passageView): data.name is the review's purpose (what people respond to), data.files its passages (files and
     links, one tile each; Preview opens the signed href, Remove deletes), data.languages the answer languages (lwc) as chips; onfield,
     onfile(file), onlink(), onremove(id), onlwc(action, code) edit; onnext patches purpose and lwc. -->
<script>
  import Stack from "../../Stack.svelte";
  import Button from "../../Button.svelte";
  import SetupFrame from "./SetupFrame.svelte";
  import Field from "./Field.svelte";
  import Glyph from "./Glyph.svelte";
  import { PASSAGE_ACCEPT } from "../../../../ui/assess/passages.js";
  import fixture from "../../../fixtures/setup/setup.json";

  // The board draws one state; the route's ?state= prop is not read, so any value (unknown included) renders it and never throws.
  let { phone = false, theme = "light", data = fixture.passage, onfield, onfile, onlink, onremove, onlwc, onnext, busy = false, error = "", status = "Draft saved" } = $props();
  const p = $derived(data);
  // Sample / gallery (no onfield): what the visitor types is kept on this screen only, so Continue enables as it would live; nothing is
  // saved anywhere (captain 2026-10-22: the sample must be clickable 1 → 5 → Launch). Live: the draft (app/setup.js) is the one source.
  let typed = $state(null);
  const name = $derived(onfield ? p.name : typed ?? p.name);
  const blocked = $derived(name.trim() ? undefined : "Name what people will respond to first.");
  const edit = (e) => (onfield ? onfield("purpose", e.currentTarget.value) : (typed = e.currentTarget.value));
  // The fixture draws one attachment (file / phoneFile); the live model lists every passage the review holds.
  const FILES = $derived(p.files ?? (phone ? [{ id: null, name: p.phoneFile.name, size: p.phoneFile.size, note: "", shows: "", href: "" }] : [{ id: null, name: p.file.name, note: p.file.note, shows: p.file.shows, size: "", href: "" }]));
  const LIVE = $derived(!!onnext);
  let fileInput = $state();
  const chosen = (e) => { const f = e.currentTarget.files?.[0]; if (f && onfile) onfile(f); e.currentTarget.value = ""; };
  // A tile's Preview opens the passage in its own tab; its Remove deletes the passage (shared Button has no onclick: delegate).
  const tile = (f) => (el) => { const h = (e) => { const b = e.target instanceof Element ? e.target.closest(".btn") : null; if (!b) return; if (b.getAttribute("aria-label") === "Remove file") { if (f.id) onremove?.(f.id); } else if (f.href) globalThis.open(f.href, "_blank", "noopener"); }; el.addEventListener("click", h); return () => el.removeEventListener("click", h); };
  const addLwc = (e) => { const v = e.currentTarget.value; if (v.trim()) onlwc?.("add", v); e.currentTarget.value = ""; };
  const linking = (el) => { const h = (e) => { const b = e.target instanceof Element ? e.target.closest(".btn") : null; if (b && b.textContent?.includes("Paste a link")) onlink?.(); }; el.addEventListener("click", h); return () => el.removeEventListener("click", h); };
</script>

{#snippet link()}<Glyph name="link" />{/snippet}
{#snippet eye()}<Glyph name="eye" />{/snippet}
{#snippet x()}<Glyph name="x" />{/snippet}
{#snippet plus()}<Glyph name="plus" />{/snippet}
{#snippet choose(label, block)}<button class={block ? "btn btn-block" : "btn"} type="button" onclick={() => fileInput?.click()}>{#if block}<Glyph name="upload" />{/if}{label}</button>{/snippet}

<SetupFrame {phone} {theme} step={2} title="What will people respond to?" phoneTitle="The passage" next={phone ? {} : { blocked }} {onnext} {busy} {error} {status}>
  <input type="file" accept={PASSAGE_ACCEPT} hidden bind:this={fileInput} onchange={chosen} />
  {#if phone}
    <p class="small">What participants will read, hear or watch.</p>
    {#if LIVE}<Field label="What will people respond to?" id="pass-p"><input class="in" id="pass-p" value={name} required oninput={edit} /></Field>{/if}
    <div class="dz su-col" {@attach linking}>{@render choose("Choose a file", true)}<Button label="Paste a link" lead={link} block /></div>
    {#each FILES as f (f.id ?? f.name)}<div class="l-row small" data-gap="2" {@attach tile(f)}><Glyph name="file" size={16} />{f.name} · {f.size || f.note} <Button label="Preview" variant="quiet" />{#if LIVE && f.id}<Button icon={x} ariaLabel="Remove file" variant="quiet" />{/if}</div>{/each}
    <Field label="Survey languages" id="sl" group help="Participants pick their language on the first screen.">
      <div class="l-row" data-wrap data-gap="2">{#each p.languages as [, short, code]}<span class="chip">{short} {#if !(LIVE && !code)}<button type="button" aria-label={`Remove ${short}`} onclick={() => onlwc?.("remove", code)}><Glyph name="x" size={14} /></button>{/if}</span>{/each}{#if LIVE}<span class="su-search"><Glyph name="search" /><input class="in" aria-label="Add a language" placeholder="Add a language…" onchange={addLwc} /></span>{:else}<Button label="Add" lead={plus} />{/if}</div>
    </Field>
  {:else}
    <Stack gap={5}>
      <p class="small t-15">Participants read, hear or watch this before they answer. You can attach it here, or just name it and play it for the group yourself.</p>
      <Field label="What will people respond to?" id="pass" help="Participants see this on their first screen." error={blocked ? "Name the passage, for example “Mark 1–4, printed draft booklet”, to continue." : undefined}>
        <input class="in" id="pass" value={name} required aria-describedby={blocked ? "pass-help pass-err" : "pass-help"} aria-invalid={blocked ? "true" : undefined} oninput={edit} />
      </Field>
      <Stack gap={3}>
        <span class="lbl">Attach the passage <span class="opt">(optional)</span></span>
        <div class="dz" {@attach linking}>
          <span class="icn icn-lens" data-lens="team" aria-hidden="true"><Glyph name="upload" /></span>
          <div class="l-stack" data-gap="1" data-grow><div class="h3">Drop a file or choose one</div><p class="small">{p.fileStorage === false ? "File uploads are not set up on this site yet. Paste a link instead." : "Scripture as USFM, SFM or USX — we typeset it into a readable PDF. Or a PDF, an MP3, or a link to a video (for example a sign-language recording)."}</p></div>
          {@render choose("Choose file", false)}
          <Button label="Paste a link" lead={link} />
        </div>
        {#each FILES as f (f.id ?? f.name)}
          <div class="solid su-tile l-row" data-gap="4" {@attach tile(f)}>
            <span class="icn icn-lens" data-lens="team" aria-hidden="true"><Glyph name="file" /></span>
            <div class="l-stack" data-gap="1" data-grow><div class="h3">{f.name} <span class="micro">{f.note}</span></div><p class="small">{f.shows}</p></div>
            <Button label="Preview" lead={eye} />
            <Button icon={x} ariaLabel="Remove file" variant="quiet" />
          </div>
        {/each}
      </Stack>
      <Stack gap={3}>
        <span class="lbl">Languages people can answer in</span>
        <p class="small">The survey is shown in these languages. Participants pick one on their phone; printed surveys can be printed in any of them.</p>
        <div class="l-row" data-wrap data-gap="2">{#each p.languages as [name, short, code]}<span class="chip">{name} {#if !(LIVE && !code)}<button type="button" aria-label={`Remove ${short}`} onclick={() => onlwc?.("remove", code)}><Glyph name="x" size={12} /></button>{/if}</span>{/each}</div>
        <span class="su-search"><Glyph name="search" /><input class="in" aria-label="Add a language" placeholder="Add a language…" onchange={addLwc} /></span>
        {#if p.signNote}<p class="small">{p.signNote}</p>{/if}
      </Stack>
    </Stack>
  {/if}
</SetupFrame>
