<!-- UI Next (v4) Invitations screen (the signed-in person's own pending invitations). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Invitations.dc.html (desktop), InvitationsPhone.dc.html (phone).
     Composed of AppShell > Page > Card / Stack / Row and the section 2 components; no <style>, no inline style.
     Data: ui-next/fixtures/people/invitations.json (GET /v2/me/invitations shape) through ui/v3/components/invite.js pendingInvitations()
     (./people-data.js invitationRows). One .btn-primary per page: desktop the first invitation's Accept (the board's), the others secondary;
     phone "Accept and open the workspace" in the phone-bar. Links: ../href.js (carries w and theme). -->
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
  import { href } from "../href.js";
  import { invitationRows } from "./people-data.js";
  import d from "../../../fixtures/people/invitations.json";

  // ?state=: no board draws one, so any value (the route passes it as state) renders the default; the prop is not read.
  let { phone = false, theme = "light" } = $props();
  const HOME = href("home"), WORKSPACE = href("workspace");
  const rows = invitationRows(phone ? d.phone : d.desktop, { kinds: d.kinds, can: d.can, roles: d.roles });
</script>

{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={d.user.initials} home={HOME} />{:else}<TopBar who={d.user.first} initials={d.user.initials} workspace={d.user.workspace} home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Accept and open the workspace" href={WORKSPACE} />{/if}{/snippet}
{#snippet tile(d)}<span class="icn" data-size="36" data-lens="team" aria-hidden="true"><Icon {d} /></span>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Invitations</h1>
    {#each rows as r (r.key)}
      <Card gap={3} label="New">
        <span class="micro">New</span>
        <Row gap={3}>{@render tile(I.mail)}<div><div><b>{r.name}</b></div><div class="small">{r.from} invited you to {d.phoneCan[r.role]} in this {r.kind} · {r.when}</div></div></Row>
        <Row><Button label="Decline" href={HOME} block /></Row>
      </Card>
    {/each}
    <Card pad="list" gap={1} label="Earlier">
      <span class="micro">Earlier</span>
      {#each d.phone.earlier as e}
        <a class="card-link list-row" href={WORKSPACE}>{@render tile(I.check)}<div class="list-body"><div class="list-title">{e.name}</div><div class="small">Accepted · {e.when}</div></div></a>
      {/each}
    </Card>
    <a class="link" href={HOME}>Back to your reviews</a>
  {:else}
    <Page width="read">
      <Card hi gap={5} label="Your invitations">
        <Stack gap={2}><h1 class="h1">Your invitations</h1><p class="small t-15">Accepting adds the project or review to <strong>Your reviews</strong>.</p></Stack>
        {#each rows as r, i (r.key)}
          <div class="solid l-card l-row" data-pad="form" data-gap="4" role="group" aria-labelledby={`inv-${r.key}`}>
            {@render tile(I.mail)}<div data-grow=""><div class="h3" id={`inv-${r.key}`}>{r.title}</div><p class="small">{r.line}</p></div>
            <Button label="Decline" variant="quiet" />{#if i === 0}<Button label="Accept" variant="primary" href={HOME} />{:else}<Button label="Accept" href={HOME} lead={check} />{/if}
          </div>
        {/each}
        <a class="link" href={HOME}>Back to your reviews</a>
      </Card>
    </Page>
  {/if}
</AppShell>
