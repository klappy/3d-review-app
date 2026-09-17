import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { COPY, facilitatorRoute, focusFirstControl, languageName, mountWorkspaceOverview, selectAndChange } from './workspace-overview.js';

// A minimal DOM, in the same shape as the other ui/ DOM tests: enough of the real contract
// (select.value refuses an absent option, change listeners, hidden, text nodes) to drive the module
// itself rather than a re-implementation of it. Browser validation stays a separate gate.
function fakeNode(tag, id) {
  const attrs = new Map();
  const node = {
    tag, id, textContent: '', className: '', children: [], listeners: {}, hidden: false, disabled: false,
    type: '', options: [], clicks: 0, focused: 0, writes: 0,
    setAttribute(k, v) { attrs.set(k, String(v)); }, getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); },
    dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); return true; },
    click() { this.clicks += 1; this.dispatchEvent({ type: 'click', preventDefault() {}, currentTarget: this }); },
    focus() { this.focused += 1; },
    append(...nodes) { this.writes += 1; this.children.push(...nodes); },
    replaceChildren(...nodes) { this.writes += 1; this.children = nodes; },
  };
  let value = '';
  Object.defineProperty(node, 'value', {
    get() { return value; },
    // Real select semantics: assigning a value with no matching option yields ''.
    set(v) { value = !node.options.length || node.options.some(o => o.value === v) ? v : ''; },
  });
  return node;
}
function fakeWorld({ hash = '', session = { facilitatorToken: 'st_owner' }, identity = 'principal · me' } = {}) {
  const nodes = new Map(), requests = [];
  const body = fakeNode('body'); body.dataset = {};
  const doc = {
    body,
    getElementById(id) { return nodes.has(id) ? nodes.get(id) : null; },
    createElement(tag) { return fakeNode(tag); },
  };
  const make = (id, patch = {}) => { const n = fakeNode('div', id); Object.assign(n, patch); nodes.set(id, n); return n; };
  for (const id of ['overview', 'overview-crumbs', 'overview-all', 'overview-project']) make(id, { hidden: true });
  make('identity', { textContent: identity });
  const projects = make('projects'), assessments = make('assessments');
  projects.tag = assessments.tag = 'select';
  make('load-projects'); make('load-assessments');
  // Real forms hold their controls inside labels; a <form> itself is not focusable.
  const form = (id) => {
    const f = make(id, { hidden: false }); f.tag = 'form';
    const label = fakeNode('label');
    const skipped = fakeNode('input'); skipped.tagName = 'INPUT'; skipped.disabled = true;
    const input = fakeNode('input'); input.tagName = 'INPUT'; input.name = 'name';
    label.children.push(skipped, input);
    f.children.push(label);
    f.firstInput = input; f.disabledInput = skipped;
    return f;
  };
  form('create-project'); form('create-assessment');
  make('assessment-card', { hidden: false });
  const sibling = make('project-card', { hidden: false, textContent: 'existing card' }); // containment spy
  const store = new Map(Object.entries(session));
  const win = {
    location: { hash },
    sessionStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    Event: class { constructor(type, init = {}) { this.type = type; this.bubbles = !!init.bubbles; } },
    setTimeout: (fn) => { fn(); return 0; },
  };
  let routes = {};
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: (options && options.method) || 'GET', headers: (options && options.headers) || {} });
    const body = routes[url];
    if (body === undefined) return { ok: false, status: 404, json: async () => ({ ok: false, error: { code: 'NOT_FOUND_OR_NOT_VISIBLE' } }) };
    if (typeof body === 'function') return body();
    return { ok: true, status: 200, json: async () => ({ ok: true, result: body }) };
  };
  return { doc, win, body, nodes, node: id => nodes.get(id), requests, sibling, projects, assessments,
    setRoutes(next) { routes = next; },
    mount() { return mountWorkspaceOverview({ doc, win, fetchImpl }); },
    async settle() { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); } };
}
const option = (value, label) => ({ value, label });
const text = node => [node.textContent, ...(node.children || []).map(text)].join(' ');
const walk = node => [node, ...(node.children || []).flatMap(walk)];

