// component: Sidebar tree (captain ruling 12:22 (1) + ruling 12:34). The 0.16 left navigation restored as one
// reusable component: Workspaces → Project → Assessment. Reads the SAME `scope` as Breadcrumbs (crumbTrail), so the
// highlighted row and the crumb row never disagree. Pure string builder: no reads, no navigation of its own.
import { crumbTrail } from './breadcrumbs.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeHref = v => (typeof v === 'string' && /^#[A-Za-z0-9_/%?=&.-]*$/.test(v) ? v : null);
const enc = encodeURIComponent;
const KINDS = ['workspace', 'project', 'assessment'];
const CHILD = { workspace: 'projects', project: 'assessments' };
const ICON = { workspace: '▦', project: '▣', assessment: '◔' };
// Which node ids are on the current path, derived from the same scope Breadcrumbs uses.
export function activePath(scope = {}) {
  const path = {};
  for (const c of crumbTrail(scope)) if (KINDS.includes(c.level) && scope[c.level]?.id != null) path[c.level] = String(scope[c.level].id);
  return path;
}
// workspaces: [{ id, name, href?, projects: [{ id, name, href?, assessments: [{ id, name, href? }] }] }]
export function sidebarTree(workspaces = [], scope = {}, { label = 'Workspaces' } = {}) {
  const path = activePath(scope);
  const deepest = KINDS.filter(k => path[k] != null).pop();
  const row = (kind, x, depth) => {
    const id = String(x.id), onPath = path[kind] === id, current = onPath && kind === deepest;
    const href = safeHref(x.href ?? `#${kind}/${enc(id)}`);
    const kids = CHILD[kind] ? (x[CHILD[kind]] || []) : [];
    const open = onPath && kids.length > 0;
    const name = esc(x.name ?? x.label ?? '');
    const link = href ? `<a class="tree-label" href="${esc(href)}" data-navigate="${esc(href)}"${current ? ' aria-current="page"' : ''}>${name}</a>` : `<span class="tree-label">${name}</span>`;
    const sub = open ? `<ul role="group">${kids.map(k => row(KINDS[KINDS.indexOf(kind) + 1], k, depth + 1)).join('')}</ul>` : '';
    return `<li role="treeitem" data-kind="${kind}" data-id="${esc(id)}" aria-level="${depth}"${kids.length ? ` aria-expanded="${open}"` : ''}${current ? ' aria-selected="true"' : ''} class="tree-row lvl-${depth}${current ? ' on' : ''}"><span class="tree-ico" aria-hidden="true">${ICON[kind]}</span>${link}${sub}</li>`;
  };
  return `<nav class="sidebar-tree" aria-label="${esc(label)}" data-component="sidebar-tree"><ul role="tree">${workspaces.map(w => row('workspace', w, 1)).join('')}</ul></nav>`;
}
