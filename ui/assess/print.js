import { renderBlankPrint } from '../stage-screens.js';
import { qrSvg } from './share.js';
import { shareUrl } from '../shared-link.js';

// S25 — the printed survey is its own document, never the app page.
// Captain's print from iOS Safari 2026-09-30 11:48 ET (cookbook work/queued/2026-09-30-3d-print-and-passage-in-language/
// evidence): the whole app printed (nav, survey card, buttons, dark bands, footer) and the right-hand choice column was
// cut off mid-word. Causes: ui/stage-screens.css hides the app on print only when an isolated copy sits directly under
// <body> (`body:has(> .stage-print-only)`), and printBlankForm (ui/stage-screens.js) removes that copy in `finally` right
// after print() — iOS Safari's print() does not wait, so the page was captured without it; the paper's two-column
// choices (`.p-opts` 1fr 1fr) at a fixed 216 mm width then overflowed the sheet inside the app's column.
//
// printDocumentHtml(model) is a plain function returning the finished, self-contained HTML of the print document (no
// DOM, no network, inline CSS), so a server-side PDF can render the very same string later. The paper markup comes from
// the one renderer (renderBlankPrint) drawn into a string document, so the preview and the paper never drift.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function node(tag) {
  const attrs = new Map();
  return { tag, textContent: '', children: [], className: '', hidden: false, type: '', value: '', selected: false,
    setAttribute(k, v) { attrs.set(k, String(v)); }, getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; }, attrs,
    addEventListener() {}, append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; } };
}
const stringDoc = { createElement: node, createTextNode: t => ({ tag: '#text', textContent: String(t), children: [] }) };
function toHtml(n) {
  if (n.tag === '#text') return esc(n.textContent);
  const attrs = [n.className ? `class="${esc(n.className)}"` : '', ...[...n.attrs].map(([k, v]) => (v === '' ? esc(k) : `${esc(k)}="${esc(v)}"`))].filter(Boolean).join(' ');
  if (n.tag === 'img') return `<img${attrs ? ` ${attrs}` : ''}>`; // void element (S31 QR)
  return `<${n.tag}${attrs ? ` ${attrs}` : ''}>${esc(n.textContent)}${n.children.map(toHtml).join('')}</${n.tag}>`;
}

// The paper (<article class="paper …">) as an HTML string; '' when the model is not a visible blank form.
export function paperHtml(model, { paper = 'letter' } = {}) {
  if (!model || model.visible !== true || model.blank !== true) return '';
  const root = node('div');
  renderBlankPrint(stringDoc, root, model, { paper });
  const article = root.children.find(c => c.tag === 'article');
  return article ? toHtml(article) : '';
}

// The paper's look (ui/stage-screens.css .paper/.p-*), made for a sheet: white, one column of choices that wraps inside
// the page, no fixed width, page margins from @page, page numbers where the browser supports margin boxes.
export const PRINT_DOC_CSS = `html,body{background:#fff;color:#111;margin:0}
body{font:15px/1.45 system-ui,sans-serif}
main{max-width:216mm;margin:0 auto;padding:12px;box-sizing:border-box}
.doc-tools{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:0 0 12px}.doc-tools button{font:inherit;min-height:44px;padding:6px 18px}
.paper{background:#fff;color:#111;margin:0;padding:0;font:11pt/1.4 Georgia,"Times New Roman",serif;box-sizing:border-box;width:auto;max-width:100%}
.p-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
.p-brand{font:700 14pt/1 Inter,system-ui,sans-serif;letter-spacing:-.4px;margin-bottom:6px}.p-brand span{display:inline-block;background:#111;color:#fff;padding:2px 5px;border-radius:4px;margin-right:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.paper h1{font:600 16pt/1.2 Inter,system-ui,sans-serif;margin:0 0 4px;overflow-wrap:anywhere}
.p-passage{font:600 12pt/1.35 Inter,system-ui,sans-serif;margin:6px 0 0;padding:6px 10px;border:1.5px solid #14685f;border-radius:6px;overflow-wrap:anywhere}
.p-label{font:600 7.5pt/1.2 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#444;margin:4px 0;max-width:62mm}
.p-slot{display:flex;gap:4px}.p-slot span{width:9mm;height:11mm;border:1.2px solid #111;border-radius:2px}
.p-qr{max-width:44mm}.p-qr .qr{display:block;width:30mm;height:30mm;background:#fff;box-sizing:border-box}.p-qr .qr.none{border:1.2px dashed #777}
.p-url{font:7pt/1.25 ui-monospace,Menlo,monospace;overflow-wrap:anywhere;margin:3px 0 0;color:#111}
.p-ident{border:1.5px solid #111;border-radius:6px;padding:6px 10px;margin:0 0 10px;font:9.5pt/1.35 Inter,system-ui,sans-serif;break-inside:avoid}
.p-id-row{display:grid;grid-template-columns:42mm minmax(0,1fr);gap:8px}.p-id-k{font-weight:600;color:#444;font-size:8pt;text-transform:uppercase;letter-spacing:.06em;padding-top:1px}.p-id-v{font-weight:600;overflow-wrap:anywhere}
.p-ids{font:7pt/1.3 ui-monospace,Menlo,monospace;color:#555;margin-top:3px;overflow-wrap:anywhere}
.p-intro{font-size:10pt;margin:0 0 10px}
.p-items{list-style:none;margin:0;padding:0}
.p-item{break-inside:avoid;page-break-inside:avoid;padding:7px 0;border-top:1px solid #bbb}
.p-q{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:baseline;font-weight:600;font-size:10.5pt}
.p-q>span,.p-opt>span:last-child{min-width:0;overflow-wrap:anywhere}
.p-n{font:700 10pt/1 Inter,system-ui,sans-serif;color:#444;min-width:16px}.p-dim{font:400 7.5pt/1.2 Inter,system-ui,sans-serif;color:#555;text-transform:uppercase;letter-spacing:.06em}
.p-opts{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;margin:5px 0 0 24px;font-size:10pt}
.p-opt{display:flex;gap:6px;align-items:flex-start;break-inside:avoid}
.p-box{flex:none;width:4mm;height:4mm;border:1.1px solid #111;margin-top:1px;box-sizing:border-box}.p-box.rd{border-radius:50%}.p-box.sq{border-radius:1px}
.p-lines{margin:6px 0 0 24px}.p-lines div{height:7mm;border-bottom:1px solid #999}
.p-opts>.p-write{grid-column:1/-1;margin:0 0 4px}
.p-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;border-top:1px solid #111;margin-top:14px;padding-top:6px;font:8pt/1.3 Inter,system-ui,sans-serif;color:#444}
.paper[lang] [data-en]::after{content:" EN";font:600 6.5pt/1 Inter,system-ui,sans-serif;vertical-align:super;color:#666;letter-spacing:.04em}
@page{margin:14mm 12mm 16mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt system-ui,sans-serif;color:#444}}
@media print{.doc-tools{display:none!important}main{max-width:none;padding:0}}`;

