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
     shared PhoneBar's demoted variant (registry; VALIDATION-people-r4.md C6). Escape (the dialog's close event) does what Cancel does: the dialog goes, New project is the primary again and
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
  import Coverage from "../results/Coverage.svelte";
  import { LENSES } from "../../LensDot.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { href } from "../href.js";
  import { P } from "./people-icons.js";
  import { groupRows } from "./people-data.js";
  import { workspaceProjects } from "../../app/workspace-actions.js";
  import fixture from "../../../fixtures/people/workspace.json";

  // ?state=: no board draws one, so any value (the route passes it as state) renders the default; the prop is not read.
  // data: the fixture, or the live workspace in the same shape (app/data.js workspaceModel); ongroup (live): groups the picked project
  // for real (POST /v2/workspaces/{id}/projects/{pid}) when the dialog's primary is pressed; without it the primary stays the board's link.
  let { group = false, phone = false, theme = "light", data = fixture, ongroup, onrename, onungroup, undo = null, onundo } = $props();
  const d = $derived(data);
  let query = $state("");
  let view = $state("Active");
  const visible = $derived(workspaceProjects(d.projects, query, view));
  let edit = $state(null);
  let name = $state("");
  let busy = $state(false);
  let message = $state("");
  let mustReload = $state(false);
  const beginRename = () => { name = d.name; message = ""; edit = { kind: "rename" }; };
  const beginUngroup = (project) => { message = ""; edit = { kind: "ungroup", project }; };
  async function save() {
    if (busy || mustReload || !edit) return;
    busy = true; message = "";
    try {
      if (edit.kind === "rename") await onrename(name);
      else await onungroup(edit.project);
      edit = null;
      message = "Saved and verified.";
    } catch (e) { message = `${e.message || "The change could not be confirmed."} Reload before trying again if the outcome is uncertain.`; mustReload = true; }
    finally { busy = false; }
  }
  async function undoRename() {
    if (busy || mustReload || !undo || undo.used) return;
    busy = true;
    try { await onundo(undo); message = "Workspace name restored and verified."; }
    catch(e) { message = `${e.message || "The undo could not be confirmed."} Reload before trying again.`; mustReload = true; }
    finally { busy = false; }
  }
  const canUngroup = (p) => !!onungroup && (d.role === "owner" || (d.role === "member" && p.directRole === "owner"));
  const LENS_ICON = { team: I.pen, community: I.people, church: P.church };
  const HOME = href("home"), PEOPLE = href("people-workspace"), BACK = href("workspace");
  const PROJECT = href("project"), SETUP = href("setup1"), MENU = href("menu");
  const rows = $derived(groupRows(d.group));
  let picked = $state(null);
  const selectedRow = $derived(rows.find((c) => c.can && (c.id ?? c.title) === picked) ?? rows.find((c) => c.can));
  const selected = $derived(selectedRow?.id ?? selectedRow?.title ?? null);
  const grouping = (el) => { const f = (e) => { if (ongroup && e.target instanceof Element && e.target.closest(".btn-primary") && selected != null) { e.preventDefault(); ongroup(selected); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
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
{#snippet bar()}{#if phone}<PhoneBar label="New project" lead="plus" href={SETUP} demoted={open} />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if onrename && d.role === "owner"}<button class="btn btn-quiet" type="button" onclick={beginRename} disabled={busy || mustReload}>Rename workspace</button>{/if}
  {#if phone}<label class="lbl">Find a project<input class="in" type="search" bind:value={query} /></label><label class="lbl">Show projects<select class="in" bind:value={view}>{#each d.views as v}<option>{v}</option>{/each}</select></label>{/if}
  {#if undo && !undo.used && onundo}<button class="btn" type="button" onclick={undoRename} disabled={busy || mustReload}>Undo workspace rename</button>{/if}
  {#if !visible.length}<p class="small" role="status">No projects match this view.</p>{/if}
  {#if message}<p class="small" role="status">{message}</p>{/if}
  {#if edit}
    <section class="glass-hi l-card l-stack" data-pad="work" data-gap="3" aria-label={edit.kind === "rename" ? "Rename workspace" : "Remove project from workspace"}>
      {#if edit.kind === "rename"}<label class="lbl">Workspace name<input class="in" bind:value={name} disabled={busy} /></label>
      {:else}<h2 class="h3">Remove {edit.project.title} from {d.name}?</h2><p class="small">The project and its reviews remain. People whose access comes only from this workspace lose that access. Direct project grants remain.</p>{/if}
      <Row wrap gap={2}><button class="btn" type="button" onclick={save} disabled={busy || mustReload}>{busy ? "Saving…" : edit.kind === "rename" ? "Save workspace name" : "Confirm removal"}</button><button class="btn btn-quiet" type="button" disabled={busy} onclick={() => { edit = null; message = ""; }}>Cancel</button></Row>
    </section>
  {/if}
  {#if phone}
    <h1 class="title-phone">{d.short}</h1>
    <Row gap={2}><Button label="People" href={PEOPLE} lead={people} block /><Button label="Switch workspace" href={MENU} lead={chev} block /></Row>
    <section class="glass l-card" data-pad="list" aria-label={`Projects · ${d.projects.length}`}>
      <span class="micro">Projects · {d.projects.length}</span>
      {#each visible as p}
        <a class="card-link list-row" href={p.href ?? PROJECT}>
          <span class="icn" data-size="36" data-tone="neutral" aria-hidden="true"><Icon d={P.file} /></span>
          <div class="list-body"><div class="list-title">{p.title}</div><div class="small">{STAGE_LABELS[p.stage]} · {p.phone}</div></div>
          <Pill stage={p.stage} />
        </a>
        {#if canUngroup(p)}<Row wrap gap={2}><button class="btn btn-quiet" type="button" aria-label={`Remove project ${p.title} from workspace`} onclick={() => beginUngroup(p)} disabled={busy || mustReload}>Remove project</button></Row>{/if}
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
          <div class="seg" data-size="wide" role="radiogroup" aria-label="Show projects">{#each d.views as v, i}<label><input type="radio" name="ws-view" checked={view === v} onchange={() => view = v} />{v}</label>{/each}</div>
          <span class="in-search"><Icon d={P.search} /><input class="in" type="search" aria-label="Find a project" bind:value={query} placeholder={FIND} size={FIND.length} /></span>
        </Row>
      </Row>
      <Grid cols={2} gap={4}>
        {#each visible as p}
          <Stack gap={2}>
          <Card href={p.href ?? PROJECT} gap={4}>
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
              <Grid cols={3} gap={3}>{#each p.levels as [lens, level, n]}<Row gap={2}><span class="icn icn-lens su-icn-s" data-lens={lens} role="img" aria-label={LENSES[lens]}><Icon d={LENS_ICON[lens]} /></span><Stack gap={1}><Level {level} /><Coverage {n} variant="count" /></Stack></Row>{/each}</Grid>
            {:else}
              <span class="small l-row" data-gap="2"><Icon d={I.clock} />No results yet</span>
            {/if}
          </Card>
          {#if canUngroup(p)}<Row wrap gap={2}><button class="btn btn-quiet" type="button" aria-label={`Remove project ${p.title} from workspace`} onclick={() => beginUngroup(p)} disabled={busy || mustReload}>Remove project</button></Row>{/if}
          </Stack>
        {/each}
      </Grid>
      <p class="small">Looking for your own reviews across projects? <a class="link" href={HOME}>Your reviews</a> lists everything you facilitate.</p>
    </Page>
  {/if}
  {#if open}
    <dialog class={phone ? "glass-hi sheet" : "glass-hi"} aria-labelledby="ws-group-title" {onclose} {@attach modal} {@attach grouping}>
      <Stack gap={phone ? 3 : 4}>
        {#if phone}<span class="sheet-handle" aria-hidden="true"></span><span class="micro" id="ws-group-title">Add a project to this workspace</span>
          <p class="small">You must directly own the project and <b>every review</b> it contains, including archived reviews. Everyone in the workspace then opens them at their workspace role.</p>
        {:else}<h2 class="h2" id="ws-group-title">Add a project to this workspace</h2>
          <p class="small">Everyone in the workspace opens the project and its reviews at their workspace role, unless they already hold a higher grant. You must directly own the project and <b>every review</b> it contains, including archived reviews; inherited access is not enough.</p>{/if}
        <div class="l-stack" data-gap="2" role="radiogroup" aria-label="Projects you own">
          {#each rows as c, i}
            <label class="row-opt"><input class="rd" type="radio" name="ws-group" value={c.id ?? c.title} checked={(c.id ?? c.title) === selected} disabled={!c.can} onchange={() => { picked = c.id ?? c.title; }} /><span class="l-stack" data-gap="1" data-grow=""><b>{c.title}</b><span class="small">{c.reason}</span></span>{#if !phone}<Tag label={c.can ? "Direct owner" : c.directRole == null ? "Inherited · cannot group" : "Cannot group"} />{/if}</label>
          {/each}
        </div>
        {#if phone}
          <Row gap={2}><Button label="Cancel" variant="quiet" href={BACK} block /><Button label="Add to workspace" variant="primary" href={selected == null ? undefined : BACK} disabled={selected == null} lead={plus} block /></Row>
        {:else}
          <div class="l-row" data-gap="2" data-justify="end"><Button label="Cancel" variant="quiet" href={BACK} /><Button label="Add to workspace" variant="primary" href={selected == null ? undefined : BACK} disabled={selected == null} lead={plus} /></div>
        {/if}
      </Stack>
    </dialog>
  {/if}
</AppShell>
