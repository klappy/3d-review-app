import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { copy, detailsLine, initVersionBadge, renderChangelog } from './changelog.js';
import * as resume from './participant-resume.js';
import * as visibility from './visibility.js';
import * as present from './present.js';
import * as shared from './shared-link.js';

// Minimal fake DOM: real-ish nodes with attributes, children and listeners. No innerHTML exists
// on these nodes, so any HTML-string rendering in changelog.js would fail here.
function fakeNode(tag, id) {
  const attrs = new Map();
  return { tag, id, textContent: '', children: [], listeners: {}, open: false,
    setAttribute(k, v) { attrs.set(k, String(v)); }, getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; }, removeAttribute(k) { attrs.delete(k); },
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); },
    async fire(event) { for (const fn of this.listeners[event] || []) await fn({ preventDefault() {}, currentTarget: this }); },
    prepend(...nodes) { this.children = [...nodes, ...this.children.filter(x => !nodes.includes(x))]; },
    append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; },
    focus() { this.focused = true; this.doc.active = this; },
    showModal() { if (this.open) throw new Error('InvalidStateError: dialog already open'); this.open = true; this.showModalCalls = (this.showModalCalls || 0) + 1; }, close() { this.open = false; return this.fire('close'); } };
}
function fakeDocument(ids = ['version', 'changelog', 'changelog-title', 'changelog-build', 'changelog-body', 'changelog-close']) {
  const nodes = new Map();
  const doc = { active: null, nodes,
    getElementById(id) { if (!nodes.has(id)) { const n = fakeNode('div', id); n.doc = doc; nodes.set(id, n); } return nodes.get(id); },
    createElement(tag) { const n = fakeNode(tag); n.doc = doc; return n; } };
  for (const id of ids) doc.getElementById(id);
  doc.getElementById('version').textContent = 'Version…';
  doc.getElementById('version').setAttribute('aria-expanded', 'false');
  return doc;
}
const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
function fetchFor(routes, log) {
  return async (url, options) => { log.push({ url, options }); const r = routes[url]; if (typeof r === 'function') return r(); if (r === undefined) return json({}, false, 404); return r; };
}
const HEALTH = { ok: true, result: { version: '0.1.0', build: '0.1.0+abc1234', commit: 'abc1234deadbeef', release_source: '9f8e7d6c5b4a', contract: 'v2' } };
const CHANGELOG = { current: '0.1.0', versions: [
  { version: '0.1.0', status: 'candidate', sections: { added: ['Version badge'], changed: [], fixed: ['A fix'], security: [] } },
  { version: '0.0.9', status: 'released', tag: 'v0.0.9', date: '2026-09-10', sections: { added: [], changed: ['Something'], fixed: [], security: ['Patched'] } },
  { version: '0.0.8', sections: { added: ['Old thing'], changed: [], fixed: [], security: [] } },
] };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const text = node => [node.textContent, ...node.children.map(text)].join('');

test('V1 staff route: health with version renders "Version 0.1.0" after one /v2/health read', async () => {
  const doc = fakeDocument(), log = [];
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json(HEALTH) }, log), shared: false });
  assert.equal(doc.getElementById('version').textContent, copy.pending);
  await api.ready;
  assert.equal(doc.getElementById('version').textContent, 'Version 0.1.0');
  assert.equal(doc.getElementById('version').getAttribute('aria-disabled'), null);
  assert.deepEqual(log.map(r => r.url), ['/v2/health']);
});

test('V1 health ok:false still yields the version (plain fetch, not api())', async () => {
  const doc = fakeDocument();
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json({ ...HEALTH, ok: false }, false, 503) }, []), shared: false });
  await api.ready;
  assert.equal(doc.getElementById('version').textContent, 'Version 0.1.0');
});

