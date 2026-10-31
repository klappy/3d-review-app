<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import { to } from "./router.js";
  import { ACCOUNT_LINKS, loadAccountSettings, saveAccountName, skipAccountName, loadReleaseInfo, loadRoadmapHistory } from "./account-settings.js";
  import { copy, detailsLine } from "../../../ui/changelog.js";
  import { createLiveFeed } from "../../../ui/roadmap/live.js";
  import { windowItems, STAGES, LABELS, stagePresentation, happeningNow, currentBlocker, nextAction } from "../../../ui/roadmap/model.js";
  let { phone = false, theme = "light", principal, sample = false, initialView = "name", back = to("home"), onsaved = () => {}, onskip, onswitch } = $props();
  let current = $state(principal);
  let name = $state(principal?.display_name ?? "");
  let busy = $state(false), locked = $state(false), error = $state(""), status = $state("");
  let switching = $state(initialView === "switch"), releases = $state(null), showReleases = $state(initialView === "release"), showRoadmap = $state(initialView === "roadmap");
  let feedState = $state(null), window = $state("now"), allWork = $state(false), histories = $state({});
  let feed;
  const roadmapWindow = $derived(windowItems(feedState?.snapshot?.items ?? [], allWork));
  const editable = $derived(!sample && ["user", "support"].includes(current?.kind));
  async function save(event) {
    event.preventDefault(); if (!editable || busy || locked) return;
    busy = true; error = ""; status = "";
    try { current = await saveAccountName(current, name); name = current.display_name ?? ""; status = "Your name was saved and verified."; onsaved(current); }
    catch (e) { error = `${e.message || "Your name could not be saved."} Reload settings before saving again.`; locked = true; }
    finally { busy = false; }
  }
  async function reload() {
    if (busy || sample) return; busy = true; error = ""; status = "";
    try { current = await loadAccountSettings(current?.id); name = current.display_name ?? ""; locked = false; status = "Account settings reloaded."; }
    catch (e) { error = e.message || "Account settings could not be read."; } finally { busy = false; }
  }
  function skip() {
    if (busy) return; let storage; try { storage = globalThis.localStorage; } catch {}
    if (!sample) skipAccountName(current, storage); if (onskip) onskip(); else globalThis.location.assign(back);
  }
  async function switchAccount() {
    if (!editable || busy || !onswitch) return; busy = true; error = "";
    try { await onswitch(); } catch (e) { error = e.message || "Sign-out could not be confirmed. Your session may still be active."; } finally { busy = false; }
  }
  async function readReleases() { error = ""; try { releases = await loadReleaseInfo(); } catch (e) { error = e.message; } }
  $effect(() => { if (showReleases && !releases) void readReleases(); });
  $effect(() => {
    if (!showRoadmap) return;
    feed = createLiveFeed({ onChange: (value) => { feedState = value; } });
    const visibility = () => { if (document.hidden) feed.pause(); else feed.resume(); };
    document.addEventListener("visibilitychange", visibility); feed.start();
    return () => { document.removeEventListener("visibilitychange", visibility); feed.dispose(); };
  });
  async function readHistory(id) {
    const generation = feedState?.snapshot?.generation;
    if (!Number.isSafeInteger(generation)) return;
    const key = `${generation}:${id}`, previous = histories[key] ?? { events: [], after: 0 };
    if (previous.busy || previous.done) return;
    histories[key] = { ...previous, busy: true, error: "" };
    try {
      const page = await loadRoadmapHistory(id, generation, previous.after);
      if (feedState?.snapshot?.generation !== generation) return;
      histories[key] = { events: previous.events.concat(page.events), after: page.next, done: page.next === null, busy: false, error: "" };
    } catch (e) {
      if (feedState?.snapshot?.generation !== generation) return;
      histories[key] = { ...previous, busy: false, error: e.message || "History could not be loaded. Try again." };
      if (e.code === "STALE_GENERATION") feed?.refresh();
    }
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape" && switching && !busy) switching = false; }} />

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Your account" parent="previous page" {back} />{:else}<TopBar home={to("home")} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page gap={4}>
    <a class="link" href={back}>Back</a><h1 class={phone ? "title-phone" : "title-page"}>Your account</h1>
    {#if sample}<p class="small">Sample account settings are read-only. Nothing is saved.</p>{/if}
    <form class="glass l-card l-stack" data-pad="work" data-gap="3" onsubmit={save}>
      <h2 class="h3">What should we call you?</h2><p class="small">Your name is optional. You can change or clear it any time.</p>
      <label class="lbl" for="account-display-name">Your name</label><input class="in" id="account-display-name" name="display_name" autocomplete="name" maxlength="80" bind:value={name} disabled={!editable || busy} />
      <div class="l-row" data-gap="2" data-wrap><button class="btn btn-primary" type="submit" disabled={!editable || busy || locked}>{busy ? "Working…" : "Save name"}</button><button class="btn" type="button" onclick={skip} disabled={busy}>Not now</button><button class="btn" type="button" onclick={reload} disabled={busy || sample}>Reload settings</button><a class="btn" href={back}>Cancel</a></div>
      <p role="status">{status}</p>
    </form>
    <nav class="l-row" data-gap="2" data-wrap aria-label="Product information"><button class="btn" type="button" onclick={() => { showReleases = !showReleases; }} aria-expanded={showReleases}>Version and changelog</button><button class="btn" type="button" onclick={() => { showRoadmap = !showRoadmap; }} aria-expanded={showRoadmap}>Roadmap work and history</button><a class="btn" href={ACCOUNT_LINKS.roadmap}>Open public roadmap</a><a class="btn" href={ACCOUNT_LINKS.versions}>Shipped versions</a></nav>
    {#if showReleases}<section class="glass l-card l-stack" data-pad="work" data-gap="3" aria-label="Version and changelog"><h2 class="h3">What changed</h2>{#if releases}<p>{detailsLine(releases.health)}</p>{#each releases.changes.versions as entry}<section><h3 class="h3">{entry.version}{entry.version === releases.health.version ? " · current" : ""}</h3>{#if entry.status === "candidate"}<p class="small">{copy.candidate(releases.health.release_source?.slice(0, 7) ?? "")}</p>{/if}{#each copy.sections as [key, label]}{#if entry.sections?.[key]?.length}<h4>{label}</h4><ul>{#each entry.sections[key] as line}<li>{line}</li>{/each}</ul>{/if}{/each}</section>{/each}{:else}<p role="status">{error ? "Release information is unavailable. You can retry below." : "Loading release information…"}</p>{/if}<button class="btn" type="button" onclick={readReleases}>Reload release information</button></section>{/if}
    {#if showRoadmap}
      <section class="glass l-card l-stack" data-pad="work" data-gap="3" aria-label="Roadmap work and history">
        <h2 class="h3">Roadmap work and history</h2><p role={feedState?.error ? "alert" : "status"}>{feedState?.error ?? (!feedState?.snapshot ? "Loading roadmap…" : "")}</p>
        <div class="l-row" data-gap="2" data-wrap><button class="btn" type="button" onclick={() => feed?.refresh()}>{feedState?.error ? "Retry roadmap" : "Refresh roadmap"}</button><label><input type="checkbox" bind:checked={allWork} /> Show all work</label></div>
        {#if feedState?.snapshot}
          <p class="small">{feedState.snapshot.source_mode === "production_canonical" ? "Production feed" : "DEV provisional feed"} · Event sequence {feedState.snapshot.cursor}. Delivery reports and independent acceptance are separate.</p>
          <p class="small">{#if Number.isFinite(feedState.fetchedAt)}Last successful read <time datetime={new Date(feedState.fetchedAt).toISOString()}>{new Date(feedState.fetchedAt).toLocaleString()}</time>. {/if}{#if feedState.lastEventAt && Number.isFinite(new Date(feedState.lastEventAt).getTime())}Latest public update <time datetime={new Date(feedState.lastEventAt).toISOString()}>{new Date(feedState.lastEventAt).toLocaleString()}</time>.{:else}No public update has been published.{/if}</p>
          <div class="l-row" data-gap="2" data-wrap role="group" aria-label="Work window">{#each [["past", "Past"], ["now", "Now"], ["next", "Future"]] as [key, label]}<button class="btn" type="button" aria-pressed={window === key} onclick={() => { window = key; }}>{label} · {roadmapWindow[key + "Total"]}</button>{/each}</div>
          {#if !roadmapWindow.pastTotal && !roadmapWindow.nowTotal && !roadmapWindow.nextTotal}<p>No roadmap work is currently published. Published plans and updates will appear here.</p>{:else if !roadmapWindow[window].length}<p>No {window === "now" ? "active" : window === "past" ? "completed" : "future"} work is currently published.</p>{/if}
          {#each roadmapWindow[window] as item (item.id)}
            {@const history = histories[`${feedState.snapshot.generation}:${item.id}`]}
            <article class="glass l-card l-stack" data-pad="work" data-gap="3"><h3 class="h3">{item.title}</h3><p>{item.provenance?.scope ?? "Scope not yet reviewed."}</p>
              {#if !["past", "now", "next"].includes(item.operations?.workflow)}<p class="small">Future · workflow placement not yet reviewed; not active work.</p>{/if}
              <dl><dt>Status</dt><dd>{happeningNow(item)}</dd><dt>Blocker</dt><dd>{currentBlocker(item)}</dd><dt>Next action</dt><dd>{nextAction(item)}</dd><dt>Outcome</dt><dd>{item.provenance?.outcome ?? "Outcome not yet reviewed."}</dd></dl>
              <div class="l-stack" data-gap="2">{#each STAGES as stage}{@const value = stagePresentation(item, stage)}<p class="small"><strong>{LABELS[stage]}:</strong> {value.headline} · {value.report} · {value.label}</p>{/each}</div>
              <details><summary>Why this work · evidence · history</summary><dl>{#each Object.entries(item.provenance ?? {}) as [key, value]}<dt>{key}</dt><dd>{String(value)}</dd>{/each}</dl>
                {#each STAGES as stage}<p class="small"><strong>{LABELS[stage]} evidence:</strong> {item.stages[stage]?.reason ?? "Not supplied"} {#each item.stages[stage]?.evidence ?? [] as link}<a class="link" href={link.url}>{link.label}</a>{/each}</p>{/each}
                <ol>{#each history?.events ?? [] as event}<li><strong>{event.recorded_at} · {String(event.value?.kind ?? "Recorded event")}</strong>{#if event.value?.summary}<dl>{#each Object.entries(event.value.summary) as [key, value]}<dt>{key}</dt><dd>{String(value)}</dd>{/each}</dl>{/if}</li>{/each}</ol>
                {#if history?.error}<p role="alert">{history.error}</p>{/if}
                {#if history?.done}<p class="small">History loaded.</p>{:else}<button class="btn" type="button" disabled={history?.busy} onclick={() => readHistory(item.id)}>{history?.busy ? "Loading history…" : history?.events.length ? "Read next history page" : "Read full history"}</button>{/if}
              </details>
            </article>
          {/each}
        {/if}
      </section>
    {/if}
    {#if editable && onswitch}<section class="glass l-card l-stack" data-pad="work" data-gap="3"><h2 class="h3">Use another account</h2>{#if switching}<p>This signs you out before the sign-in screen opens for the other account. Confirm only when you are ready to leave this account.</p><div class="l-row" data-gap="2"><button class="btn" type="button" onclick={switchAccount} disabled={busy}>Sign out and use another account</button><button class="btn" type="button" onclick={() => { switching = false; }} disabled={busy}>Cancel account switch</button></div>{:else}<button class="btn" type="button" onclick={() => { switching = true; }}>Use another account</button>{/if}</section>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
  </Page>
</AppShell>
