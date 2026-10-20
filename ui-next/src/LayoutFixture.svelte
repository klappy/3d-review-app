<!-- Test fixture only: a Card inside a Grid inside a Section inside a Page inside an AppShell. Status: provisional. -->
<script>
  import AppShell from "./AppShell.svelte";
  import Page from "./Page.svelte";
  import Section from "./Section.svelte";
  import Card from "./Card.svelte";
  import Stack from "./Stack.svelte";
  import Row from "./Row.svelte";
  import Grid from "./Grid.svelte";
  let { phone = false } = $props();
</script>

<AppShell theme="dark" {phone}>
  <Page width="narrow" gap={6}>
    <Section heading="Projects" help="Help line">
      <Grid cols={2} gap={4}>
        <Card><Stack gap={2}><span>a</span><span>b</span></Stack></Card>
        <Card hi gap={5}><Row gap={3}><span>c</span><span>d</span></Row></Card>
      </Grid>
    </Section>
  </Page>
</AppShell>