const PROJECTS = { projects: [
  { id: 'p1', workspace_id: null, name: 'Coast', organization: 'Partner org', archived_at: null, created_at: '2026-01-01', role: 'owner' },
  { id: 'p2', workspace_id: null, name: 'Highland', organization: 'Highland trust', archived_at: '2026-02-02', created_at: '2026-01-02', role: 'member' },
] };
const PROJECT_P1 = { project: PROJECTS.projects[0], languages: [{ id: 'l1', code: 'xyz', name: 'Coast language' }] };
const ASSESSMENTS_P1 = { assessments: [
  { id: 'a1', project_id: 'p1', language_id: 'l1', name: 'October cycle', purpose: null, period: 'October 2026', format: 'Written', stage: 'collect', archived_at: null, created_at: '2026-03-01', role: 'owner' },
  { id: 'a2', project_id: 'p1', language_id: 'l1', name: 'April cycle', purpose: null, period: 'April 2026', format: null, stage: 'understand', archived_at: null, created_at: '2026-02-01', role: 'member' },
] };
const ROUTES = { '/v2/projects': PROJECTS, '/v2/projects/p1': PROJECT_P1, '/v2/projects/p1/assessments': ASSESSMENTS_P1 };

test('A: one card per granted project with the kit copy verbatim and no counts', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES); w.mount(); await w.settle();
  const all = w.node('overview-all');
  assert.equal(w.node('overview').hidden, false);
  assert.equal(all.hidden, false);
  assert.equal(all.children[0].textContent, COPY.allEyebrow);
  assert.equal(all.children[0].className, 'eyebrow');
  assert.equal(all.children[1].textContent, 'Choose a project, or create one');
  assert.equal(all.children[2].textContent, 'Each project holds its own assessments. A project appears here only if you hold a grant on it.');
  const grid = walk(all).find(n => n.className === 'three');
  assert.equal(grid.children.length, 2, 'one card per project, no extra');
  assert.equal(grid.children.every(c => c.className === 'glass panel'), true);
  assert.match(text(grid.children[0]), /Coast/);
  assert.match(text(grid.children[0]), /Partner org · owner/);
  assert.match(text(grid.children[1]), /Archived/);
  assert.match(text(grid.children[1]), /Highland trust · member/);
  assert.equal(text(grid.children[0]).includes('Archived'), false);
  assert.equal(/\d+ assessment|\d+ response|count/i.test(text(all)), false, 'no invented counts');
  assert.equal(w.node('overview-project').hidden, true);
});

test('A: Open project sets the existing select and dispatches change', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1'), option('p2')];
  let fired = 0;
  w.projects.addEventListener('change', () => { fired += 1; });
  w.mount(); await w.settle();
  const openButtons = walk(w.node('overview-all')).filter(n => n.textContent === COPY.openProject);
  assert.equal(openButtons.length, 2);
  openButtons[0].click(); await w.settle();
  assert.equal(w.projects.value, 'p1');
  assert.ok(fired >= 1, 'the existing chooseProject change listener must have fired');
  assert.equal(w.node('load-projects').clicks, 0, 'no refresh needed when the option is present');
});

test('A: Open project refuses a missing option after one refresh retry and injects nothing', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option('')]; // the server listed p1 but the select has not been repopulated
  let fired = 0;
  w.projects.addEventListener('change', () => { fired += 1; });
  w.mount(); await w.settle();
  walk(w.node('overview-all')).find(n => n.textContent === COPY.openProject).click();
  await w.settle();
  assert.equal(w.node('load-projects').clicks, 1, 'exactly one retry through the existing control');
  assert.equal(fired, 0, 'no change is dispatched for a value the select cannot hold');
  assert.deepEqual(w.projects.options.map(o => o.value), [''], 'no option was injected');
  assert.equal(w.projects.value, '');
});

test('B: the table has one row per assessment with the exact stage words and real language names', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.mount(); await w.settle();
  const project = w.node('overview-project');
  assert.equal(project.hidden, false);
  assert.equal(w.node('overview-all').hidden, true, 'exactly one of A/B occupies the overview');
  assert.match(text(project), /Project/);
  assert.match(text(project), /Coast/);
  assert.match(text(project), /Partner org · your role: owner/);
  const table = walk(project).find(n => n.className === 'table');
  const header = table.children[0].children[0];
  assert.deepEqual(header.children.map(c => c.textContent), ['Assessment', 'Period', 'Language', 'Stage', '']);
  const rows = table.children[1].children;
  assert.equal(rows.length, 2);
  assert.match(text(rows[0]), /October cycle/);
  assert.match(text(rows[0]), /October 2026/);
  assert.match(text(rows[0]), /Coast language/);
  const badges = walk(table).filter(n => n.className === 'badge').map(n => n.textContent);
  assert.deepEqual(badges, ['collect', 'understand'], 'the server stage word, not a relabelled one');
  assert.equal(/Surveys/.test(text(table)), false, 'the Surveys column needs a call per row and is omitted');
});

