<!-- UI Next (v4) live "Not built yet" page (live QA N1): the signed-in shell (app/Chrome.svelte top bar or phone header), a card with the
     state and its way back, and the build action and its confirm (Live's snippet) inside the same .app, so they take the kit's styles and
     focus ring. Status: provisional. Light DOM, no <style>, no inline style. -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Card from "../Card.svelte";
  import Row from "../Row.svelte";
  import Button from "../Button.svelte";
  import Chrome from "./Chrome.svelte";
  let { chrome, theme = "light", phone = false, crumbs = [], message, context = null, back, backLabel, children } = $props();
</script>

{#snippet top()}<Chrome {chrome} {crumbs} />{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page width="read" gap={4}>
    <Card hi pad="hero" gap={3} label="Not built yet">
      <h1 class="title-phone">Not built yet</h1>
      {#if context}<p class="small t-15">{context.context}</p><p class="small t-15" role="status">{context.message}</p>{#if context.guidance}<p class="small t-15">{context.guidance}</p>{/if}{#if message}<p class="small t-15">{message}</p>{/if}{:else}<p class="small t-15" role="status">{message}</p>{/if}
      {@render children?.()}
      {#if back}<Row gap={2}><Button label={backLabel} variant="quiet" href={back} /></Row>{/if}
    </Card>
  </Page>
</AppShell>
