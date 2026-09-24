// v3 lane 9 L9-1: home / dashboard per Bincy screen 02 (cookbook sources/bincy-design-sprint-2026-09-22, 02_home_dashboard.png).
// Pure: returns an HTML string; no fetch, no DOM. Data: /v2/projects + /v2/projects/:id/assessments (loaded by scope.js
// projects page). /v2/me carries no display name, so no "Welcome, <name>". Response counts by group are not drawn here yet (next slice) — never a number the server did not send.
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const HOME_CSS = '/v3/home.css';
const pill = stage => stage === 'prepare' ? 'setup' : stage === 'collect' ? 'progress' : 'done';
export function assessmentRow(a, stageLabel) {
  const href = `#assessment/${encodeURIComponent(a.id)}`;
  const setup = a.stage === 'prepare';
  const meta = [a.language_name || a.language_id || ''].filter(Boolean).map(ESC).join(' · ');
  return `<div class="v3h-row" data-v3h-assessment="${ESC(a.id)}"><div class="v3h-row-head"><h3>${ESC(a.name)}</h3><span class="v3h-pill v3h-pill-${pill(a.stage)}">${stageLabel(a.stage)}</span></div>${meta ? `<p class="v3h-meta">${meta}</p>` : ''}<a class="v3h-continue" href="${href}">${setup ? 'Continue setup' : 'Continue assessment'} →</a></div>`;
}
export function homeView({ projects = [], listFor, stageLabel = s => ESC(s), start = '', title = '' }) {
  const head = `<link rel="stylesheet" href="${HOME_CSS}"><div class="v3h-head"><div>${title ? `<h1>${ESC(title)}</h1>` : ''}<p class="v3h-sub">Here are your 3D Review projects.</p></div>${start}</div>`;
  if (!projects.length) return `<div class="v3h">${head}<div class="v3h-card"><h2>You have no projects yet.</h2><p class="v3h-meta">Start a new 3D Review to set one up.</p></div></div>`;
  const body = projects.map(p => {
    const l = listFor(p.id) || {}, open = `<a href="#project/${encodeURIComponent(p.id)}">Open project</a>`;
    const inner = l.status === 'loaded' ? (l.list.length ? l.list.map(a => assessmentRow(a, stageLabel)).join('') : `<p class="v3h-meta">No assessments yet. ${open}</p>`)
      : l.status === 'unauthenticated' ? '<p class="v3h-meta" role="alert">Your sign-in is no longer active. <a href="/v2/auth/access">Sign in again</a></p>'
      : l.status === 'refused' ? '<p class="v3h-meta">Not listed: you have no role on this project.</p>'
      : l.status === 'failed' ? `<p class="v3h-meta" role="alert">Could not load assessments. ${open}</p>`
      : `<p class="v3h-meta">${open}</p>`;
    return `<section class="v3h-card" data-v3h-project="${ESC(p.id)}"><h2><a href="#project/${encodeURIComponent(p.id)}">${ESC(p.name)}</a></h2>${inner}</section>`;
  }).join('');
  return `<div class="v3h">${head}${body}</div>`;
}
