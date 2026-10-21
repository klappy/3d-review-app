<!-- UI Next (v4) Tag. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 2 Tag row + "Tag states, the practice slot" (R9): neutral chip; state by word + aria-hidden icon,
     never a colour; practice slot carries R5's words; optional lens dot only where the tag names a perspective. Never a stage, never a level. -->
<script module>
  export const TAG_STATES = Object.freeze({ ready: "Ready", queued: "Queued · being prepared", review: "Awaiting review" });
  export const PRACTICE_LABEL = "Practice copy · not a real review";
</script>
<script>
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  const ICON = { ready: I.check, queued: I.clock, review: I.eye };
  const LENSES = ["team", "community", "church"];
  let { label, state, kind, lens } = $props();
  if (state !== undefined && !Object.hasOwn(TAG_STATES, state)) throw new TypeError(`Tag: unknown state "${state}"`);
  if (kind !== undefined && kind !== "practice") throw new TypeError(`Tag: unknown kind "${kind}"`);
  if (lens !== undefined && !LENSES.includes(lens)) throw new TypeError(`Tag: unknown lens "${lens}"`);
  if ((state || kind) && label) throw new TypeError("Tag: a state or practice tag takes its words from the contract");
  if ((state || kind) && lens) throw new TypeError("Tag: a lens dot only names a perspective, never a state");
  if (!state && !kind && !(typeof label === "string" && label.trim())) throw new TypeError("Tag: a tag needs a label");
  const text = $derived(state ? TAG_STATES[state] : kind ? PRACTICE_LABEL : label);
</script>

<span class="tag" data-state={state} data-kind={kind}>{#if state}<Icon d={ICON[state]} />{/if}{#if lens}<i class="lensdot" data-lens={lens} aria-hidden="true"></i>{/if}{text}</span>
