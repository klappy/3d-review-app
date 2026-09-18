import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render, bind, shareFor, blankShare, copy, qrSvg, invitationSheetHtml, CAN_SHARE } from './share.js';

const read = n => readFileSync(fileURLToPath(new URL(n, import.meta.url)), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = { esc, enc: encodeURIComponent };
const current = role => ({ assessment: { id: 'a1', name: 'Tavo collection', stage: 'collect', role }, surveys: [] });
const survey = { id: 's1', template_name: 'Validation', perspective: 'Translation Team', collection_status: 'open' };
const err = (code, status) => Object.assign(new Error(code), { code, status });
function fakeApi(table) { const calls = []; const api = async (url, init = {}) => { calls.push({ url, ...init }); const h = table[`${init.method || 'GET'} ${url}`]; if (!h) throw err('NOT_FOUND_OR_NOT_VISIBLE', 404); const v = typeof h === 'function' ? h(init) : h; if (v instanceof Error) throw v; return v; }; return { api, calls }; }
// minimal root: querySelector by attribute name; click() fires the handler
function makeRoot(html) {
  const attrs = [...html.matchAll(/data-share-[a-z-]+/g)].map(m => m[0]);
  const els = Object.fromEntries(attrs.map(a => [a, { handlers: {}, addEventListener(ev, fn) { this.handlers[ev] = fn; }, click() { return this.handlers.click?.(); } }]));
  return { html, els, querySelector(sel) { const m = /\[(data-share-[a-z-]+)\]/.exec(sel); return m ? this.els[m[1]] || null : null; }, set innerHTML(v) { this.html = v; const r = makeRoot(v); this.els = r.els; }, get innerHTML() { return this.html; } };
}
function mount(role, table) {
  const { api, calls } = fakeApi(table); const state = {}; const cur = current(role); const share = shareFor(state, 'a1', 's1', 1);
  const root = makeRoot(render(ctx, { current: cur, survey, share })); const clipboard = { text: null, async writeText(t) { this.text = t; } };
  const prints = []; const sheets = []; const doc = { createElement: () => ({ set innerHTML(v) { this.html = v; }, className: '', remove() { sheets.push('removed'); } }), body: { append: el => sheets.push(el) } };
  const onChange = () => { root.innerHTML = render(ctx, { current: cur, survey, share }); bind(ctx, root, { current: cur, survey, share, api, onChange, print: () => prints.push(1), clipboard, doc, origin: 'https://example.test' }); };
  bind(ctx, root, { current: cur, survey, share, api, onChange, print: () => prints.push(1), clipboard, doc, origin: 'https://example.test' });
  return { api, calls, state, share, root, clipboard, prints, sheets, click: async attr => { await root.querySelector(`[${attr}]`).click(); } };
}
const LINKS = 'POST /v2/assessments/a1/surveys/s1/links';

test('roles: viewer sees no controls; owner and member get the Share card (issue_link/revoke_link are O, M)', () => {
  assert.deepEqual([...CAN_SHARE], ['owner', 'member']);
  const v = render(ctx, { current: current('viewer'), survey, share: blankShare() });
  assert.match(v, /cannot create participant links/); assert.doesNotMatch(v, /data-share-preview|data-share-create/);
  assert.match(render(ctx, { current: current('member'), survey, share: blankShare() }), /data-share-preview/);
});

test('two-step: preview (dry_run) shows the impact and a Create control; create (execute with confirm_token) shows the link ONCE with copy/QR/sheet/revoke', async () => {
  const m = mount('owner', { [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300, impact: { effect: 'external', compensating_control: 'cap.survey.revoke_link' } } : { link_id: 'inv_1', link_token: 'SECRET', entry_fragment: '#survey=SECRET', expires_at: null } });
  assert.doesNotMatch(m.root.html, /data-share-create/, 'no Create before preview');
  await m.click('data-share-preview');
  assert.deepEqual(m.calls[0].body, { params: {}, mode: 'dry_run' }); assert.match(m.root.html, /Nothing is sent until you confirm/); assert.match(m.root.html, /compensating control: cap.survey.revoke_link/); assert.match(m.root.html, /data-share-create/);
  await m.click('data-share-create');
  assert.deepEqual(m.calls[1].body, { params: {}, mode: 'execute', confirm_token: 'ct1' });
  assert.equal(m.share.confirm, null, 'confirm token is single-use'); assert.equal(m.share.link.url, 'https://example.test/#survey=SECRET'); assert.equal(m.share.link.id, 'inv_1');
  assert.match(m.root.html, /shown once/); assert.match(m.root.html, /data-share-copy/); assert.match(m.root.html, /data-share-qr/); assert.match(m.root.html, /data-share-sheet/); assert.match(m.root.html, /data-share-revoke/);
  assert.doesNotMatch(m.root.html, /link_token|inv_1/, 'the raw token field and link id are never rendered');
  await m.click('data-share-copy'); assert.equal(m.clipboard.text, 'https://example.test/#survey=SECRET'); assert.match(m.root.html, /Link copied/);
  await m.click('data-share-qr'); assert.match(m.root.html, /<svg/); assert.match(m.root.html, /Hide QR code/);
  await m.click('data-share-sheet'); assert.equal(m.prints.length, 1); assert.deepEqual(m.sheets.map(s => typeof s === 'string' ? s : 'mounted'), ['mounted', 'removed'], 'sheet mounted on body for print then removed');
});

test('create without a live confirm token never calls execute; a failed execute keeps no link', async () => {
  const m = mount('owner', { [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300 } : err('CONFIRM_EXPIRED', 409) });
  await m.click('data-share-preview'); m.share.confirm = null;
  await m.click('data-share-create'); assert.equal(m.calls.length, 1); assert.match(m.root.html, /Preview the survey link again/);
  await m.click('data-share-preview'); await m.click('data-share-create');
  assert.equal(m.share.link, null); assert.match(m.root.html, /CONFIRM_EXPIRED/); assert.doesNotMatch(m.root.html, /data-share-copy/);
});

test('revoke uses the link id (never the token) and clears the once-shown link; message states answers already sent stay', async () => {
  const m = mount('member', { [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300 } : { link_id: 'inv_9', entry_fragment: '#survey=TOK', expires_at: '2026-10-01T00:00:00.000Z' }, 'DELETE /v2/assessments/a1/surveys/s1/links/inv_9': { id: 'inv_9', status: 'revoked' } });
  await m.click('data-share-preview'); await m.click('data-share-create'); assert.match(m.root.html, /Expires 2026-10-01/);
  await m.click('data-share-revoke');
  assert.equal(m.calls[2].url, '/v2/assessments/a1/surveys/s1/links/inv_9'); assert.equal(m.calls[2].method, 'DELETE');
  assert.equal(m.share.link, null); assert.match(m.root.html, /Link revoked/); assert.doesNotMatch(m.root.html, /TOK/);
});

test('credential discipline: the model is keyed to (aid, sid, epoch) and dropped on any change; nothing is written to storage', async () => {
  const state = {}; const s1 = shareFor(state, 'a1', 's1', 1); s1.link = { id: 'x', url: 'https://example.test/#survey=T' };
  assert.equal(shareFor(state, 'a1', 's1', 1), s1);
  assert.equal(shareFor(state, 'a1', 's1', 2).link, null, 'new epoch → fresh model');
  shareFor(state, 'a1', 's1', 2).link = { id: 'y', url: 'u' }; assert.equal(shareFor(state, 'a1', 's2', 2).link, null, 'other survey → fresh model');
  const src = read('./share.js'); assert.doesNotMatch(src, /localStorage|sessionStorage|document\.cookie|console\.log/); assert.doesNotMatch(src, /location\.hash\s*=/);
  const shell = read('./assess.js'); assert.match(shell, /function resetIdentity\(\) \{ state\.share = null;/, 'identity change drops the share model');
});

test('QR and invitation sheet carry the URL only; sheet is print-only markup', () => {
  const svg = qrSvg('https://example.test/#survey=abc'); assert.match(svg, /^<svg/);
  const html = invitationSheetHtml(ctx, { current: current('owner'), survey, url: 'https://example.test/#survey=abc' });
  assert.match(html, /share-sheet-print/); assert.match(html, /https:\/\/example.test\/#survey=abc/); assert.match(html, /Validation/); assert.doesNotMatch(html, /a1|s1|owner/);
  assert.match(read('./share.js'), /\.share-sheet\{display:none\}@media print\{\.share-sheet\{display:block\}/);
});

test('harness + assets: server.mjs serves share.js, vendor-qrcode.js and shared-link.js; tests excluded from assets', () => {
  const server = read('../server.mjs'); for (const p of ['/assess/share.js', '/assess/vendor-qrcode.js', '/shared-link.js']) assert.ok(server.includes(`'${p}':`), p);
  assert.ok(read('../.assetsignore').split('\n').includes('assess/share.test.mjs'));
});