test('B: the empty table uses the exact-grant copy, never "No assessments yet."', async () => {
  const w = fakeWorld(); w.setRoutes({ ...ROUTES, '/v2/projects/p1/assessments': { assessments: [] } });
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.mount(); await w.settle();
  const note = walk(w.node('overview-project')).find(n => n.className === 'note');
  assert.equal(note.textContent, 'No assessments you hold a grant on.');
  assert.equal(/No assessments yet/.test(text(w.node('overview-project'))), false);
});

test('B: Open → sets the assessments select and dispatches change', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.assessments.options = [option(''), option('a1'), option('a2')];
  let fired = 0;
  w.assessments.addEventListener('change', () => { fired += 1; });
  w.mount(); await w.settle();
  const opens = walk(w.node('overview-project')).filter(n => n.textContent === COPY.open);
  assert.equal(opens.length, 2);
  opens[1].click(); await w.settle();
  assert.equal(w.assessments.value, 'a2');
  assert.ok(fired >= 1);
});

test('B: the level menu offers Assessments and Languages only, and Languages lists the project GET', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.mount(); await w.settle();
  const nav = walk(w.node('overview-project')).find(n => n.className === 'phases');
  assert.deepEqual(nav.children.map(c => c.textContent), ['Assessments', 'Languages']);
  assert.equal(/Details|People & access/.test(text(w.node('overview-project'))), false);
  nav.children[1].click(); await w.settle();
  assert.match(text(w.node('overview-project')), /Coast language · xyz/);
  const navAfter = walk(w.node('overview-project')).find(n => n.className === 'phases');
  navAfter.children[0].click(); await w.settle();
  assert.match(text(w.node('overview-project')), /October cycle/);
  assert.ok(walk(w.node('overview-project')).find(n => n.className === 'table'), 'Assessments restores the table after Languages');
});

test('C: crumbs carry project › assessment with aria-current and the deepest role badge', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.assessments.options = [option(''), option('a1'), option('a2')]; w.assessments.value = 'a2';
  w.mount(); await w.settle();
  const crumbs = w.node('overview-crumbs');
  assert.equal(crumbs.hidden, false);
  const nav = crumbs.children[0];
  assert.equal(nav.className, 'crumbs');
  assert.equal(nav.getAttribute('aria-label'), 'Where you are');
  assert.deepEqual(nav.children.map(c => c.textContent), ['Coast', '›', 'April cycle', 'member']);
  assert.equal(nav.children[0].getAttribute('aria-current'), null);
  assert.equal(nav.children[2].getAttribute('aria-current'), 'location');
  assert.equal(nav.children[3].className, 'badge', 'the a2 row role, not the project role');
  // S4 #13: the overview keeps its crumbs and the assessment header, and never hides itself.
  assert.equal(w.node('overview').hidden, false);
  assert.equal(w.node('overview-all').hidden, true);
  assert.equal(w.node('overview-project').children.length, 1);
  assert.equal(w.node('overview-project').children[0].className, 'headrow');
});

test('an assessment-only viewer with no project grants gets no overview at all', async () => {
  const w = fakeWorld({ session: { facilitatorToken: 'st_viewer' } });
  w.setRoutes({ ...ROUTES, '/v2/projects': { projects: [] } });
  w.mount(); await w.settle();
  assert.deepEqual(w.requests.map(r => r.url), ['/v2/projects'], 'an empty list ends the render; nothing else is asked');
  assert.equal(w.node('overview').hidden, true);
  for (const id of ['overview-crumbs', 'overview-all', 'overview-project']) {
    assert.equal(w.node(id).hidden, true, id);
    assert.deepEqual(w.node(id).children, [], id);
  }
  assert.equal(/No projects|grant on/.test([w.node('overview-all'), w.node('overview-project'), w.node('overview-crumbs')].map(text).join(' ')), false, 'no absence copy is painted');
});

