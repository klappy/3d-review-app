<!-- UI Next (v4) phone header. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md "Phone chrome" (R13) + section 9 phone-header: .phone-top[data-shell=facilitator][data-state],
     56px, never more than three targets, no crumb. root: brand · — · avatar; nested: back · title · avatar;
     public: brand · — · Sign in (quiet) or nothing; setup-step: Close · "Step n of 5" · nothing. Avatar opens the MenuPhone sheet. -->
<script module>
  export const HEADER_STATES = Object.freeze(["root", "nested", "public", "setup-step"]);
</script>
<script>
  import { getContext } from "svelte";
  import Mark from "./Mark.svelte";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  import { liveChrome } from "./app/chrome.js";
  import { linkFor } from "./app/router.js";
  import { liveContext } from "./screens/href.js";
  const L = liveChrome();
  const liveAccount = getContext("next-account-chrome");
  const verified = $derived(!!liveAccount?.available?.() && !!liveAccount?.session?.()?.principal?.id && liveAccount.session().principal.kind !== "anonymous");
  const accountChrome = $derived(liveAccount?.chrome?.());
  const accessControl = $derived(verified ? liveAccount?.access?.() : null);
  let { state = "root", title, parent = "Home", back = L?.home ?? "#home", step, steps = 5, signIn = true, initials = L?.initials ?? "BK", menuHref = L ? linkFor("menu", {}, liveContext() ?? {}) : "#menu", home = L?.home ?? "#home", onclose } = $props();
  if (!HEADER_STATES.includes(state)) throw new TypeError(`PhoneHeader: unknown state "${state}"`);
  if (state === "nested" && !(typeof title === "string" && title.trim())) throw new TypeError("PhoneHeader: a nested header needs the page title");
  if (state === "setup-step" && !(Number.isInteger(step) && step >= 1 && step <= steps)) throw new TypeError("PhoneHeader: setup-step needs step 1..steps");
</script>

{#snippet backIcon()}<Icon d={I.back} />{/snippet}
{#snippet closeIcon()}<Icon d={I.x} />{/snippet}

<header class="phone-top" data-shell="facilitator" data-state={state}>
  {#if state === "nested"}
    <Button icon={backIcon} ariaLabel={`Back to ${parent}`} variant="quiet" href={back} />
    <span class="phone-title">{title}</span>
  {:else if state === "setup-step"}
    <Button icon={closeIcon} ariaLabel="Close setup" variant="quiet" href={home} />
    <span class="phone-step">Step {step} of {steps}</span>
  {:else}
    <a class="brand" href={home}><Mark size={26} /><span>3D Review</span></a>
  {/if}
  {#if state === "root" || state === "nested" || (state === "public" && verified)}
    <div class="phone-account">{@render accessControl?.()}<a class="menu-btn" href={menuHref} aria-label="Workspace and account"><span class="av" aria-hidden="true">{verified ? accountChrome?.who?.initials ?? initials : initials}</span></a></div>
  {:else if state === "public" && signIn}
    <Button label="Sign in" variant="quiet" href="#signin" />
  {/if}
</header>
