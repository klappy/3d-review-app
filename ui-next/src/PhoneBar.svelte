<!-- UI Next (v4) phone bar. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 9 phone-bar + Phone shell row: fixed bottom glass bar in the thumb zone,
     one btn-primary (block / flex-grow) plus an optional quiet Back; the only place a primary lives on a phone page (none while demoted).
     disabled: the primary renders as a native disabled button (no href: a link cannot be disabled), styled by the helmet's
     .btn-primary:disabled (design-system.md section 2 "Field and button states", R16 Disabled); pass ariaDescribedby with the
     id of the line that names the reason (R16 V-41; lane actions R4-2: PrintPhone with nothing ticked).
     ariaDescribedby: id refs passed through to the main button as aria-describedby (Button's own check applies).
     demoted: while a dialog or sheet holds the page's one primary, the bar's action steps down to a secondary block button
     (design-system.md section 9 "Dialog and sheet states: one primary"; lane people C6: the WorkspaceGroup phone sheet).
     lead / trail: a named icon before or after the label, rendered through Button's own lead and trail (gen.py btn() lead= and icon=):
     lead plus or arrow; trail arrow, as the boards draw "Plan the next step ->" on ResultsPhone and ResultsAnswersPhone
     (VALIDATION-integration N3). -->
<script>
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  let { label, href, lead, trail, backHref, backLabel = "Back", disabled = false, ariaDescribedby, demoted = false } = $props();
  if (!(typeof label === "string" && label.trim())) throw new TypeError("PhoneBar: the bar holds one primary, which needs a label");
  const LEAD = { plus: I.plus, arrow: "M5 12h14M13 6l6 6-6 6" };
  if (lead !== undefined && !Object.hasOwn(LEAD, lead)) throw new TypeError(`PhoneBar: unknown lead icon "${lead}"`);
  const TRAIL = { arrow: I.arrow };
  if (trail !== undefined && !Object.hasOwn(TRAIL, trail)) throw new TypeError(`PhoneBar: unknown trail icon "${trail}"`);
  if (typeof disabled !== "boolean") throw new TypeError("PhoneBar: disabled is true or false");
  if (typeof demoted !== "boolean") throw new TypeError("PhoneBar: demoted is true or false");
</script>

{#snippet leadIcon()}<Icon d={LEAD[lead]} />{/snippet}
{#snippet trailIcon()}<Icon d={TRAIL[trail]} />{/snippet}

<div class="glass phone-bar" role="group" aria-label="Page actions">
  {#if backHref}<Button label={backLabel} variant="quiet" href={backHref} />{/if}
  <Button {label} variant={demoted ? "secondary" : "primary"} lg block={demoted} href={disabled ? undefined : href} {disabled} {ariaDescribedby}
    lead={lead ? leadIcon : undefined} trail={trail ? trailIcon : undefined} />
</div>