for (const [label, health] of [['missing version', { ok: true, result: { build: '0.1.0+abc1234', commit: 'abc1234' } }], ['read failure', () => { throw new Error('offline'); }]]) {
  test(`V1 health ${label}: "Version unavailable", aria-disabled, click does not open`, async () => {
    const doc = fakeDocument(), log = [];
    const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': health, '/changelog.json': json(CHANGELOG) }, log), shared: false });
    await api.ready;
    const badge = doc.getElementById('version');
    assert.equal(badge.textContent, 'Version unavailable');
    assert.notEqual(badge.textContent, '0.1.0+abc1234');
    assert.equal(badge.getAttribute('aria-disabled'), 'true');
    await badge.fire('click'); await api.ready; await settle();
    assert.equal(doc.getElementById('changelog').open, false);
    assert.equal(badge.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(log.map(r => r.url), ['/v2/health']);
  });
}

test('V1 shared route: badge reads "Version" with no health read on load; health read lazily on first activation', async () => {
  const doc = fakeDocument(), log = [];
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json(HEALTH), '/changelog.json': json(CHANGELOG) }, log), shared: true });
  await api.ready; await settle();
  const badge = doc.getElementById('version');
  assert.equal(badge.textContent, 'Version');
  assert.deepEqual(log, []);
  await badge.fire('click'); await api.ready;
  assert.equal(badge.textContent, 'Version 0.1.0');
  assert.equal(doc.getElementById('changelog').open, true);
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
  await doc.getElementById('changelog').close();
  await badge.fire('click'); await api.ready; // second activation: health is not re-read
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json', '/changelog.json']);
});

test('V1 shared route: failed lazy health read → "Version unavailable", dialog stays closed', async () => {
  const doc = fakeDocument(), log = [];
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json({ ok: true, result: {} }) }, log), shared: true });
  await doc.getElementById('version').fire('click'); await api.ready;
  assert.equal(doc.getElementById('version').textContent, 'Version unavailable');
  assert.equal(doc.getElementById('version').getAttribute('aria-disabled'), 'true');
  assert.equal(doc.getElementById('changelog').open, false);
  assert.deepEqual(log.map(r => r.url), ['/v2/health']);
});

test('V3 details line exact, with and without build_uuid', () => {
  assert.equal(detailsLine(HEALTH.result), '0.1.0+abc1234 · app abc1234 · cookbook 9f8e7d6');
  assert.equal(detailsLine({ ...HEALTH.result, build_uuid: 'uuid-42' }), '0.1.0+abc1234 · app abc1234 · cookbook 9f8e7d6 · build uuid-42');
});

test('V4 render: sections in order, candidate label, unlabelled entry never "released", current marked', () => {
  const doc = fakeDocument(), body = doc.getElementById('changelog-body');
  renderChangelog({ doc, body, data: CHANGELOG, health: HEALTH.result });
  const sections = body.children;
  assert.deepEqual(sections.map(s => s.tag), ['section', 'section', 'section']);
  const [cand, rel, none] = sections;
  assert.equal(cand.children[0].tag, 'h3'); assert.equal(cand.children[0].textContent, '0.1.0 · current');
  assert.equal(cand.children[1].tag, 'p'); assert.equal(cand.children[1].textContent, 'Built as a candidate at cookbook 9f8e7d6; release status is recorded in the cookbook');
  assert.deepEqual(cand.children.slice(2).map(c => [c.tag, c.textContent || c.children.map(li => li.textContent)]), [['h4', 'Added'], ['ul', ['Version badge']], ['h4', 'Fixed'], ['ul', ['A fix']]]);
  assert.equal(rel.children[0].textContent, '0.0.9 — v0.0.9 · 2026-09-10');
  assert.deepEqual(rel.children.slice(1).map(c => c.tag === 'h4' ? c.textContent : c.children.map(li => li.textContent)), ['Changed', ['Something'], 'Security', ['Patched']]);
  assert.equal(none.children[0].textContent, '0.0.8');
  assert.equal(/released|—/.test(text(none)), false, 'unlabelled entry is never labelled released');
  assert.equal(text(body).includes(copy.notListed), false);
  for (const n of body.children.flatMap(s => s.children)) assert.equal('innerHTML' in n, false);
});

test('V4 render: status other than the exact string "released" is not released', () => {
  const doc = fakeDocument(), body = doc.getElementById('changelog-body');
  renderChangelog({ doc, body, data: { current: '1.0.0', versions: [{ version: '1.0.0', status: 'Released', tag: 'v1', date: 'd', sections: {} }] }, health: HEALTH.result });
  assert.equal(body.children[0].children[0].textContent, '1.0.0 · current');
});

