<!-- UI Next (v4) Language search (setup lane). Status: provisional (playbook rule 12).
     Contract: design-system.md section 2 "Language search" row (lang_picker()): search by name or code, the chosen language as a removable
     .chip, a [role=status] match line, up to 6 .row-opt result buttons "name · code", quiet "Add language…". Board: Setup1 / Setup1Phone.
     Wiring debt: the current UI's picker (ui/v3/language-picker.js) renders HTML strings bound to the DOM; this draws the fixture state. -->
<script>
  import Glyph from "./Glyph.svelte";
  import Button from "../../Button.svelte";
  let { id, query = "", language, matches = [], describedby } = $props();
  const shown = $derived(matches.slice(0, 6));
  const status = $derived(matches.length === 0 ? "No matching languages." : matches.length > 6 ? `${matches.length} matches; showing first 6. Refine your search.` : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`);
</script>

{#snippet plus()}<Glyph name="plus" />{/snippet}

<div class="l-stack" data-gap="2">
  <span class="su-search"><Glyph name="search" /><input class="in" type="search" {id} value={query} placeholder="Search by name or code" autocomplete="off" aria-describedby={describedby} /></span>
  {#if language}<div class="l-row" data-wrap data-gap="2" role="group" aria-label="Selected language"><span class="chip">{language.name} · {language.code} <button type="button" aria-label={`Remove ${language.name} · ${language.code}`}><Glyph name="x" size={12} /></button></span></div>{/if}
  <p class="small" role="status">{status}</p>
  {#if shown.length}<div class="l-stack" data-gap="2">{#each shown as m}<button type="button" class="row-opt su-match"><span>{m.name} · {m.code}</span></button>{/each}</div>{/if}
  <div class="l-row"><Button label="Add language…" variant="quiet" lead={plus} /></div>
</div>
