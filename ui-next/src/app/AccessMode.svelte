<script>
  import { to } from "./router.js";
  import { switchAccessMode, watchAccessMode } from "./access-mode.js";
  let { principal, sample = false, oninvalidate = () => {} } = $props();
  let busy = $state(false);
  let channel;
  const eligible = $derived(!sample && principal?.super_admin === true);
  $effect(() => {
    if (!eligible) return;
    channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("review-access") : null;
    const stop = watchAccessMode(principal, { document, location, channel, onChange: () => { busy = true; oninvalidate(); } });
    return () => { stop(); channel?.close(); };
  });
  function change(mode) {
    if (!eligible || busy || mode === principal.access_mode) return;
    busy = true; oninvalidate();
    let storage; try { storage = globalThis.localStorage; } catch {}
    switchAccessMode(principal, mode, { document, location, storage, channel });
  }
</script>

{#if eligible}
  <section class="glass l-card l-stack" data-pad="work" data-gap="2" aria-label="Super admin access" aria-busy={busy}>
    <div class="l-row" data-gap="2" role="group" aria-label="Access mode">
      <button class="btn" type="button" disabled={busy} aria-pressed={principal.access_mode !== "global"} onclick={() => change("my")}>My Access</button>
      <button class="btn" type="button" disabled={busy} aria-pressed={principal.access_mode === "global"} onclick={() => change("global")}>Global Access</button>
    </div>
    <p class="small" role="status">{busy ? "Access changed. Reloading…" : principal.access_mode === "global" ? "Global Access · Browse every workspace and project." : "My Access · Your workspaces and projects."}</p>
    {#if !busy}<div class="l-row" data-gap="3"><a class="link" href={to("workspaces")}>{principal.access_mode === "global" ? "All workspaces" : "My workspaces"}</a><a class="link" href={to("projects")}>{principal.access_mode === "global" ? "All projects" : "My projects"}</a></div>{/if}
  </section>
{/if}