test('V4 render: current absent from list → not-listed line; 404/malformed → not-listed line', () => {
  const doc = fakeDocument(), body = doc.getElementById('changelog-body');
  renderChangelog({ doc, body, data: { current: '0.2.0', versions: CHANGELOG.versions.slice(1) }, health: HEALTH.result });
  assert.equal(body.children[0].tag, 'p'); assert.equal(body.children[0].textContent, 'Changes for this version are not listed yet.');
  renderChangelog({ doc, body, data: null, health: HEALTH.result });
  assert.deepEqual(body.children.map(c => [c.tag, c.textContent]), [['p', 'Changes for this version are not listed yet.']]);
  renderChangelog({ doc, body, data: { versions: 'nope' }, health: HEALTH.result });
  assert.deepEqual(body.children.map(c => [c.tag, c.textContent]), [['p', 'Changes for this version are not listed yet.']]);
});

test('V4 open/close: 404 changelog renders not-listed body; close event resets aria-expanded and returns focus', async () => {
  const doc = fakeDocument(), log = [];
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json(HEALTH) }, log), shared: false });
  await api.ready;
  const badge = doc.getElementById('version'), dialog = doc.getElementById('changelog');
  await badge.fire('click'); await api.ready;
  assert.equal(dialog.open, true);
  assert.equal(badge.getAttribute('aria-expanded'), 'true');
  assert.equal(doc.active.id, 'changelog-close');
  assert.equal(doc.getElementById('changelog-build').textContent, '0.1.0+abc1234 · app abc1234 · cookbook 9f8e7d6');
  assert.equal(text(doc.getElementById('changelog-body')), 'Changes for this version are not listed yet.');
  await doc.getElementById('changelog-close').fire('click');
  assert.equal(dialog.open, false);
  assert.equal(badge.getAttribute('aria-expanded'), 'false');
  assert.equal(doc.active.id, 'version');
  await dialog.close(); // Esc/cancel or programmatic close takes the same path
  assert.equal(badge.getAttribute('aria-expanded'), 'false');
});

// V5: run the real app.js run() sweep against real button nodes. The fake document's
// querySelectorAll('button') returns the badge, the Close button and one ordinary button.
function appHarness() {
  const nodes = new Map(), requests = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, hidden: true, textContent: '', value: '', children: [], listeners: {}, attrs: new Map(),
      addEventListener(event, fn) { this.listeners[event] = fn; }, setAttribute(k, v) { this.attrs.set(k, String(v)); }, getAttribute(k) { return this.attrs.get(k) ?? null; },
      replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); },
      prepend(child) { this.children.unshift(child); }, add(child) { this.children.push(child); },
      reset() {}, focus() { this.focused = true; }, querySelectorAll() { return []; } });
    return nodes.get(id);
  }
  const buttons = ['version', 'changelog-close', 'signout'].map(node);
  for (const b of buttons) { b.disabledLog = []; let d = false; Object.defineProperty(b, 'disabled', { get() { return d; }, set(v) { d = v; b.disabledLog.push(v); } }); }
  const context = vm.createContext({ ...resume, ...visibility, ...present, ...shared, sharedCopy: shared.copy,
    initLanguageControls: () => ({ refresh: async () => {} }),
    document: { getElementById: node, createElement: tag => node(`generated-${nodes.size}-${tag}`), querySelectorAll: sel => sel === 'button' ? [...buttons] : [] },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { hash: '' }, history: { replaceState() {} }, crypto: { randomUUID: () => 'synthetic-key' },
    Option: class {}, FormData: class {},
    fetch: async (url, options) => { requests.push({ url, options }); throw Error('unconfigured request'); },
    redactDiagnosticPath: u => u, createCollabHooks: () => ({ reset() {}, identity() {}, projects() {}, setScope() {}, destroy() {} }), mountEntityScreen: () => ({ render() {}, reset() {} }), mountLensSurveys: () => ({ set() {}, reset() {} }), // app.js import stripped above; hooks covered by collab-mount.test.mjs + Chromium
  });
  const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInContext(source, context);
  return { node, requests, buttons };
}

