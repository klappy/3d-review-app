// U10: Access codes on the survey Share card — count → preview (dry run) → in-page confirm → shown once → print-ready list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { render, bind, shareFor, blankShare, copy } from './share.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = { esc, enc: encodeURIComponent };
const current = role => ({ assessment: { id: 'a1', name: 'Tavo collection', stage: 'collect', role }, surveys: [] });
const survey = { id: 's1', template_name: 'Validation', perspective: 'Translation Team', collection_status: 'open' };
const CODES = 'POST /v2/assessments/a1/surveys/s1/codes', EXPORT = `${CODES}/export`;
function makeRoot(html) {
  const els = Object.fromEntries([...html.matchAll(/data-[a-z-]+/g)].map(m => [m[0], { value: undefined, handlers: {}, addEventListener(ev, fn) { this.handlers[ev] = fn; }, click() { return this.handlers.click?.(); } }]));
  return { html, els, querySelector(sel) { const m = /\[(data-[a-z-]+)\]/.exec(sel); return m ? this.els[m[1]] || null : null; } };
}
// Fake server: tracks live (issued, not undone) codes so a test can prove no batch is ever left unseen.
function server(opts = {}) {
  const live = new Map(); let n = 0;
  const table = {
    [CODES]: ({ body }) => { const batch = `b${++n}`, ids = Array.from({ length: body.count }, (_, i) => `${batch}_${i}`); live.set(batch, ids); return { ok: true, result: { count: body.count, ids }, receipt: { undo_token: `u_${batch}` } }; },
    [EXPORT]: ({ body }) => { if (opts.exportFails && body.mode === 'execute') throw new Error('network'); return body.mode === 'dry_run' ? { count: body.params.ids.length, confirm_token: 'ct', expires_in: 300 } : { count: body.params.ids.length, codes: body.params.ids.map((id, i) => ({ id, code: `C0DE${i}` })) }; },
  };
  const undo = url => { if (opts.undoFails) throw new Error('network'); live.delete(url.split('/').pop().slice(2)); return { ok: true }; };
  return { table, live, undo, liveCount: () => [...live.values()].reduce((t, ids) => t + ids.length, 0) };
}
function mount(role, srv = server(), { isCurrent = () => true } = {}) {
  const calls = [], api = async (url, init = {}) => { calls.push({ url, ...init }); if (url.startsWith('/v2/undo/')) return srv.undo(url); const h = srv.table[`${init.method || 'GET'} ${url}`]; if (!h) throw Object.assign(new Error('nf'), { code: 'NOT_FOUND_OR_NOT_VISIBLE', status: 404 }); const v = h(init); return url === '/v2/assessments/a1/surveys/s1/codes' ? v.result : v; };
  const apiFull = async (url, init = {}) => { calls.push({ url, ...init }); return srv.table[`${init.method} ${url}`](init); };
  const cur = current(role), share = shareFor({}, 'a1', 's1', 1), prints = [], sheets = [];
  const doc = { createElement: () => ({ set innerHTML(v) { this.html = v; }, className: '', remove() {} }), body: { append: el => sheets.push(el.html) } };
  const m = { calls, share, prints, sheets, srv, root: null };
  const c = { ...ctx, isCurrent };
  const paint = () => { m.root = makeRoot(render(c, { current: cur, survey, share })); bind(c, m.root, { current: cur, survey, share, api, apiFull, onChange: paint, print: () => prints.push(1), doc, origin: 'https://example.test' }); };
  paint();
  m.click = async a => { await m.root.querySelector(`[${a}]`).click(); };
  return m;
}
const kinds = m => m.calls.map(c => c.url.startsWith('/v2/undo/') ? 'undo' : c.url.endsWith('/export') ? `export:${c.body.mode}` : 'codes:write');

