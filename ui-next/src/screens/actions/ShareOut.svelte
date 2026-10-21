<!-- UI Next (v4) actions-lane share-out control (SharePhone's per-survey share icon, "Share link for X"): an icon-only quiet button that
     hands the row's link to the phone's share sheet (navigator.share) or, where there is none, copies it (./copy.js shareText), then
     reads "Link copied for X" with a check. The markup is the shared ../../Button.svelte's icon-only quiet button plus an onclick, which
     the shared Button does not take yet (handed back in RESULTS-actions). The link is fixture data until links are issued (RESULTS
     debt 1). Status: provisional. -->
<script>
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  import { shareText } from "./copy.js";
  let { text, name, title = "Survey link" } = $props();
  if (!(typeof text === "string" && text.trim())) throw new TypeError("ShareOut: text is the link to share");
  if (!(typeof name === "string" && name.trim())) throw new TypeError("ShareOut: name says whose link it is");
  let result = $state();
  const copied = $derived(result === "copied");
  const go = async () => { result = await shareText(text, `${title}: ${name}`); };
</script>

<button class="btn btn-quiet btn-icon" type="button" aria-label={copied ? `Link copied for ${name}` : `Share link for ${name}`} title={result === false ? "Sharing is not available here: select the link" : undefined} onclick={go}><Ico d={copied ? A.check : A.out} /></button>