// The finished print document. autoPrint opens the print dialog once the page has laid out.
export function printDocumentHtml(model, { paper = 'letter', autoPrint = false } = {}) {
  const body = paperHtml(model, { paper });
  if (!body) return '';
  const size = paper === 'a4' ? 'A4' : 'letter';
  const title = model.title || 'Blank survey';
  return `<!doctype html><html lang="${esc(model.lang || 'en')}"${model.dir === 'rtl' ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${PRINT_DOC_CSS}
@page{size:${size}}</style></head><body><main><div class="doc-tools"><button type="button" onclick="print()">Print</button><span>${esc(size === 'A4' ? 'A4' : 'Letter')} · nothing personal on the page</span></div>${body}</main>${autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},300)})</script>' : ''}</body></html>`;
}

// App side: open the print document in its own tab from the click (no pop-up block) and let it print itself.
// Returns false when the browser blocked the tab (the caller says so; the in-page preview stays).
export function openPrintDocument(win, model, { paper = 'letter' } = {}) {
  const html = printDocumentHtml(model, { paper, autoPrint: true });
  if (!html) return false;
  let w = null;
  try { w = win.open('', '_blank'); } catch { w = null; }
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

// S31 (captain 2026-09-30 13:39 ET: "the same single QR code from the webpage for that survey"): the survey's one active
// shared link, read with the facilitator's session through the existing issue_link pair (src/handlers/survey.ts issue_link,
// #404): the dry run names the active link it would hand back (`reuses`); only then is the execute sent, which returns that
// same link (`reused: true`) and stores nothing. No active link → null: printing never mints a link.
export async function activeSurveyLink(api, { aid, sid, origin = globalThis.location?.origin, enc = encodeURIComponent }) {
  const base = `/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`;
  const d = await api(base, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
  if (!d?.reuses || !d.confirm_token) return null;
  const r = await api(base, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token: d.confirm_token } });
  // Review #411 (rev411-1340): print only the link the dry run read — if it vanished in between, the execute minted a new
  // one (src/handlers/survey.ts issue_link); that is not a link this paper read, so the paper says "no shared link".
  if (r?.reused !== true || r.link_id !== d.reuses) return null;
  if (!r?.link_id || typeof r.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(r.entry_fragment)) return null;
  return { id: r.link_id, url: shareUrl(origin, r.entry_fragment), expires_at: r.expires_at || null };
}
// The paper's link: the URL plus its QR (the Share card's own qrSvg) as an inline SVG data URI — no network on the paper.
export const paperLink = link => (link?.url ? { url: link.url, qr: `data:image/svg+xml,${encodeURIComponent(qrSvg(link.url))}` } : null);

// S31 identity, from the facilitator's rows as the API returns them: the assessment read carries language_id only
// (src/handlers/assessment.ts, SELECT a.*), so the evaluated language's name comes from the project's languages
// (GET /v2/projects/{pid}/languages), as ui/assess/scope.js resolves it for the project page.
export function printIdentityFrom(a, { project = null, languages = [], survey = {}, perspective = '' } = {}) {
  const langName = new Map((Array.isArray(languages) ? languages : []).map(l => [l?.id, l?.name]));
  return {
    project: { id: a.project_id, name: project?.name || a.project_name || '' },
    assessment: { id: a.id, name: a.name, language: langName.get(a.language_id) || a.language_name || '' },
    survey: { id: survey.id, name: survey.template_name, perspective },
  };
}