test('an empty list clears an overview a previous identity had painted', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  const mounted = w.mount(); await w.settle();
  assert.equal(w.node('overview-all').hidden, false);
  w.setRoutes({ ...ROUTES, '/v2/projects': { projects: [] } });
  mounted.schedule(); await w.settle();
  assert.equal(w.node('overview').hidden, true);
  assert.deepEqual(w.node('overview-all').children, []);
});

// views-coordinator.js assessmentShell L59-62.
async function atAssessment(aid) {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.assessments.options = [option(''), option('a1'), option('a2'), option('a9')]; w.assessments.value = aid;
  w.mount(); await w.settle();
  return w;
}
const headrowOf = w => w.node('overview-project').children[0];

test('assessment state renders the source headrow from the real row', async () => {
  const w = await atAssessment('a1');
  const headrow = headrowOf(w);
  assert.equal(headrow.className, 'headrow');
  const title = headrow.children[0];
  assert.equal(title.children[0].className, 'eyebrow');
  assert.equal(title.children[0].textContent, 'Coast / October cycle');
  assert.equal(title.children[1].tag, 'h1');
  assert.equal(title.children[1].textContent, 'October cycle');
  assert.equal(title.children[2].className, 'muted');
  assert.equal(title.children[2].textContent, 'October 2026 · Coast language · Written');
  assert.equal(title.children.length, 3, 'eyebrow, h1, muted — nothing else');
});

test('the headrow omits the kit words the app has no field for, and never repeats the stage', async () => {
  const w = await atAssessment('a1');
  const page = text(headrowOf(w));
  assert.equal(/Sample/.test(page), false, 'the kit fixture badge is not real data');
  assert.equal(/kind|Current project review|Follow-up/.test(page), false, 'no kind field exists');
  assert.equal(/prepare|collect|understand|improve|Preparing|Collecting/i.test(page), false, 'the phase tabs already show the stage');
  assert.equal(/owner|member|viewer/.test(page), false, 'the role sits in the crumbs badge, not twice');
  assert.equal(/Partner org|your role/.test(page), false, 'the project row copy is gone from this state');
});

test('a null field adds no separator and no placeholder', async () => {
  const w = await atAssessment('a2'); // April cycle: period + language, format null
  const title = headrowOf(w).children[0];
  assert.equal(title.children[1].textContent, 'April cycle');
  assert.equal(title.children[2].textContent, 'April 2026 · Coast language');
  assert.equal(/· *$|· ·|null|undefined|—/.test(text(headrowOf(w))), false);
});

test('a selected assessment the list does not carry falls back to the project row, with no h1', async () => {
  const w = await atAssessment('a9'); // authorized elsewhere, or simply not in this list
  const root = w.node('overview-project');
  assert.equal(root.hidden, false);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].className, 'muted', 'the project row, not a headrow');
  assert.equal(walk(root).some(n => n.tag === 'h1'), false, 'no name is invented for an unseen assessment');
  assert.match(text(root), /Coast · Partner org · your role: owner/);
  assert.equal(/a9/.test(text(root)), false, 'not even the raw id is passed off as a name');
  // The crumbs stay at the project, because that is the deepest scope actually read.
  const nav = w.node('overview-crumbs').children[0];
  assert.deepEqual(nav.children.map(c => c.textContent), ['Coast', 'owner']);
  assert.equal(w.body.dataset.overviewState, 'assessment', 'the live selection still owns the composition');
});

test('the headrow stays inside #overview-project and survives a stale list', async () => {
  const w = await atAssessment('a1');
  const before = w.sibling.children.length;
  assert.equal(w.node('overview-all').children.length, 0);
  assert.equal(w.sibling.children.length, before);
  assert.equal(w.node('overview-crumbs').children[0].className, 'crumbs');
});

