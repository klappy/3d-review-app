<!-- UI Next (v4) actions-lane icon button that does something on the page (copy a link, close a sheet): the same markup the shared
     ../../Button.svelte draws for an icon-only quiet button (button.btn.btn-quiet.btn-icon, type=button, aria-label, decorative glyph),
     plus an onclick, which the shared Button does not take yet (handed back in RESULTS-actions). Status: provisional. -->
<script>
  import Ico from "./Ico.svelte";
  let { d, ariaLabel, onclick } = $props();
  if (!(typeof ariaLabel === "string" && ariaLabel.trim())) throw new TypeError("IconAction: an icon-only button needs an aria-label");
  if (typeof onclick !== "function") throw new TypeError("IconAction: onclick is required (use the shared Button for a link)");
</script>

<button class="btn btn-quiet btn-icon" type="button" aria-label={ariaLabel} {onclick}><Ico {d} /></button>
