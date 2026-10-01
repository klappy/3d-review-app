import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { passagesHtml, mountPassages, PASSAGE_ACCEPT } from './passages.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sample = [
  { id: 'passage_1', kind: 'link', media: 'video', title: 'Mark 4 in ISL', reference: 'Mark 4:1-20', href: 'https://youtu.be/x' },
  { id: 'passage_2', kind: 'file', media: 'audio', title: 'Mark 4.mp3', reference: null, size: 2400000, href: '/v2/passages/passage_2/file?exp=1&sig=s' },
];

test('passagesHtml: rows open in a new tab; editors get Remove and both forms; viewers read only', () => {
  const edit = passagesHtml(esc, { mayEdit: true, passages: sample });
  assert.match(edit, /Mark 4 in ISL/); assert.match(edit, /Mark 4:1-20/); assert.match(edit, /2\.3 MB/);
  assert.match(edit, /target="_blank" rel="noopener noreferrer"/);
  assert.equal((edit.match(/data-passage-remove=/g) || []).length, 2);
  assert.match(edit, new RegExp(`accept="${PASSAGE_ACCEPT.replace(/\./g, '\\.')}"`));
  assert.match(edit, /data-passage-link/);
  const view = passagesHtml(esc, { mayEdit: false, passages: sample });
  assert.doesNotMatch(view, /data-passage-remove|data-passage-upload|data-passage-link/);
  assert.match(passagesHtml(esc, { mayEdit: true, passages: [], fileStorage: false }), /File uploads are not set up/);
  assert.match(passagesHtml(esc, { passages: [] }), /Nothing attached yet/);
  assert.doesNotMatch(passagesHtml(esc, { passages: [{ ...sample[0], title: '<img onerror=x>' }] }), /<img onerror/);
});

test('mountPassages: lists, uploads the raw file with name and passage, adds a link as JSON, removes', async () => {
  const dom = new JSDOM('<div id="r"></div>'); globalThis.FormData = dom.window.FormData;
  const root = dom.window.document.getElementById('r');
  const calls = []; let list = [...sample];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers, body: init.body });
    if ((init.method || 'GET') === 'GET') return { ok: true, status: 200, json: async () => ({ ok: true, result: { passages: list, file_storage: true } }) };
    if (init.method === 'DELETE') { list = list.filter(p => !url.endsWith(p.id)); return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) }; }
    return { ok: true, status: 201, json: async () => ({ ok: true, result: { passage: {} } }) };
  };
  mountPassages({ root, aid: 'a1', mayEdit: true, esc, token: () => 'st_x', fetchImpl });
  await new Promise(r => setTimeout(r, 20));
  assert.match(root.textContent, /Mark 4 in ISL/);
  assert.equal(calls[0].headers.authorization, 'Bearer st_x');
  const file = new dom.window.File(['ID3'], 'Mark 4.mp3', { type: 'audio/mpeg' });
  const up = root.querySelector('form[data-passage-upload]');
  Object.defineProperty(up.querySelector('input[type=file]'), 'files', { value: [file] });
  up.querySelector('input[name=reference]').value = 'Mark 4';
  await up.onsubmit({ preventDefault() {} });
  const post = calls.find(c => c.method === 'POST');
  assert.equal(post.url, '/v2/assessments/a1/passages?name=Mark%204.mp3&reference=Mark%204');
  assert.equal(post.headers['content-type'], 'audio/mpeg'); assert.equal(post.body, file);
  const ln = root.querySelector('form[data-passage-link]');
  ln.querySelector('input[name=url]').value = 'https://youtu.be/y'; ln.querySelector('input[name=title]').value = 'Sign';
  await ln.onsubmit({ preventDefault() {} });
  const linkCall = calls.filter(c => c.method === 'POST')[1];
  assert.equal(linkCall.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(linkCall.body), { url: 'https://youtu.be/y', title: 'Sign', reference: '' });
  await root.querySelector('[data-passage-remove="passage_1"]').onclick();
  assert.ok(calls.some(c => c.method === 'DELETE' && c.url === '/v2/assessments/a1/passages/passage_1'));
  assert.doesNotMatch(root.textContent, /Mark 4 in ISL/);
});

test('passagesHtml: a USFM passage says "Text · PDF" when PTXprint made one, else "Text file"', () => {
  const text = (pdf) => ({ id: 'passage_3', kind: 'file', media: 'text', title: 'Mark 4.usfm', reference: null, size: 90, pdf, href: '/v2/passages/passage_3/file?exp=1&sig=s' });
  assert.match(passagesHtml(esc, { mayEdit: false, passages: [text(true)] }), /<span class="p-kind">Text · PDF<\/span>/);
  assert.match(passagesHtml(esc, { mayEdit: false, passages: [text(false)] }), /<span class="p-kind">Text file<\/span>/);
});

