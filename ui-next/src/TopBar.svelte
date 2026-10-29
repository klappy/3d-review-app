<!-- UI Next (v4) Top bar. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 2 Top bar row + "Top bar variants and breadcrumb" (R12): .top[data-variant];
     signed-in = brand → workspace switcher (details.dd) → .crumb → ? help → account menu; public = brand → Help and FAQ (quiet) + Sign in.
     Breadcrumb per WAI-ARIA APG: nav[aria-label=Breadcrumb] > ol, earlier items a.link, last a span[aria-current=page]. Desktop only (8.4). -->
<script>
  import Mark from "./Mark.svelte";
  import Menu from "./Menu.svelte";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import { I, accountItems } from "./icons.js";
  import { liveChrome } from "./app/chrome.js";
  const VARIANTS = ["signed-in", "public"];
  // Live (app/chrome.js): the real account, workspace and menu are the defaults; the boards' values apply only with no live chrome.
  const L = liveChrome();
  let { variant = "signed-in", crumbs = [], who = L?.who ?? "Bincy", initials = L?.initials ?? "BK", workspace = L?.workspace ?? "BCS · India", workspaces = L?.workspaces ?? ["BCS · India", "Seed Company · partners"], accountOpen = false, workspaceOpen = false, home = L?.home ?? "#home", end = true, accountItems: acctOverride = L?.accountItems, workspaceItems = L?.workspaceItems } = $props();
  if (!VARIANTS.includes(variant)) throw new TypeError(`TopBar: unknown variant "${variant}" (flow, document and room are not ported yet)`);
  if (variant === "public" && crumbs.length) throw new TypeError("TopBar: the public variant has no breadcrumb");
  const acctItems = $derived(acctOverride ?? accountItems()); // live mode passes the real account; the gallery builds the fixture menu
  const wsItems = $derived(workspaceItems ?? [{ kind: "micro", label: "Your workspaces" }, ...workspaces.map((w) => ({ label: w, href: "#workspace" }))]);
</script>

{#snippet help()}<Icon d={I.help} />{/snippet}
{#snippet acct()}<span class="av" aria-hidden="true">{initials}</span>{who}<Icon d={I.chev} />{/snippet}
{#snippet ws()}<span class="av" aria-hidden="true">{workspace.slice(0, 1)}</span>{workspace}<Icon d={I.chev} />{/snippet}

<header class="top" data-variant={variant}>
  <a class="brand" href={home}><Mark /><span>3D Review</span></a>
  {#if variant === "signed-in"}
    <Menu id="ws" summary={ws} title="Switch workspace" label={`Workspace: ${workspace}`} items={wsItems} align="start" open={workspaceOpen} />
    {#if crumbs.length}
      <nav class="crumb" aria-label="Breadcrumb"><ol>
        {#each crumbs as c, i}
          <li>{#if i < crumbs.length - 1}<a class="link" href={c.href} title={c.label}>{c.label}</a>{:else}<span aria-current="page" title={c.label}>{c.label}</span>{/if}</li>
        {/each}
      </ol></nav>
    {/if}
    {#if end}<div class="top-end">
      <Button icon={help} ariaLabel="Help" variant="quiet" href="#help" />
      <Menu id="acct" summary={acct} title="Account menu" label={`Account menu, ${who}`} items={acctItems} open={accountOpen} />
    </div>{/if}
  {:else}
    <div class="top-end">
      <Button label="Help and FAQ" variant="quiet" href="#help" />
      <Button label="Sign in" href="#signin" />
    </div>
  {/if}
</header>