test('shared route: nothing is requested and nothing is rendered', async () => {
  for (const world of [
    fakeWorld({ hash: '#survey=tok_abc', session: { facilitatorToken: 'st_owner' } }),
    fakeWorld({ session: { facilitatorToken: 'st_owner', 'shared:current': `shared:${'a'.repeat(64)}:` } }),
  ]) {
    world.setRoutes(ROUTES); world.mount(); await world.settle();
    assert.deepEqual(world.requests, [], 'the shared route issues no request');
    assert.equal(world.node('overview').hidden, true);
    for (const id of ['overview-crumbs', 'overview-all', 'overview-project']) {
      assert.equal(world.node(id).hidden, true, id);
      assert.deepEqual(world.node(id).children, [], id);
    }
  }
  assert.equal(facilitatorRoute({ location: { hash: '' } }, { getItem: () => null }), true);
});

test('signed out: the overview clears and hides, and asks for nothing', async () => {
  const w = fakeWorld({ session: {}, identity: 'Not signed in' });
  w.setRoutes(ROUTES); w.mount(); await w.settle();
  assert.deepEqual(w.requests, []);
  assert.equal(w.node('overview').hidden, true);
  assert.deepEqual(w.node('overview-all').children, []);
});

test('generation guard: a late response for an abandoned project never paints', async () => {
  const w = fakeWorld();
  let release;
  const held = new Promise(r => { release = r; });
  w.setRoutes({ ...ROUTES, '/v2/projects/p1/assessments': async () => { await held; return { ok: true, status: 200, json: async () => ({ ok: true, result: ASSESSMENTS_P1 }) }; } });
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  const mounted = w.mount(); await w.settle();
  assert.equal(w.node('overview-project').hidden, true, 'the held read has not answered yet');
  w.projects.value = ''; // the coordinator goes back to All projects while the read is in flight
  mounted.schedule(); await w.settle();
  release(); await w.settle();
  assert.equal(w.node('overview-project').hidden, true, 'the stale project never paints');
  assert.deepEqual(w.node('overview-project').children, []);
  assert.equal(w.node('overview-all').hidden, false, 'the current state A stands');
});

test('every request is a GET carrying the session bearer read per call, and nothing is written', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.assessments.options = [option(''), option('a1')]; w.assessments.value = 'a1';
  w.mount(); await w.settle();
  assert.ok(w.requests.length >= 3);
  assert.equal(w.requests.every(r => r.method === 'GET'), true, 'the module issues no POST/PUT/DELETE in any state');
  assert.equal(w.requests.every(r => r.headers.authorization === 'Bearer st_owner'), true);
  assert.deepEqual([...new Set(w.requests.map(r => r.url))].sort(), ['/v2/projects', '/v2/projects/p1', '/v2/projects/p1/assessments']);
});

test('containment: nothing outside the four roots is written, hidden or moved', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.assessments.options = [option(''), option('a1')];
  const watched = ['project-card', 'assessment-card', 'create-project', 'create-assessment', 'identity', 'load-projects', 'load-assessments'];
  const before = watched.map(id => ({ id, writes: w.node(id).writes, hidden: w.node(id).hidden, textContent: w.node(id).textContent, className: w.node(id).className }));
  w.mount(); await w.settle();
  walk(w.node('overview-project')).find(n => n.textContent === COPY.startAssessment).click(); await w.settle();
  walk(w.node('overview-project')).find(n => n.textContent === COPY.open).click(); await w.settle();
  for (const snapshot of before) {
    const node = w.node(snapshot.id);
    assert.equal(node.writes, snapshot.writes, `${snapshot.id} children must be untouched`);
    assert.equal(node.hidden, snapshot.hidden, `${snapshot.id} hidden must be untouched`);
    assert.equal(node.textContent, snapshot.textContent, `${snapshot.id} text must be untouched`);
    assert.equal(node.className, snapshot.className, `${snapshot.id} class must be untouched`);
  }
  assert.equal(w.sibling.children.length, 0);
  assert.equal(w.node('create-assessment').focused, 0, 'a form is not focusable and is never focused');
  assert.equal(w.node('create-assessment').firstInput.focused, 1, 'its first enabled control is focused, never replaced');
  assert.equal(w.body.dataset.overviewState, 'assessment', 'the one attribute the amendment allows outside the roots, after Open →');
});

test('helpers: language names come from the project GET and fall back to the real id', () => {
  assert.equal(languageName([{ id: 'l1', name: 'Coast language' }], 'l1'), 'Coast language');
  assert.equal(languageName([], 'l9'), 'l9');
  assert.equal(languageName(null, null), '');
});