test('S34: a refused link (http://) keeps the typed URL, title and passage in the fields; a later success clears them', async () => {
  const dom = new JSDOM('<div id="r"></div>'); globalThis.FormData = dom.window.FormData;
  const root = dom.window.document.getElementById('r');
  let refuse = true;
  const fetchImpl = async (url, init = {}) => {
    if ((init.method || 'GET') === 'GET') return { ok: true, status: 200, json: async () => ({ ok: true, result: { passages: [], file_storage: true } }) };
    if (refuse) return { ok: false, status: 400, json: async () => ({ ok: false, error: { message: 'Links must start with https://.' } }) };
    return { ok: true, status: 201, json: async () => ({ ok: true, result: { passage: {} } }) };
  };
  mountPassages({ root, aid: 'a1', mayEdit: true, esc, token: () => null, fetchImpl });
  await new Promise(r => setTimeout(r, 20));
  let ln = root.querySelector('form[data-passage-link]');
  ln.querySelector('input[name=url]').value = 'http://example.org/v'; ln.querySelector('input[name=title]').value = 'Sign "A"'; ln.querySelector('input[name=reference]').value = 'Mark 4';
  await ln.onsubmit({ preventDefault() {} });
  ln = root.querySelector('form[data-passage-link]');
  assert.match(root.querySelector('.p-status').textContent, /https:\/\//);
  assert.equal(ln.querySelector('input[name=url]').value, 'http://example.org/v', 'the typed URL stays to be fixed');
  assert.equal(ln.querySelector('input[name=title]').value, 'Sign "A"');
  assert.equal(ln.querySelector('input[name=reference]').value, 'Mark 4');
  refuse = false; ln.querySelector('input[name=url]').value = 'https://example.org/v';
  await ln.onsubmit({ preventDefault() {} });
  ln = root.querySelector('form[data-passage-link]');
  assert.equal(ln.querySelector('input[name=url]').value, '');
  assert.equal(root.querySelector('.p-status').textContent, 'Link added.');
});

test('S34 pin: the API refusal "a link must be a full https:// address" (src/passages.ts 400) is the status line and the draft is put back', async () => {
  const refusal = 'a link must be a full https:// address';
  assert.match(passagesHtml(esc, { mayEdit: true, linkDraft: { url: 'http://x.org/"v"', title: '', reference: 'Mark 4' } }), /<input value="http:\/\/x\.org\/&quot;v&quot;" type="url" name="url"/);
  const dom = new JSDOM('<div id="r"></div>'); globalThis.FormData = dom.window.FormData;
  const root = dom.window.document.getElementById('r');
  const posts = [];
  const fetchImpl = async (url, init = {}) => {
    if ((init.method || 'GET') === 'GET') return { ok: true, status: 200, json: async () => ({ ok: true, result: { passages: [], file_storage: true } }) };
    posts.push(JSON.parse(init.body));
    return { ok: false, status: 400, json: async () => ({ ok: false, error: { code: 'INVALID_PARAMS', message: refusal } }) };
  };
  mountPassages({ root, aid: 'a1', mayEdit: true, esc, token: () => null, fetchImpl });
  await new Promise(r => setTimeout(r, 20));
  let ln = root.querySelector('form[data-passage-link]');
  ln.querySelector('input[name=url]').value = '  http://youtu.be/sign  '; ln.querySelector('input[name=title]').value = 'Mark 4 in ISL';
  await ln.onsubmit({ preventDefault() {} });
  assert.deepEqual(posts[0], { url: 'http://youtu.be/sign', title: 'Mark 4 in ISL', reference: '' });
  assert.equal(root.querySelector('.p-status').textContent, refusal, 'the 400 message is the status line, word for word');
  ln = root.querySelector('form[data-passage-link]');
  assert.notEqual(ln, null);
  assert.equal(ln.querySelector('input[name=url]').value, 'http://youtu.be/sign', 'the kept draft is put back after the repaint');
  assert.equal(ln.querySelector('input[name=title]').value, 'Mark 4 in ISL');
  assert.equal(ln.querySelector('input[name=reference]').value, '');
  assert.ok([...ln.querySelectorAll('button,input')].every(el => !el.disabled), 'the form is usable again to fix the link');
});
