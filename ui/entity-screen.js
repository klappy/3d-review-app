// One entity per screen. Source: cookbook 2c29676 views-coordinator (V.projects / V.project) + tree.js crumbs/levelMenu.
// This controller owns exactly one body attribute, data-entity-level ∈ workspaces | workspace | project | assessment | survey,
// derived from actual selection state (the existing #projects/#assessments selects and the W manager's selected
// workspace), plus a deep link (#p/<pid>, #p/<pid>/a/<aid>) resolved ONLY through those selects — set-then-verify,
// dispatch change, never inject options, never grant. Presentation only: entity-screen.css hides what is not the
// selected entity; every hidden flag and authority check stays where it was.
export function entityLevel({ staff, workspace, project, assessment, survey }) {
  if (!staff) return null;
  if (assessment && survey) return 'survey';
  if (assessment) return 'assessment';
  if (project) return 'project';
  if (workspace) return 'workspace';
  return 'workspaces';
}
export function parseDeepLink(hash) {
  const m = /^#p\/([A-Za-z0-9_.-]+)(?:\/a\/([A-Za-z0-9_.-]+))?$/.exec(hash || '');
  return m ? { project: m[1], assessment: m[2] || null } : null;
}
export function deepLinkFor({ project, assessment }) {
  return project ? `#p/${encodeURIComponent(project)}${assessment ? `/a/${encodeURIComponent(assessment)}` : ''}` : '';
}
export function mountEntityScreen(doc, win, { isStaff, selectedWorkspace, backToWorkspaces }) {
  const body = doc.body, projects = doc.getElementById('projects'), assessments = doc.getElementById('assessments'), surveys = doc.getElementById('surveys');
  const back = doc.getElementById('entity-back');
  let pending = null; // unresolved deep link, retried once after the next option refresh
  function level() { return entityLevel({ staff: isStaff(), workspace: selectedWorkspace(), project: projects.value, assessment: assessments.value, survey: surveys?.value }); }
  function select(sel, id) { if (!sel || sel.value === id) return true; sel.value = id; if (sel.value !== id) return false; sel.dispatchEvent(new win.Event('change', { bubbles: true })); return true; }
  function resolve() {
    if (!pending || !isStaff()) return;
    if (!select(projects, pending.project)) { doc.getElementById('load-projects')?.click(); pending.retried = (pending.retried || 0) + 1; if (pending.retried > 1) pending = null; return; }
    if (pending.assessment && !select(assessments, pending.assessment)) { if (projects.value === pending.project && assessments.options.length > 1) pending = null; return; }
    pending = null;
  }
  function render() {
    const l = level();
    if (body?.dataset) { if (l) body.dataset.entityLevel = l; else delete body.dataset.entityLevel; }
    if (back) {
      const label = l === 'survey' ? 'Back to assessment' : l === 'assessment' ? 'Back to project' : l === 'project' ? 'Back to workspaces' : l === 'workspace' ? 'Back to workspaces' : '';
      const text = label ? `← ${label}` : '';
      if (back.hidden !== !label) back.hidden = !label;
      if (back.textContent !== text) back.textContent = text; // write only on change: this node sits inside observed roots
    }
    // The URL reflects the selected entity; never a token, never the participant/shared fragments.
    if (l && isStaff()) { const want = deepLinkFor({ project: projects.value, assessment: assessments.value }); const cur = win.location?.hash ?? ''; if (want && cur !== want && !/^#(session=|survey=|participant|facilitator|reports-card|workspace|evidence)/.test(cur) && (cur === '' || parseDeepLink(cur))) win.history?.replaceState(null, '', win.location.pathname + want); else if (!want && parseDeepLink(cur)) win.history?.replaceState(null, '', win.location.pathname); }
  }
  back?.addEventListener?.('click', () => {
    const l = level();
    if (l === 'survey') select(surveys, '');
    else if (l === 'assessment') select(assessments, '');
    else if (l === 'project') { select(projects, ''); }
    else if (l === 'workspace') backToWorkspaces();
    render();
  });
  if (typeof win.MutationObserver === 'function') { // option refreshes, identity text and W renders arrive without events; the selects' change events still drive render without an observer
    const observer = new win.MutationObserver(() => { resolve(); render(); });
    for (const id of ['projects', 'assessments', 'surveys', 'identity', 'workspace-manager-root']) { const n = doc.getElementById(id); if (n) observer.observe(n, { childList: true, subtree: true, attributes: true, characterData: true }); }
    { const n = doc.getElementById('facilitator'); if (n) observer.observe(n, { attributes: true, attributeFilter: ['hidden'] }); }
  }
  projects.addEventListener('change', render); assessments.addEventListener('change', render); surveys?.addEventListener('change', render);
  win.addEventListener?.('hashchange', () => { pending = parseDeepLink(win.location.hash); resolve(); render(); });
  pending = parseDeepLink(win.location?.hash);
  render();
  return { render, reset() { pending = null; render(); } };
}
