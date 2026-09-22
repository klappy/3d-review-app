// Kit ↔ app adapter (K3a normal-root read slice). Presentation mapping only: no transport, no storage, no role synthesis.
// The real controller (assess.js) owns identity, routes, data and permissions; this module turns what it has ALREADY loaded
// into a kit shell model, mounts the shell once around a stable content element, and adopts (moves, never clones) the real
// account/version controls into the shell's header host.
import { mountShell } from './tree.js';
import { safeHref } from './core.js';

const CAP = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const CONTROL_IDS = Object.freeze(['version', 'account']);

// Page-model status → kit read state. Missing data is never 'ready'.
export function mapStatus(status) {
  switch (status) {
    case 'loaded': return 'ready';
    case 'unauthenticated': case 'refused': case 'not_built': case 'failed': return status;
    default: return 'failed';
  }
}

// Tree nodes from loaded, authorized data only. `known` is what the controller already holds:
//   projects: [{id,name,role,workspace_id}]   (from /v2/projects at boot)
//   workspaces: Map<wid,{id,name,projects:[pid]}> (cached by workspaceFor) plus page-level lists
//   lists: Map<pid,{status,list}>              (assessmentsFor cache)
//   page: { kind, model }                      (the current scope page's loaded model, if any)
// Nothing here issues a request; an ancestor the identity cannot read is simply absent (no invented links).
export function treeNodes(routes, known = {}) {
  const projects = known.projects || [], lists = known.lists || new Map(), page = known.page || null;
  const wsMap = new Map();
  for (const [id, w] of known.workspaces || []) wsMap.set(id, { id, name: w.name, role: w.role, projects: w.projects || [] });
  if (page?.kind === 'workspaces' && page.model?.status === 'loaded') for (const w of page.model.workspaces || []) if (!wsMap.has(w.id)) wsMap.set(w.id, { id: w.id, name: w.name, role: w.role, projects: [] });
  if (page?.kind === 'workspace' && page.model?.status === 'loaded') { const w = page.model.workspace || {}; if (w.id) wsMap.set(w.id, { id: w.id, name: w.name, role: w.role, projects: (page.model.projects || []).map(p => p.id) }); }
  const projById = new Map(projects.map(p => [p.id, p]));
  if (page?.kind === 'workspace' && page.model?.status === 'loaded') for (const p of page.model.projects || []) if (!projById.has(p.id)) projById.set(p.id, p);
  if (page?.kind === 'project' && page.model?.status === 'loaded') { const p = page.model.project || {}; if (p.id && !projById.has(p.id)) projById.set(p.id, p); }
  const assessmentsOf = pid => {
    const l = lists.get(pid);
    if (page?.kind === 'project' && page.model?.status === 'loaded' && page.model.project?.id === pid && page.model.assessmentsStatus === 'loaded') return page.model.assessments || [];
    return l?.status === 'loaded' ? (l.list || []) : [];
  };
  const projectNode = p => ({ id: 'p:' + p.id, kind: 'project', label: String(p.name ?? p.id), href: routes.project(p.id), visible: true, role: p.role ? CAP(p.role) : undefined,
    children: assessmentsOf(p.id).map(a => ({ id: 'a:' + a.id, kind: 'assessment', label: String(a.name ?? a.id), detail: a.stage ? CAP(a.stage) : undefined, href: routes.assessment(a.id), visible: true, children: [] })) });
  const grouped = new Set();
  const wsNodes = [...wsMap.values()].map(w => { const kids = w.projects.map(pid => projById.get(pid)).filter(Boolean); kids.forEach(p => grouped.add(p.id)); return { id: 'w:' + w.id, kind: 'workspace', label: String(w.name ?? w.id), href: routes.workspace(w.id), visible: true, role: w.role ? CAP(w.role) : undefined, children: kids.map(projectNode) }; });
  const loose = [...projById.values()].filter(p => !grouped.has(p.id)).map(projectNode);
  return [...wsNodes, ...loose];
}

