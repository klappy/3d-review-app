// UI Next (v4) people lane: fixture → screen rows, through the current UI's pure modules (no backend change). Status: provisional.
// Gating is the server's, as the current UI mirrors it: ui/scope-invitations.js (who may invite, change a role, remove someone,
// revoke a pending invitation: invitationRoles(caller).includes(invitation role), as its renderManager gates "Revoke invitation"),
// ui/workspace-manager.js mayGroup() (who may add a project to a workspace), ui/v3/components/invite.js pendingInvitations()
// (which /v2/me/invitations rows are well formed). The fixtures under ui-next/fixtures/people/ use those modules' input shapes.
import { canRevokeGrant, canUpdateGrant, invitationRoles } from "../../../../ui/scope-invitations.js";
import { mayGroup } from "../../../../ui/workspace-manager.js";
import { invitationParts, pendingInvitations } from "../../../../ui/v3/components/invite.js";

export const ROLE_ORDER = Object.freeze(["owner", "member", "viewer"]);
const roleOf = (grants, me) => grants.find((g) => g.principal_id === me)?.role ?? null;

// One roster row per grant and pending invitation, in the order the board draws (a pending row may name the grant it follows).
// Desktop columns: person · role here (plain text, or a role select when canUpdateGrant) · what they can do · actions.
export function rosterRows(roster, { me, can = {}, roles }) {
  const grants = roster?.grants ?? [];
  const myRole = roleOf(grants, me);
  const rows = grants.map((g) => {
    const self = g.principal_id === me;
    const actions = [];
    if (self && myRole === "owner") actions.push("Transfer ownership");
    else if (!self && myRole === "owner" && g.role === "member") actions.push("Transfer ownership");
    if (g.via) actions.length = 0;
    else if (canRevokeGrant(myRole, g.role)) actions.push("Remove");
    return {
      key: g.id, initials: g.initials, name: self && g.email ? `${g.name} (you)` : g.name, sub: g.email ?? roles[g.role], role: g.role,
      roleLabel: roles[g.role], editable: !self && canUpdateGrant(myRole, g.role), via: g.via ?? null, can: can[g.role] ?? "",
      actions, note: g.via ? `Change on the ${g.via}` : null, pending: false,
    };
  });
  for (const i of roster?.pending_invitations ?? []) {
    if (!["sent", "pending", "unconfirmed"].includes(i.status)) continue; // permissions.js keeps only live invitations
    const row = {
      key: i.id, initials: i.initials ?? "?", name: i.email, role: i.role, roleLabel: roles[i.role], editable: false, via: null,
      sub: i.expires ? `Invited ${i.invited} · not yet accepted` : `Invited · ${i.invited}`, can: i.expires ? `Invitation expires ${i.expires}` : "",
      // C1: the current UI offers revocation only for a role the caller may invite (ui/scope-invitations.js renderManager), so a
      // member never sees Withdraw (or Resend) on an owner invitation the server would refuse.
      actions: invitationRoles(myRole).includes(i.role) ? ["Resend", "Withdraw"] : [], note: null, pending: true,
    };
    const at = i.after ? rows.findIndex((r) => r.key === i.after) : -1;
    if (at === -1) rows.push(row); else rows.splice(at + 1, 0, row);
  }
  return { myRole, rows };
}

// The roles the caller may invite as (scope-invitations.js invitationRoles), each with the board's label; board order kept.
export function inviteOptions(myRole, labels) {
  const allowed = invitationRoles(myRole);
  return Object.entries(labels).filter(([role]) => allowed.includes(role));
}

// Eligibility is computed by the server without returning hidden review identifiers. The write still rechecks it.
export function groupRows(group) {
  return (group?.candidates ?? []).map((c) => {
    const can = mayGroup(group.workspaceRole, c.directRole, 'group', c.groupingEligible);
    const reason = can ? 'You directly own this project and every review it contains'
      : !['owner', 'member'].includes(group.workspaceRole) ? 'Only a workspace member or owner can group projects'
      : c.directRole !== 'owner' ? 'Cannot group: a direct project owner grant is required; inherited access is not enough'
      : c.groupingEligible === undefined ? 'Grouping eligibility is unavailable; reload before grouping'
      : 'Cannot group: you must directly own every review in this project, including archived reviews';
    return { ...c, can, reason };
  });
}

// The current UI's words for an invitation whose scope name the server did not send (ui/v3/components/invite.js mountInvitations).
export const NO_NAME = "Name not available";

// The current UI's words for a role it has no label for (ui/v3/components/invite.js ROLE fallback, "as a collaborator").
export const ANY_ROLE = "a collaborator";
// "as a Member", "as an Owner": the article follows the label's first letter; a role missing from the label map reads ANY_ROLE.
export function asRole(role, roles) {
  const label = Object.hasOwn(roles, role) ? roles[role] : null;
  return label ? `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}` : ANY_ROLE;
}

// Own pending invitations, filtered by the current UI's own parser. A missing scope name (pendingInvitations sets null) is
// detected by invitationParts, as the current UI does, and reads NO_NAME; invitationParts' name is HTML-escaped for innerHTML,
// so the raw name is used here (Svelte escapes text). line is the desktop sentence, phoneLine the phone one; a role missing
// from can/phoneCan drops its clause instead of printing "undefined" (C2).
export function invitationRows(result, { kinds, can, roles, phoneCan = {} }) {
  const known = (map, role) => (Object.hasOwn(map, role) ? map[role] : null);
  return pendingInvitations(result).map((i) => {
    const kind = kinds[i.scope.type] ?? i.scope.type, name = invitationParts(i).name === null ? NO_NAME : i.scope.name;
    const does = known(can, i.role), phoneDoes = known(phoneCan, i.role);
    const line = [i.from && `From ${i.from}`, `as ${asRole(i.role, roles)}${does ? ` — ${does}` : ""}`, i.expires && `expires ${i.expires}`];
    const phoneLine = [`${i.from ? `${i.from} invited you` : "You were invited"} to ${phoneDoes ? `${phoneDoes} in` : "join"} this ${kind}`, i.when];
    return {
      key: i.id, name, kind, role: i.role, from: i.from, when: i.when, expires: i.expires, title: `${name} · ${kind}`,
      line: line.filter(Boolean).join(" · "), phoneLine: phoneLine.filter(Boolean).join(" · "),
    };
  });
}
