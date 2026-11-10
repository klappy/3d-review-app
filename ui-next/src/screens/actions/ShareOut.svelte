<!-- UI Next (v4) actions-lane share-out control (SharePhone's per-survey share icon, "Share link for X"): an icon-only quiet button that
     hands the row's link to the phone's share sheet (navigator.share) or, where there is none, copies it (./copy.js shareText), then
     reads "Link copied for X" with a check. The markup is the shared ../../Button.svelte's icon-only quiet button plus an onclick, which
     the shared Button does not take yet (handed back in RESULTS-actions). The link is fixture data until links are issued (RESULTS
     debt 1). When neither is available, the icon turns to the warning glyph, the control is named "Sharing failed: select the link
     for X", and a polite status line (.sr-only, role=status, present from the start) announces the result, again when the same result
     repeats (cleared, then set; VALIDATION-actions-r4.md R4-3). Status: provisional. -->
<script>
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { shareText } from "./copy.js";
  import { tick } from "svelte";
  let { text, name, title = "Survey link" } = $props();
  if (!(typeof text === "string" && text.trim())) throw new TypeError("ShareOut: text is the link to share");
  if (!(typeof name === "string" && name.trim())) throw new TypeError("ShareOut: name says whose link it is");
  let result = $state();
  const copied = $derived(result === "copied");
  const failed = $derived(result === false);
  const aria = $derived(failed ? `Sharing failed: select the link for ${name}` : copied ? `Link copied for ${name}` : `Share link for ${name}`);
  const SAID = { shared: "Link shared.", copied: "Link copied.", cancelled: "" };
  let said = $state("");
  const go = async () => {
    const r = await shareText(text, `${title}: ${name}`);
    result = r;
    said = "";
    await tick();
    said = r === false ? `Sharing failed: select the link for ${name}.` : SAID[r];
  };
</script>

<button class="btn btn-quiet btn-icon" type="button" aria-label={aria} title={failed ? aria : undefined} onclick={go}><Ico d={failed ? A.warn : copied ? A.check : A.out} /></button>
<span class="sr-only" role="status">{said}</span>
