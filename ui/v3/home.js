// v3 lane 9 L9-1: home / dashboard per Bincy screen 02 (cookbook sources/bincy-design-sprint-2026-09-22, 02_home_dashboard.png).
// Pure: returns an HTML string; no fetch, no DOM. Data: /v2/projects (loaded by scope.js projects page). Owner rule: nobody sees
// a review/assessment outside an opened project, so Home lists projects only; reviews appear after a project is opened. L9-2: body is prototype frame 2 (design-system-v3 app.js card()). Greet by name (captain a1, 2026-10-02): /v2/me carries the account's optional display_name; when set, the head says "Welcome, <name>" (escaped), otherwise nothing changes. B17: cards show the list read's child counts through the shared Card childCounts line (overall — the list reads carry no per-group count); never a number the server did not send.
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { childCounts } from './components/card.js';
export const HOME_CSS = '/v3/home.css';
// B17 (captain 14:52): "9 responses" on the card; the shared childCounts builder, only counts the server sent.
const countsLine = pairs => { const c = childCounts(pairs); return c ? `<p class="v3h-meta v3-child-counts" data-v3-counts>${ESC(c)}</p>` : ''; };
// S40 (persona C, gate 0.24.0): a signed-in invitee with pending invitations gets ONE quiet secondary line linking to the existing
// invitations screen (#invite → the signed-in person's own list, S19). The count is the length of the list the caller read
// (GET /v2/me/invitations through pendingInvitations); 0, missing or not a whole number → nothing. Never a second primary.
export function invitationsHint(n) {
  if (!Number.isInteger(n) || n < 1) return '';
  return `<p class="v3h-meta v3h-invites" data-v3h-invitations>You have ${n} invitation${n === 1 ? '' : 's'} waiting. <a href="#invite/list" data-v3h-invitations-link>See ${n === 1 ? 'the invitation' : 'invitations'}</a></p>`;
}
export function homeView({ projects = [], start = '', title = '', invitations = 0, name = '' }) {
  // Design contract § 4–5 (design/CONTRACT.md, adopted 2026-10-16): greet once, as the page title. With a name (or, failing that,
  // the email) the welcome IS the H1 and replaces the separate title; the primary sits on the H1's row (1280) or under the subline (390).
  const who = typeof name === 'string' ? name.trim() : '';
  const h1 = who ? `<h1 class="fs-h1" data-v3h-welcome>Welcome, ${ESC(who)}</h1>` : title ? `<h1>${ESC(title)}</h1>` : '';
  const head = `<link rel="stylesheet" href="${HOME_CSS}"><div class="v3h-head"><div class="v3h-title">${h1}<p class="v3h-sub">Your projects, newest first.</p>${invitationsHint(invitations)}</div>${start}</div>`;
  if (!projects.length) return `<div class="v3h">${head}<div class="v3h-card"><h2>You have no projects yet.</h2><p class="v3h-meta">Start a new 3D Review to set one up.</p></div></div>`;
  // Owner rule: Home lists projects only. No review is listed, searched or counted into a card here; open a project to see its reviews.
  const cards = projects.map(p => {
    const plink = `<h3><a href="#project/${encodeURIComponent(p.id)}">${ESC(p.name)}</a></h3>`;
    if (p.archived_at) return `<section class="v3h-card v3h-archived" data-v3h-project="${ESC(p.id)}"><div class="v3h-row-head"><span class="v3h-eyebrow">Project</span><span class="v3h-pill v3h-pill-done">Archived</span></div>${plink}</section>`;
    return `<section class="v3h-card" data-v3h-project="${ESC(p.id)}"><span class="v3h-eyebrow">Project</span>${plink}${countsLine([[p.assessment_count, 'assessment'], [p.response_count, 'response']])}<p class="v3h-meta"><a href="#project/${encodeURIComponent(p.id)}">Open project</a></p></section>`;
  });
  return `<div class="v3h">${head}<div class="v3h-cards">${cards.join('')}</div></div>`;
}
