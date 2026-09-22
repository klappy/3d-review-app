// node --test ui/kit/app-adapter.test.mjs — kit↔app adapter: pure mapping from loaded data, stable mount/host, no synthesis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { mapStatus, treeNodes, shellModel, mountKitRoot, roleLabel } from './app-adapter.js';
import { routes } from '../assess/cards.js';

const known = () => ({ projects: [{ id: 'p1', name: 'River Valley', role: 'owner', workspace_id: 'w1' }, { id: 'p2', name: 'Hill', role: 'viewer', workspace_id: null }], workspaces: new Map([['w1', { id: 'w1', name: 'Field team', role: 'owner', projects: ['p1'] }]]), lists: new Map([['p1', { status: 'loaded', list: [{ id: 'a1', name: 'Sept', stage: 'collect' }] }], ['p2', { status: 'refused', list: null }]]) });

test('adapter test is excluded from deployed assets; runtime module is not', () => { const ig = readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8').split(/\r?\n/); assert.ok(ig.includes('kit/app-adapter.test.mjs')); assert.ok(!ig.includes('kit/app-adapter.js')); });
test('status mapping is explicit; unknown and missing are never ready', () => { assert.equal(mapStatus('loaded'), 'ready'); for (const s of ['unauthenticated', 'refused', 'not_built', 'failed']) assert.equal(mapStatus(s), s); assert.equal(mapStatus(undefined), 'failed'); assert.equal(mapStatus('unloaded'), 'failed'); });
test('tree comes only from loaded authorized data: refused list yields no children, no ancestor discovery, hrefs from routes', () => {
  const nodes = treeNodes(routes, known());
  assert.deepEqual(nodes.map(n => [n.id, n.kind, n.href]), [['w:w1', 'workspace', '#workspace/w1'], ['p:p2', 'project', '#project/p2']]);
  assert.deepEqual(nodes[0].children.map(c => [c.id, c.href, c.children.map(a => a.href)]), [['p:p1', '#project/p1', ['#assessment/a1']]]);
  assert.deepEqual(nodes[1].children, []);
  assert.ok(nodes.every(n => n.visible === true));
});
test('page models enrich the tree without requests: workspaces list, workspace projects, project assessments', () => {
  const ws = treeNodes(routes, { page: { kind: 'workspaces', model: { status: 'loaded', workspaces: [{ id: 'w7', name: 'Seven' }] } } });
  assert.deepEqual(ws.map(n => n.label), ['Seven']);
  const pr = treeNodes(routes, { page: { kind: 'project', model: { status: 'loaded', project: { id: 'p3', name: 'Three', role: 'member' }, assessmentsStatus: 'loaded', assessments: [{ id: 'a3', name: 'Third', stage: 'prepare' }] } } });
  assert.deepEqual(pr[0].children.map(a => [a.label, a.detail]), [['Third', 'Prepare']]);
  const failed = treeNodes(routes, { page: { kind: 'project', model: { status: 'loaded', project: { id: 'p3', name: 'Three' }, assessmentsStatus: 'failed', assessments: [] } } });
  assert.deepEqual(failed[0].children, [], 'failed assessments list is not an empty success');
  const refused = treeNodes(routes, { page: { kind: 'project', model: { status: 'refused' } } });
  assert.deepEqual(refused, []);
});
test('shell model: route/title/crumbs agree, role only from loaded data, no actions synthesized', () => {
  const k = known();
  const m = shellModel({ route: { kind: 'project', id: 'p1' }, routes, principal: { id: 'x' }, known: k, page: { kind: 'project', model: { status: 'loaded', project: k.projects[0], assessmentsStatus: 'loaded', assessments: [] } } });
  assert.equal(m.title, 'River Valley'); assert.equal(m.currentHref, '#project/p1'); assert.equal(m.role, 'Owner');
  assert.deepEqual(m.ancestors.map(a => [a.label, a.href]), [['Projects', '#projects'], ['Field team', '#workspace/w1'], ['River Valley', '#project/p1']]);
  assert.deepEqual(m.expanded, ['w:w1', 'p:p1']); assert.deepEqual(m.actions, []); assert.equal(m.status, 'ready');
  const pending = shellModel({ route: { kind: 'project', id: 'p2' }, routes, principal: { id: 'x' }, known: k, page: { kind: 'project', model: { status: 'refused' } } });
  assert.equal(pending.title, '', 'no title for a refused page'); assert.equal(pending.status, 'refused');
  const guest = shellModel({ route: { kind: 'entry' }, routes, principal: null });
  assert.equal(guest.role, ''); assert.equal(guest.identityLabel, '', 'no identity pill: the real account control identifies the user'); assert.deepEqual(guest.nodes, []);
  // Review F3: signed in with no authoritative role at the current scope → no role label (never 'Member').
  const noScope = shellModel({ route: { kind: 'workspaces' }, routes, principal: { id: 'x' }, known: k });
  assert.equal(noScope.role, ''); assert.equal(noScope.identityLabel, ''); assert.equal(noScope.contextCollapsible, false);
  const viewerOnly = shellModel({ route: { kind: 'project', id: 'p2' }, routes, principal: { id: 'x' }, known: k, page: { kind: 'project', model: { status: 'loaded', project: k.projects[1], assessmentsStatus: 'refused', assessments: [] } } });
  assert.equal(viewerOnly.role, 'Viewer', 'role label equals the loaded scope role');
  assert.equal(viewerOnly.nodes.find(n => n.id === 'p:p2').role, 'Viewer');
});
test('direct assessment grant: reachable, listed under itself, no invented workspace/project links; visible names never become ids', () => {
  const current = { assessment: { id: 'a9', name: '<b>Granted</b>', project_id: 'p9', role: 'viewer', stage: 'understand' } };
  const m = shellModel({ route: { kind: 'assessment', id: 'a9' }, routes, principal: { id: 'x' }, known: { projects: [], workspaces: new Map(), lists: new Map() }, current });
  assert.deepEqual(m.ancestors.map(a => a.href), ['#assessment/a9']); assert.deepEqual(m.nodes.map(n => [n.id, n.href, n.role]), [['a:a9', '#assessment/a9', 'Viewer']]);
  assert.equal(m.title, '<b>Granted</b>', 'model carries raw text; the shell escapes at paint');
  assert.equal(m.expanded.length, 0);
});
test('mount: absent root → null; present root → shell with stable content and host; controls are moved, not cloned', () => {
  assert.equal(mountKitRoot(null, {}), null);
  const d = new JSDOM('<div id="rv"></div><div id="wrap"><button id="version">V</button><span id="account"><span id="who">Account: x@example.invalid</span></span></div>', { url: 'http://127.0.0.1/' });
  const doc = d.window.document, version = doc.getElementById('version');
  let clicks = 0; version.addEventListener('click', () => clicks++);
  const kit = mountKitRoot(doc.getElementById('rv'), shellModel({ route: { kind: 'projects' }, routes, principal: null }));
  assert.deepEqual(kit.adoptControls(doc, ['version', 'account', 'missing']), ['version', 'account']);
  assert.equal(doc.querySelectorAll('#version').length, 1); assert.equal(doc.querySelector('[data-header-host] #version'), version);
  version.click(); assert.equal(clicks, 1, 'listener travels with the node');
  const content = kit.content; content.append(doc.createElement('p'));
  kit.update(shellModel({ route: { kind: 'workspaces' }, routes, principal: { id: 'x' } }));
  assert.equal(kit.content, content); assert.equal(content.childNodes.length, 0); assert.equal(doc.querySelector('[data-header-host] #who').textContent, 'Account: x@example.invalid');
  assert.deepEqual(kit.adoptControls(doc, ['version']), [], 'already hosted: nothing moved twice');
  assert.equal(doc.querySelectorAll('header').length, 1);
});

// Captain's role contract: Owner, Member, Viewer — each displays as itself; missing/unknown shows nothing; no privilege escalation.
test('role labels: owner/member/viewer display as themselves in shell and tree; missing or unknown role yields no label; no actions ever synthesized', () => {
  assert.deepEqual(['owner', 'member', 'viewer', 'VIEWER'].map(roleLabel), ['Owner', 'Member', 'Viewer', 'Viewer']);
  assert.deepEqual([undefined, null, '', 'admin', 'superuser', 'Owner ', 42].map(roleLabel), ['', '', '', '', '', '', '']);
  // Adversarial (review amend at 46b23d10): inherited object keys are unknown roles, never a function/object label.
  assert.strictEqual(roleLabel('constructor'), ''); assert.strictEqual(roleLabel('__proto__'), '');
  for (const k of ['toString', 'hasOwnProperty', 'valueOf', 'prototype', 'CONSTRUCTOR']) assert.strictEqual(roleLabel(k), '', k);
  const hostile = shellModel({ route: { kind: 'project', id: 'p1' }, routes, principal: { id: 'x' }, known: { projects: [{ id: 'p1', name: 'P', role: '__proto__', workspace_id: 'w1' }], workspaces: new Map([['w1', { id: 'w1', name: 'W', role: 'constructor', projects: ['p1'] }]]), lists: new Map() } });
  assert.strictEqual(hostile.role, ''); assert.strictEqual(hostile.nodes[0].role, undefined); assert.strictEqual(hostile.nodes[0].children[0].role, undefined);
  for (const [role, label] of [['owner', 'Owner'], ['member', 'Member'], ['viewer', 'Viewer']]) {
    const k = { projects: [{ id: 'p1', name: 'P', role, workspace_id: 'w1' }], workspaces: new Map([['w1', { id: 'w1', name: 'W', role, projects: ['p1'] }]]), lists: new Map() };
    const m = shellModel({ route: { kind: 'project', id: 'p1' }, routes, principal: { id: 'x' }, known: k, page: { kind: 'project', model: { status: 'loaded', project: k.projects[0], assessmentsStatus: 'loaded', assessments: [] } } });
    assert.equal(m.role, label); assert.equal(m.nodes[0].role, label); assert.equal(m.nodes[0].children[0].role, label); assert.deepEqual(m.actions, []);
    const w = shellModel({ route: { kind: 'workspace', id: 'w1' }, routes, principal: { id: 'x' }, known: k });
    assert.equal(w.role, label);
    const a = shellModel({ route: { kind: 'assessment', id: 'a1' }, routes, principal: { id: 'x' }, known: k, current: { assessment: { id: 'a1', name: 'A', project_id: 'p1', role, stage: 'prepare' } } });
    assert.equal(a.role, label);
  }
  const unknown = shellModel({ route: { kind: 'project', id: 'p1' }, routes, principal: { id: 'x' }, known: { projects: [{ id: 'p1', name: 'P', role: 'admin' }], workspaces: new Map(), lists: new Map() } });
  assert.equal(unknown.role, '', 'unknown role is not promoted to any label'); assert.equal(unknown.nodes[0].role, undefined);
});
