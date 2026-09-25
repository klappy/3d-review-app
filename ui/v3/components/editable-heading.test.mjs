import test from 'node:test'; import assert from 'node:assert/strict'; import { JSDOM } from 'jsdom';
import { mountEditableHeading } from './editable-heading.js';
const page = () => { const d = new JSDOM('<div class="row"><h1>Lake &lt;one&gt;</h1><span>menu</span></div>').window.document; return { d, h1: d.querySelector('h1') }; };
const submit = (d, form) => form.dispatchEvent(new d.defaultView.Event('submit', { cancelable: true }));
const flush = () => new Promise(r => setTimeout(r, 0));

test('no grant → heading only, no control', () => {
  const { d, h1 } = page();
  assert.equal(mountEditableHeading(h1, { canEdit: false, label: 'project name', save: async () => {} }), null);
  assert.equal(d.querySelector('[data-edit-heading]'), null); assert.equal(d.querySelector('.v3-eh'), null);
});
test('pencil opens inline field with Save/Cancel; Cancel restores; Save calls save(name) and updates the heading', async () => {
  const { d, h1 } = page(); const calls = [];
  mountEditableHeading(h1, { canEdit: true, label: 'project name', save: async n => { calls.push(n); } });
  const btn = d.querySelector('[data-edit-heading]');
  assert.equal(btn.getAttribute('aria-label'), 'Edit project name'); assert.equal(h1.parentElement.className, 'v3-eh');
  btn.click();
  const form = d.querySelector('.v3-eh-form'); assert.equal(form.querySelector('input').value, 'Lake <one>'); assert.equal(h1.hidden, true);
  assert.deepEqual([...form.querySelectorAll('button')].map(b => b.textContent), ['Save', 'Cancel']);
  form.querySelector('[data-cancel]').click(); assert.equal(d.querySelector('.v3-eh-form'), null); assert.equal(h1.hidden, false); assert.deepEqual(calls, []);
  btn.click(); d.querySelector('.v3-eh-form input').value = '  New name '; submit(d, d.querySelector('.v3-eh-form')); await flush();
  assert.deepEqual(calls, ['New name']); assert.equal(h1.textContent, 'New name'); assert.equal(d.querySelector('.v3-eh-form'), null);
});
test('refusal keeps the field open with the reason; re-mount never duplicates the control', async () => {
  const { d, h1 } = page();
  mountEditableHeading(h1, { canEdit: true, label: 'assessment name', save: async () => { throw new Error('Not allowed here.'); } });
  d.querySelector('[data-edit-heading]').click(); d.querySelector('.v3-eh-form input').value = 'X'; submit(d, d.querySelector('.v3-eh-form')); await flush();
  assert.equal(d.querySelector('.v3-eh-msg').textContent, 'Not allowed here.'); assert.equal(h1.textContent, 'Lake <one>');
  mountEditableHeading(h1, { canEdit: true, label: 'assessment name', save: async () => false });
  assert.equal(d.querySelectorAll('[data-edit-heading]').length, 1); assert.equal(d.querySelectorAll('.v3-eh-form').length, 0); assert.equal(d.querySelectorAll('.v3-eh').length, 1); assert.equal(h1.hidden, false);
  d.querySelector('[data-edit-heading]').click(); d.querySelector('.v3-eh-form input').value = 'Y'; submit(d, d.querySelector('.v3-eh-form')); await flush();
  assert.equal(d.querySelector('.v3-eh-msg').textContent, 'The name was not saved.');
});
