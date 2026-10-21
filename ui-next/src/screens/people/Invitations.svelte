<!-- UI Next (v4) Invitations screen (the signed-in person's own pending invitations). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Invitations.dc.html (desktop), InvitationsPhone.dc.html (phone).
     Composed of AppShell > Page > Card / Stack / Row and the section 2 components; no <style>, no inline style.
     Data: ui-next/fixtures/people/invitations.json (GET /v2/me/invitations shape) through ui/v3/components/invite.js pendingInvitations()
     (./people-data.js invitationRows). One .btn-primary per page: desktop the first invitation's Accept (the board's), the others secondary;
     phone "Accept and open the workspace" in the phone-bar. -->
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
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { invitationRows } from "./people-data.js";
  import d from "../../../fixtures/people/invitations.json";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`Invitations: no board draws state "${String(state)}"`);
  const w = phone ? "&w=phone" : "";
  const HOME = `?screen=home${w}`, WORKSPACE = `?screen=workspace${w}`;
  const rows = invitationRows(phone ? d.phone : d.desktop, { kinds: d.kinds, can: d.can, roles: d.roles });
</script>

{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={d.user.initials} />{:else}<TopBar who={d.user.first} initials={d.user.initials} workspace={d.user.workspace} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Accept and open the workspace" href={WORKSPACE} />{/if}{/snippet}
{#snippet mailIcon()}<span class="icn icn-lens" data-lens="team" aria-hidden="true"><Icon d={I.mail} /></span>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Invitations</h1>
    {#each rows as r (r.key)}
      <Card gap={3} label="New">
        <span class="micro">New</span>
        <Row gap={3}>{@render mailIcon()}<div><div><b>{r.name}</b></div><div class="small">{r.from} invited you to {d.phoneCan[r.role]} in this {r.kind} · {r.when}</div></div></Row>
        <Row><Button label="Decline" href={HOME} block /></Row>
      </Card>
    {/each}
    <Card pad="list" gap={3} label="Earlier">
      <span class="micro">Earlier</span>
      {#each d.phone.earlier as e}
        <hr class="hr" />
        <a class="card-link l-row" data-gap="3" href={WORKSPACE}><span class="icn icn-lens" data-lens="team" aria-hidden="true"><Icon d={I.check} /></span><div><div><b class="t-15">{e.name}</b></div><div class="small">Accepted · {e.when}</div></div></a>
      {/each}
    </Card>
    <a class="link" href={HOME}>Back to your reviews</a>
  {:else}
    <Page width="read">
      <Card hi gap={5} label="Your invitations">
        <Stack gap={1}><h1 class="h1">Your invitations</h1><p class="small t-15">Accepting adds the project or review to <strong>Your reviews</strong>.</p></Stack>
        {#each rows as r, i (r.key)}
          <div class="solid l-card l-row" data-split="" data-gap="4" role="group" aria-label={r.title}>
            <Row gap={4}>{@render mailIcon()}<div><div class="h3">{r.title}</div><p class="small">{r.line}</p></div></Row>
            <Row gap={2}><Button label="Decline" variant="quiet" />{#if i === 0}<Button label="Accept" variant="primary" href={HOME} />{:else}<Button label="Accept" href={HOME} lead={check} />{/if}</Row>
          </div>
        {/each}
        <a class="link" href={HOME}>Back to your reviews</a>
      </Card>
    </Page>
  {/if}
</AppShell>
