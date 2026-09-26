import test from 'node:test'; import assert from 'node:assert/strict'; import { JSDOM } from 'jsdom';
import { showSavedStatus, undoTokenOf } from './saved-status.js';
const flush = () => new Promise(r => setTimeout(r, 0));
const page = () => { const w = new JSDOM('<main><form id="f"><input name="name"></form><p id="other"></p></main>', { url: 'http://x/#a' }).window; return { w, d: w.document, f: w.document.getElementById('f') }; };

test('undoTokenOf reads only the receipt token', () => {
  assert.equal(undoTokenOf({ result: {}, receipt: { undo_token: 'undo_1' } }), 'undo_1');
  assert.equal(undoTokenOf({ result: {} }), null); assert.equal(undoTokenOf({ receipt: { undo_token: '' } }), null); assert.equal(undoTokenOf(null), null);
});
test('no undo_token → just "Saved", right after the form used', () => {
  const { d, f } = page(); showSavedStatus(f, { undoToken: null, undo: async () => {} });
  const s = d.querySelector('[data-saved-status]'); assert.equal(s.textContent, 'Saved'); assert.equal(f.nextElementSibling, s); assert.equal(s.getAttribute('role'), 'status'); assert.equal(s.querySelector('button'), null);
});
test('undo_token → "Saved · Undo"; Undo calls undo(token) once and says "Undone"; a repainted anchor is followed', async () => {
  const { d, f } = page(); const calls = []; let f2;
  showSavedStatus(f, { undoToken: 'undo_9', undo: async t => { calls.push(t); f.remove(); f2 = d.createElement('form'); d.querySelector('main').prepend(f2); return f2; } });
  assert.equal(d.querySelector('[data-saved-status]').textContent, 'Saved · Undo');
  const b = d.querySelector('[data-undo]'); b.click(); b.click(); await flush();
  assert.deepEqual(calls, ['undo_9']); const s = d.querySelector('[data-saved-status]'); assert.equal(s.textContent, 'Undone'); assert.equal(f2.nextElementSibling, s);
});
test('a refused undo shows the reason and keeps Undo; one status per anchor; navigation clears it', async () => {
  const { w, d, f } = page();
  showSavedStatus(f, { undoToken: 't', undo: async () => { throw new Error('Undo failed: gone'); } });
  d.querySelector('[data-undo]').click(); await flush();
  assert.match(d.querySelector('[data-saved-status]').textContent, /^Undo failed: gone Undo$/); assert.ok(d.querySelector('[data-saved-status]').classList.contains('alert'));
  showSavedStatus(f, {}); assert.equal(d.querySelectorAll('[data-saved-status]').length, 1);
  w.dispatchEvent(new w.HashChangeEvent('hashchange')); assert.equal(d.querySelectorAll('[data-saved-status]').length, 0);
});
test('inside: the status goes in the heading row', () => {
  const { d } = page(); const row = d.getElementById('other'); showSavedStatus(row, { inside: true }); assert.equal(row.lastElementChild.textContent, 'Saved');
});

// Workspace rename (scope.js) end to end in jsdom with a stubbed API.
test('workspace rename: "Saved · Undo" beside the rename form; Undo restores the old name and says "Undone"; navigation clears it', async () => {
  const { pages } = await import('../../assess/scope.js');
  const w = new JSDOM('<main id="root"></main>', { url: 'http://x/#workspaces/ws1' }).window, d = w.document, root = d.getElementById('root');
  let name = 'Old', notes = [], calls = [];
  const api = async (url, { method = 'GET', body } = {}) => {
    calls.push(`${method} ${url}`);
    if (method === 'GET') return { workspace: { id: 'ws1', name, role: 'owner', archived_at: null }, projects: [] };
    if (method === 'PATCH') { name = body.name; return { workspace: { id: 'ws1', name } }; }
    if (method === 'POST' && url === '/v2/undo/undo_ws') { name = 'Old'; return { undone: 'cap.workspace.update' }; }
    throw new Error('unexpected ' + url);
  };
  const ctx = { api, apiFull: async (u, o) => ({ ok: true, result: await api(u, o), receipt: { undo_token: 'undo_ws' } }), esc: s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`), enc: encodeURIComponent, routes: { workspaces: '#workspaces', projects: '#projects' }, note: (t, a) => notes.push([t, a]), state: {}, cards: {} };
  const ws = pages.workspace, model = await ws.load(ctx, { id: 'ws1' });
  root.innerHTML = ws.render(ctx, model); ws.bind(ctx, root, model);
  const form = root.querySelector('#rename-form'); form.elements.name.value = 'New';
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); for (let i = 0; i < 5; i++) await flush();
  const f1 = root.querySelector('#rename-form'), s1 = root.querySelector('[data-saved-status]');
  assert.equal(name, 'New'); assert.equal(s1.textContent, 'Saved · Undo'); assert.equal(f1.nextElementSibling, s1); assert.equal(f1.elements.name.value, 'New');
  s1.querySelector('[data-undo]').click(); for (let i = 0; i < 5; i++) await flush();
  const f2 = root.querySelector('#rename-form'), s2 = root.querySelector('[data-saved-status]');
  assert.ok(calls.includes('POST /v2/undo/undo_ws')); assert.equal(name, 'Old'); assert.equal(f2.elements.name.value, 'Old'); assert.equal(s2.textContent, 'Undone'); assert.equal(f2.nextElementSibling, s2);
  assert.deepEqual(notes.filter(n => n[1]), []);
  w.dispatchEvent(new w.HashChangeEvent('hashchange')); assert.equal(root.querySelector('[data-saved-status]'), null);
});
