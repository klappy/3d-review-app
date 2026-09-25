// Member list — ONE component for every permissions roster (workspace, project, assessment). Captain P0 12:30 + ruling 12:34.
// People are shown by name + email, "You" for the signed-in account — NEVER by principal id.
// Contract today (src/handlers/grant.ts list): a grant row carries principal_id + role only, and the principal table stores
// an email HASH only, so another member's name/email is not readable by any capability. Until the API returns it
// (NEED 11→door), the signed-in account shows "You" + its own email (/v2/auth/access?view=account) and others show a
// neutral "Member N" label. A future `name` / `email` / `display_name` on the grant row is shown as soon as it exists.

export const YOU = 'You';
export const OTHER_PERSON = 'Member';
export const NO_EMAIL_NOTE = 'Names and emails of other people are not shared by the service yet.';

const clean = v => (typeof v === 'string' && v.trim() && [...v].length <= 254 ? v.trim() : '');

/** Person label for one roster row. `n` is the 1-based position among people who are not you. Never returns an id. */
export function memberPerson(row, { me = null, myEmail = '', n = 1 } = {}) {
  const you = !!me && row?.principal_id === me;
  const name = clean(row?.display_name) || clean(row?.name);
  const email = you ? clean(myEmail) || clean(row?.email) : clean(row?.email);
  return { you, name: you ? YOU : name || email || `${OTHER_PERSON} ${n}`, email: name || you ? email : '' };
}

/** Label every row in order; returns [{ row, person }]. */
export function labelMembers(rows = [], { me = null, myEmail = '' } = {}) {
  let n = 0;
  return rows.map(row => { const you = !!me && row?.principal_id === me; if (!you) n += 1; return { row, person: memberPerson(row, { me, myEmail, n }) }; });
}

/** The "who" cell: name on one line, email beneath (when known). */
export function memberCell(esc, person) {
  return `<span class="member" data-member${person.you ? ' data-member-you' : ''}><strong>${esc(person.name)}</strong>${person.email ? `<br><span class="small muted" data-member-email>${esc(person.email)}</span>` : ''}</span>`;
}

/** Roster table. `actions(row, person)` returns the third cell's HTML (page-specific controls). */
// `note: false` leaves the "names are not shared" note to the caller (e.g. behind Learn more: one line per screen, B30).
export function memberList(esc, rows, { me = null, myEmail = '', actions = () => '', rowAttr = () => '', empty = 'No one listed.', note = true } = {}) {
  const labelled = labelMembers(rows, { me, myEmail });
  const body = labelled.map(({ row, person }) => `<tr ${rowAttr(row)}><td>${memberCell(esc, person)}</td><td>${esc(row.role)}</td><td class="small">${actions(row, person)}</td></tr>`).join('');
  const hidden = labelled.some(({ person }) => !person.you && !person.email);
  return `<table class="grants" data-member-list><thead><tr><th>Person</th><th>Role</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="3" class="muted">${esc(empty)}</td></tr>`}</tbody></table>${hidden && note ? `<p class="small muted" data-member-note>${esc(NO_EMAIL_NOTE)}</p>` : ''}`;
}

/** True when some row (not you) has no name or email to show — the case NO_EMAIL_NOTE explains. */
export const membersHidden = (rows = [], { me = null, myEmail = '' } = {}) => labelMembers(rows, { me, myEmail }).some(({ person }) => !person.you && !person.email);

/** Read the signed-in account's email (same read the shell header uses). Resolves '' on any failure; never throws. */
export async function readAccountEmail({ demo = false, fetchImpl = globalThis.fetch } = {}) {
  if (demo || typeof fetchImpl !== 'function' || !globalThis.location?.origin) return '';
  try {
    const r = await fetchImpl('/v2/auth/access?view=account', { headers: { accept: 'application/json' }, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
    const v = r.ok ? await r.json() : null;
    return clean(v?.email);
  } catch { return ''; }
}

export default memberList;
