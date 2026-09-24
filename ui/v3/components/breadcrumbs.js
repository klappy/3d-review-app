// component: Breadcrumbs (captain P0 12:32 + ruling 12:34). ONE crumb row for every page, always in the same order:
// Home › Workspace › Project › Assessment › Page. Levels without data are omitted; the last level is plain text
// (aria-current="page"), never a link. Pure string builder: no reads, no navigation of its own. The sidebar tree
// reads the same `scope` through crumbTrail(), so the two never disagree.
export const ORDER = Object.freeze(['home', 'workspace', 'project', 'assessment', 'page']);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Only app-local hash routes become links (same rule as kit/core.js safeHref).
const safeHref = v => (typeof v === 'string' && /^#[A-Za-z0-9_/%?=&.-]*$/.test(v) ? v : null);
const enc = encodeURIComponent;
const DEFAULT_HREF = {
  home: () => '#',
  workspace: x => `#workspace/${enc(x.id)}`,
  project: x => `#project/${enc(x.id)}`,
  assessment: x => `#assessment/${enc(x.id)}`,
};
// scope: { workspace?: {id,name,href?}, project?: {...}, assessment?: {...}, page?: {label,href?} | string, home?: false|{label,href} }
export function crumbTrail(scope = {}) {
  const out = [];
  for (const level of ORDER) {
    let x = scope[level];
    if (level === 'home') { if (x === false) continue; x = { label: 'Home', ...(x || {}) }; }
    if (level === 'page' && typeof x === 'string') x = { label: x };
    if (!x) continue;
    const label = x.label ?? x.name;
    if (label == null || label === '') continue;
    const href = safeHref(x.href ?? (DEFAULT_HREF[level] && (level === 'home' || x.id != null) ? DEFAULT_HREF[level](x) : null));
    out.push({ level, label: String(label), href });
  }
  return out;
}
export function breadcrumbs(scope = {}, { label = 'Breadcrumb', className = 'crumbs' } = {}) {
  const trail = crumbTrail(scope);
  if (!trail.length) return '';
  const last = trail.length - 1;
  const items = trail.map((c, i) => i === last || !c.href
    ? `<span data-crumb="${c.level}"${i === last ? ' aria-current="page"' : ''}>${esc(c.label)}</span>`
    : `<a data-crumb="${c.level}" href="${esc(c.href)}" data-navigate="${esc(c.href)}">${esc(c.label)}</a>`);
  return `<nav class="${esc(className)}" aria-label="${esc(label)}" data-component="breadcrumbs">${items.join('<span class="sep" aria-hidden="true">›</span>')}</nav>`;
}
