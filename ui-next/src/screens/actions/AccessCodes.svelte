<!-- Existing survey code escrow, role/confirmation and one-time-export semantics. Contract classes only. -->
<script>
  import { onMount } from "svelte";
  import { liveContext } from "../href.js";
  import { token } from "../../app/api.js";
  import { codeRequest, issueCodeBatch, undoCodeBatch, codesCsv } from "../../app/access-codes.js";
  import { CAN_SHARE } from "./legacy.js";
  import { copyText } from "./copy.js";
  let { aid = liveContext()?.aid, requestFactory = codeRequest } = $props();
  let surveys = $state([]), sid = $state(""), count = $state(20), role = $state(""), stage = $state("loading"), message = $state(""), codes = $state([]), batch = $state(null);
  let owner, bearer, request, alive = true, generation = 0;
  const name = $derived(surveys.find(s => s.id === sid)?.name ?? "Survey");
  const busy = $derived(stage === "busy");
  function clear() { codes = []; batch = null; }
  async function current() {
    if (!alive || bearer !== token() || (liveContext()?.aid && liveContext().aid !== aid)) return false;
    const me = (await request("/v2/me")).result;
    return alive && bearer === token() && me?.principal?.id === owner;
  }
  async function load() {
    const gen = ++generation; clear(); stage = "loading"; message = "";
    bearer = token(); request = requestFactory(bearer);
    try {
      const me = (await request("/v2/me")).result;
      const model = (await request(`/v2/assessments/${encodeURIComponent(aid)}`)).result;
      if (!alive || gen !== generation || bearer !== token()) return;
      owner = me?.principal?.id; role = model.assessment.role;
      surveys = (model.surveys ?? []).filter(s => s.state === "selected" && !s.archived_at).map(s => ({ id: s.id, name: s.display_name || s.name || s.template_name || s.id }));
      sid = surveys[0]?.id ?? ""; stage = "idle";
    } catch { if (alive && gen === generation) { stage = "load-error"; message = "Access-code options could not be loaded. Check your sign-in and try again."; } }
  }
  async function issue() {
    if (stage !== "confirm" || !CAN_SHARE.has(role)) return;
    stage = "busy"; message = "Issuing and exporting codes. Keep this page open…";
    const result = await issueCodeBatch({ aid, sid, count: Number(count), request, current });
    if (!alive) { if (result.batch && !result.batch.undone) await undoCodeBatch(request, result.batch); return; }
    clear();
    if (!(await current().catch(() => false))) { if (result.batch && !result.batch.undone) await undoCodeBatch(request, result.batch); stage = "changed"; message = "Your sign-in changed. Codes were cleared; an unseen batch was undone where possible."; return; }
    stage = result.stage; batch = result.batch ?? null; codes = result.codes ?? []; message = result.message;
    if (stage === "unseen") { stage = batch.undone ? "idle" : "undo-required"; message = batch.undone ? "The codes could not be shown, so the batch was undone; no codes remain active from it." : "The codes could not be shown and undo was not confirmed. Retry undo before issuing another batch."; if (batch.undone) batch = null; }
  }
  async function undo() {
    if (!batch || busy) return;
    const priorCodes = codes; stage = "busy"; codes = [];
    const ok = await undoCodeBatch(request, batch);
    if (!alive) return;
    if (!(await current().catch(() => false))) { clear(); stage = "changed"; message = "Your sign-in changed. Code values were cleared."; return; }
    stage = ok ? "idle" : priorCodes.length ? "shown" : "undo-required"; if (!ok) codes = priorCodes; message = ok ? "Undone; no codes are active from that batch." : "Undo did not go through. Codes may still be active (redeemed codes cannot be undone). Try undo again."; if (ok) batch = null;
  }
  function download() {
    const blob = new Blob([codesCsv(name, codes)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "survey-access-codes.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function copy() { message = await copyText(codes.map(c => c.code).join("\n")) ? "Codes copied. Keep them private." : "Copy failed. Select the codes below and copy them."; }
  onMount(() => {
    if (!aid || aid === "sample") { stage = "fixture"; return; }
    load();
    const recheck = async () => { if (!(await current().catch(() => false))) { generation++; clear(); stage = "changed"; message = "Your sign-in changed. Code values were cleared. Reload this page to continue."; } };
    globalThis.addEventListener("focus", recheck);
    return () => { alive = false; generation++; globalThis.removeEventListener("focus", recheck); clear(); };
  });
</script>

<div class="l-stack" data-gap="3" role="group" aria-label="Access codes">
  {#if stage === "fixture"}<p class="small">Open a real review to issue access codes.</p>
  {:else if stage === "loading"}<p class="small" role="status">Loading access-code options…</p>
  {:else if stage === "load-error"}<p class="small">{message}</p><button class="btn" type="button" onclick={load}>Try again</button>
  {:else if !CAN_SHARE.has(role)}<p class="small">Only an owner or member can issue or export access codes.</p>
  {:else if !surveys.length}<p class="small">Select a survey in Prepare before issuing access codes.</p>
  {:else}
    <p class="small">A code opens one survey. Codes are shown once: download or copy them before leaving. Keep this page open until the batch is shown.</p>
    {#if ["idle", "refused"].includes(stage)}
      <label class="small l-stack" data-gap="1">Survey<select class="in" bind:value={sid}>{#each surveys as s}<option value={s.id}>{s.name}</option>{/each}</select></label>
      <label class="small l-stack" data-gap="1">Number of codes<input class="in" type="number" min="1" max="100" step="1" bind:value={count} /></label>
      <button class="btn" type="button" onclick={() => { if (!Number.isInteger(Number(count)) || count < 1 || count > 100) { message = "Choose between 1 and 100 codes."; return; } stage = "confirm"; message = ""; }}>Make access codes</button>
    {:else if stage === "confirm"}
      <p class="small">Issue and reveal {count} one-time access codes for {name}? Anyone with a code can answer this survey. No codes have been issued yet.</p>
      <div class="l-row" data-wrap data-gap="2"><button class="btn" type="button" onclick={issue}>Issue and show codes</button><button class="btn" type="button" onclick={() => { stage = "idle"; message = "Cancelled; no codes were issued."; }}>Cancel</button></div>
    {:else if stage === "shown"}
      <label class="small l-stack" data-gap="1">Access codes<textarea class="in" readonly rows="6" value={codes.map(c => c.code).join("\n")}></textarea></label>
      <div class="l-row" data-wrap data-gap="2"><button class="btn" type="button" onclick={download}>Download as CSV</button><button class="btn" type="button" onclick={copy}>Copy codes</button><button class="btn" type="button" onclick={undo}>Undo this batch</button><button class="btn" type="button" onclick={() => { clear(); stage = "idle"; message = "Code values cleared from this page. The issued codes remain active."; }}>Done with this batch</button></div>
    {:else if stage === "undo-required"}<button class="btn" type="button" onclick={undo}>Retry undo</button>{/if}
    <p class="small" role="status">{message}</p>
  {/if}
</div>
