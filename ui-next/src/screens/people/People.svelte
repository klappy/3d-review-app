<!-- UI Next (v4) People screen ("People with access"). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): People.dc.html + PeoplePhone.dc.html (scope "review", screen people),
     PeopleWorkspace.dc.html + PeopleWorkspacePhone.dc.html (scope "workspace", screen people-workspace via PeopleWorkspace.svelte).
     Composed of AppShell > Page > Card / Row and the section 2 components, plus contract rows the shared components do not take as
     props yet (.l-row[data-align|justify], [data-grow], .l-card[data-pad=work|form|rows], .l-grid[data-tpl=invite], .tbl, .t-24,
     .td[data-align=end]: base.css at the PIN); no <style>, no inline style.
     Data: ui-next/fixtures/people/people.json through ./people-data.js (ui/scope-invitations.js gating: role select only where
     canUpdateGrant, Remove only where canRevokeGrant, invite roles from invitationRoles). The boards draw no .btn-primary on desktop;
     phone: "Send invitation" in the phone-bar. Menus follow the Menu contract: the destructive item is last, after an hr.
     Links: ../href.js (carries w and theme) for every screen link, other lanes' by their registered names (collect, close-collection,
     share, setup1, setup5, results, next-step, project, menu); test/ui-next-links.test.ts passes once those lanes merge. -->
