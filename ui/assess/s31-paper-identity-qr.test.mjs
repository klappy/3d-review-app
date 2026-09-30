// S31 (captain 2026-09-30 13:39 ET, cookbook work/active/2026-09-30-3d-paper-identity-qr/TICKET.md): the printed survey
// names its project, assessment (language) and survey, and carries the survey's one shared link as a QR for the helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { printDocumentHtml, paperHtml, activeSurveyLink, paperLink } from './print.js';
import { renderBlankPrint, printableLink, loadBlankPrint, credentialFields, PRINT_WORDS } from '../stage-screens.js';
import { applyPrintTranslation } from './print-lang.js';

const URL1 = 'https://dev.example.test/#survey=link_AbC123-_x';
const identity = { project: { id: 'proj_1', name: 'Hindi NT' }, assessment: { id: 'assess_1', name: 'Community check March', language: 'Hindi' }, survey: { id: 'survey_1', name: 'Community-Pastor', perspective: 'Community' } };
const base = { visible: true, blank: true, title: 'Community-Pastor', template_id: 'tpl_cp', template_version: 2, items: [{ text: 'Anything else?', type: 'text', options: [] }], identity };

test('identity block tops the print document and the preview (one renderer): project, assessment, language, survey, perspective, ids', () => {
  const html = printDocumentHtml(base);
  const at = html.indexOf('class="p-ident"');
  assert.ok(at > 0 && at < html.indexOf('class="p-head"'), 'identity block is the first thing on the paper');
  for (const s of ['Hindi NT', 'Community check March', 'Language evaluated', 'Hindi', 'Community-Pastor · Community', 'proj_1 · assess_1 · survey_1']) assert.ok(html.includes(s), s);
  assert.doesNotMatch(html, /Printed in/, 'English paper: no printed-in row');
  assert.ok(html.includes(paperHtml(base)), 'the document draws the same article as the preview');
  const hi = applyPrintTranslation({ ...base }, { code: 'hi', name: 'Hindi', endonym: 'हिन्दी', dir: 'ltr' }, { 'w.projectLabel': 'परियोजना' });
  const hiHtml = printDocumentHtml(hi);
  assert.match(hiHtml, /परियोजना/, 'labels translate like the rest of the paper');
  assert.match(hiHtml, /Printed in<\/span><span class="p-id-v">हिन्दी \(Hindi\)</, 'the LWC the paper is printed in, when ?lang= is set');
  assert.doesNotMatch(printDocumentHtml({ ...base, identity: undefined }), /class="p-ident"/, 'no identity → no empty box');
});

test('QR present with the survey link, URL under it and the helper line; absent with the honest line when no link', () => {
  const link = paperLink({ url: URL1 });
  assert.match(link.qr, /^data:image\/svg\+xml,/);
  const html = printDocumentHtml({ ...base, link });
  assert.match(html, /<div class="p-qr"><img class="qr" src="data:image\/svg\+xml,[^"]+" alt="[^"]+"><div class="p-url">https:\/\/dev\.example\.test\/#survey=link_AbC123-_x<\/div><div class="p-label">Helper: scan to enter this paper&#39;s answers<\/div><\/div>/);
  assert.doesNotMatch(html, /No shared link/);
  const none = printDocumentHtml(base);
  assert.match(none, /<div class="qr none"[^>]*><\/div><div class="p-label">No shared link for this survey yet/);
  assert.doesNotMatch(none, /<img|#survey=/, 'no link is invented');
  assert.match(none, /Codes are never printed\. The QR is the survey&#39;s own link\./);
});

test('only the survey entry link is ever drawn; codes stay refused', async () => {
  const qr = paperLink({ url: URL1 }).qr;
  for (const url of ['https://x.test/#code=ABCD-EFGH', 'https://x.test/p?token=st_1', 'javascript:alert(1)', 'https://x.test/#survey=link_a"><script>'])
    assert.equal(printableLink({ url, qr }), null, url);
  assert.equal(printableLink({ url: URL1, qr: 'https://evil.test/q.png' }), null, 'QR must be the inline SVG');
  assert.doesNotMatch(printDocumentHtml({ ...base, link: { url: 'https://x.test/#code=ABCD', qr } }), /ABCD|<img/);
  for (const key of ['codes', 'code', 'link_token', 'session', 'access_code', 'secret']) assert.deepEqual(credentialFields({ blank: true, [key]: 'x' }), [key]);
  const request = async () => ({ ok: true, json: async () => ({ ok: true, result: { blank: true, html: '<h1>T</h1>', codes: ['ABCD-EFGH'] } }) });
  const refused = await loadBlankPrint({ request, aid: 'a1', sid: 's1', role: 'owner' });
  assert.equal(refused.reason, 'unsafe-print');
});

test('activeSurveyLink reads the active link through issue_link and never mints one', async () => {
  const calls = [];
  const api = active => async (url, init) => { calls.push({ url, mode: init.body.mode }); return init.body.mode === 'dry_run' ? { confirm_token: 'ct', ...(active ? { reuses: 'invite_1' } : {}) } : { link_id: 'invite_1', entry_fragment: '#survey=link_AbC123-_x', reused: true }; };
  const got = await activeSurveyLink(api(true), { aid: 'a 1', sid: 's1', origin: 'https://dev.example.test' });
  assert.deepEqual(got, { id: 'invite_1', url: URL1, expires_at: null });
  assert.deepEqual(calls.map(c => c.mode), ['dry_run', 'execute']); assert.equal(calls[0].url, '/v2/assessments/a%201/surveys/s1/links');
  calls.length = 0;
  assert.equal(await activeSurveyLink(api(false), { aid: 'a1', sid: 's1', origin: 'https://x.test' }), null);
  assert.deepEqual(calls.map(c => c.mode), ['dry_run'], 'no active link → no execute, nothing minted');
});

test('assess.js wiring: identity and link set before translation, tab link first, then the active read', () => {
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  const click = src.slice(src.indexOf('btn.onclick = async () => {'));
  assert.ok(click.indexOf('model.identity = printIdentity(current, s)') < click.indexOf('translatePrint(model'));
  assert.match(src, /share\.knownLink\(state\.collectLinks, k\);\s*if \(!link && !demo\) \{ try \{ link = await activeSurveyLink\(api/);
  assert.equal(PRINT_WORDS.helperScan, "Helper: scan to enter this paper's answers");
  const doc = { createElement: tag => ({ tag, children: [], attrs: {}, className: '', textContent: '', setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; } }), createTextNode: t => ({ tag: '#t', textContent: t, children: [] }) };
  const root = doc.createElement('div'); renderBlankPrint(doc, root, { ...base, link: paperLink({ url: URL1 }) });
  const texts = []; (function w(n) { texts.push(n.textContent); n.children.forEach(w); })(root);
  assert.ok(texts.includes('Hindi NT') && texts.includes(URL1), 'preview carries identity and the link');
});
