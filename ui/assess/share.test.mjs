import test from 'node:test';
import vm from 'node:vm';
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
function mount(role, table, extras = {}) {
  const { api, calls } = fakeApi(table); const state = {}; const cur = current(role); const share = shareFor(state, 'a1', 's1', 1);
  const bindCtx = { ...ctx, ...extras };
  const root = makeRoot(render(ctx, { current: cur, survey, share })); const clipboard = { text: null, async writeText(t) { this.text = t; } };
  const prints = []; const sheets = []; const doc = { createElement: () => ({ set innerHTML(v) { this.html = v; }, className: '', remove() { sheets.push('removed'); } }), body: { append: el => sheets.push(el) } };
  const onChange = () => { root.innerHTML = render(ctx, { current: cur, survey, share }); bind(bindCtx, root, { current: cur, survey, share, api, onChange, print: () => prints.push(1), clipboard, doc, origin: 'https://example.test' }); };
  bind(bindCtx, root, { current: cur, survey, share, api, onChange, print: () => prints.push(1), clipboard, doc, origin: 'https://example.test' });
  return { api, calls, state, share, root, clipboard, prints, sheets, click: async attr => { await root.querySelector(`[${attr}]`).click(); } };
}
const LINKS = 'POST /v2/assessments/a1/surveys/s1/links';

test('roles: viewer sees no controls; owner and member get the Share card (issue_link/revoke_link are O, M)', () => {
  assert.deepEqual([...CAN_SHARE], ['owner', 'member']);
  const v = render(ctx, { current: current('viewer'), survey, share: blankShare() });
  assert.match(v, /cannot share participant links/); assert.doesNotMatch(v, /data-share-open|data-share-copy/);
  assert.match(render(ctx, { current: current('member'), survey, share: blankShare() }), /data-share-open/);
});

test('Share prepares only; Copy confirms issuance and delivers, then QR/print reuse the same link', async () => {
  const m = mount('owner', { [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300, impact: { effect: 'external', compensating_control: 'cap.survey.revoke_link' } } : { link_id: 'inv_1', link_token: 'SECRET', entry_fragment: '#survey=SECRET', expires_at: null } });
  assert.doesNotMatch(m.root.html, /data-share-copy/, 'no Create before preview');
  await m.click('data-share-open');
  assert.deepEqual(m.calls[0].body, { params: {}, mode: 'dry_run' }); assert.match(m.root.html, /Your choice makes a participant link available/); assert.doesNotMatch(m.root.html, /compensating control|Preview link|Create survey link/); assert.equal(m.calls.length, 1); assert.match(m.root.html, /data-share-copy/);
  await m.click('data-share-copy');
  assert.deepEqual(m.calls[1].body, { params: {}, mode: 'execute', confirm_token: 'ct1' });
  assert.equal(m.share.confirm, null, 'confirm token is single-use'); assert.equal(m.share.link.url, 'https://example.test/#survey=SECRET'); assert.equal(m.share.link.id, 'inv_1');
  assert.match(m.root.html, /Keep a copy of this link/); assert.match(m.root.html, /data-share-copy/); assert.match(m.root.html, /data-share-qr/); assert.match(m.root.html, /data-share-sheet/); assert.match(m.root.html, /data-share-revoke/);
  assert.doesNotMatch(m.root.html, /link_token|inv_1/, 'the raw token field and link id are never rendered');
  await m.click('data-share-copy'); assert.equal(m.clipboard.text, 'https://example.test/#survey=SECRET'); assert.match(m.root.html, /Link copied/);
  await m.click('data-share-qr'); assert.match(m.root.html, /<svg/); assert.match(m.root.html, /Hide QR code/);
  await m.click('data-share-sheet'); assert.equal(m.calls.length, 2, 'output retries never reissue'); assert.equal(m.prints.length, 1); assert.deepEqual(m.sheets.map(s => typeof s === 'string' ? s : 'mounted'), ['mounted', 'removed'], 'sheet mounted on body for print then removed');
});

test('create without a live confirm token never calls execute; a failed execute keeps no link', async () => {
  const m = mount('owner', { [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300 } : err('CONFIRM_EXPIRED', 409) });
  await m.click('data-share-open'); m.share.confirm = null;
  await m.click('data-share-copy'); assert.equal(m.calls.length, 1); assert.match(m.root.html, /Sharing options expired/);
  await m.click('data-share-open'); await m.click('data-share-copy');
  assert.equal(m.share.link, null); assert.match(m.root.html, /Sharing options expired/); assert.doesNotMatch(m.root.html, /data-share-copy/);
});