test('A1: the level menu survives repeated Assessments/Languages transitions', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  w.mount(); await w.settle();
  const tableShowing = () => !!walk(w.node('overview-project')).find(n => n.className === 'table');
  const languagesShowing = () => /Coast language · xyz/.test(text(w.node('overview-project')));
  const menu = () => walk(w.node('overview-project')).find(n => n.className === 'phases');
  assert.equal(tableShowing(), true, 'the table is the default section');
  for (let round = 0; round < 3; round += 1) {
    menu().children[1].click(); await w.settle();
    assert.equal(languagesShowing(), true, `round ${round}: Languages must render`);
    assert.equal(tableShowing(), false, `round ${round}: the table gives way`);
    menu().children[0].click(); await w.settle();
    assert.equal(tableShowing(), true, `round ${round}: the assessments table must come back`);
    assert.equal(languagesShowing(), false, `round ${round}: Languages gives way`);
    assert.equal(walk(w.node('overview-project')).filter(n => n.className === 'table').length, 1, 'exactly one table');
  }
  assert.deepEqual(menu().children.map(c => c.getAttribute('aria-current')), ['true', 'false']);
});

test('A2: the permitted create forms focus their first enabled control, never the form', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.mount(); await w.settle();
  const createProject = w.node('create-project');
  walk(w.node('overview-all')).find(n => n.textContent === COPY.createProject).click();
  assert.equal(createProject.focused, 0, 'a form is not focusable and must not be focused');
  assert.equal(createProject.disabledInput.focused, 0, 'a disabled control is skipped');
  assert.equal(createProject.firstInput.focused, 1, 'focus lands on the first enabled input');

  w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
  const mounted2 = fakeWorld(); mounted2.setRoutes(ROUTES);
  mounted2.projects.options = [option(''), option('p1')]; mounted2.projects.value = 'p1';
  mounted2.mount(); await mounted2.settle();
  const createAssessment = mounted2.node('create-assessment');
  walk(mounted2.node('overview-project')).find(n => n.textContent === COPY.startAssessment).click();
  assert.equal(createAssessment.focused, 0);
  assert.equal(createAssessment.firstInput.focused, 1);
});

test('A2: a hidden form is neither focused nor revealed, and no button is offered', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.node('create-project').hidden = true; // not provisioned
  w.mount(); await w.settle();
  assert.equal(walk(w.node('overview-all')).some(n => n.textContent === COPY.createProject), false, 'no control is offered');
  assert.equal(focusFirstControl(w.node('create-project')), null);
  assert.equal(w.node('create-project').hidden, true, 'the form is never unhidden');
  assert.equal(w.node('create-project').firstInput.focused, 0);
  assert.equal(focusFirstControl(null), null);
});

test('B: a selected assessment keeps assessment state when the overview GET omits it', async () => {
  for (const list of [
    { assessments: [] },
    { assessments: [{ id: 'a-other', project_id: 'p1', language_id: 'l1', name: 'Other', purpose: null, period: '', format: null, stage: 'collect', archived_at: null, created_at: '2026-03-01', role: 'owner' }] },
    async () => ({ ok: false, status: 500, json: async () => ({ ok: false, error: { code: 'UNAVAILABLE' } }) }),
  ]) {
    const w = fakeWorld();
    w.setRoutes({ ...ROUTES, '/v2/projects/p1/assessments': list });
    w.projects.options = [option(''), option('p1')]; w.projects.value = 'p1';
    w.assessments.options = [option(''), option('a1')]; w.assessments.value = 'a1';
    w.mount(); await w.settle();
    assert.equal(w.body.dataset.overviewState, 'assessment', 'the select, not the overview GET, decides composition');
    assert.equal(w.node('overview-project').children.length, 1, 'collapse to the project line; do not paint a conflicting table');
  }
});

