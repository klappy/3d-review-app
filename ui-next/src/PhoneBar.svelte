<!-- UI Next (v4) phone bar. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 9 phone-bar + Phone shell row: fixed bottom glass bar in the thumb zone,
     exactly one btn-primary (block / flex-grow) plus an optional quiet Back; the only place a primary lives on a phone page. -->
<script>
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  let { label, href, lead, backHref, backLabel = "Back" } = $props();
  if (!(typeof label === "string" && label.trim())) throw new TypeError("PhoneBar: the bar holds one primary, which needs a label");
  const LEAD = { plus: I.plus, arrow: "M5 12h14M13 6l6 6-6 6" };
  if (lead !== undefined && !Object.hasOwn(LEAD, lead)) throw new TypeError(`PhoneBar: unknown lead icon "${lead}"`);
</script>

{#snippet leadIcon()}<Icon d={LEAD[lead]} />{/snippet}

<div class="glass phone-bar" role="group" aria-label="Page actions">
  {#if backHref}<Button label={backLabel} variant="quiet" href={backHref} />{/if}
  <Button {label} variant="primary" lg {href} lead={lead ? leadIcon : undefined} />
</div>
