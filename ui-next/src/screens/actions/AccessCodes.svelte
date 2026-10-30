<!-- Presentation only: Share owns the ephemeral controller across responsive card placement. -->
<script>
  import { onMount } from "svelte";
  import { createAccessCodesState } from "../../app/access-codes.svelte.js";
  import { CAN_SHARE } from "./legacy.js";
  let { controller = null, aid, requestFactory } = $props();
  const owned = controller === null;
  const flow = controller ?? createAccessCodesState({ aid, requestFactory });
  const c = flow.state;
  const name = $derived(flow.name());
  let panel;
  onMount(() => {
    const dispose = owned ? flow.mount() : null;
    const disclosure = panel.closest("details");
    const remember = () => flow.setExpanded(disclosure.open);
    if (disclosure) { disclosure.open = c.expanded; disclosure.addEventListener("toggle", remember); }
    return () => { disclosure?.removeEventListener("toggle", remember); dispose?.(); };
  });
</script>

<div bind:this={panel} class="l-stack" data-gap="3" role="group" aria-label="Access codes">
  {#if c.stage === "fixture"}<p class="small">Open a real review to issue access codes.</p>
  {:else if c.stage === "loading"}<p class="small" role="status">Loading access-code options…</p>
  {:else if c.stage === "load-error"}<p class="small">{c.message}</p><button class="btn" type="button" onclick={flow.load}>Try again</button>
  {:else if !CAN_SHARE.has(c.role)}<p class="small">Only an owner or member can issue or export access codes.</p>
  {:else if !c.surveys.length}<p class="small">Select a survey in Prepare before issuing access codes.</p>
  {:else}
    <p class="small">Make a new batch when you need access codes for paper surveys. Codes are shown only when you issue a batch.</p>
    {#if ["idle", "refused"].includes(c.stage)}
      <label class="small l-stack" data-gap="1">Survey<select class="in" value={c.sid} onchange={e => flow.setSurvey(e.currentTarget.value)}>{#each c.surveys as s}<option value={s.id}>{s.name}</option>{/each}</select></label>
      <label class="small l-stack" data-gap="1">Number of codes<input class="in" type="number" min="1" max="100" step="1" value={c.count} oninput={e => flow.setCount(e.currentTarget.valueAsNumber)} /></label>
      <button class="btn" type="button" onclick={flow.prepare}>Make access codes</button>
    {:else if c.stage === "confirm"}
      <p class="small">Issue and reveal {c.count} one-time access codes for {name}? Anyone with a code can answer this survey. No codes have been issued yet.</p>
      <div class="l-row" data-wrap data-gap="2"><button class="btn" type="button" onclick={flow.issue}>Issue and show codes</button><button class="btn" type="button" onclick={flow.cancel}>Cancel</button></div>
    {:else if c.stage === "shown"}
      <p class="small">{c.codes.length} access code{c.codes.length === 1 ? "" : "s"} in this batch · shown once. Download or copy before leaving.</p>
      <label class="small l-stack" data-gap="1">Access codes<textarea class="in" readonly rows="6" value={c.codes.map(c => c.code).join("\n")}></textarea></label>
      <div class="l-row" data-wrap data-gap="2"><button class="btn" type="button" onclick={() => flow.print()}>Print this batch</button><button class="btn" type="button" onclick={flow.download}>Download as CSV</button><button class="btn" type="button" onclick={flow.copy}>Copy codes</button><button class="btn" type="button" onclick={flow.undo}>Undo this batch</button><button class="btn" type="button" onclick={flow.done}>Done with this batch</button></div>
    {:else if c.stage === "undo-required"}<button class="btn" type="button" onclick={flow.undo}>Retry undo</button>{/if}
    <p class="small" role="status">{c.message}</p>
  {/if}
</div>
