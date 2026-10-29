<!-- UI Next (v4) /next/ fixture gallery. Status: provisional. Every ported contract state, light and dark.
     Light DOM only; layout classes live in gallery.css (no <style> blocks). -->
<script>
  import Button from "./Button.svelte";
  import Pill, { STAGES } from "./Pill.svelte";
  import LensDot, { LENSES } from "./LensDot.svelte";
  import Icon from "./Icon.svelte";

  const PLUS = "M12 5v14M5 12h14", ARROW = "M5 12h14M13 6l6 6-6 6", DOTS = "M5 12h.01M12 12h.01M19 12h.01", HELP = "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01";
  const MODES = ["both", "light", "dark"];
  let { mode = "both" } = $props();
  const themes = $derived(mode === "both" ? ["light", "dark"] : [mode]);
</script>

{#snippet plus()}<Icon d={PLUS} />{/snippet}
{#snippet arrow()}<Icon d={ARROW} />{/snippet}
{#snippet dots()}<Icon d={DOTS} />{/snippet}
{#snippet help()}<Icon d={HELP} />{/snippet}

<header class="gx-bar">
  <strong>UI Next gallery</strong>
  <span class="gx-note">Svelte 5 re-expression of Button, Stage pill and Lens dot. Provisional.</span>
  <nav class="gx-toggle" aria-label="Gallery pages"><a class="gx-tab" href="?page=components" aria-current="page">Components</a><a class="gx-tab" href="?page=layouts">Layouts</a><a class="gx-tab" href="?page=home">Home parts</a></nav>
  <div class="gx-toggle" role="group" aria-label="Theme">
    {#each MODES as m}
      <button type="button" class="gx-tab" aria-pressed={mode === m ? "true" : "false"} onclick={() => (mode = m)}>{m}</button>
    {/each}
  </div>
</header>

<main class="gx-grid" data-mode={mode}>
  {#each themes as theme (theme)}
    <section class="app gx-sheet" data-theme={theme} aria-label={`Components, ${theme} theme`}>
      <h2>{theme === "light" ? "Light" : "Dark"}</h2>

      <h3 class="gx-h">Button</h3>
      <div class="gx-row"><span class="gx-k">Variants</span>
        <Button label="Share the survey" variant="primary" />
        <Button label="Secondary" />
        <Button label="Quiet" variant="quiet" />
      </div>
      <div class="gx-row"><span class="gx-k">Leading / trailing icon</span>
        <Button label="Add a project" variant="primary" lead={plus} />
        <Button label="Continue setup" trail={arrow} />
        <Button label="Close" variant="quiet" lead={plus} />
      </div>
      <div class="gx-row"><span class="gx-k">Icon-only (aria-label)</span>
        <Button icon={help} ariaLabel="Help" variant="quiet" />
        <Button icon={dots} ariaLabel="More actions" />
      </div>
      <div class="gx-row"><span class="gx-k">Large</span>
        <Button label="Read the results" variant="primary" lg />
        <Button label="Large secondary" lg />
      </div>
      <div class="gx-row"><span class="gx-k">Link</span>
        <Button label="Plan the next step" href="#top" />
        <Button label="Quiet link" variant="quiet" href="#top" />
      </div>
      <div class="gx-row gx-block"><span class="gx-k">Block</span>
        <Button label="Next" variant="primary" block />
        <Button label="Back" block />
      </div>

      <h3 class="gx-h">Stage pill</h3>
      <div class="gx-row"><span class="gx-k">Stages</span>
        {#each STAGES as stage}<Pill {stage} />{/each}
      </div>
      <div class="gx-row"><span class="gx-k">Beside a title</span>
        <span class="gx-title"><strong>Example review</strong><Pill stage="collecting" /></span>
      </div>

      <h3 class="gx-h">Lens dot</h3>
      <div class="gx-row"><span class="gx-k">Dot with visible name (decorative)</span>
        {#each Object.entries(LENSES) as [lens, name]}<span class="gx-legend"><LensDot {lens} decorative />{name}</span>{/each}
      </div>
      <div class="gx-row"><span class="gx-k">Standalone dot (named)</span>
        {#each Object.keys(LENSES) as lens}<LensDot {lens} />{/each}
        <LensDot lens="team" label="Translation team: 18 answers" />
      </div>
      <div class="gx-row gx-pts"><span class="gx-k">Point (colour binding only; size is gallery scaffolding)</span>
        {#each Object.keys(LENSES) as lens}<LensDot kind="pt" {lens} />{/each}
      </div>
    </section>
  {/each}
</main>
