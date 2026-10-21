<!-- UI Next (v4) actions-lane copy control for a survey link (Share, SharePhone, the collect rows on Print and Sandbox): a button, never a
     link, that writes the link text to the clipboard where the browser allows it (./copy.js) and then reads "Copied" (the boards' Share
     state; copied=true draws a row already copied). icon: the boards' icon-only quiet form ("Copy link for X"); else the labelled form
     ("Copy"). The markup is the shared ../../Button.svelte's (button.btn[.btn-quiet.btn-icon], decorative glyph); the shared Button does
     not take an onclick yet (handed back in RESULTS-actions). The link is fixture data until links are issued (RESULTS debt 1). Status: provisional. -->
<script>
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { copyText } from "./copy.js";
  let { text, name, icon = false, copied = false } = $props();
  if (!(typeof text === "string" && text.trim())) throw new TypeError("CopyButton: text is the link to copy");
  if (!(typeof name === "string" && name.trim())) throw new TypeError("CopyButton: name says whose link it is");
  let done = $state(false);
  let failed = $state(false);
  const shown = $derived(copied || done);
  const go = async () => { const ok = await copyText(text); done = ok; failed = !ok; };
</script>

{#if icon}
  <button class="btn btn-quiet btn-icon" type="button" aria-label={shown ? `Link copied for ${name}` : `Copy link for ${name}`} title={failed ? "Copy is not available here: select the link" : undefined} onclick={go}><Ico d={shown ? A.check : A.copy} /></button>
{:else}
  <button class="btn" type="button" aria-label={shown ? `Link copied for ${name}` : `Copy link for ${name}`} title={failed ? "Copy is not available here: select the link" : undefined} onclick={go}>{#if shown}Copied<Ico d={A.check} />{:else}<Ico d={A.copy} />Copy{/if}</button>
{/if}