test('V5 run() sweep disables the ordinary button but never #version or #changelog-close; "Version unavailable" state survives', async () => {
  const h = appHarness(); await settle();
  const badge = h.node('version'), close = h.node('changelog-close'), ordinary = h.node('signout');
  assert.deepEqual(badge.disabledLog, [], 'load-time run() must not touch the badge');
  for (const b of h.buttons) b.disabledLog.length = 0; // app.js runs one sweep at load; measure the click cycle alone
  badge.textContent = 'Version unavailable'; badge.setAttribute('aria-disabled', 'true');
  ordinary.hidden = false;
  let sawOrdinaryDisabledDuring = false;
  const originalReset = h.node('identity');
  // observe during the task: resetClientIdentity() runs inside the sweep and touches #identity
  Object.defineProperty(originalReset, 'textContent', { set() { sawOrdinaryDisabledDuring = ordinary.disabled === true; assert.notEqual(badge.disabled, true, 'badge must not be disabled during the sweep'); assert.notEqual(close.disabled, true); }, get() { return ''; } });
  await ordinary.listeners.click({ preventDefault() {}, currentTarget: ordinary }); await settle();
  assert.equal(sawOrdinaryDisabledDuring, true, 'sweep must have disabled the ordinary button during the task');
  assert.deepEqual(ordinary.disabledLog, [true, false]);
  assert.deepEqual(badge.disabledLog, []); assert.deepEqual(close.disabledLog, []);
  assert.notEqual(badge.disabled, true);
  assert.equal(badge.textContent, 'Version unavailable');
  assert.equal(badge.getAttribute('aria-disabled'), 'true');
  assert.equal(h.requests.length, 0);
});

test('V1 shared route: two synchronous activations while reads are in flight → one /v2/health, one /changelog.json, showModal once', async () => {
  const doc = fakeDocument(), log = [];
  const slow = body => () => new Promise(r => setTimeout(() => r(json(body)), 5));
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': slow(HEALTH), '/changelog.json': slow(CHANGELOG) }, log), shared: true });
  const badge = doc.getElementById('version');
  const first = badge.fire('click'); const second = badge.fire('click'); // no await between activations
  await Promise.all([first, second, api.ready]); await settle();
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
  assert.equal(doc.getElementById('changelog').showModalCalls, 1);
  assert.equal(doc.getElementById('changelog').open, true);
  assert.equal(badge.textContent, 'Version 0.1.0');
});

test('activation while the dialog is already open is a no-op', async () => {
  const doc = fakeDocument(), log = [];
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json(HEALTH), '/changelog.json': json(CHANGELOG) }, log), shared: false });
  await api.ready;
  const badge = doc.getElementById('version'), dialog = doc.getElementById('changelog');
  await badge.fire('click'); await api.ready;
  assert.equal(dialog.open, true);
  await badge.fire('click'); await api.ready; await settle();
  assert.equal(dialog.showModalCalls, 1);
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
  await dialog.close();
  await badge.fire('click'); await api.ready; // reopens after close
  assert.equal(dialog.showModalCalls, 2);
});

test('V6 request log contains only /v2/health and /changelog.json', async () => {
  const doc = fakeDocument(), log = [];
  const api = initVersionBadge({ doc, fetchImpl: fetchFor({ '/v2/health': json(HEALTH), '/changelog.json': json(CHANGELOG) }, log), shared: false });
  await api.ready;
  await doc.getElementById('version').fire('click'); await api.ready;
  await doc.getElementById('changelog-close').fire('click');
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
  assert.equal(log.some(r => r.url.includes('/v2/participate/')), false);
  assert.equal(log.some(r => r.options?.headers?.authorization), false, 'no bearer is attached');
  assert.equal(log.every(r => r.options?.credentials === 'omit'), true, 'credentials omitted on both reads');
});


