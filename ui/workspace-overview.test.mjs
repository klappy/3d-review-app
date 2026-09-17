import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { COPY, facilitatorRoute, languageName, mountWorkspaceOverview, selectAndChange } from './workspace-overview.js';

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
  const doc = {
    getElementById(id) { return nodes.has(id) ? nodes.get(id) : null; },
    createElement(tag) { return fakeNode(tag); },
  };
  const make = (id, patch = {}) => { const n = fakeNode('div', id); Object.assign(n, patch); nodes.set(id, n); return n; };
  for (const id of ['overview', 'overview-crumbs', 'overview-all', 'overview-project']) make(id, { hidden: true });
  make('identity', { textContent: identity });
  const projects = make('projects'), assessments = make('assessments');
  projects.tag = assessments.tag = 'select';
  make('load-projects'); make('load-assessments');
  make('create-project', { hidden: false }); make('create-assessment', { hidden: false });
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
  return { doc, win, nodes, node: id => nodes.get(id), requests, sibling, projects, assessments,
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
  { id: 'a1', project_id: 'p1', language_id: 'l1', name: 'October cycle', purpose: null, period: 'October 2026', format: null, stage: 'collect', archived_at: null, created_at: '2026-03-01', role: 'owner' },
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
  // S4 #13: with an assessment selected the overview collapses to one line and never hides itself.
  assert.equal(w.node('overview').hidden, false);
  assert.equal(w.node('overview-all').hidden, true);
  assert.equal(w.node('overview-project').children.length, 1);
  assert.match(text(w.node('overview-project')), /Coast · Partner org · your role: owner/);
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
  assert.equal(w.node('create-assessment').focused, 1, 'the existing form is focused, never replaced');
});

test('helpers: language names come from the project GET and fall back to the real id', () => {
  assert.equal(languageName([{ id: 'l1', name: 'Coast language' }], 'l1'), 'Coast language');
  assert.equal(languageName([], 'l9'), 'l9');
  assert.equal(languageName(null, null), '');
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
  for (const existing of ['.glass', '.panel', '.eyebrow', '.three', '.crumbs', '.badge', '.muted', '.note', '.headrow', '.rv-btn']) {
    assert.equal(new RegExp(`\\${existing}\\s*\\{`).test(css), false, `${existing} already exists and must not be redefined`);
  }
  assert.equal(/@import/.test(css), false);
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
