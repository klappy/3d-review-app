// v3 lane 9 L9-1: home / dashboard per Bincy screen 02 (cookbook sources/bincy-design-sprint-2026-09-22, 02_home_dashboard.png).
// Pure: returns an HTML string; no fetch, no DOM. Data: /v2/projects + /v2/projects/:id/assessments (loaded by scope.js
// projects page). L9-2: body is prototype frame 2 (design-system-v3 app.js card()). /v2/me carries no display name, so no "Welcome, <name>". B17: cards show the list read's child counts through the shared Card childCounts line (overall — the list reads carry no per-group count); never a number the server did not send.
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { childCounts } from './components/card.js';
export const HOME_CSS = '/v3/home.css';
// B17 (captain 14:52): "9 responses" on the card; the shared childCounts builder, only counts the server sent.
const countsLine = pairs => { const c = childCounts(pairs); return c ? `<p class="v3h-meta v3-child-counts" data-v3-counts>${ESC(c)}</p>` : ''; };
const pill = stage => stage === 'prepare' ? 'setup' : stage === 'collect' ? 'progress' : 'done';
// L9-2 (prototype frame 2 `card`): each assessment is ONE whole-card link — eyebrow project · language, state badge, name, next line.
export function assessmentRow(a, stageLabel, projectName = '') {
  const href = `#assessment/${encodeURIComponent(a.id)}`;
  const setup = a.stage === 'prepare';
  const eyebrow = [projectName, a.language_name || ''].filter(Boolean).map(ESC).join(' · ');
  return `<a class="v3h-card v3h-acard" href="${href}" data-v3h-assessment="${ESC(a.id)}"><div class="v3h-row-head"><span class="v3h-eyebrow">${eyebrow}</span><span class="v3h-pill v3h-pill-${pill(a.stage)}">${stageLabel(a.stage)}</span></div><h3>${ESC(a.name)}</h3>${countsLine([[a.response_count, 'response']])}<span class="v3h-continue">${setup ? 'Continue setup' : 'Continue assessment'} <span aria-hidden="true">→</span></span></a>`;
}
export function homeView({ projects = [], shared = [], listFor, stageLabel = s => ESC(s), start = '', title = '' }) {
  const head = `<link rel="stylesheet" href="${HOME_CSS}"><div class="v3h-head"><div>${title ? `<h1>${ESC(title)}</h1>` : ''}<p class="v3h-sub">Here are your 3D Review projects.</p></div>${start}</div>`;
  // B03: assessments shared directly with this person (no project role) — the same card, eyebrow "Shared with you".
  const sharedCards = shared.map(a => assessmentRow(a, stageLabel, 'Shared with you')).join('');
  if (!projects.length && !sharedCards) return `<div class="v3h">${head}<div class="v3h-card"><h2>You have no projects yet.</h2><p class="v3h-meta">Start a new 3D Review to set one up.</p></div></div>`;
  // Frame 2: one grid. Loaded assessments become cards; a project with nothing to continue keeps one project card with its state.
  const body = projects.flatMap(p => {
    const l = listFor(p.id) || {}, open = `<a href="#project/${encodeURIComponent(p.id)}">Open project</a>`;
    const plink = `<h3><a href="#project/${encodeURIComponent(p.id)}">${ESC(p.name)}</a></h3>`;
    // Bugbot 4095269668: archived projects are labelled, and their assessments are not read (scope.js load skips them).
    if (p.archived_at) return [`<section class="v3h-card v3h-archived" data-v3h-project="${ESC(p.id)}"><div class="v3h-row-head"><span class="v3h-eyebrow">Project</span><span class="v3h-pill v3h-pill-done">Archived</span></div>${plink}</section>`];
    if (l.status === 'loaded' && l.list.length) return l.list.map(a => assessmentRow(a, stageLabel, p.name));
    const msg = l.status === 'loaded' ? `<p class="v3h-meta">No assessments yet. ${open}</p>`
      : l.status === 'unauthenticated' ? '<p class="v3h-meta" role="alert">Your sign-in is no longer active. <a href="/v2/auth/access">Sign in again</a></p>'
      : l.status === 'refused' ? '<p class="v3h-meta">Not listed: you have no role on this project.</p>'
      : l.status === 'failed' ? `<p class="v3h-meta" role="alert">Could not load assessments. ${open}</p>`
      : `<p class="v3h-meta">${open}</p>`;
    return [`<section class="v3h-card" data-v3h-project="${ESC(p.id)}"><span class="v3h-eyebrow">Project</span>${plink}${l.status === 'loaded' ? '' : countsLine([[p.assessment_count, 'assessment'], [p.response_count, 'response']])}${msg}</section>`];
  }).join('') + sharedCards;
  // Validator #209 (high): projects shown only through assessment cards stay reachable — one quiet line of project links below the grid.
  const shown = projects.filter(p => !p.archived_at && (listFor(p.id) || {}).status === 'loaded' && listFor(p.id).list.length);
  const plinks = shown.length ? `<p class="v3h-meta v3h-projects">Projects: ${shown.map(p => `<a href="#project/${encodeURIComponent(p.id)}">${ESC(p.name)}</a>`).join(' · ')}</p>` : '';
  return `<div class="v3h">${head}<div class="v3h-cards">${body}</div>${plinks}</div>`;
}
