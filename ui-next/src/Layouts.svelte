<!-- UI Next (v4) /next/?page=layouts gallery page: reproduces the cookbook Layouts spec board (design-system.md section 8)
     with the real primitives: nested outlined levels, the spacing ruler, the page-width bars; desktop and phone, light and dark.
     Status: provisional. Light DOM, no <style>, no inline style (gallery.css carries the drawing classes). -->
<script>
  import AppShell from "./AppShell.svelte";
  import Page from "./Page.svelte";
  import Section from "./Section.svelte";
  import Card from "./Card.svelte";
  import Stack from "./Stack.svelte";
  import Row from "./Row.svelte";
  import Grid from "./Grid.svelte";
  import LayoutsTree from "./LayoutsTree.svelte";

  const STEPS = [[1, 4], [2, 8], [3, 12], [4, 16], [5, 24], [6, 32], [7, 48]];
  const WIDTHS = [["max", "Page", "--page-max · 1120px"], ["narrow", "Narrow (setup, forms)", "--page-max-narrow · 880px"], ["read", "Read (dialogs, text)", "--page-max-read · 520px"]];
  const MODES = ["both", "light", "dark"];
  let { mode = "both", phone = false } = $props();
  const themes = $derived(mode === "both" ? ["light", "dark"] : [mode]);
  const LEGEND = [["shell", "AppShell"], ["page", "Page"], ["section", "Section"], ["card", "Card"], ["axis", "Stack · Row · Grid"]];
</script>

<header class="gx-bar">
  <strong>UI Next gallery · Layouts</strong>
  <nav class="gx-toggle" aria-label="Gallery pages"><a class="gx-tab" href="?page=components">Components</a><a class="gx-tab" href="?page=layouts" aria-current="page">Layouts</a><a class="gx-tab" href="?page=home">Home parts</a></nav>
  <div class="gx-toggle" role="group" aria-label="Theme">
    {#each MODES as m}
      <button type="button" class="gx-tab" aria-pressed={mode === m ? "true" : "false"} onclick={() => (mode = m)}>{m}</button>
    {/each}
  </div>
  <div class="gx-toggle" role="group" aria-label="Width">
    <button type="button" class="gx-tab" aria-pressed={phone ? "false" : "true"} onclick={() => (phone = false)}>desktop</button>
    <button type="button" class="gx-tab" aria-pressed={phone ? "true" : "false"} onclick={() => (phone = true)}>phone</button>
  </div>
</header>

<div class="gx-grid" data-mode={mode}>
  {#each themes as theme (theme)}
    <div class="gx-lay" aria-label={`Layouts, ${theme} theme`}>
      <AppShell {theme} {phone}>
        <Page gap={6}>
          <Section heading="§8 Layouts" help="Every screen is the same five boxes. AppShell holds a Page; a Page holds Sections; a Section holds Cards; a Card holds Stacks, Rows and Grids. Siblings are spaced by the parent's gap, never a margin. Status: provisional.">
            <Row gap={5}>
              {#each LEGEND as [lv, name]}<Row gap={2}><span class="gx-sw" data-lv={lv}></span><span class="small">{name}</span></Row>{/each}
            </Row>
          </Section>
          <Section heading={phone ? "Phone · nesting tree" : "Desktop · nesting tree"} level={3}>
            <LayoutsTree {phone} />
          </Section>
          <Grid cols={phone ? undefined : 2} gap={5}>
            <Card gap={3}>
              <Section heading="Spacing scale" help="Layout space only (§8.2). Component-internal spacing stays a component token." level={3}>
                <Stack gap={2}>
                  {#each STEPS as [n, px]}<Row gap={3}><span class="kbd gx-k8">--sp-{n}</span><span class="gx-ruler" data-sp={n}></span><span class="micro">{px}px</span></Row>{/each}
                </Stack>
              </Section>
            </Card>
            <Card gap={3}>
              <Section heading="Page widths" help="Desktop widths, drawn to scale against 1120. On a phone all three are 100% minus the 16px gutter." level={3}>
                <Stack gap={3}>
                  {#each WIDTHS as [w, name, tok]}<Stack gap={1}><span class="small">{name}</span><span class="gx-wbar" data-w={w}><span class="micro">{tok}</span></span></Stack>{/each}
                </Stack>
              </Section>
            </Card>
          </Grid>
        </Page>
      </AppShell>
    </div>
  {/each}
</div>