test('viewers never see access codes; owners and members do, with the one shown-once sentence', () => {
  const v = render(ctx, { current: current('viewer'), survey, share: blankShare() });
  assert.doesNotMatch(v, /data-share-codes|Access codes/);
  for (const r of ['owner', 'member']) { const h = render(ctx, { current: current(r), survey, share: blankShare() }); assert.match(h, /data-share-codes-prepare/); assert.ok(h.includes(esc(copy.codesOnce))); }
});

test('20 codes: preview asks in the page (nothing issued), confirm issues once, dry-runs, releases once, prints, then gone', async () => {
  const m = mount('member');
  m.root.els['data-share-codes-count'].value = '20';
  await m.click('data-share-codes-prepare');
  assert.equal(m.calls.length, 0, 'preview issues nothing');
  assert.ok(m.root.html.includes('data-share-codes-confirm') && m.root.html.includes('Issue and show 20 access codes'), 'in-page confirm (shared review-gate markup)');
  await m.click('data-share-codes-go');
  assert.deepEqual(kinds(m), ['codes:write', 'export:dry_run', 'export:execute']);
  assert.equal(m.calls[0].body.count, 20); assert.equal(m.calls[2].body.confirm_token, 'ct');
  assert.equal((m.root.html.match(/<li><code>C0DE/g) || []).length, 20);
  await m.click('data-share-codes-print');
  assert.equal(m.prints.length, 1); assert.equal((m.sheets[0].match(/<li><code>/g) || []).length, 20);
  await m.click('data-share-codes-done');
  assert.doesNotMatch(m.root.html, /C0DE/, 'shown once: values leave the page model');
  assert.equal(m.calls.length, 3, 'no second issue or release');
});

test('cancel → 0 live codes and says so in one sentence', async () => {
  const m = mount('owner');
  await m.click('data-share-codes-prepare'); await m.click('data-share-codes-cancel');
  assert.equal(m.srv.liveCount(), 0); assert.equal(m.calls.length, 0);
  assert.match(m.root.html, /Cancelled; no codes were issued\./);
});

test('leave and return → no orphan batch: leaving mid-release undoes it, and the next release issues exactly one batch', async () => {
  const srv = server(); let here = true;
  const m = mount('owner', srv, { isCurrent: () => here });
  await m.click('data-share-codes-prepare');
  const go = m.root.querySelector('[data-share-codes-go]').click(); here = false; await go;
  assert.equal(srv.liveCount(), 0, 'unseen batch undone after leaving');
  here = true; const back = mount('owner', srv); // return: a fresh share model
  await back.click('data-share-codes-prepare'); await back.click('data-share-codes-go');
  assert.equal(srv.live.size, 1, 'exactly the one batch the facilitator sees is live');
  assert.deepEqual(kinds(back), ['codes:write', 'export:dry_run', 'export:execute']);
});

test('a failed release undoes the batch; if undo also fails the card says N codes are active and offers Undo', async () => {
  const a = mount('owner', server({ exportFails: true }));
  await a.click('data-share-codes-prepare'); await a.click('data-share-codes-go');
  assert.equal(a.srv.liveCount(), 0); assert.match(a.root.html, /no codes were issued/);
  const srv = server({ exportFails: true, undoFails: true }), b = mount('owner', srv);
  await b.click('data-share-codes-prepare'); await b.click('data-share-codes-go');
  assert.match(b.root.html, /20 codes are issued and still active\./); assert.match(b.root.html, /data-share-codes-undo/);
  srv.undo = url => { srv.live.delete(url.split('/').pop().slice(2)); return { ok: true }; };
  await b.click('data-share-codes-undo');
  assert.equal(srv.liveCount(), 0); assert.doesNotMatch(b.root.html, /still active/);
});
test('count outside 1–100 is refused before any call', async () => {
  const m = mount('owner');
  m.root.els['data-share-codes-count'].value = '0';
  await m.click('data-share-codes-prepare');
  assert.equal(m.calls.length, 0); assert.match(m.root.html, /between 1 and 100/);
});
