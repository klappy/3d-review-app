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
function mount(role, table) {
  const calls = [], api = async (url, init = {}) => { calls.push({ url, ...init }); const h = table[`${init.method || 'GET'} ${url}`]; if (!h) throw Object.assign(new Error('nf'), { code: 'NOT_FOUND_OR_NOT_VISIBLE', status: 404 }); return h(init); };
  const cur = current(role), share = shareFor({}, 'a1', 's1', 1), prints = [], sheets = [];
  const doc = { createElement: () => ({ set innerHTML(v) { this.html = v; }, className: '', remove() {} }), body: { append: el => sheets.push(el.html) } };
  const m = { calls, share, prints, sheets, root: null };
  const paint = () => { m.root = makeRoot(render(ctx, { current: cur, survey, share })); bind(ctx, m.root, { current: cur, survey, share, api, onChange: paint, print: () => prints.push(1), doc, origin: 'https://example.test' }); };
  paint();
  m.click = async a => { await m.root.querySelector(`[${a}]`).click(); };
  return m;
}
const happy = () => ({
  [CODES]: ({ body }) => ({ count: body.count, ids: Array.from({ length: body.count }, (_, i) => `code_${i}`) }),
  [EXPORT]: ({ body }) => body.mode === 'dry_run' ? { count: body.params.ids.length, confirm_token: 'ct', expires_in: 300 } : { count: body.params.ids.length, codes: body.params.ids.map((id, i) => ({ id, code: `C0DE${i}` })) },
});

test('viewers never see access codes; owners and members do, with the one shown-once sentence', () => {
  const v = render(ctx, { current: current('viewer'), survey, share: blankShare() });
  assert.doesNotMatch(v, /data-share-codes|Access codes/);
  for (const r of ['owner', 'member']) { const h = render(ctx, { current: current(r), survey, share: blankShare() }); assert.match(h, /data-share-codes-prepare/); assert.ok(h.includes(esc(copy.codesOnce))); }
});

test('20 codes: issue once, preview (dry run), in-page confirm, execute once, print-ready list, then gone', async () => {
  const m = mount('member', happy());
  m.root.els['data-share-codes-count'].value = '20';
  await m.click('data-share-codes-prepare');
  assert.deepEqual(m.calls.map(c => [c.url.endsWith('/export') ? 'export' : 'codes', c.body.mode || 'write']), [['codes', 'write'], ['export', 'dry_run']]);
  assert.equal(m.calls[0].body.count, 20);
  assert.ok(m.root.html.includes('data-share-codes-confirm') && m.root.html.includes('Show 20 access codes'), 'in-page confirm (shared review-gate markup)');
  assert.doesNotMatch(m.root.html, /C0DE/);
  await m.click('data-share-codes-go');
  const exec = m.calls[2]; assert.equal(exec.body.mode, 'execute'); assert.equal(exec.body.confirm_token, 'ct'); assert.equal(exec.body.params.ids.length, 20);
  assert.equal((m.root.html.match(/<li><code>C0DE/g) || []).length, 20);
  await m.click('data-share-codes-print');
  assert.equal(m.prints.length, 1); assert.equal((m.sheets[0].match(/<li><code>/g) || []).length, 20);
  await m.click('data-share-codes-done');
  assert.doesNotMatch(m.root.html, /C0DE/, 'shown once: values leave the page model');
  assert.equal(m.calls.length, 3, 'no second issue or release');
});

test('cancel sends nothing; an expired preview never executes; a lost execute never re-releases', async () => {
  const m = mount('owner', happy());
  await m.click('data-share-codes-prepare'); await m.click('data-share-codes-cancel');
  assert.equal(m.calls.length, 2); assert.match(m.root.html, /Preview again/);
  await m.click('data-share-codes-prepare');
  assert.equal(m.calls.length, 3, 'preview again reuses the issued batch (no second issue)');
  const t = { ...happy(), [EXPORT]: ({ body }) => { if (body.mode === 'dry_run') return { confirm_token: 'ct', expires_in: 300 }; throw new Error('network'); } };
  const n = mount('owner', t);
  await n.click('data-share-codes-prepare'); await n.click('data-share-codes-go');
  assert.match(n.root.html, /cannot be shown again/); assert.match(n.root.html, /Preview codes/);
});

test('count outside 1–100 is refused before any call', async () => {
  const m = mount('owner', happy());
  m.root.els['data-share-codes-count'].value = '0';
  await m.click('data-share-codes-prepare');
  assert.equal(m.calls.length, 0); assert.match(m.root.html, /between 1 and 100/);
});
