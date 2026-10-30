<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import { to } from "./router.js";
  import { loadProjectSettings, saveProjectSettings } from "./project-settings.js";
  let { phone = false, theme = "light", project, sample = false } = $props();
  let current = $state(project);
  let name = $state(project.name);
  let organization = $state(project.organization ?? "");
  let busy = $state(false);
  let message = $state("");
  let error = $state("");
  let mustReload = $state(false);
  const editable = $derived(!sample && current.role === "owner");
  const back = $derived(to("project", { pid: current.id }));
  async function save(event) {
    event.preventDefault();
    if (!editable || busy || mustReload) return;
    busy = true; error = ""; message = "";
    try {
      current = await saveProjectSettings(current, { name, organization });
      name = current.name; organization = current.organization ?? "";
      message = "Settings saved and verified.";
    } catch (e) { error = `${e.message || "Settings could not be saved."} Reload settings before saving again.`; mustReload = true; }
    finally { busy = false; }
  }
  async function reload() {
    if (busy || sample) return;
    busy = true; error = ""; message = "";
    try { current = await loadProjectSettings(current.id); name = current.name; organization = current.organization ?? ""; mustReload = false; message = "Current settings reloaded."; }
    catch (e) { error = e.message || "Settings could not be loaded."; }
    finally { busy = false; }
  }
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Project settings" parent="project" {back} />{:else}<TopBar home={to("home")} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page gap={4}>
    <a class="link" href={back}>Back to project</a>
    <h1 class={phone ? "title-phone" : "title-page"}>Project settings</h1>
    <p>{current.name}</p>
    {#if sample}<p class="small">Sample settings are read-only. Changes are not saved.</p>
    {:else if !editable}<p class="small">Your role: {current.role}. Only a project owner can change these settings.</p>{/if}
    <form class="glass l-card l-stack" data-gap="4" onsubmit={save}>
      <div><label class="lbl" for="project-settings-name">Project name</label><input class="in" id="project-settings-name" required bind:value={name} disabled={!editable || busy} /></div>
      <div><label class="lbl" for="project-settings-org">Organization (optional)</label><input class="in" id="project-settings-org" bind:value={organization} disabled={!editable || busy} /></div>
      {#if error}<p role="alert">{error}</p>{/if}
      <p role="status">{message}</p>
      <div class="l-row" data-gap="2" data-wrap>
        {#if editable}<button class="btn btn-primary" type="submit" disabled={busy || mustReload}>{busy ? "Saving…" : "Save settings"}</button>{/if}
        {#if !sample}<button class="btn" type="button" onclick={reload} disabled={busy}>Reload settings</button>{/if}
        <a class="btn" href={back}>Cancel</a>
      </div>
    </form>
  </Page>
</AppShell>