// Ancestry/title/role for the current route from loaded data only. `current` is state.current (assessment) or null.
export function shellModel({ route, routes, principal, known = {}, current = null, page = null, identityLabel, sectionLabel }) {
  const kind = route?.kind || 'entry';
  const nodes = treeNodes(routes, { ...known, page });
  const projects = known.projects || [];
  const findProject = pid => projects.find(p => p.id === pid) || (page?.kind === 'project' && page.model?.project?.id === pid ? page.model.project : null) || (page?.kind === 'workspace' ? (page.model?.projects || []).find(p => p.id === pid) : null);
  const findWorkspace = wid => (known.workspaces || new Map()).get(wid) || (page?.kind === 'workspace' && page.model?.workspace?.id === wid ? page.model.workspace : null);
  let ancestors = [], title = '', eyebrow = '', currentHref = '', role = '', expanded = [];
  const anc = (label, href) => ({ label: String(label ?? ''), href, visible: true });
  const status = page ? mapStatus(page.model?.status) : 'ready';
  if (kind === 'workspaces') { title = 'Workspaces'; eyebrow = 'Optional grouping'; currentHref = routes.workspaces; ancestors = [anc('Workspaces', routes.workspaces)]; }
  else if (kind === 'projects') { title = 'Projects'; eyebrow = 'Your projects'; currentHref = routes.projects; ancestors = [anc('Projects', routes.projects)]; }
  else if (kind === 'workspace') { const w = findWorkspace(route.id); currentHref = routes.workspace(route.id); title = status === 'ready' ? String(w?.name ?? '') : ''; eyebrow = 'Workspace'; role = CAP(w?.role); ancestors = [anc('Workspaces', routes.workspaces), ...(w ? [anc(w.name, currentHref)] : [])]; expanded = ['w:' + route.id]; }
  else if (kind === 'project') { const p = findProject(route.id); const w = p?.workspace_id ? findWorkspace(p.workspace_id) : null; currentHref = routes.project(route.id); title = status === 'ready' ? String(p?.name ?? '') : ''; eyebrow = 'Project'; role = CAP(p?.role); ancestors = [anc('Projects', routes.projects), ...(w ? [anc(w.name, routes.workspace(w.id))] : []), ...(p ? [anc(p.name, currentHref)] : [])]; expanded = [...(w ? ['w:' + w.id] : []), 'p:' + route.id]; }
  else if ((kind === 'assessment' || kind === 'survey') && current) { const a = current.assessment; const p = findProject(a.project_id); const w = p?.workspace_id ? findWorkspace(p.workspace_id) : null; currentHref = routes.assessment(a.id); title = String(a.name ?? ''); eyebrow = 'Assessment'; role = CAP(a.role);
    ancestors = [...(w ? [anc(w.name, routes.workspace(w.id))] : []), ...(p ? [anc(p.name, routes.project(p.id))] : []), anc(a.name, currentHref)];
    expanded = [...(w ? ['w:' + w.id] : []), ...(p ? ['p:' + p.id] : [])];
    // Direct grant: the assessment is reachable and listed truthfully under its own heading; no workspace/project link is invented.
    if (!p) nodes.push({ id: 'a:' + a.id, kind: 'assessment', label: String(a.name ?? ''), detail: a.stage ? CAP(a.stage) : undefined, href: currentHref, visible: true, role: CAP(a.role), children: [] }); }
  else if (kind === 'permissions') { title = 'Permissions'; eyebrow = CAP(route.scope); currentHref = safeHref('#permissions/' + route.scope + '/' + encodeURIComponent(route.id)) || ''; }
  else if (kind === 'feedback') { title = 'App feedback'; eyebrow = 'Feedback'; currentHref = '#feedback'; }
  else { title = principal ? 'Welcome' : '3D Review'; eyebrow = ''; currentHref = '#'; }
  const seen = new Set(); ancestors = ancestors.filter(x => safeHref(x.href) && !seen.has(x.href) && seen.add(x.href));
  // Review F3: the role label comes ONLY from loaded authority for the current scope; with none it is empty — never a synthesized permission.
  return { context: { route: kind, id: route?.id ?? null }, identityLabel: identityLabel || (principal ? 'Signed in' : 'Not signed in'), role, sample: false, title, eyebrow, currentHref, expanded, sectionLabel: sectionLabel || (nodes.length ? 'Workspaces' : 'Nothing loaded'), nodes, ancestors, actions: [], menuLabel: 'Actions', status };
}

// Mount the kit shell once around a stable content element. Returns null when the root is absent (tests without a DOM).
export function mountKitRoot(root, model, callbacks = {}) {
  if (!root || typeof root.querySelector !== 'function') return null;
  const shell = mountShell(root, model, callbacks);
  return {
    shell,
    get content() { return shell.content; },
    get headerHost() { return shell.headerHost; },
    update(next, cb = callbacks) { shell.update(next, cb); },
    // Move (never clone) the real controls into the host; listeners stay bound to the same nodes.
    adoptControls(doc, ids = CONTROL_IDS) { const host = shell.headerHost; if (!host) return []; const moved = []; for (const id of ids) { const el = doc.getElementById(id); if (el && el.parentNode !== host) { host.append(el); moved.push(id); } } return moved; },
    // Empty the content mount without touching the header host or the shell chrome.
    clearContent() { shell.content?.replaceChildren(); },
    destroy() { shell.destroy(); },
  };
}