test('B: the state attribute walks none → all → project → assessment and back', async () => {
  const w = fakeWorld(); w.setRoutes(ROUTES);
  w.projects.options = [option(''), option('p1')];
  w.assessments.options = [option(''), option('a1')];
  const mounted = w.mount();
  assert.equal(w.body.dataset.overviewState, undefined, 'nothing is claimed before the first read');
  await w.settle();
  assert.equal(w.body.dataset.overviewState, 'all');
  w.projects.value = 'p1'; mounted.schedule(); await w.settle();
  assert.equal(w.body.dataset.overviewState, 'project');
  w.assessments.value = 'a1'; mounted.schedule(); await w.settle();
  assert.equal(w.body.dataset.overviewState, 'assessment');
  w.assessments.value = ''; w.projects.value = ''; mounted.schedule(); await w.settle();
  assert.equal(w.body.dataset.overviewState, 'all');
  w.node('identity').textContent = 'Not signed in'; mounted.schedule(); await w.settle();
  assert.equal(w.body.dataset.overviewState, 'none', 'sign-out returns the page to its own composition');
  assert.equal(w.node('overview').hidden, true);
});

test('B: the shared route and an identity with no grants both claim state none', async () => {
  const shared = fakeWorld({ hash: '#survey=tok_abc' });
  shared.setRoutes(ROUTES); shared.mount(); await shared.settle();
  assert.equal(shared.body.dataset.overviewState, 'none');
  assert.deepEqual(shared.requests, []);
  const viewer = fakeWorld(); viewer.setRoutes({ ...ROUTES, '/v2/projects': { projects: [] } });
  viewer.mount(); await viewer.settle();
  assert.equal(viewer.body.dataset.overviewState, 'none');
});