test('dedicated roadmap actual bootstrap reads health before interaction despite retained shared state', async () => {
  const html = fs.readFileSync(new URL('./roadmap/index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/src="\/changelog.js"/g) || []).length, 1);
  const ids = ['version', 'changelog', 'changelog-title', 'changelog-build', 'changelog-body', 'changelog-close'];
  for (const id of ids) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  assert.match(html, /<button id="version"[^>]*aria-controls="changelog"[^>]*>Version…<\/button>/);
  assert.ok(html.indexOf('id="version"') < html.indexOf('<main'), 'badge survives route content replacement');
  assert.ok(html.indexOf('id="changelog"') > html.indexOf('</main>'), 'dialog survives route content replacement');
  assert.ok(html.indexOf('src="/changelog.js"') < html.indexOf('src="/roadmap/versions.js"'), 'changelog loads before page');
  const doc = fakeDocument(ids), log = [];
  const component = fs.readFileSync(new URL('./changelog.js', import.meta.url), 'utf8').replace(/export /g, '');
  vm.runInNewContext(component, {
    document: doc, location: { hash: '', pathname: '/roadmap/' }, sessionStorage: { getItem: () => 'retained-participant-state' },
    fetch: fetchFor({ '/v2/health': json(HEALTH), '/changelog.json': json(CHANGELOG) }, log),
  });
  await settle();
  assert.equal(doc.getElementById('version').textContent, 'Version 0.1.0', 'canonical health resolves before a click');
  assert.deepEqual(log.map(r => r.url), ['/v2/health']);
  assert.ok(log.every(r => r.options.credentials === 'omit' && r.options.cache === 'no-store'));
  await doc.getElementById('version').fire('click'); await settle();
  assert.equal(doc.getElementById('changelog').open, true);
  assert.equal(doc.getElementById('version').textContent, 'Version 0.1.0', 'runtime health fixture supplies version, not markup');
  assert.equal(doc.getElementById('changelog-build').textContent, detailsLine(HEALTH.result));
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
});

test('dedicated participant shell mounts the shared badge and reads health lazily', async () => {
  const html = fs.readFileSync(new URL('./participate/index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/src="\/changelog.js"/g) || []).length, 1);
  const ids = ['version', 'changelog', 'changelog-title', 'changelog-build', 'changelog-body', 'changelog-close'];
  for (const id of ids) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  assert.match(html, /<button id="version"[^>]*aria-controls="changelog"[^>]*>Version…<\/button>/);
  assert.ok(html.indexOf('id="version"') < html.indexOf('<main'), 'badge survives route content replacement');
  assert.ok(html.indexOf('id="changelog"') > html.indexOf('</main>'), 'dialog survives route content replacement');
  assert.ok(html.indexOf('src="/changelog.js"') < html.indexOf('src="/participate/page.js"'), 'changelog loads before page');
  const doc = fakeDocument(ids), log = [];
  const component = fs.readFileSync(new URL('./changelog.js', import.meta.url), 'utf8').replace(/export /g, '');
  vm.runInNewContext(component, {
    document: doc, location: { hash: '', pathname: '/participate/' }, sessionStorage: { getItem: () => null },
    fetch: fetchFor({ '/v2/health': json(HEALTH), '/changelog.json': json(CHANGELOG) }, log),
  });
  await settle();
  assert.equal(doc.getElementById('version').textContent, copy.shared, 'dedicated page is lazy, not a staff health read');
  assert.deepEqual(log, []);
  await doc.getElementById('version').fire('click'); await settle();
  assert.equal(doc.getElementById('changelog').open, true);
  assert.equal(doc.getElementById('version').textContent, 'Version 0.1.0', 'runtime health fixture supplies version, not markup');
  assert.equal(doc.getElementById('changelog-build').textContent, detailsLine(HEALTH.result));
  assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
});

for (const path of ['index.html', 'assess/index.html']) {
  test(`homepage badge is mounted and bootstraps the shared health-backed component: ${path}`, async () => {
    const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal((html.match(/src="\/changelog.js"/g) || []).length, 1);
    const ids = ['version', 'changelog', 'changelog-title', 'changelog-build', 'changelog-body', 'changelog-close'];
    for (const id of ids) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
    assert.match(html, /<button id="version"[^>]*aria-controls="changelog"[^>]*>Version…<\/button>/);
    assert.ok(html.indexOf('id="version"') < html.indexOf('<main'), 'badge survives route content replacement');
    assert.ok(html.indexOf('id="changelog"') > html.indexOf('</main>'), 'dialog survives route content replacement');
    const doc = fakeDocument(ids), log = [];
    const component = fs.readFileSync(new URL('./changelog.js', import.meta.url), 'utf8').replace(/export /g, '');
    vm.runInNewContext(component, {
      document: doc, location: { hash: '' }, sessionStorage: { getItem: () => null },
      fetch: fetchFor({ '/v2/health': json(HEALTH), '/changelog.json': json(CHANGELOG) }, log),
    });
    await settle();
    assert.equal(doc.getElementById('version').textContent, 'Version 0.1.0', 'runtime health fixture supplies version, not markup');
    await doc.getElementById('version').fire('click'); await settle();
    assert.equal(doc.getElementById('changelog').open, true);
    assert.equal(doc.getElementById('changelog-build').textContent, detailsLine(HEALTH.result));
    assert.deepEqual(log.map(r => r.url), ['/v2/health', '/changelog.json']);
  });
}

for (const retained of [null, 'retained-participant-state']) test(`roadmap auto-bootstrap health failure is honest before interaction (${retained === null ? 'fresh' : 'retained'})`, async()=>{
 const doc=fakeDocument(['version','changelog','changelog-build','changelog-body','changelog-close']),log=[];
 const component=fs.readFileSync(new URL('./changelog.js',import.meta.url),'utf8').replace(/export /g,'');
 vm.runInNewContext(component,{document:doc,location:{hash:'',pathname:'/roadmap'},sessionStorage:{getItem:()=>retained},fetch:fetchFor({'/v2/health':json({ok:true,result:{}})},log)});
 await settle();assert.equal(doc.getElementById('version').textContent,copy.unavailable);assert.deepEqual(log.map(r=>r.url),['/v2/health']);assert.ok(log.every(r=>r.options.credentials==='omit'&&r.options.cache==='no-store'));
 await doc.getElementById('version').fire('click');assert.equal(doc.getElementById('changelog').open,false);assert.equal(log.length,1);
});

test('long changelog uses a persistent first close control and resets scroll after deferred load and reopen',async()=>{
 const {JSDOM}=await import('jsdom');const doc=new JSDOM('<button id="version"></button><dialog id="changelog"><h2 id="changelog-title">Changes</h2><p id="changelog-build"></p><div id="changelog-body"></div><button id="changelog-close">Close</button></dialog>').window.document;
 const dialog=doc.getElementById('changelog'),body=doc.getElementById('changelog-body'),close=doc.getElementById('changelog-close'),badge=doc.getElementById('version');let resolveRead;let focusOptions;
 dialog.showModal=()=>{dialog.setAttribute('open','');dialog.scrollTop=900;};dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new doc.defaultView.Event('close'));};const focus=close.focus.bind(close);close.focus=opts=>{focusOptions=opts;focus(opts);};
 const api=initVersionBadge({doc,fetchImpl:async url=>url==='/v2/health'?json(HEALTH):new Promise(resolve=>{resolveRead=()=>resolve(json(CHANGELOG));})});await api.ready;
 badge.click();await settle();assert.equal(dialog.open,false);resolveRead();await api.ready;
 assert.equal(dialog.firstElementChild,close);assert.equal(close.getAttribute('aria-label'),'Close changelog');assert.equal(close.style.position,'sticky');assert.equal(dialog.scrollTop,0);assert.deepEqual(focusOptions,{preventScroll:true});assert.match(body.querySelector('h3').textContent,/0.1.0/);
 dialog.scrollTop=1000;body.scrollTop=700;close.click();assert.equal(dialog.open,false);assert.equal(doc.activeElement,badge);
 badge.click();await settle();resolveRead();await api.ready;assert.equal(dialog.scrollTop,0);assert.equal(body.scrollTop,0);assert.equal(dialog.open,true);
});

test('only a pointer gesture wholly on the backdrop closes; content and cross-boundary gestures do not',async()=>{
 const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="version"></button><dialog id="changelog"><h2 id="changelog-title">Changes</h2><p id="changelog-build"></p><div id="changelog-body"></div><button id="changelog-close">Close</button></dialog>'),doc=dom.window.document;
 const dialog=doc.getElementById('changelog'),badge=doc.getElementById('version');dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new dom.window.Event('close'));};dialog.getBoundingClientRect=()=>({left:100,top:100,right:600,bottom:700});const api=initVersionBadge({doc,fetchImpl:async url=>json(url==='/v2/health'?HEALTH:CHANGELOG)});await api.ready;badge.click();await api.ready;
 const fire=(target,type,x,y)=>target.dispatchEvent(new dom.window.MouseEvent(type,{clientX:x,clientY:y,bubbles:true}));
 fire(dialog,'pointerdown',200,200);fire(dialog,'click',200,200);assert.equal(dialog.open,true);
 fire(doc.getElementById('changelog-body'),'pointerdown',200,200);fire(dialog,'click',10,10);assert.equal(dialog.open,true);
 fire(dialog,'pointerdown',10,10);fire(dialog,'click',200,200);assert.equal(dialog.open,true);
 fire(dialog,'pointerdown',10,10);fire(dialog,'click',10,10);assert.equal(dialog.open,false);assert.equal(doc.activeElement,badge);assert.equal(badge.getAttribute('aria-expanded'),'false');
});
