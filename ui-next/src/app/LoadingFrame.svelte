<!-- Neutral pending content: no cached review, counts or workspace names. Static shapes avoid motion in every preference mode. -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Card from "../Card.svelte";
  import Grid from "../Grid.svelte";
  import Chrome from "./Chrome.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import TopBar from "../TopBar.svelte";
  import "../../components/loading.css";
  let { phone = false, theme = "light", chrome = null, kind = "page" } = $props();
  const report = $derived(["results", "results-held", "results-gaps", "results-answers", "report", "report-detailed", "next-step", "action-plan"].includes(kind));
  const label = $derived(report ? "Loading review content…" : "Loading content…");
</script>

{#snippet top()}
  {#if chrome?.session}<Chrome {chrome} />
  {:else if phone}<PhoneHeader state="public" signIn={false} home="#/home" initials="" />
  {:else}<TopBar variant="public" end={false} home="#/home" />{/if}
{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page gap={4}>
    <p class="small" role="status" aria-live="polite" aria-atomic="true">{label}</p>
    <section class="loading-content l-stack" data-gap="4" aria-busy="true" aria-label="Loading content" data-loading-frame>
      <div class="loading-shapes l-stack" data-gap="4" aria-hidden="true" inert>
        <div class="l-stack" data-gap="2"><div class="loading-bar loading-title"></div><div class="loading-bar loading-subtitle"></div></div>
        {#if report}
          <Grid cols={phone ? undefined : 3} gap={3}>
            {#each [1, 2, 3] as n (n)}<Card gap={3}><div class="loading-bar loading-subtitle"></div><div class="loading-bar loading-value"></div><div class="loading-bar"></div><div class="loading-bar loading-short"></div></Card>{/each}
          </Grid>
        {/if}
        <Card gap={3}><div class="loading-bar loading-subtitle"></div>{#each [1, 2, 3] as n (n)}<div class="loading-bar"></div><div class="loading-bar loading-short"></div>{/each}</Card>
      </div>
    </section>
  </Page>
</AppShell>
