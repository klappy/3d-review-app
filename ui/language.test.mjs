import assert from 'node:assert/strict';
import test from 'node:test';
import { initLanguageControls } from './language.js';

test('lists only active project languages and selects a newly created one', async () => {
  const listeners = {};
  const select = {
    value: '', options: [],
    replaceChildren(...options) { this.options = options; this.value = options[0]?.value ?? ''; },
    add(option) { this.options.push(option); },
  };
  const form = { addEventListener(name, fn) { listeners.submit = fn; }, reset() {} };
  const button = { addEventListener(name, fn) { listeners.click = fn; } };
  const status = { textContent: '' };
  const nodes = { 'create-language': form, 'load-languages': button, languages: select, 'language-status': status };
  const previousDocument = globalThis.document, previousOption = globalThis.Option, previousFormData = globalThis.FormData;
  globalThis.document = { getElementById(id) { return nodes[id]; } };
  globalThis.Option = class { constructor(label, value) { this.label = label; this.value = value; } };
  globalThis.FormData = class { get(key) { return { name: 'Invented Tavo', code: 'qaa' }[key]; } };
  let pending;
  const requests = [];
  const api = async (url, opts = {}) => {
    requests.push([url, opts]);
    if (opts.method === 'POST') return { language: { id: 'lang_new' } };
    return { languages: [
      { id: 'lang_old', name: 'Old', code: null, archived_at: '2026-09-16' },
      { id: 'lang_new', name: 'Invented Tavo', code: 'qaa', archived_at: null },
    ] };
  };
  try {
    const controls = initLanguageControls({ api, run: (_label, task) => { pending = task(); }, getProject: () => 'proj_new' });
    await controls.refresh();
    assert.deepEqual(select.options.map(o => o.value), ['', 'lang_new']);
    assert.match(status.textContent, /1 active project language; 1 archived/);
    listeners.submit({ preventDefault() {} }); await pending;
    assert.equal(select.value, 'lang_new');
    assert.deepEqual(requests[1], ['/v2/projects/proj_new/languages', { method: 'POST', body: { name: 'Invented Tavo', code: 'qaa' } }]);
  } finally {
    globalThis.document = previousDocument; globalThis.Option = previousOption; globalThis.FormData = previousFormData;
  }
});