test('B: the state rules hide only repeated chrome and never the path to the next state', () => {
  const css = fs.readFileSync(new URL('./workspace-overview.css', import.meta.url), 'utf8');
  const rules = ruleBlocks(css);
  const hides = rules.filter(r => /display:\s*none/.test(r.body)).flatMap(r => r.selectors);
  for (const selector of hides) {
    assert.match(selector, /^body\[data-overview-state=/, `a display:none rule must be state-scoped: ${selector}`);
  }
  // The only path onward is never hidden.
  for (const state of ['all', 'project']) {
    assert.equal(hides.some(s => s.includes(`"${state}"`) && /#project-card\s*$/.test(s)), false, `#project-card must stay in ${state}`);
  }
  assert.equal(hides.some(s => s.includes('"project"') && /#assessment-card\s*$/.test(s)), false, '#assessment-card must stay in project');
  // Only the generic chrome and the cards with no role in the state are hidden.
  for (const selector of hides) {
    assert.match(selector, /#workspace > \.headrow|#workspace > \.introduction|#facilitator > h2|#(assessment|survey|results|reports)-card/, `unexpected hide: ${selector}`);
  }
  // Understand: Reports must sit ahead of the legacy Results block.
  const order = id => {
    const rule = rules.find(r => r.selectors.some(s => s.includes('"assessment"') && s.includes(id)) && /order:/.test(r.body));
    return Number((rule.body.match(/order:\s*(-?\d+)/) || [])[1]);
  };
  assert.ok(order('#reports-card') < order('#results-card'), 'reports before results in the assessment state');
  assert.ok(order('#project-card') > order('#results-card'), 'the selector cards follow the phase content');
  // State none has no rules: the landing and participant routes are untouched.
  assert.equal(rules.some(r => r.selectors.some(s => s.includes('"none"'))), false);
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/data-overview-state/.test(declarations.replace(/body\[data-overview-state="(all|project|assessment)"\]/g, '')), false,
    'the attribute is only ever read with one of the three composing values');
});

test('the module renders text nodes only and ships exactly the two missing classes', () => {
  const raw = fs.readFileSync(new URL('./workspace-overview.js', import.meta.url), 'utf8');
  const js = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n'"`]*$/gm, '');
  const css = fs.readFileSync(new URL('./workspace-overview.css', import.meta.url), 'utf8');
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(js), false);
  assert.match(js, /encodeURIComponent/);
  assert.equal(/method: '(POST|PUT|DELETE|PATCH)'/.test(js), false);
  assert.match(css, /\.rv \.phases/);
  assert.match(css, /\.rv \.table/);
  // Every rule is either one of the two classes the app lacks, or scoped inside #overview. No
  // existing class is redefined for the rest of the app.
  // Every rule is one of the two classes the app lacks, scoped inside #overview, or a
  // body[data-overview-state=…] composition rule limited to the shell ids the amendment names.
  const STATE = /^body\[data-overview-state="(all|project|assessment)"\]\s/;
  const SHELL = /^body\[data-overview-state="(all|project|assessment)"\]\s+(#workspace > \.(headrow|introduction)|#facilitator > h2|#(project|assessment|survey|results|reports)-card( > h3)?)$/;
  for (const selector of selectorsOf(css)) {
    if (STATE.test(selector)) { assert.match(selector, SHELL, `a state rule may only target the named shell nodes: ${selector}`); continue; }
    assert.match(selector, /#overview\b|\.phases\b|\.table\b/, `unscoped rule would leak into the app: ${selector}`);
  }
  for (const existing of ['.glass', '.panel', '.eyebrow', '.three', '.crumbs', '.badge', '.muted', '.note', '.rv-btn']) {
    for (const selector of selectorsOf(css)) {
      if (!new RegExp(`\\${existing}(\\b|$)`).test(selector)) continue;
      assert.match(selector, /#overview\b/, `${existing} already exists; a rule for it must be scoped under #overview, got: ${selector}`);
    }
  }
  assert.equal(/@import/.test(css), false);
});

// Selector lists paired with their declaration block.
function ruleBlocks(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const match of clean.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const prelude = match[1].trim();
    if (!prelude || prelude.startsWith('@')) continue;
    out.push({ selectors: prelude.split(',').map(s => s.trim()).filter(Boolean), body: match[2] });
  }
  return out;
}

// Every selector list in the stylesheet, comments stripped and at-rule preludes dropped.
function selectorsOf(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const match of clean.matchAll(/([^{}]+)\{/g)) {
    const prelude = match[1].trim();
    if (!prelude || prelude.startsWith('@')) continue;
    for (const selector of prelude.split(',')) { const s = selector.trim(); if (s) out.push(s); }
  }
  return out;
}

test('the crumbs override is scoped under #overview and never touches .rv .crumbs globally', () => {
  const css = fs.readFileSync(new URL('./workspace-overview.css', import.meta.url), 'utf8');
  const selectors = selectorsOf(css);
  const crumbRules = selectors.filter(s => /\.crumbs\b/.test(s));
  assert.ok(crumbRules.length, 'the override must exist');
  for (const selector of crumbRules) {
    assert.match(selector, /#overview\b/, `unscoped crumbs rule: ${selector}`);
    assert.equal(/^\s*(\.rv\s+)?\.crumbs\b/.test(selector), false, `bare .crumbs selector: ${selector}`);
  }
  // The one rule that must beat components.css:113 at every width.
  const block = css.match(/\.rv #overview \.crumbs \{[^}]*\}/);
  assert.ok(block, 'the .rv #overview .crumbs block must exist');
  assert.match(block[0], /display:\s*flex/);
  assert.match(block[0], /flex-wrap:\s*wrap/);
  assert.match(block[0], /overflow-wrap:\s*anywhere/);
  assert.match(block[0], /gap:\s*var\(--gap-pip\)/, 'gap comes from an existing token');
  // It must not be buried in a width query, or the 760px hide would still win below that width.
  const guarded = css.slice(0, css.indexOf(block[0])).split('@media').length - 1;
  const closed = (css.slice(0, css.indexOf(block[0])).match(/\}/g) || []).length;
  assert.ok(closed >= guarded, 'the override must sit outside every @media block');
  // The separator and the role badge keep their place at narrow widths.
  assert.match(css, /#overview \.crumbs \.sep/);
  assert.match(css, /#overview \.crumbs \.badge/);
  // No horizontal overflow: nothing in the override may pin a width.
  assert.equal(/#overview \.crumbs[^{]*\{[^}]*(white-space:\s*nowrap|min-width:\s*[1-9])/.test(css), false);
});

test('selectAndChange never invents an option when no refresh control is available', async () => {
  const w = fakeWorld();
  w.projects.options = [option('')];
  assert.equal(await selectAndChange(w.doc, w.win, 'projects', 'nope', 'p1'), false);
  assert.equal(await selectAndChange(w.doc, w.win, 'missing-select', 'load-projects', 'p1'), false);
  w.projects.options = [option(''), option('p1')];
  assert.equal(await selectAndChange(w.doc, w.win, 'projects', 'load-projects', 'p1'), true);
  assert.equal(w.projects.value, 'p1');
});
