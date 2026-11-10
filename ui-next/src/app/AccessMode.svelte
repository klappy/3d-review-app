<script>
  import "../../components/access-mode.css";
  import { switchAccessMode, watchAccessMode } from "./access-mode.js";
  let { principal, sample = false, oninvalidate = () => {}, pending = false, error = "", onfailure = () => {} } = $props();
  let busy = $state(false);
  const uid = $props.id();
  let channel;
  const eligible = $derived(!sample && principal?.super_admin === true);
  $effect(() => {
    if (!eligible) return;
    channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("review-access") : null;
    const stop = watchAccessMode(principal, { document, location, channel, onChange: () => { busy = true; oninvalidate(); } });
    return () => { stop(); channel?.close(); };
  });
  function change(mode) {
    if (!eligible || busy || pending || mode === principal.access_mode) return;
    const servedPrincipal = principal;
    busy = true; oninvalidate();
    let storage; try { storage = globalThis.localStorage; } catch {}
    try { if (!switchAccessMode(servedPrincipal, mode, { document, location, storage, channel })) onfailure(); } catch { onfailure(); }
  }
</script>

{#if eligible}
  <label class="access-mode" data-access-mode={principal.access_mode === "global" ? "support" : "personal"} aria-busy={busy || pending}>
    <span class="sr-only">Access mode</span>
    <select class="in" aria-label="Access mode" value={principal.access_mode === "global" ? "global" : "my"} disabled={busy || pending} aria-describedby={`${uid}-scope`} onchange={e => change(e.currentTarget.value)}>
      <option value="my">Personal</option>
      <option value="global">Support</option>
    </select>
    <span id={`${uid}-scope`} class="sr-only" role="status">{busy || pending ? "Checking access change…" : principal.access_mode === "global" ? "Support mode: browse all workspaces and projects." : "Personal mode: your workspaces and projects."}</span>
  </label>
  {#if error}<div class="access-mode-error" role="alert"><p class="small">{error}</p><button class="btn" type="button" onclick={() => location.reload()}>Reload to verify access</button></div>{/if}
{/if}
