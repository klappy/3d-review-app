import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as resume from './participant-resume.js';
import * as visibility from './visibility.js';
import * as present from './present.js';
import * as shared from './shared-link.js';
import * as stage from './stage-screens.js';

// Drive the real app.js mount (not a re-implementation) against a minimal DOM, the same way the
// other app-level DOM tests do. Browser validation stays a separate gate.
function harness(saved = {}) {
  const nodes = new Map(), storage = new Map(Object.entries(saved)), requests = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, hidden: true, textContent: '', value: '', children: [], listeners: {}, attrs: new Map(), options: [], disabled: false,
      setAttribute(k, v) { this.attrs.set(k, String(v)); }, getAttribute(k) { return this.attrs.get(k) ?? null; },
      addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); },
      async fire(event, extra = {}) { for (const fn of this.listeners[event] || []) await fn({ preventDefault() {}, currentTarget: this, ...extra }); },
      replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
      prepend(child) { this.children.unshift(child); }, add(child) { this.options.push(child); this.children.push(child); },
      reset() {}, focus() {}, querySelectorAll() { return []; } });
    return nodes.get(id);
  }
  let responder = async () => { throw Error('unconfigured request'); };
  const context = vm.createContext({ ...resume, ...visibility, ...present, ...shared, ...stage, sharedCopy: shared.copy,
    initLanguageControls: () => ({ refresh: async () => {} }),
    document: { getElementById: node, createElement: tag => node(`generated-${nodes.size}-${tag}`), createTextNode: t => ({ tag: '#text', textContent: t, children: [] }), querySelectorAll: () => [] },
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    location: { hash: '' }, history: { replaceState() {} }, crypto: { randomUUID: () => 'synthetic-key' },
    window: { print() { throw Error('workspace print must never run in this test'); } },
    Option: class { constructor(label, value) { this.textContent = label; this.value = value; this.disabled = false; } },
    FormData: class { constructor(target) { this.target = target; } get(k) { return this.target.fields?.[k] ?? null; } },
    fetch: async (url, options) => { requests.push({ url, options }); return responder(url, options); },
  });
  const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInContext(source, context);
  return { node, storage, requests, setResponder(fn) { responder = fn; },
    async settle() { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); } };
}
const ok = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
const text = n => [n.textContent, ...(n.children || []).map(text)].join('');
const ASSESSMENT = { assessment: { id: 'a1', name: 'Cycle one', stage: 'collect', role: 'owner' }, surveys: [] };

test('the mount roots start hidden and empty before any assessment is chosen', async () => {
  const h = harness(); await h.settle();
  for (const id of ['stage-tabs', 'stage-tour', 'role-help', 'blank-print']) {
    assert.equal(h.node(id).hidden, true, id);
    assert.deepEqual(h.node(id).children, [], id);
  }
});

test('choosing an authorized assessment paints tabs and the in-stage tour and never posts /stage', async () => {
  const h = harness({ facilitatorToken: 'st_owner' }); await h.settle();
  h.node('assessments').value = 'a1';
  h.setResponder(async url => {
    if (url === '/v2/assessments/a1') return ok(ASSESSMENT);
    if (url === '/v2/docs?role=owner') return ok({ role: 'owner', can: ['cap.survey.select'], next_best: { collect: 'cap.survey.select' } });
    throw Error('unexpected read');
  });
  await h.node('assessments').fire('change'); await h.settle();
  assert.equal(h.node('stage-tabs').hidden, false);
  assert.match(text(h.node('stage-tabs')), /Prepare.*Collect.*Understand.*Improve/s);
  assert.match(text(h.node('stage-tabs')), /Current stage: Collect/);
  assert.equal(h.node('stage-tour').hidden, false);
  assert.equal(h.node('role-help').hidden, false);
  assert.match(text(h.node('role-help')), /Authorized role: owner/);
  assert.equal(h.requests.some(r => r.url.includes('/stage')), false);
  assert.equal(h.requests.some(r => (r.options?.method || 'GET') !== 'GET'), false);
});

// The generation guard is the point of the mount: a helper answer for an abandoned selection
// must be dropped silently rather than painted beside the newly chosen assessment.
test('a late role-help answer for an abandoned assessment is discarded', async () => {
  const h = harness({ facilitatorToken: 'st_owner' }); await h.settle();
  let releaseDocs;
  const held = new Promise(r => { releaseDocs = r; });
  h.node('assessments').value = 'a1';
  h.setResponder(async url => {
    if (url === '/v2/assessments/a1') return ok(ASSESSMENT);
    if (url === '/v2/docs?role=owner') { await held; return ok({ role: 'owner', can: ['cap.survey.select'], next_best: { collect: 'cap.survey.select' } }); }
    throw Error('unexpected read');
  });
  await h.node('assessments').fire('change'); await h.settle();
  assert.equal(h.node('role-help').hidden, true, 'the held read has not answered yet');

  h.node('assessments').value = ''; // the facilitator moves off the assessment while the read is in flight
  await h.node('assessments').fire('change'); await h.settle();
  releaseDocs(); await h.settle();
  assert.equal(h.node('role-help').hidden, true, 'a stale answer must not paint');
  assert.deepEqual(h.node('role-help').children, []);
  assert.equal(h.node('stage-tabs').hidden, true);
});

