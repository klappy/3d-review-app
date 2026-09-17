// Workspace overview — the coordinator's "All projects" and "Project" states, wired to the real
// /v2 reads and to the existing #projects/#assessments selectors. Reproduces the cookbook kit
// (design-system/ui_kits/3d-review, pin 2c29676): views-coordinator.js V.projects and the V.project
// default branch, tree.js crumbs + levelMenu, core.js heading.
//
// Containment (S4 #13): this module writes only inside #overview-crumbs, #overview-all and
// #overview-project, and toggles `hidden` only on #overview and those three. It never reads, hides,
// moves or restyles any other node. The existing selectors and forms are touched only as the
// controls the map assigns to them: set value + dispatch change, or focus.
//
// Reads only. Every request is a GET; the module issues no write in any state.
import { currentNamespace, parseEntryFragment } from './shared-link.js';

export const ROOT_IDS = Object.freeze(['overview-crumbs', 'overview-all', 'overview-project']);

// Kit copy, verbatim from V.projects (views-coordinator.js L6-9) and the V.project default branch.
export const COPY = Object.freeze({
  allEyebrow: 'All projects',
  allHeading: 'Choose a project, or create one',
  allLead: 'Each project holds its own assessments. A project appears here only if you hold a grant on it.',
  createProject: 'Create a project',
  openProject: 'Open project',
  archived: 'Archived',
  projectEyebrow: 'Project',
  startAssessment: 'Start an assessment',
  assessments: 'Assessments',
  languages: 'Languages',
  open: 'Open →',
  // S4 #4: under exact-grant listing, absence is "no grant", never "none exists".
  noAssessmentsAll: 'No assessments you hold a grant on. Start an assessment →',
  noAssessments: 'No assessments you hold a grant on.',
  noLanguages: 'No languages you hold a grant on.',
  crumbsLabel: 'Where you are',
  columns: Object.freeze(['Assessment', 'Period', 'Language', 'Stage']),
});

const enc = value => encodeURIComponent(String(value));

// S4 #8 (blocking): the module runs only where app.js decides it is NOT on the shared route, using
// app.js's own test — no entry fragment and no remembered shared namespace.
export function facilitatorRoute(win, storage) {
  let hash = '';
  try { hash = (win && win.location && win.location.hash) || ''; } catch { hash = ''; }
  if (parseEntryFragment(hash) !== null) return false;
  try { return currentNamespace(storage) === null; } catch { return false; }
}

// S4 #8: read per request, never cached on the module.
export function bearer(storage) {
  try { return storage.getItem('facilitatorToken') || null; } catch { return null; }
}

export function signedOut(doc, storage) {
  if (!bearer(storage)) return true;
  const identity = doc.getElementById('identity');
  return !!identity && String(identity.textContent || '').trim() === 'Not signed in';
}

export function languageName(languages, id) {
  const found = (languages || []).find(entry => entry && entry.id === id);
  return found && found.name ? found.name : (id || '');
}

// S4 #7: set the value, verify it took, and on a miss click the existing refresh control and try
// once more. An option is never injected — a project the server did not list is not selectable.
export async function selectAndChange(doc, win, selectId, refreshId, value) {
  const select = doc.getElementById(selectId);
  if (!select) return false;
  select.value = value;
  if (select.value !== value) {
    const refresh = doc.getElementById(refreshId);
    if (!refresh || refresh.hidden || refresh.disabled) return false;
    refresh.click();
    await settleTick(win);
    select.value = value;
    if (select.value !== value) return false;
  }
  select.dispatchEvent(new win.Event('change', { bubbles: true }));
  return true;
}

function settleTick(win) {
  return new Promise(resolve => {
    if (win && typeof win.setTimeout === 'function') win.setTimeout(resolve, 0);
    else resolve();
  });
}

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text); // text nodes only, never innerHTML
  if (className) node.className = className;
  return node;
}

// core.js heading (L67).
function heading(doc, eyebrow, title, lead) {
  const nodes = [el(doc, 'div', eyebrow, 'eyebrow'), el(doc, 'h1', title)];
  if (lead) nodes.push(el(doc, 'p', lead, 'muted'));
  return nodes;
}