test('revoke uses the link id (never the token) and clears the once-shown link; message states answers already sent stay', async () => {
  const m = mount('member', { [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300 } : { link_id: 'inv_9', entry_fragment: '#survey=TOK', expires_at: '2026-10-01T00:00:00.000Z' }, 'DELETE /v2/assessments/a1/surveys/s1/links/inv_9': { id: 'inv_9', status: 'revoked' } });
  await m.click('data-share-open'); await m.click('data-share-copy'); assert.match(m.root.html, /Expires 2026-10-01/);
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
  const shell = read('./assess.js'); assert.match(shell, /function resetIdentity\(\) \{[^}]*state\.share = null;/, 'identity change drops the share model');
  assert.match(shell, /onChange = \(\) => \{[^}]*querySelector\('#share-root'\)/, 'share onChange retargets the live card after paint');
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

const receipt = { link_id: 'inv_1', entry_fragment: '#survey=SECRET' };
const prepared = { confirm_token: 'ct1', expires_in: 300 };
const good = ({body}) => body.mode === 'dry_run' ? prepared : receipt;
test('QR or print can be the first outcome; each explicitly confirms only once', async () => {
  for (const action of ['data-share-qr', 'data-share-sheet']) {
    const m = mount('owner', {[LINKS]:good});
    await m.click('data-share-open'); await m.click(action);
    assert.equal(m.calls.length, 2); assert.equal(m.calls[1].body.mode, 'execute');
    assert.equal(action === 'data-share-qr' ? m.share.qr : m.prints.length, action === 'data-share-qr' ? true : 1);
  }
});
test('copy rejection preserves link; close/reopen and another copy never issue a second link', async () => {
  const m = mount('owner', {[LINKS]:good});
  m.clipboard.writeText = async () => {throw Error('activation expired');};
  await m.click('data-share-open'); await m.click('data-share-copy');
  assert.match(m.root.html, /Press Copy link again/); assert.ok(m.share.link);
  await m.click('data-share-close'); assert.doesNotMatch(m.root.html, /SECRET/);
  await m.click('data-share-open');
  m.clipboard.writeText = async t => {m.clipboard.text=t;};
  await m.click('data-share-copy'); assert.equal(m.calls.length, 2); assert.equal(m.clipboard.text, 'https://example.test/#survey=SECRET');
});
test('uncertain execution never retries, echoes errors, or retains confirmation; new attempt is explicit', async () => {
  const m = mount('owner', {[LINKS]:({body})=>body.mode==='dry_run'?prepared:err('SECRET',500)});
  await m.click('data-share-open'); await m.click('data-share-copy');
  assert.equal(m.calls.length,2); assert.equal(m.share.confirm,null); assert.equal(m.share.link,null);
  assert.match(m.root.html,/may have created a link/); assert.match(m.root.html,/may create another link/); assert.doesNotMatch(m.root.html,/SECRET/);
});
test('expired preparation never executes and closing before confirmation has no effects', async () => {
  const m = mount('owner', {[LINKS]:good});
  await m.click('data-share-open'); m.share.deadline=0; await m.click('data-share-copy');
  assert.equal(m.calls.length,1); assert.match(m.root.html,/expired/);
  await m.click('data-share-open'); await m.click('data-share-close'); assert.equal(m.calls.length,2); assert.equal(m.share.confirm,null);
});
test('inflight duplicate click and replaced-identity response cannot duplicate issuance or deliver token', async () => {
  let finish; let current = true;
  const m=mount('owner', {[LINKS]:({body})=>body.mode==='dry_run'?prepared:new Promise(r=>finish=r)}, { isCurrent: () => current });
  await m.click('data-share-open'); const pending=m.click('data-share-copy');
  await m.click('data-share-copy'); assert.equal(m.calls.length,2);
  m.root.isConnected=false; current=false; finish(receipt); await pending;
  assert.equal(m.share.link,null); assert.equal(m.clipboard.text,null); assert.equal(m.prints.length,0);
});
test('same-page paint keeps an in-flight share and refreshes the replacement card', async () => {
  let finishPrep; let finishExec; let finishRevoke;
  const m = mount('owner', {
    [LINKS]: ({ body }) => body.mode === 'dry_run' ? new Promise(r => finishPrep = r) : new Promise(r => finishExec = r),
    'DELETE /v2/assessments/a1/surveys/s1/links/inv_1': () => new Promise(r => finishRevoke = r),
  });
  const pendingPrep = m.click('data-share-open');
  m.root.isConnected = false; finishPrep(prepared); await pendingPrep;
  assert.equal(m.share.stage, 'ready'); assert.equal(m.share.confirm, 'ct1');
  assert.match(m.root.html, /data-share-copy/);
  m.root.isConnected = true;
  const pendingExec = m.click('data-share-copy');
  m.root.isConnected = false; finishExec(receipt); await pendingExec;
  assert.equal(m.share.link.url, 'https://example.test/#survey=SECRET'); assert.equal(m.share.stage, 'linked');
  assert.equal(m.clipboard.text, null, 'detached root must not copy');
  assert.match(m.root.html, /Keep a copy of this link/); assert.doesNotMatch(m.root.html, / disabled/);
  m.root.isConnected = true;
  const pendingRevoke = m.click('data-share-revoke');
  m.root.isConnected = false; finishRevoke({ id: 'inv_1', status: 'revoked' }); await pendingRevoke;
  assert.equal(m.share.link, null); assert.equal(m.share.stage, 'idle');
  assert.match(m.root.html, /Link revoked/);
});
test('incomplete execute receipt is uncertain and never becomes an output', async () => {
  const m=mount('owner', {[LINKS]:({body})=>body.mode==='dry_run'?prepared:{link_id:'x'}});
  await m.click('data-share-open'); await m.click('data-share-qr');
  assert.equal(m.share.link,null); assert.match(m.root.html,/may have created a link/);
});


test('late issue after actual shell route departure cannot retain credential on return', async()=>{
 const source=read('./assess.js'), box={state:{share:null},epoch:1,location:{hash:'#assessment/a1/survey/s1'}};
 const routeCode=source.slice(source.indexOf('export function route('),source.indexOf('async function assessmentsFor')).replace('export function','function');
 const guardCode=source.slice(source.indexOf('function currentShareRoute('),source.indexOf('function bindShare('));
 const guard=vm.runInNewContext(routeCode+guardCode+'currentShareRoute',box);
 let finish;const m=mount('owner',{[LINKS]:({body})=>body.mode==='dry_run'?prepared:new Promise(r=>finish=r)},{isCurrent:()=>guard()===m.share});
 box.state=m.state;await m.click('data-share-open');const pending=m.click('data-share-copy');
 box.location.hash='#workspaces';guard();box.location.hash='#assessment/a1/survey/s1';
 finish(receipt);await pending;
 assert.equal(m.share.link,null);assert.equal(m.clipboard.text,null);
 assert.notEqual(shareFor(m.state,'a1','s1',1),m.share);
});

// B36 (Bincy): Copy link and Show QR code per group on the launched screen and on Collect — the same shared rows.
test('B36 groupLinks: one labelled row per group (group · survey), Copy + QR as secondary buttons, no primary', async () => {
  const { groupLinks } = await import('./share.js');
  const h = groupLinks(ctx, [{ key: 's1', group: 'Translation team', survey: 'Validation', url: 'https://x/participate/#survey=T1' }, { key: 's2', group: 'Community', survey: 'Listening' }]);
  assert.equal((h.match(/data-group-link=/g) || []).length, 2);
  assert.match(h, /Translation team <span aria-hidden="true">·<\/span> Validation/); assert.match(h, /Community <span aria-hidden="true">·<\/span> Listening/);
  assert.equal((h.match(/data-group-copy=/g) || []).length, 2); assert.equal((h.match(/data-group-qr=/g) || []).length, 2);
  assert.match(h, new RegExp(`>${copy.copyLink}<`)); assert.match(h, new RegExp(`>${copy.qr}<`));
  assert.doesNotMatch(h, /class="primary"/);
});

function fakeRow(key) {
  const mk = (extra = {}) => ({ attrs: {}, textContent: '', innerHTML: '', hidden: true, className: '', dataset: {}, setAttribute(k, v) { this.attrs[k] = v; }, ...extra });
  const status = mk(), fig = mk(), row = { querySelector: sel => sel === '[data-group-status]' ? status : sel === '[data-group-qr-figure]' ? fig : null };
  const btn = ds => mk({ dataset: ds });
  const copyBtn = btn({ groupCopy: key }); const qrBtn = btn({ groupQr: key });
  copyBtn.closest = sel => sel === '[data-group-link]' ? row : copyBtn; qrBtn.closest = sel => sel === '[data-group-link]' ? row : qrBtn;
  return { status, fig, copyBtn, qrBtn };
}
test('B36 bindGroupLinks: Copy copies that group\'s link in one tap; QR shows and hides that group\'s code', async () => {
  const { bindGroupLinks } = await import('./share.js');
  let handler; const root = { addEventListener: (ev, fn) => { handler = fn; } };
  const clipboard = { text: null, async writeText(t) { this.text = t; } };
  const urls = { s1: 'https://x/participate/#survey=AAA', s2: 'https://x/participate/#survey=BBB' }; const asked = [];
  bindGroupLinks(root, { resolve: async k => { asked.push(k); return urls[k]; }, clipboard });
  const r2 = fakeRow('s2');
  await handler({ target: r2.copyBtn });
  assert.equal(clipboard.text, urls.s2); assert.equal(r2.status.textContent, copy.copied); assert.deepEqual(asked, ['s2']);
  await handler({ target: r2.qrBtn });
  assert.equal(r2.fig.hidden, false); assert.match(r2.fig.innerHTML, /<svg/); assert.equal(r2.qrBtn.textContent, copy.hideQr);
  await handler({ target: r2.qrBtn });
  assert.equal(r2.fig.hidden, true); assert.equal(r2.qrBtn.textContent, copy.qr);
  const bad = fakeRow('s9'); await handler({ target: bad.copyBtn });
  assert.match(bad.status.className, /alert/);
});

test('B36 issueLink: one tap = dry_run then execute on that survey; returns the participant URL; Collect wires it in assess.js', async () => {
  const { issueLink } = await import('./share.js');
  const { api, calls } = fakeApi({ [LINKS]: ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct1', expires_in: 300 } : { link_id: 'inv_1', entry_fragment: '#survey=TOK', expires_at: null } });
  const link = await issueLink(api, { aid: 'a1', sid: 's1', origin: 'https://example.test' });
  assert.deepEqual(calls.map(c => c.body.mode), ['dry_run', 'execute']); assert.equal(calls[1].body.confirm_token, 'ct1');
  assert.equal(link.id, 'inv_1'); assert.match(link.url, /^https:\/\/example\.test\/.*#survey=TOK$/);
  const src = read('./assess.js');
  assert.match(src, /share\.groupLinks\(\{ esc \}, \[\{ key: s\.id \}\]\)/);
  assert.match(src, /share\.bindGroupLinks\(root/); assert.match(src, /share\.issueLink\(api/); assert.match(src, /state\.collectLinks\.clear\(\)/);
  assert.doesNotMatch(src.slice(src.indexOf('function bindCollectLinks'), src.indexOf('function collectPanel')), /localStorage|sessionStorage|console\./);
});

test('B36 follow-up: an uncertain Collect failure keeps the Share card warning and never silently mints a second link', async () => {
  const { issueLink, cachedLink, bindGroupLinks, groupLinks } = await import('./share.js');
  for (const exec of [err('NETWORK', 0), { link_id: 'x' }]) { // lost response; incomplete receipt
    const { api, calls } = fakeApi({ [LINKS]: ({ body }) => body.mode === 'dry_run' ? prepared : exec });
    const cache = new Map(); let handler; const root = { addEventListener: (ev, fn) => { handler = fn; } };
    bindGroupLinks(root, { resolve: k => cachedLink(cache, k, () => issueLink(api, { aid: 'a1', sid: k, origin: 'https://example.test' })), clipboard: { async writeText() {} } });
    const r = fakeRow('s1');
    await handler({ target: r.copyBtn });
    assert.equal(r.status.textContent, copy.uncertain); assert.match(r.status.className, /alert/);
    assert.deepEqual(cache.get('s1'), { uncertain: true }); assert.equal(calls.filter(c => c.body.mode === 'execute').length, 1);
  }
  // a certain failure (nothing created) clears the key; the uncertain mark lets only a deliberate, already-warned tap issue again
  const cache = new Map(); let n = 0;
  await assert.rejects(cachedLink(cache, 'k', async () => { throw Object.assign(new Error('x'), { uncertain: false }); })); assert.equal(cache.has('k'), false);
  await assert.rejects(cachedLink(cache, 'k', async () => { n++; throw Object.assign(new Error('x'), { uncertain: true }); }));
  assert.deepEqual(cache.get('k'), { uncertain: true });
  assert.equal((await cachedLink(cache, 'k', async () => { n++; return { url: 'u' }; })).url, 'u'); assert.equal(n, 2);
  assert.equal((await cachedLink(cache, 'k', async () => { n++; return { url: 'v' }; })).url, 'u'); assert.equal(n, 2);
  // Collect rows show only the buttons (group and survey are in the heading just above); the footer line is gone
  assert.doesNotMatch(groupLinks(ctx, [{ key: 's1' }]), /data-group-label/);
  assert.doesNotMatch(read('./assess.js'), /Open a survey to share its link or print a blank questionnaire/);
});
