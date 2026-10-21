<!-- UI Next (v4) Layouts gallery: the 8.1 nesting tree drawn with the real primitives inside outlined levels. Status: provisional. -->
<script>
  import Page from "./Page.svelte";
  import Section from "./Section.svelte";
  import Card from "./Card.svelte";
  import Stack from "./Stack.svelte";
  import Row from "./Row.svelte";
  import Grid from "./Grid.svelte";
  import Button from "./Button.svelte";
  import Level from "./LayoutsLevel.svelte";
  let { phone = false } = $props();
</script>

<Level lv="shell" name="AppShell" cls=".app > .layer" note="theme, aurora, top bar or phone header + phone-bar">
  <Level lv="page" name="Page" cls=".l-page" note={phone ? "--gutter 16 · max 100%" : "--gutter 32 · --page-max 1120"}>
    <Page>
      <Level lv="section" name="Section" cls=".l-section">
        <Section heading="Section heading" help="Help line, then the body. Gap --sp-4." level={3}>
          <Level lv="card" name="Card" cls=".glass">
            <Card gap={4}>
              <Level lv="axis" name="Stack · Row · Grid" cls=".l-stack / .l-row / .l-grid">
                <Stack gap={2}><span class="chip">Field</span><span class="chip">Field</span><span class="chip">Option row</span></Stack>
              </Level>
              <Level lv="axis" name="Stack · Row · Grid" cls=".l-stack / .l-row / .l-grid">
                <Row gap={3}><Button label="Back" variant="quiet" /><Button label="Next" /></Row>
              </Level>
              <Level lv="axis" name="Stack · Row · Grid" cls=".l-stack / .l-row / .l-grid">
                <Grid cols={3} gap={3}><span class="chip">Cell 1</span><span class="chip">Cell 2</span><span class="chip">Cell 3</span></Grid>
              </Level>
            </Card>
          </Level>
        </Section>
      </Level>
      <Level lv="section" name="Section" cls=".l-section">
        <Section heading="Second section" help="Page gap --sp-5 spaces the sections; no margins." level={3} />
      </Level>
    </Page>
  </Level>
</Level>
