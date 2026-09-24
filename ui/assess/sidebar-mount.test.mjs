import { test as it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sidebarTree } from '../v3/components/sidebar-tree.js';
import { breadcrumbs } from '../v3/components/breadcrumbs.js';
const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
it('assess.js mounts the Sidebar tree component with the crumb scope', () => {
  assert.match(src, /from '\/v3\/components\/sidebar-tree\.js'/);
  assert.match(src, /sidebarTree\(\[[\s\S]*?crumbScope\(ws, proj, current\?\.assessment\)/);
});
it('tree and crumbs agree on the current assessment', () => {
  const scope = { workspace: { id: 'w', name: 'W', href: '#workspace/w' }, project: { id: 'p', name: 'P', href: '#project/p' }, assessment: { id: 'a', name: 'A', href: '#assessment/a' } };
  const t = sidebarTree([{ id: 'w', name: 'W', projects: [{ id: 'p', name: 'P', assessments: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }, { id: 'q', name: 'Q' }] }], scope);
  assert.match(t, /data-kind="assessment" data-id="a"[^>]*aria-selected="true"/);
  assert.doesNotMatch(t, /data-id="b"[^>]*aria-selected/);
  assert.match(breadcrumbs(scope), /data-crumb="assessment" aria-current="page">A</);
});
