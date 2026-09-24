import { test as it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { breadcrumbs } from '../v3/components/breadcrumbs.js';
const routes = { workspace: id => `#workspace/${id}`, project: id => `#project/${id}`, assessment: id => `#assessment/${id}` };
const scope = (ws, p, a) => ({ workspace: ws && { ...ws, href: routes.workspace(ws.id) }, project: p && { ...p, href: routes.project(p.id) }, assessment: a && { ...a, href: routes.assessment(a.id) } });
  it('assess.js uses the component, no hand-built crumb row', () => {
    const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
    assert.match(src, /from '\/v3\/components\/breadcrumbs\.js'/);
    assert.doesNotMatch(src, /<nav class="crumbs" aria-label="Scope">/);
  });
  it('fixed order Home › Workspace › Project › Assessment, current is plain text', () => {
    const h = breadcrumbs(scope({ id: 'w', name: 'W' }, { id: 'p', name: 'P' }, { id: 'a', name: 'A' }), { label: 'Scope' });
    const order = [...h.matchAll(/data-crumb="(\w+)"/g)].map(m => m[1]);
    assert.deepEqual(order, ['home', 'workspace', 'project', 'assessment']);
    assert.match(h, /<span data-crumb="assessment" aria-current="page">A<\/span>/);
  });
  it('omits missing levels', () => {
    const h = breadcrumbs(scope(null, { id: 'p', name: 'P' }, null));
    assert.deepEqual([...h.matchAll(/data-crumb="(\w+)"/g)].map(m => m[1]), ['home', 'project']);
  });
  it('local server serves the components', () => {
    const s = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
    for (const f of ['breadcrumbs', 'stepper', 'member-list']) assert.ok(s.includes(`'/v3/components/${f}.js'`));
  });
