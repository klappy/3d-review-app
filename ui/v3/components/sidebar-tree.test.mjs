import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sidebarTree, activePath } from './sidebar-tree.js';
import { crumbTrail } from './breadcrumbs.js';
const data = [
  { id: 'w1', name: 'Acme', projects: [{ id: 'p1', name: 'Pilot', assessments: [{ id: 'a1', name: 'Spring' }, { id: 'a2', name: 'Fall' }] }, { id: 'p2', name: 'Other', assessments: [{ id: 'a9', name: 'Hidden' }] }] },
  { id: 'w2', name: 'Beta <x>', projects: [{ id: 'p3', name: 'Closed' }] },
];
const scope = { workspace: { id: 'w1', name: 'Acme' }, project: { id: 'p1', name: 'Pilot' }, assessment: { id: 'a2', name: 'Fall' }, page: 'Results' };
test('tree order workspace → project → assessment, expands only the current path', () => {
  const h = sidebarTree(data, scope);
  assert.ok(h.indexOf('Acme') < h.indexOf('Pilot') && h.indexOf('Pilot') < h.indexOf('Spring'));
  assert.ok(!h.includes('Hidden') && !h.includes('Closed'));
  assert.match(h, /data-component="sidebar-tree"/);
});
test('current node = deepest scope level, same as breadcrumbs', () => {
  const h = sidebarTree(data, scope);
  assert.equal((h.match(/aria-current="page"/g) || []).length, 1);
  assert.match(h, /href="#assessment\/a2" data-navigate="#assessment\/a2" aria-current="page">Fall/);
  const levels = crumbTrail(scope).map(c => c.level).filter(l => l in activePath(scope));
  assert.deepEqual(levels, Object.keys(activePath(scope)));
});
test('workspace-only scope marks workspace, collapsed children stay out', () => {
  const h = sidebarTree(data, { workspace: { id: 'w2', name: 'Beta' } });
  assert.match(h, /aria-current="page">Beta &lt;x&gt;/);
  assert.ok(!h.includes('Pilot'));
});
test('unsafe href falls back to no link; empty data renders empty tree', () => {
  assert.ok(!sidebarTree([{ id: 'w', name: 'X', href: 'javascript:alert(1)' }]).includes('javascript:'));
  assert.match(sidebarTree([]), /<ul role="tree"><\/ul>/);
});
