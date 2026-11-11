<!-- UI Next (v4) live status screens: loading, empty, error (with Retry), refused, held, not built and unavailable. Status: provisional.
     One place for every non-data state so each lane screen draws only data (design-system.md §2 Card, Button). -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Card from "../Card.svelte";
  import Row from "../Row.svelte";
  import Button from "../Button.svelte";
  let { phone = false, theme = "light", kind = "loading", message = "", onretry, back, backLabel = "Home", inline = false } = $props();
  const TITLE = { loading: "Loading…", empty: "Nothing here yet", failed: "Something went wrong", refused: "Not visible to you", not_built: "Not built yet", held: "Held by policy", unavailable: "Not available yet" };
  const retryable = $derived(!!onretry && kind !== "loading");
  const title = $derived(TITLE[kind] ?? TITLE.failed);
  const text = $derived(message || (kind === "loading" ? "Reading from the server." : kind === "refused" ? "Either this does not exist or your account has no role on it. Ask an owner to invite you." : kind === "failed" ? "The server could not be reached or did not answer." : ""));
</script>

{#snippet retryBar()}
  <div class="glass phone-bar" role="group" aria-label="Page actions">
    {#if back}<Button label={backLabel} variant="quiet" href={back} />{/if}
    <button class="btn btn-primary btn-lg" type="button" onclick={onretry}>Retry</button>
  </div>
{/snippet}

{#if inline}
  <div class="app" data-theme={theme} data-w={phone ? "phone" : undefined}><div class="layer"><main class={phone ? "l-page l-phone" : "l-main"}><Card gap={2} label={title}><span class="micro">{title}</span><p class="small" role="status">{text}</p>{#if back}<Row gap={2}><Button label={backLabel} variant="quiet" href={back} /></Row>{/if}</Card></main></div></div>
{:else}
  <AppShell {phone} {theme} screen bar={phone && retryable ? retryBar : undefined}>
    <Page width="read" gap={4}>
      <Card hi pad="hero" gap={3}>
        <Row split gap={3}>
          <h1 class="title-phone" aria-live="polite">{title}</h1>
          {#if !phone && retryable}<button class="btn btn-primary" type="button" onclick={onretry}>Retry</button>{/if}
        </Row>
        <p class="small t-15" role="status">{text}</p>
        {#if back && !(phone && retryable)}<Row gap={2}><Button label={backLabel} variant="quiet" href={back} /></Row>{/if}
      </Card>
    </Page>
  </AppShell>
{/if}
