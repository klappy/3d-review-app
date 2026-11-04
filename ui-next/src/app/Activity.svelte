<script>
  import AppShell from '../AppShell.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import { to } from './router.js';
  let { phone = false, theme = 'light', entries = [], onrefresh } = $props();
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Request activity" parent="Home" back={to('home')} menuHref={to('menu')} />{:else}<TopBar home={to('home')} crumbs={[{ label: 'Request activity' }]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}><Page gap={4}>
  <h1 class="title-page">Request activity</h1>
  <p class="small">Recent server receipts observed in this tab for your current sign-in. This is not a complete account history. Message contents and credentials are not recorded here.</p>
  <button class="btn" type="button" onclick={onrefresh}>Refresh activity</button>
  {#each entries as entry}<Card gap={2} label="Request receipt"><p class="small">{entry.at} · {entry.capability || entry.kind} · {entry.scope}</p><details><summary>Receipt and trace details</summary><p class="small">Receipt: {entry.receipt}</p><p class="small">Trace: {entry.trace || 'Not returned'}</p></details></Card>{/each}
  {#if !entries.length}<p class="small">No receipts have been observed in this tab yet.</p>{/if}
</Page></AppShell>
