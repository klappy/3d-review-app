<!-- UI Next (v4) actions-lane copy control for a link (Share, SharePhone, the collect rows on Print and Sandbox, ActionPlan's share
     link): a button, never a link, that writes the link text to the clipboard where the browser allows it (./copy.js) and then reads
     "Copied" (the boards' Share state; copied=true draws a row already copied). Three forms: icon (the boards' icon-only quiet form,
     named "Copy link for X"); the default labelled "Copy" (named "Copy link for X", which contains the visible word); label + lead (a
     board's own wording, e.g. ActionPlan "Copy share link" / "Copy link": the visible label is the name). The markup is the shared
     ../../Button.svelte's (button.btn[.btn-quiet.btn-icon][.btn-block], decorative glyph); the shared Button does not take an onclick yet
     (handed back in RESULTS-actions). The link is fixture data until links are issued (RESULTS debt 1). When the browser refuses the
     copy, the control says so where it can be seen (the label reads "Select the link to copy"; the icon form draws the warning glyph
     and is named "Copy failed: select the link for X"), and a polite status line (.sr-only, role=status, present from the start)
     announces the result, copied or not. Status: provisional. -->
<script>
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { copyText } from "./copy.js";
  let { text, name, icon = false, copied = false, label, lead = "copy", block = false } = $props();
  if (!(typeof text === "string" && text.trim())) throw new TypeError("CopyButton: text is the link to copy");
  if (label !== undefined && !(typeof label === "string" && label.trim())) throw new TypeError("CopyButton: label is the visible wording");
  if (label !== undefined && icon) throw new TypeError("CopyButton: an icon-only control takes no label");
  if (label === undefined && !(typeof name === "string" && name.trim())) throw new TypeError("CopyButton: name says whose link it is");
  if (!Object.hasOwn(A, lead)) throw new TypeError(`CopyButton: unknown lead icon "${lead}"`);
  const FAIL = "Select the link to copy";
  let done = $state(false);
  let failed = $state(false);
  const shown = $derived(!failed && (copied || done));
  const whose = $derived(typeof name === "string" && name.trim() ? ` for ${name}` : "");
  // The accessible name: the visible label when there is one (label form, and every failed labelled form reads FAIL itself),
  // else whose link it is and what happened.
  const aria = $derived(
    icon ? (failed ? `Copy failed: select the link${whose}` : shown ? `Link copied${whose}` : `Copy link${whose}`)
    : label !== undefined ? undefined
    : failed ? `${FAIL}${whose}` : shown ? `Link copied${whose}` : `Copy link${whose}`,
  );
  let said = $state("");
  const go = async () => {
    const ok = await copyText(text);
    done = ok;
    failed = !ok;
    said = ok ? `Link copied${whose}.` : `Copy failed${whose}: select the link to copy it.`;
  };
</script>

{#if icon}
  <button class="btn btn-quiet btn-icon" type="button" aria-label={aria} title={failed ? aria : undefined} onclick={go}><Ico d={failed ? A.warn : shown ? A.check : A.copy} /></button>
{:else}
  <button class={block ? "btn btn-block" : "btn"} type="button" aria-label={aria} onclick={go}>{#if failed}<Ico d={A.warn} />{FAIL}{:else if shown}Copied<Ico d={A.check} />{:else}<Ico d={A[lead]} />{label ?? "Copy"}{/if}</button>
{/if}
<span class="sr-only" role="status">{said}</span>
