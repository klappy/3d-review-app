<!-- UI Next (v4) /next/?page=home gallery: states pages for Home's components (TopBar, Menu, Tag, Level, PhoneHeader, PhoneBar).
     Status: provisional. Playbook stage 4: states first. Boards: canvas Home, HomeFirst, HomePhone, MenuPhone. No <style>, no inline style. -->
<script>
  import TopBar from "./TopBar.svelte";
  import Menu from "./Menu.svelte";
  import Tag, { TAG_STATES } from "./Tag.svelte";
  import Level, { LEVELS, SKINS } from "./Level.svelte";
  import PhoneHeader, { HEADER_STATES } from "./PhoneHeader.svelte";
  import PhoneBar from "./PhoneBar.svelte";
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  const MODES = ["both", "light", "dark"];
  let { mode = "both", phone = false } = $props();
  const themes = $derived(mode === "both" ? ["light", "dark"] : [mode]);
  const CRUMBS = [{ label: "BCS · India", href: "#workspace" }, { label: "Hindi New Testament", href: "#project" }, { label: "Mark 1–4 draft" }];
  const REVIEW_ITEMS = [
    { label: "Edit details and dates", href: "#setup", icon: I.pen },
    { label: "People with access", href: "#people", icon: I.people },
    { kind: "hr" },
    { label: "Delete this review", icon: I.x, danger: true, refused: "Reviews with responses can't be deleted. This one has 18." },
  ];
  const OPEN_ITEMS = [{ label: "Edit details and dates", href: "#setup", icon: I.pen }, { kind: "hr" }, { label: "Delete this review", icon: I.x, danger: true }];
</script>

{#snippet dots()}<Icon d="M5 12h.01M12 12h.01M19 12h.01" />{/snippet}

<header class="gx-bar">
  <strong>UI Next gallery</strong>
  <span class="gx-note">Home's components: Top bar, Menu, Tag, Level, phone header, phone bar. Provisional.</span>
  <nav class="gx-toggle" aria-label="Gallery pages"><a class="gx-tab" href="?page=components">Components</a><a class="gx-tab" href="?page=layouts">Layouts</a><a class="gx-tab" href="?page=home" aria-current="page">Home parts</a></nav>
  <div class="gx-toggle" role="group" aria-label="Theme">
    {#each MODES as m}<button type="button" class="gx-tab" aria-pressed={mode === m ? "true" : "false"} onclick={() => (mode = m)}>{m}</button>{/each}
  </div>
</header>

<main class="gx-grid" data-mode={mode}>
  {#each themes as theme (theme)}
    <section class="app gx-sheet" data-theme={theme} aria-label={`Home parts, ${theme} theme`}>
      <h2>{theme === "light" ? "Light" : "Dark"}</h2>

      {#if !phone}
        <h3 class="gx-h">Top bar</h3>
        <div class="gx-k">signed-in · breadcrumb Workspace › Project › Review</div>
        <div class="gx-frame"><TopBar crumbs={CRUMBS} /></div>
        <div class="gx-k">signed-in · Home (no crumb) · account menu open</div>
        <div class="gx-frame gx-open"><TopBar accountOpen /></div>
        <div class="gx-k">signed-in · workspace switcher open</div>
        <div class="gx-frame gx-open-s"><TopBar workspaceOpen /></div>
        <div class="gx-k">public</div>
        <div class="gx-frame"><TopBar variant="public" /></div>
      {/if}

      <h3 class="gx-h">Menu (details.dd)</h3>
      <div class="gx-row"><span class="gx-k">closed · open with destructive item last · open with refused item and its reason</span></div>
      <div class="gx-row gx-menus">
        <Menu id={`m1-${theme}`} summaryClass="btn btn-icon" label="More for this review" summary={dots} items={OPEN_ITEMS} />
        <Menu id={`m2-${theme}`} summaryClass="btn btn-icon" label="More for this review" summary={dots} items={OPEN_ITEMS} open align="start" />
        <Menu id={`m3-${theme}`} summaryClass="btn btn-icon" label="More for this review" summary={dots} items={REVIEW_ITEMS} open align="start" />
      </div>

      <h3 class="gx-h">Tag</h3>
      <div class="gx-row"><span class="gx-k">Neutral counts</span><Tag label="1 new" /><Tag label="Not yet reviewed" /><Tag label="18 of 30" /></div>
      <div class="gx-row"><span class="gx-k">Perspective (lens dot)</span><Tag label="Translation team" lens="team" /><Tag label="Community" lens="community" /><Tag label="Church" lens="church" /></div>
      <div class="gx-row"><span class="gx-k">Recommendation states (word + icon)</span>{#each Object.keys(TAG_STATES) as state}<Tag {state} />{/each}</div>
      <div class="gx-row"><span class="gx-k">Practice slot</span><Tag kind="practice" /></div>

      <h3 class="gx-h">Level (meter + name)</h3>
      {#each SKINS as skin}
        <div class="app gx-skin" data-theme={theme} data-imagery={skin}>
          <div class="gx-row"><span class="gx-k">{skin}</span>{#each Object.keys(LEVELS) as level}<Level {level} />{/each}</div>
        </div>
      {/each}

      <h3 class="gx-h">Phone header</h3>
      <div class="gx-phones">
        {#each HEADER_STATES as state}
          <div class="gx-k">{state}</div>
          <div class="gx-frame gx-phone">
            {#if state === "nested"}<PhoneHeader {state} title="Hindi New Testament" parent="Home" />
            {:else if state === "setup-step"}<PhoneHeader {state} step={3} />
            {:else}<PhoneHeader {state} />{/if}
          </div>
        {/each}
      </div>

      <h3 class="gx-h">Phone bar</h3>
      <div class="gx-phones">
        <div class="gx-k">one primary</div>
        <div class="gx-frame gx-phone"><PhoneBar label="Start a 3D Review" lead="plus" href="#setup" /></div>
        <div class="gx-k">primary + quiet Back</div>
        <div class="gx-frame gx-phone"><PhoneBar label="Next" backHref="#back" href="#next" /></div>
      </div>
    </section>
  {/each}
</main>