// A2: a <form> is not focusable, so focusing it silently does nothing. Navigate to the surface the
// server already permits and focus its first enabled control. A hidden form is never revealed and
// no authority flag is touched — the caller checks visibility, and so does this.
export function focusFirstControl(form) {
  if (!form || form.hidden) return null;
  const control = firstControl(form);
  if (!control) return null;
  if (typeof control.scrollIntoView === 'function') { try { control.scrollIntoView({ block: 'center' }); } catch { /* not scrollable here */ } }
  if (typeof control.focus === 'function') control.focus();
  return control;
}
function firstControl(node) {
  for (const child of node.children || []) {
    const tag = String(child.tagName || child.tag || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) && !child.disabled && !child.hidden && child.type !== 'hidden') return child;
    const nested = firstControl(child);
    if (nested) return nested;
  }
  return null;
}

function button(doc, label, className, onClick) {
  const node = el(doc, 'button', label, className);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

export function mountWorkspaceOverview({ doc, win, fetchImpl } = {}) {
  const $ = id => doc.getElementById(id);
  const overview = $('overview');
  const crumbsRoot = $('overview-crumbs'), allRoot = $('overview-all'), projectRoot = $('overview-project');
  if (!overview || !crumbsRoot || !allRoot || !projectRoot) return null; // self-mounting: no roots, no module
  const storage = win.sessionStorage;
  const request = fetchImpl || ((url, options) => win.fetch(url, options));
  let generation = 0;
  let pending = false;
  let section = 'assessments'; // levelMenu selection, page memory only

  // Read-only envelope reader. These GETs deliberately bypass app.js's api(): they never post a
  // receipt and never appear in #events (S4 #9).
  async function read(url) {
    const headers = { accept: 'application/json' };
    const token = bearer(storage);
    if (token) headers.authorization = `Bearer ${token}`;
    let response;
    try { response = await request(url, { method: 'GET', headers, credentials: 'same-origin', cache: 'no-store' }); }
    catch { return null; }
    let data;
    try { data = await response.json(); } catch { return null; }
    if (!response.ok || !data || data.ok !== true) return null;
    return data.result;
  }

  // S4 #13 as amended: the module may set exactly one attribute outside its roots —
  // body.dataset.overviewState ∈ none|all|project|assessment — and nothing else. It carries no
  // authority: the stylesheet uses it only to order and quiet presentation the state has no use for.
  function setState(value) {
    const body = doc.body;
    if (!body || !body.dataset) return;
    if (body.dataset.overviewState !== value) body.dataset.overviewState = value;
  }

  function clear() {
    for (const root of [crumbsRoot, allRoot, projectRoot]) { root.replaceChildren(); root.hidden = true; }
  }
  function stand(root, ...children) {
    root.replaceChildren(...children);
    root.hidden = !children.length;
  }

  // --- A. All projects (V.projects, views-coordinator.js L6-9) -----------------------------------
  function renderAll(projects) {
    const nodes = [...heading(doc, COPY.allEyebrow, COPY.allHeading, COPY.allLead)];
    const createForm = $('create-project');
    // S4 #11: the existing form's own hidden attribute is the permission; no /v2/me call here.
    if (createForm && !createForm.hidden) {
      const row = el(doc, 'div', undefined, 'row');
      row.append(button(doc, COPY.createProject, 'rv-btn primary', () => { focusFirstControl($('create-project')); }));
      nodes.push(row);
    }
    const grid = el(doc, 'div', undefined, 'three');
    for (const project of projects) {
      const card = el(doc, 'div', undefined, 'glass panel');
      const head = el(doc, 'div', undefined, 'row');
      head.append(el(doc, 'h3', project.name));
      if (project.archived_at) head.append(el(doc, 'span', COPY.archived, 'badge'));
      card.append(head);
      // The app has no lang/format on a project, so the kit's muted line carries what exists.
      card.append(el(doc, 'p', [project.organization, project.role].filter(Boolean).join(' · '), 'muted'));
      const actions = el(doc, 'div', undefined, 'row');
      actions.append(button(doc, COPY.openProject, 'rv-btn', () => {
        selectAndChange(doc, win, 'projects', 'load-projects', project.id);
      }));
      card.append(actions);
      grid.append(card);
    }
    nodes.push(grid);
    stand(allRoot, ...nodes);
  }

  // --- B. Project (V.project default branch) -----------------------------------------------------
  // tree.js levelMenu (L112-119), reduced to the two sections that have real data behind them.
  function levelMenu(onSelect) {
    const nav = el(doc, 'nav', undefined, 'phases');
    nav.setAttribute('aria-label', 'project sections');
    for (const [key, label] of [['assessments', COPY.assessments], ['languages', COPY.languages]]) {
      const item = button(doc, label, section === key ? 'on' : '', () => { section = key; onSelect(); });
      item.setAttribute('aria-current', section === key ? 'true' : 'false');
      nav.append(item);
    }
    return nav;
  }

  function assessmentTable(rows, languages) {
    if (!rows.length) return el(doc, 'div', COPY.noAssessments, 'note');
    const table = el(doc, 'table', undefined, 'table');
    const thead = el(doc, 'thead'), headRow = el(doc, 'tr');
    for (const column of COPY.columns) headRow.append(el(doc, 'th', column));
    headRow.append(el(doc, 'th', ''));
    thead.append(headRow);
    const tbody = el(doc, 'tbody');
    for (const row of rows) {
      const tr = el(doc, 'tr');
      const name = el(doc, 'td'); name.append(el(doc, 'strong', row.name)); tr.append(name);
      tr.append(el(doc, 'td', row.period || ''));
      tr.append(el(doc, 'td', languageName(languages, row.language_id)));
      const stage = el(doc, 'td');
      stage.append(el(doc, 'span', row.stage, 'badge')); // the exact stage word the server returned
      if (row.archived_at) stage.append(el(doc, 'span', COPY.archived, 'badge'));
      tr.append(stage);
      const open = el(doc, 'td');
      open.append(button(doc, COPY.open, 'rv-btn quiet', () => {
        selectAndChange(doc, win, 'assessments', 'load-assessments', row.id);
      }));
      tr.append(open);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    return table;
  }

  function languageList(languages) {
    if (!languages.length) return el(doc, 'div', COPY.noLanguages, 'note');
    const list = el(doc, 'div', undefined, 'glass panel');
    for (const language of languages) list.append(el(doc, 'p', [language.name, language.code].filter(Boolean).join(' · '), 'muted'));
    return list;
  }

  function renderProject(project, rows, languages, repaint) {
    const nodes = [];
    const headrow = el(doc, 'div', undefined, 'headrow');
    const title = el(doc, 'div');
    title.append(...heading(doc, COPY.projectEyebrow, project.name, `${project.organization || ''} · your role: ${project.role}`.replace(/^ · /, '')));
    headrow.append(title);
    const card = $('assessment-card');
    // S4 #11: visibility of the existing create form is the server's ruling; the client adds none.
    if (card && !card.hidden) {
      const actions = el(doc, 'div', undefined, 'row');
      actions.append(button(doc, COPY.startAssessment, 'rv-btn primary', () => {
        const card = $('assessment-card');
        if (!card || card.hidden) return; // the surface itself is gated; never reveal an ancestor
        focusFirstControl($('create-assessment'));
      }));
      headrow.append(actions);
    }
    nodes.push(headrow, levelMenu(repaint));
    if (section === 'languages') nodes.push(el(doc, 'h2', COPY.languages), languageList(languages));
    else nodes.push(el(doc, 'h2', COPY.assessments), assessmentTable(rows, languages));
    stand(projectRoot, ...nodes);
  }

  // Collapsed row (S4 #13): with an assessment selected the phase composition owns the space below,
  // so the overview keeps only its crumbs and one project line, and never hides itself.
  function renderProjectRow(project) {
    stand(projectRoot, el(doc, 'p', [project.name, project.organization, `your role: ${project.role}`].filter(Boolean).join(' · '), 'muted'));
  }

  // --- C. Crumbs (tree.js crumbs, L98-110) -------------------------------------------------------
  function renderCrumbs(project, assessment) {
    if (!project) { stand(crumbsRoot); return; }
    const nav = el(doc, 'nav', undefined, 'crumbs');
    nav.setAttribute('aria-label', COPY.crumbsLabel);
    const last = assessment || project;
    const projectCrumb = button(doc, project.name, '', () => {
      selectAndChange(doc, win, 'assessments', 'load-assessments', '');
    });
    if (!assessment) projectCrumb.setAttribute('aria-current', 'location');
    nav.append(projectCrumb);
    if (assessment) {
      nav.append(el(doc, 'span', '›', 'sep'));
      const assessmentCrumb = button(doc, assessment.name, '', () => {
        selectAndChange(doc, win, 'assessments', 'load-assessments', assessment.id);
      });
      assessmentCrumb.setAttribute('aria-current', 'location');
      nav.append(assessmentCrumb);
    }
    // The role of the deepest selected scope, exactly as the server returned it.
    if (last.role) {
      const badge = el(doc, 'span', last.role, 'badge');
      badge.setAttribute('title', 'Your role at this scope');
      nav.append(badge);
    }
    stand(crumbsRoot, nav);
  }

  async function refresh() {
    const gen = ++generation;
    if (!facilitatorRoute(win, storage) || signedOut(doc, storage)) { clear(); overview.hidden = true; setState('none'); return; }
    const projectsResult = await read('/v2/projects');
    if (gen !== generation) return; // stale: the selection or the identity moved on
    if (!projectsResult) { clear(); overview.hidden = true; setState('none'); return; }
    const projects = projectsResult.projects || [];
    // No project grants at all: this identity's entry is #shared-assessments, not the overview.
    // The module says nothing rather than reporting an absence the viewer cannot act on.
    if (!projects.length) { clear(); overview.hidden = true; setState('none'); return; }
    const pid = ($('projects') || {}).value || '';
    const aid = ($('assessments') || {}).value || '';
    overview.hidden = false;

    if (!pid) { stand(projectRoot); renderCrumbs(null, null); setState('all'); renderAll(projects); return; }

    const [detail, list] = await Promise.all([read(`/v2/projects/${enc(pid)}`), read(`/v2/projects/${enc(pid)}/assessments`)]);
    if (gen !== generation) return; // stale
    const project = detail && detail.project ? detail.project : projects.find(entry => entry.id === pid);
    if (!project) { clear(); overview.hidden = true; setState('none'); return; }
    const languages = (detail && detail.languages) || [];
    const rows = (list && list.assessments) || [];
    const assessment = aid ? rows.find(row => row.id === aid) || null : null;

    stand(allRoot); // exactly one of A / B occupies the overview
    renderCrumbs(project, assessment);
    setState(assessment ? 'assessment' : 'project');
    if (assessment) { renderProjectRow(project); return; }
    // One closure, reused by every repaint: the level menu must survive any number of
    // Assessments/Languages transitions, not just the first.
    const repaint = () => { if (gen === generation) renderProject(project, rows, languages, repaint); };
    repaint();
  }

  // Coalesce the burst of option mutations app.js produces while repopulating a select.
  function schedule() {
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => { pending = false; refresh(); });
  }

  for (const id of ['projects', 'assessments']) {
    const select = $(id);
    if (select) select.addEventListener('change', schedule);
  }
  if (typeof win.MutationObserver === 'function') {
    const observer = new win.MutationObserver(schedule);
    for (const id of ['projects', 'assessments']) { const node = $(id); if (node) observer.observe(node, { childList: true, subtree: true }); }
    const identity = $('identity');
    if (identity) observer.observe(identity, { childList: true, characterData: true, subtree: true });
  }
  schedule();
  return { refresh, schedule };
}

// Self-mounting: in the browser the roots decide whether this module does anything at all.
if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById('overview')) {
  mountWorkspaceOverview({ doc: document, win: window });
}
