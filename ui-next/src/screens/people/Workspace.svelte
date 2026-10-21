<!-- UI Next (v4) Workspace screen (one organisation's projects). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Workspace.dc.html + WorkspacePhone.dc.html (screen workspace),
     WorkspaceGroup.dc.html + WorkspaceGroupPhone.dc.html (group = true, screen workspace-group via WorkspaceGroup.svelte).
     Composed of AppShell > Page > Card / Stack / Row / Grid and the section 2 components, plus contract rows the shared components do
     not take as props yet (.l-grid[data-cols="5"], .num[data-size], .av[data-size|logo], .seg[data-size=wide], .in-search,
     .l-row[data-justify=end], [data-grow], .list-row, .icn[data-size][data-tone], .sheet-handle: base.css at the PIN). The 28px lens
     chip is .icn.icn-lens.su-icn-s, the folded name of .icn[data-size="28"] that keeps the --lens icon the board draws; no <style>.
     Data: ui-next/fixtures/people/workspace.json; the group dialog's rows go through ui/workspace-manager.js mayGroup() (./people-data.js).
     One .btn-primary per page: "New project" (desktop page head; phone: the phone-bar). With the group dialog open the dialog's
     "Add to workspace" is the one primary and New project is demoted (Dialog and sheet states: one primary). The dialog is a native
     <dialog class="glass-hi"> opened with showModal() (design-system.md Dialog and sheet states): the dialog.glass-hi rows give the
     opaque --dialog fill, the 560px geometry and the --scrim ::backdrop; on phone dialog.glass-hi.sheet anchors it to the bottom over the
     demoted phone-bar. Escape (the dialog's close event) does what Cancel does: the dialog goes, New project is the primary again and
     the address becomes the workspace screen's. The search field's size is the placeholder's length, so the field shows all of it
     (the board's 260px has no width row yet). Links: ../href.js (carries w and theme), other lanes' screens by their registered names (project, setup1, menu);
     test/ui-next-links.test.ts passes once those lanes merge. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Pill, { STAGE_LABELS } from "../../Pill.svelte";
  import Tag from "../../Tag.svelte";
  import Level from "../../Level.svelte";
  import { LENSES } from "../../LensDot.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { href } from "../href.js";
  import { P } from "./people-icons.js";
  import { groupRows } from "./people-data.js";
  import d from "../../../fixtures/people/workspace.json";

  // ?state=: no board draws one, so any value (the route passes it as state) renders the default; the prop is not read.
  let { group = false, phone = false, theme = "light" } = $props();
  const LENS_ICON = { team: I.pen, community: I.people, church: P.church };
  const HOME = href("home"), PEOPLE = href("people-workspace"), BACK = href("workspace");
  const PROJECT = href("project"), SETUP = href("setup1"), MENU = href("menu");
  const rows = groupRows(d.group);
  const FIND = "Find a project or language";
  // Escape closes the native modal (close event): drop the dialog and restore New project as the primary, at the Cancel target's address.
  let closed = $state(false);
  const open = $derived(group && !closed);
  const onclose = () => {
    closed = true;
    try { globalThis.history?.replaceState(globalThis.history.state, "", BACK); } catch { /* no history: the page state alone changes */ }
  };
  // Native modal dialog (design-system.md Dialog and sheet states): showModal() gives the top layer, the inert page and focus.
  const modal = (el) => {
    if (typeof el.showModal === "function" && !el.open) { try { el.showModal(); return; } catch { /* not connected: fall back to open */ } }
    el.setAttribute("open", "");
  };
</script>

{#snippet plus()}<Icon d={I.plus} />{/snippet}
{#snippet people()}<Icon d={I.people} />{/snippet}
{#snippet chev()}<Icon d={I.chev} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={d.user.initials} home={HOME} menuHref={MENU} />{:else}<TopBar who={d.user.first} initials={d.user.initials} workspace={d.short} home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}{#if open}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="New project" lg block href={SETUP} lead={plus} /></div>{:else}<PhoneBar label="New project" lead="plus" href={SETUP} />{/if}{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">{d.short}</h1>
    <Row gap={2}><Button label="People" href={PEOPLE} lead={people} block /><Button label="Switch workspace" href={MENU} lead={chev} block /></Row>
    <section class="glass l-card" data-pad="list" aria-label={`Projects · ${d.projects.length}`}>
      <span class="micro">Projects · {d.projects.length}</span>
      {#each d.projects as p}
        <a class="card-link list-row" href={PROJECT}>
          <span class="icn" data-size="36" data-tone="neutral" aria-hidden="true"><Icon d={P.file} /></span>
          <div class="list-body"><div class="list-title">{p.title}</div><div class="small">{STAGE_LABELS[p.stage]} · {p.phone}</div></div>
          <Pill stage={p.stage} />
        </a>
      {/each}
    </section>
    <a class="link" href={HOME}>Your reviews across workspaces <Icon d={I.arrow} /></a>
  {:else}
    <Page gap={5}>
      <Row split gap={4}>
        <div><span class="micro">Workspace</span><h1 class="title-page">{d.name}</h1><p class="small t-15">{d.lead}</p></div>
        <Row gap={2}><Button label="People in this workspace" href={PEOPLE} lead={people} /><Button label="New project" variant={open ? "secondary" : "primary"} href={SETUP} lead={plus} /></Row>
      </Row>
      <div class="l-grid" data-cols="5" data-gap="3">
        {#each d.stats as [label, n]}<Card gap={1} {label}><span class="small">{label}</span><span class="num" data-size="36">{n}</span></Card>{/each}
      </div>
      <Row split gap={3}>
        <h2 class="h2">Projects</h2>
        <Row gap={3}>
          <div class="seg" data-size="wide" role="radiogroup" aria-label="Show projects">{#each d.views as v, i}<label><input type="radio" name="ws-view" checked={i === 0} />{v}</label>{/each}</div>
          <span class="in-search"><Icon d={P.search} /><input class="in" type="search" aria-label="Find a project" placeholder={FIND} size={FIND.length} /></span>
        </Row>
      </Row>
      <Grid cols={2} gap={4}>
        {#each d.projects as p}
          <Card href={PROJECT} gap={4}>
            <Row split gap={3}><Row gap={3}><h3 class="h2">{p.title}</h3><Pill stage={p.stage} /></Row><span class="go" aria-hidden="true"><Icon d={I.arrow} /></span></Row>
            <Row split gap={4}>
              <Row wrap gap={4}><span class="small l-row" data-gap="1" title="Language"><Icon d={I.globe} />{p.language}</span><span class="small l-row" data-gap="1" title="Translation format"><Icon d={P[p.formatIcon]} />{p.format}</span></Row>
              <span class="l-row" data-gap="1" role="img" aria-label={`Organisations: ${p.orgs.map(([o]) => o).join(", ")}`}>{#each p.orgs as [org, logo]}<span class="av" data-size="28" data-logo={logo ? "" : undefined} title={org} aria-hidden="true">{logo ? "logo" : org.slice(0, 1)}</span>{/each}</span>
            </Row>
            <Row split gap={4}>
              <Row gap={6}>
                <span class="l-row" data-gap="2" title="Reviews" aria-label={`Reviews: ${p.reviews}`}><Icon d={P.reviews} /><span class="num" data-size="20">{p.reviews}</span></span>
                <span class="l-row" data-gap="2" title="Responses" aria-label={`Responses: ${p.responses}`}><Icon d={I.people} /><span class="num" data-size="20">{p.responses}</span></span>
              </Row>
              <span class="small l-row" data-gap="1" title="Last activity"><Icon d={I.clock} />{p.activity}</span>
            </Row>
            <hr class="hr" />
            {#if p.levels}
              <Grid cols={3} gap={3}>{#each p.levels as [lens, level]}<Row gap={2}><span class="icn icn-lens su-icn-s" data-lens={lens} role="img" aria-label={LENSES[lens]}><Icon d={LENS_ICON[lens]} /></span><Level {level} /></Row>{/each}</Grid>
            {:else}
              <span class="small l-row" data-gap="2"><Icon d={I.clock} />No results yet</span>
            {/if}
          </Card>
        {/each}
      </Grid>
      <p class="small">Looking for your own reviews across projects? <a class="link" href={HOME}>Your reviews</a> lists everything you facilitate.</p>
    </Page>
  {/if}
  {#if open}
    <dialog class={phone ? "glass-hi sheet" : "glass-hi"} aria-labelledby="ws-group-title" {onclose} {@attach modal}>
      <Stack gap={phone ? 3 : 4}>
        {#if phone}<span class="sheet-handle" aria-hidden="true"></span><span class="micro" id="ws-group-title">Add a project to this workspace</span>
          <p class="small">Only a <b>direct project owner</b> can group a project. Everyone in the workspace then opens it at their workspace role.</p>
        {:else}<h2 class="h2" id="ws-group-title">Add a project to this workspace</h2>
          <p class="small">Everyone in the workspace opens it at their workspace role, unless they already hold a higher project grant. Only a <b>direct project owner</b> can group it; a role inherited from a workspace is never enough.</p>{/if}
        <div class="l-stack" data-gap="2" role="radiogroup" aria-label="Projects you own">
          {#each rows as c, i}
            <label class="row-opt"><input class="rd" type="radio" name="ws-group" checked={i === 0} disabled={!c.can} /><span class="l-stack" data-gap="1" data-grow=""><b>{c.title}</b><span class="small">{c.can ? "You own this project directly" : phone ? "Cannot group: your access comes from the workspace, not a project grant" : "Your access here comes from the workspace, not a project grant"}</span></span>{#if !phone}<Tag label={c.can ? "Direct owner" : "Inherited · cannot group"} />{/if}</label>
          {/each}
        </div>
        {#if phone}
          <Row gap={2}><Button label="Cancel" variant="quiet" href={BACK} block /><Button label="Add to workspace" variant="primary" href={BACK} lead={plus} block /></Row>
        {:else}
          <div class="l-row" data-gap="2" data-justify="end"><Button label="Cancel" variant="quiet" href={BACK} /><Button label="Add to workspace" variant="primary" href={BACK} lead={plus} /></div>
        {/if}
      </Stack>
    </dialog>
  {/if}
</AppShell>
