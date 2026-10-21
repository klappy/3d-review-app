<!-- UI Next (v4) People screen ("People with access"). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): People.dc.html + PeoplePhone.dc.html (scope "review", screen people),
     PeopleWorkspace.dc.html + PeopleWorkspacePhone.dc.html (scope "workspace", screen people-workspace via PeopleWorkspace.svelte).
     Composed of AppShell > Page > Card / Stack / Row / Grid and the section 2 components; no <style>, no inline style.
     Data: ui-next/fixtures/people/people.json through ./people-data.js (ui/scope-invitations.js gating: role select only where
     canUpdateGrant, Remove only where canRevokeGrant, invite roles from invitationRoles). The boards draw no .btn-primary on desktop;
     phone: "Send invitation" in the phone-bar. Menus follow the Menu contract: the destructive item is last, after an hr. -->
<script module>
  export const SCOPES = Object.freeze(["review", "workspace"]);
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Pill from "../../Pill.svelte";
  import Menu from "../../Menu.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { P } from "./people-icons.js";
  import { rosterRows, inviteOptions, ROLE_ORDER } from "./people-data.js";
  import data from "../../../fixtures/people/people.json";

  let { scope = "review", phone = false, theme = "light", state } = $props();
  if (!SCOPES.includes(scope)) throw new TypeError(`People: unknown scope "${String(scope)}" (review | workspace)`);
  if (state !== undefined) throw new TypeError(`People: no board draws state "${String(state)}"`);
  const review = scope === "review";
  const s = review ? data.review : data.workspace;
  const COLLECT = "#collect", WORKSPACE = "?screen=workspace";
  const back = review ? COLLECT : WORKSPACE;
  const roster = $derived(rosterRows(phone ? data.phone.roster : s.roster, { me: phone ? data.phone.me : s.me, can: s.can, roles: data.roles }));
  const options = $derived(inviteOptions(roster.myRole, phone ? data.phone.inviteLabels : data.inviteLabels));
  const MORE = [
    { label: "Edit details and dates", href: "#setup", icon: I.pen },
    { label: "People with access", href: "?screen=people", icon: I.people },
    { label: "Close collection now", href: "#close-collection", icon: P.lock },
    { label: "Meeting offline? Print and paper", href: "#offline", icon: P.print },
    { kind: "hr" },
    { label: "Delete this review", danger: true, icon: I.x, refused: "Reviews with responses can't be deleted. This one has 18." },
  ];
  const TABS = [["Prepare", "#setup", "done"], ["Collect", COLLECT, "now"], ["Understand", "#results", ""], ["Improve", "#next-step", ""]];
  const ACTION = { "Transfer ownership": { href: "#transfer", icon: I.people }, Remove: { href: "#remove", icon: I.x, danger: true }, Resend: { href: "#resend", icon: P.refresh }, Withdraw: { href: "#withdraw", icon: I.x, danger: true } };
  function menuItems(actions) {
    const items = actions.map((a) => ({ label: a, ...ACTION[a] }));
    const safe = items.filter((it) => !it.danger), danger = items.filter((it) => it.danger);
    return safe.length && danger.length ? [...safe, { kind: "hr" }, ...danger] : [...safe, ...danger];
  }
</script>

