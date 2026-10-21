<!-- UI Next (v4) actions-lane labelled button that does something on the page (ActionPlan's "Print"): the markup the shared
     ../../Button.svelte draws for a labelled secondary/quiet button with a lead glyph (button.btn[.btn-quiet], type=button, decorative
     glyph), plus an onclick, which the shared Button does not take yet (handed back in RESULTS-actions). Status: provisional. -->
<script>
  import Ico from "./Ico.svelte";
  import { A } from "./icons.js";
  let { label, lead, variant = "secondary", onclick } = $props();
  const CLS = { secondary: "btn", quiet: "btn btn-quiet" };
  if (!Object.hasOwn(CLS, variant)) throw new TypeError(`ActButton: unknown variant "${variant}"`);
  if (!(typeof label === "string" && label.trim())) throw new TypeError("ActButton: a button needs a label");
  if (lead !== undefined && !Object.hasOwn(A, lead)) throw new TypeError(`ActButton: unknown lead icon "${lead}"`);
  if (typeof onclick !== "function") throw new TypeError("ActButton: onclick is required (use the shared Button for a link)");
</script>

<button class={CLS[variant]} type="button" {onclick}>{#if lead}<Ico d={A[lead]} />{/if}{label}</button>