<script module>
  export const SCOPES = Object.freeze(["review", "workspace"]);
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Pill from "../../Pill.svelte";
  import Menu from "../../Menu.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { href } from "../href.js";
  import { P } from "./people-icons.js";
  import { rosterRows, inviteOptions, ROLE_ORDER } from "./people-data.js";
  import fixture from "../../../fixtures/people/people.json";

  // ?state=: no board draws one, so any value (the route passes it as state) renders the default; the prop is not read.
  // data: the fixture, or the live roster in the same shape (app/data.js peopleModel). Live actions (absent in the harness, where the
  // controls stay the board's): oninvite({ email, role }) sends an invitation (the confirmed dry-run → execute pair); onrole(row, role)
  // changes a grant's role the same way; onaction(name, row) does a row action the app performs for real — data.actions names them
  // (Remove, Withdraw); a board action without a route (Transfer ownership, Resend) is not offered on live data.
  let { scope = "review", phone = false, theme = "light", data = fixture, oninvite, onaction, onrole } = $props();
  if (!SCOPES.includes(scope)) throw new TypeError(`People: unknown scope "${String(scope)}" (review | workspace)`);
  const review = scope === "review";
  const s = review ? data.review : data.workspace;
  const COLLECT = href("collect"), WORKSPACE = href("workspace"), HOME = href("home"), MENU = href("menu");
  const back = review ? COLLECT : WORKSPACE;
  const roster = $derived(rosterRows(phone ? data.phone.roster : s.roster, { me: phone ? data.phone.me : s.me, can: s.can, roles: data.roles }));
  const options = $derived(inviteOptions(roster.myRole, phone ? data.phone.inviteLabels : data.inviteLabels));
  const MORE = [
    { label: "Edit details and dates", href: href("setup1"), icon: I.pen },
    { label: "People with access", href: href("people"), icon: I.people },
    { label: "Close collection now", href: href("close-collection"), icon: P.lock },
    { label: "Meeting offline? Print and paper", href: COLLECT, icon: P.print }, // the board links Collect#offline
    { kind: "hr" },
    { label: "Delete this review", danger: true, icon: I.x, refused: data.review?.deleteRefused ?? "Reviews with responses can't be deleted. This one has 18." },
  ];
  const TABS = [["Prepare", href("setup5"), "done"], ["Collect", COLLECT, "now"], ["Understand", href("results"), ""], ["Improve", href("next-step"), ""]];
  const ACTION = { "Transfer ownership": { href: "#transfer", icon: I.people }, Remove: { href: "#remove", icon: I.x, danger: true }, Resend: { href: "#resend", icon: P.refresh }, Withdraw: { href: "#withdraw", icon: I.x, danger: true } };
  const offered = (r) => (data.actions ? r.actions.filter((a) => data.actions.includes(a)) : r.actions);
  function menuItems(actions, row) {
    const items = actions.map((a) => ({ label: a, ...ACTION[a], ...(onaction ? { href: undefined, onclick: () => onaction(a, row) } : {}) }));
    const safe = items.filter((it) => !it.danger), danger = items.filter((it) => it.danger);
    return safe.length && danger.length ? [...safe, { kind: "hr" }, ...danger] : [...safe, ...danger];
  }
  // Live: the invite form's button sends what the fields hold (desktop: the form card; phone: the phone-bar's primary, by document click).
  const read = (emailId, roleId) => ({ email: document.getElementById(emailId)?.value?.trim() ?? "", role: document.getElementById(roleId)?.value ?? "" });
  const inviting = (el) => { const f = (e) => { if (oninvite && e.target instanceof Element && e.target.closest(".btn")) { e.preventDefault(); oninvite(read("pp-invite", "pp-as")); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
  const barInvite = (e) => { if (phone && oninvite && e.target instanceof Element && e.target.closest(".phone-bar .btn-primary")) { e.preventDefault(); oninvite(read("pp-inv", "pp-role")); } };
  const acting = (row) => (el) => { const f = (e) => { const b = e.target instanceof Element ? e.target.closest(".btn") : null; if (onaction && b) { e.preventDefault(); onaction(b.textContent.trim(), row); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
</script>

{#snippet dots()}<Icon d={P.dots} />{/snippet}
{#snippet qr()}<Icon d={P.qr} />{/snippet}
{#snippet mail()}<Icon d={I.mail} />{/snippet}
{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title={s.phoneTitle} parent={review ? data.review.title : data.workspace.short} {back} initials={data.user.initials} home={HOME} menuHref={MENU} />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.user.workspace} home={HOME} crumbs={review ? [{ label: data.review.project, href: href("project") }, { label: data.review.title }] : []} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Send invitation" />{/if}{/snippet}
{#snippet person(r)}<Row gap={3}><span class="av" aria-hidden="true">{r.initials}</span><div><div>{r.name}</div><div class="small">{r.sub}</div></div></Row>{/snippet}
{#snippet personRow(r)}<span class="av" aria-hidden="true">{r.initials}</span><div class="list-body"><div class="list-title">{r.name}</div><div class="small">{r.sub}</div></div>{/snippet}
{#snippet roleSelect(id, label, opts, selected, on)}<label class="sel"><select class="in" {id} aria-label={label} onchange={(e) => on?.(e.currentTarget.value)}>{#each opts as [value, text]}<option {value} selected={value === selected}>{text}</option>{/each}</select><Icon d={I.chev} /></label>{/snippet}

<svelte:document onclick={barInvite} />
<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <span class="small"><a class="link" href={back}>{review ? data.review.title : data.workspace.short}</a></span>
    <h1 class="title-phone">{s.phoneTitle}</h1>
    <Card gap={3} label="Invite">
      <div><label class="lbl" for="pp-inv">Invite by email</label><input class="in" type="email" inputmode="email" placeholder="name@example.org" id="pp-inv" /></div>
      <div><label class="lbl" for="pp-role">Role</label>{@render roleSelect("pp-role", undefined, options, options[0]?.[0])}</div>
    </Card>
    <section class="glass l-card" data-pad="rows" aria-label={`People · ${roster.rows.length}`}>
      <span class="micro">People · {roster.rows.length}</span>
      {#each roster.rows as r (r.key)}
        <div class="list-row">
          {@render personRow(r)}
          {#if offered(r).length}<Menu id={`pp-${r.key}`} summary={dots} summaryClass="btn btn-quiet" label={`Actions for ${r.name}`} items={menuItems(offered(r), r)} />{/if}
        </div>
      {/each}
    </section>
  {:else}
    <Page gap={5}>
      {#if review}
        <div class="l-row" data-gap="5" data-align="start">
          <div class="l-stack" data-gap="2" data-grow="">
            <Row gap={3}><h1 class="title-page">{data.review.title}</h1><Pill stage={data.review.stage} /></Row>
            <p class="small t-15">{data.review.meta} · {data.review.updated}</p>
          </div>
          <Row gap={2}>
            <Menu id="pp-more" summary={dots} summaryClass="btn btn-icon" label="More actions" title="More actions" items={MORE} />
            <Button label="Share the survey" href={href("share")} lead={qr} />
          </Row>
        </div>
        <nav class="glass tabs" aria-label="Review stages">
          {#each TABS as [name, to, mark], i}
            <a class="tab" href={to} aria-current={mark === "now" ? "page" : undefined}>{#if mark === "done"}<span class="dot done"><Icon d={I.check} /></span>{:else}<span class="dot">{i + 1}</span>{/if}{name}{#if mark === "now"} <span class="now">Now</span>{/if}</a>
          {/each}
        </nav>
      {:else}
        <div><a class="link small" href={WORKSPACE}>{data.workspace.name}</a><h1 class="title-page">People</h1></div>
      {/if}
      <div class="glass-hi l-card l-stack" data-pad="work" data-gap="5" role="group" aria-label={s.heading}>
        <div>
          <h2 class="h2 t-24">{s.heading}</h2>
          {#if review}<p class="small t-15">Access to <strong>{data.review.title}</strong>. People on the whole <strong>{data.review.project}</strong> project see it too.</p>
          {:else}<p class="small t-15">Access to <strong>{data.workspace.name}</strong> and everything in it. Someone invited only to a project or a review does not appear here.</p>{/if}
        </div>
        <div class="solid l-card l-grid" data-pad="form" data-tpl="invite" data-gap="3" {@attach inviting}>
          <div><label class="lbl" for="pp-invite">Invite someone</label><input class="in" type="email" placeholder="name@example.org" id="pp-invite" /></div>
          <div><label class="lbl" for="pp-as">As</label>{@render roleSelect("pp-as", undefined, options, options[0]?.[0])}</div>
          <Button label="Send invitation" lead={mail} />
        </div>
        <table class="tbl">
          <thead><tr><th class="th">Person</th><th class="th">Role here</th><th class="th">What they can do</th><th class="th" data-align="end">Actions</th></tr></thead>
          <tbody>
            {#each roster.rows as r (r.key)}
              <tr>
                <td class="td">{@render person(r)}</td>
                <td class="td">{#if r.editable}{@render roleSelect(undefined, `Role for ${r.name}`, ROLE_ORDER.map((role) => [role, data.roles[role]]), r.role, (role) => onrole?.(r, role))}{:else}{r.roleLabel}{/if}{#if r.via}<div class="micro">from {r.via}</div>{/if}</td>
                <td class="td"><span class="small">{r.can}</span></td>
                <td class="td" data-align="end" {@attach acting(r)}>{#if r.note}<span class="small">{r.note}</span>{:else}{#each offered(r) as a}<Button label={a} variant="quiet" />{/each}{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="small">{data.footnote}</p>
      </div>
      <div class="l-row" data-justify="end"><Button label="Done" variant="quiet" href={back} trail={check} /></div>
    </Page>
  {/if}
</AppShell>
