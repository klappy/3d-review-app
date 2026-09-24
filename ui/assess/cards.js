// Reusable entity cards — same markup for browser pages and MCP-rendered summaries (cookbook #16 mandate: reusable cards).
// Pure functions: HTML strings only, no fetch, no DOM. Every text value passes through esc().
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const enc = v => encodeURIComponent(String(v ?? ''));
// v3 plain state words (lane 1; must match ui/v3-shell.js STATE_WORDS — cards.js is inlined into the MCP panel, so no import).
// v2 words, for a one-line revert: { prepare: 'In preparation', collect: 'Collecting', understand: 'Understanding', improve: 'Improving' }
export const STAGE_LABEL = Object.freeze({ prepare: 'Setup not finished', collect: 'Collecting responses', understand: 'Ready to look at results', improve: 'Reviewed' });
export const stageLabel = s => STAGE_LABEL[s] || esc(s || '');

// card({ eyebrow, title, href, meta: [strings], badge, note, archived }) — a panel that is a link when href is set.
// childCounts(pairs) — L1-23 (captain 14:52): "3 assessments · 91 responses". Only counts the server sent are shown; all zero → "No <last> yet".
const plural = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
export function childCounts(pairs = []) {
  const got = pairs.filter(([n]) => n !== null && n !== undefined && Number.isFinite(Number(n))).map(([n, w]) => [Math.max(0, Math.floor(Number(n))), w]);
  if (!got.length) return '';
  if (got.every(([n]) => n === 0)) return `No ${got[0][1]}s yet`;
  return got.map(([n, w]) => (n === 0 ? `no ${w}s` : plural(n, w))).join(' · ');
}
export function card({ eyebrow, title, href, meta = [], badge = '', note = '', archived = false, id = '', counts = '' }) {
  const tag = href ? 'a' : 'div';
  const attrs = `class="panel entity-card${archived ? ' archived' : ''}"${href ? ` href="${esc(href)}"` : ''}${id ? ` data-id="${esc(id)}"` : ''}`;
  return `<${tag} ${attrs}>${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2>${esc(title)}</h2>${counts ? `<p class="small v3-child-counts" data-v3-counts>${esc(counts)}</p>` : ''}${meta.filter(Boolean).map(m => `<p class="muted small">${esc(m)}</p>`).join('')}${badge ? `<span class="badge">${esc(badge)}</span>` : ''}${note ? `<p class="small muted">${esc(note)}</p>` : ''}</${tag}>`;
}
export function cardGrid(cards, empty = 'Nothing here yet.') {
  return `<div class="project-grid">${cards.length ? cards.join('') : `<p class="muted">${esc(empty)}</p>`}</div>`;
}
// Scope → route helpers. One page per scope; a card always links to the child's own page.
export const routes = Object.freeze({
  entry: '#', workspaces: '#workspaces', workspace: id => `#workspace/${enc(id)}`, projects: '#projects',
  project: id => `#project/${enc(id)}`, assessment: (id, view = '') => `#assessment/${enc(id)}${view ? '/' + view : ''}`,
  survey: (aid, sid) => `#assessment/${enc(aid)}/survey/${enc(sid)}`,
});
export const workspaceCard = w => card({ eyebrow: 'Workspace', title: w.name, href: routes.workspace(w.id), counts: childCounts([[w.project_count, 'project'], [w.assessment_count, 'assessment'], [w.response_count, 'response']]), meta: [w.role ? `Your role: ${w.role}` : ''], badge: w.archived_at ? 'Archived' : '', archived: !!w.archived_at, id: w.id });
export const projectCard = p => card({ eyebrow: 'Project', title: p.name, href: routes.project(p.id), counts: childCounts([[p.assessment_count, 'assessment'], [p.response_count, 'response']]), meta: [p.role ? `Your role: ${p.role}` : ''], badge: p.archived_at ? 'Archived' : '', archived: !!p.archived_at, id: p.id });
export const assessmentCard = a => card({ eyebrow: 'Assessment', title: a.name, href: routes.assessment(a.id), counts: childCounts([[a.response_count, 'response']]), meta: [a.language_name || a.language_id ? `Language: ${a.language_name || a.language_id}` : ''], badge: a.archived_at ? 'Archived' : stageLabel(a.stage), archived: !!a.archived_at, id: a.id });
export const surveyCard = (aid, s) => card({ eyebrow: s.perspective || 'Survey', title: s.template_name || s.template_id || s.id, href: routes.survey(aid, s.id), meta: [s.version ? `Version ${s.version}` : ''], badge: s.archived_at ? 'Archived' : '', archived: !!s.archived_at, id: s.id });