test('a viewer never fetches the blank print and the print root stays hidden', async () => {
  const h = harness({ facilitatorToken: 'st_viewer' }); await h.settle();
  h.node('assessments').value = 'a1';
  h.setResponder(async url => {
    if (url === '/v2/assessments/a1') return ok({ assessment: { id: 'a1', name: 'Cycle one', stage: 'collect', role: 'viewer' }, surveys: [{ id: 's1', template_name: 'Team', collection_status: 'open' }] });
    if (url === '/v2/docs?role=viewer') return ok({ role: 'viewer', can: [], next_best: {} });
    throw Error('unexpected read');
  });
  await h.node('assessments').fire('change'); await h.settle();
  assert.equal(h.node('blank-print').hidden, true);
  assert.equal(h.requests.some(r => r.url.includes('/print')), false);
});

test('an owner with one survey gets a blank form, and changing survey discards the in-flight one', async () => {
  const h = harness({ facilitatorToken: 'st_owner' }); await h.settle();
  const html = '<h1>Team form</h1><ol><li>How does review work?<hr></li></ol>';
  let releasePrint;
  const held = new Promise(r => { releasePrint = r; });
  h.node('assessments').value = 'a1';
  h.setResponder(async url => {
    if (url === '/v2/assessments/a1') return ok({ assessment: { id: 'a1', name: 'Cycle one', stage: 'collect', role: 'owner' }, surveys: [{ id: 's1', template_name: 'Team', collection_status: 'open' }] });
    if (url === '/v2/docs?role=owner') return ok({ role: 'owner', can: [], next_best: {} });
    if (url === '/v2/assessments/a1/surveys/s1/print') { await held; return ok({ blank: true, html, template_id: 'tpl_team', template_version: 2 }); }
    throw Error(`unexpected read ${url}`);
  });
  await h.node('assessments').fire('change'); await h.settle();
  h.node('surveys').value = ''; // the survey selection moves while the print read is in flight
  await h.node('surveys').fire('change'); await h.settle();
  releasePrint(); await h.settle();
  assert.equal(h.node('blank-print').hidden, true, 'a stale print must not paint');
  assert.deepEqual(h.node('blank-print').children, []);
});

test('an owner with one survey sees the blank form with no code values on it', async () => {
  const h = harness({ facilitatorToken: 'st_owner' }); await h.settle();
  const html = '<h1>Team form</h1><ol><li>How does review work?<hr></li></ol>';
  h.node('assessments').value = 'a1';
  h.setResponder(async url => {
    if (url === '/v2/assessments/a1') return ok({ assessment: { id: 'a1', name: 'Cycle one', stage: 'collect', role: 'owner' }, surveys: [{ id: 's1', template_name: 'Team', collection_status: 'open' }] });
    if (url === '/v2/docs?role=owner') return ok({ role: 'owner', can: [], next_best: {} });
    if (url === '/v2/assessments/a1/surveys/s1/print') return ok({ blank: true, html, template_id: 'tpl_team', template_version: 2 });
    throw Error(`unexpected read ${url}`);
  });
  await h.node('assessments').fire('change'); await h.settle();
  assert.equal(h.node('blank-print').hidden, false);
  const page = text(h.node('blank-print'));
  assert.match(page, /How does review work\?/);
  assert.match(page, /No invitation link on this blank form/);
  assert.equal(/Bearer |st_owner|https?:\/\//.test(page), false);
});

test('signing out clears every stage root', async () => {
  const h = harness({ facilitatorToken: 'st_owner' }); await h.settle();
  h.node('assessments').value = 'a1';
  h.setResponder(async url => {
    if (url === '/v2/assessments/a1') return ok(ASSESSMENT);
    if (url === '/v2/docs?role=owner') return ok({ role: 'owner', can: [], next_best: {} });
    return ok({});
  });
  await h.node('assessments').fire('change'); await h.settle();
  assert.equal(h.node('stage-tabs').hidden, false);
  await h.node('signout').fire('click'); await h.settle();
  for (const id of ['stage-tabs', 'stage-tour', 'role-help', 'blank-print']) {
    assert.equal(h.node(id).hidden, true, id);
    assert.deepEqual(h.node(id).children, [], id);
  }
});

test('app.js mounts the stage roots and routes printing through the isolating wrapper', () => {
  const app = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('./server.mjs', import.meta.url), 'utf8');
  for (const id of ['stage-tabs', 'stage-tour', 'role-help', 'blank-print']) assert.match(html, new RegExp(`id="${id}" hidden`), id);
  assert.match(html, /href="\/stage-screens\.css"/);
  assert.match(server, /'\/stage-screens\.js'/);
  assert.match(server, /'\/stage-screens\.css'/);
  // The workspace is never printed directly: renderBlankPrint's button already goes through
  // printBlankForm, which builds and isolates its own article. onPrint is that wrapper's hook.
  assert.match(app, /renderBlankPrint\(document, root, model, \{ onPrint/);
  assert.equal(/window\.print\(\)/.test(app.replace(/onPrint: \(\) => window\.print\(\)/, '')), false);
});