{#snippet dots()}<Icon d={P.dots} />{/snippet}
{#snippet qr()}<Icon d={P.qr} />{/snippet}
{#snippet mail()}<Icon d={I.mail} />{/snippet}
{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title={s.phoneTitle} parent={review ? data.review.title : data.workspace.short} {back} initials={data.user.initials} />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.user.workspace} crumbs={review ? [{ label: data.review.project, href: "#project" }, { label: data.review.title }] : []} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Send invitation" />{/if}{/snippet}
{#snippet person(r)}<Row gap={3}><span class="av" aria-hidden="true">{r.initials}</span><div><div><b>{r.name}</b></div><div class="small">{r.sub}</div></div></Row>{/snippet}
{#snippet roleSelect(id, label, opts, selected)}<label class="sel"><select class="in" {id} aria-label={label}>{#each opts as [value, text]}<option {value} selected={value === selected}>{text}</option>{/each}</select><Icon d={I.chev} /></label>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <span class="small"><a class="link" href={back}>{review ? data.review.title : data.workspace.short}</a></span>
    <h1 class="title-phone">{s.phoneTitle}</h1>
    <Card gap={3} label="Invite">
      <div><label class="lbl" for="pp-inv">Invite by email</label><input class="in" type="email" inputmode="email" placeholder="name@example.org" id="pp-inv" /></div>
      <div><label class="lbl" for="pp-role">Role</label>{@render roleSelect("pp-role", undefined, options, options[0]?.[0])}</div>
    </Card>
    <Card pad="list" gap={2} label={`People · ${roster.rows.length}`}>
      <span class="micro">People · {roster.rows.length}</span>
      {#each roster.rows as r (r.key)}
        <hr class="hr" />
        <Row split gap={3}>
          {@render person(r)}
          {#if r.actions.length}<Menu id={`pp-${r.key}`} summary={dots} summaryClass="btn btn-quiet" label={`Actions for ${r.name}`} items={menuItems(r.actions)} />{/if}
        </Row>
      {/each}
    </Card>
  {:else}
    <Page gap={5}>
      {#if review}
        <Row split gap={5}>
          <Stack gap={2}>
            <Row gap={3}><h1 class="title-page">{data.review.title}</h1><Pill stage={data.review.stage} /></Row>
            <p class="small t-15">{data.review.meta} · {data.review.updated}</p>
          </Stack>
          <Row gap={2}>
            <Menu id="pp-more" summary={dots} summaryClass="btn btn-icon" label="More actions" title="More actions" items={MORE} />
            <Button label="Share the survey" href="#share" lead={qr} />
          </Row>
        </Row>
        <nav class="glass tabs" aria-label="Review stages">
          {#each TABS as [name, href, mark], i}
            <a class="tab" {href} aria-current={mark === "now" ? "page" : undefined}>{#if mark === "done"}<span class="dot done"><Icon d={I.check} /></span>{:else}<span class="dot">{i + 1}</span>{/if}{name}{#if mark === "now"} <span class="now">Now</span>{/if}</a>
          {/each}
        </nav>
      {:else}
        <Stack gap={1}><span class="small"><a class="link" href={WORKSPACE}>{data.workspace.name}</a></span><h1 class="title-page">People</h1></Stack>
      {/if}
      <Card hi gap={5} label={s.heading}>
        <Stack gap={1}>
          <h2 class="h2">{s.heading}</h2>
          {#if review}<p class="small t-15">Access to <strong>{data.review.title}</strong>. People on the whole <strong>{data.review.project}</strong> project see it too.</p>
          {:else}<p class="small t-15">Access to <strong>{data.workspace.name}</strong> and everything in it. Someone invited only to a project or a review does not appear here.</p>{/if}
        </Stack>
        <div class="solid l-card l-grid" data-cols="2" data-gap="3">
          <div><label class="lbl" for="pp-invite">Invite someone</label><input class="in" type="email" placeholder="name@example.org" id="pp-invite" /></div>
          <Row gap={3}>
            <div><label class="lbl" for="pp-as">As</label>{@render roleSelect("pp-as", undefined, options, options[0]?.[0])}</div>
            <Button label="Send invitation" lead={mail} />
          </Row>
        </div>
        <table>
          <thead><tr><th class="th">Person</th><th class="th">Role here</th><th class="th">What they can do</th><th class="th">Actions</th></tr></thead>
          <tbody>
            {#each roster.rows as r (r.key)}
              <tr>
                <td class="td">{@render person(r)}</td>
                <td class="td">{#if r.editable}{@render roleSelect(undefined, `Role for ${r.name}`, ROLE_ORDER.map((role) => [role, data.roles[role]]), r.role)}{:else}{r.roleLabel}{/if}{#if r.via}<div class="micro">from {r.via}</div>{/if}</td>
                <td class="td"><span class="small">{r.can}</span></td>
                <td class="td">{#if r.note}<span class="small">{r.note}</span>{:else}<Row gap={1}>{#each r.actions as a}<Button label={a} variant="quiet" />{/each}</Row>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="small">{data.footnote}</p>
      </Card>
      <Row split><span aria-hidden="true"></span><Button label="Done" variant="quiet" href={back} trail={check} /></Row>
    </Page>
  {/if}
</AppShell>
