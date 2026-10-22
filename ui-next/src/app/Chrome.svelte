<!-- UI Next (v4) live chrome: the signed-in TopBar / PhoneHeader with the real account, breadcrumbs and workspace. Status: provisional. -->
<script>
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import { to } from "./router.js";
  let { chrome, crumbs = [], title, parent = "Home", back = to("home"), workspace = "Your workspace", workspaces = [] } = $props();
  const nested = $derived(!!title);
  const wsItems = $derived([{ kind: "micro", label: "Your workspaces" }, ...workspaces.map((w) => ({ label: w.name, href: to("home") }))]);
</script>

{#if chrome.phone}
  {#if nested}<PhoneHeader state="nested" {title} {parent} {back} menuHref={to("menu")} initials={chrome.who?.initials ?? ""} home={to("home")} />
  {:else}<PhoneHeader state="root" initials={chrome.who?.initials ?? ""} menuHref={to("menu")} home={to("home")} />{/if}
{:else}
  <TopBar {crumbs} who={chrome.who?.first ?? "You"} initials={chrome.who?.initials ?? ""} {workspace} workspaces={workspaces.map((w) => w.name)} workspaceItems={wsItems} home={to("home")} accountItems={chrome.accountItems} />
{/if}
