// A PDF is the existing paper/report presentation of an authorized read, never a new report build.
import { paperHtml, PRINT_DOC_CSS } from '../assess/print.js';
import { renderReport } from '../report-view.js';
import { lensesCss, lensRespondents } from '../report-lenses.js';
import { pdfFontCss } from './font.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kebab = k => k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
function node(tag) {
  const attrs = new Map();
  return { tag, attrs, children: [], textContent: '', className: '', dataset: {}, style: {},
    get lastChild() { return this.children.at(-1); },
    setAttribute(k,v) { attrs.set(k,String(v)); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  };
}
const doc = { createElement: node, createElementNS: (_, tag) => node(tag), createTextNode: text => ({tag:'#text',textContent:text}) };
function html(n) {
  if (n.tag === '#text') return esc(n.textContent);
  const attrs = new Map(n.attrs);
  if (n.className) attrs.set('class', n.className);
  if (n.title) attrs.set('title', n.title);
  for (const [k,v] of Object.entries(n.dataset)) attrs.set(`data-${kebab(k)}`, v);
  const styles = Object.entries(n.style).map(([k,v]) => `${kebab(k)}:${v}`).join(';');
  if (styles) attrs.set('style', styles);
  // Existing renderer-owned styles only; report values always become escaped text nodes.
  const text = n.tag === 'style' ? n.textContent : esc(n.textContent);
  return `<${n.tag}${[...attrs].map(([k,v])=>` ${k}="${esc(v)}"`).join('')}>${text}${n.children.map(html).join('')}</${n.tag}>`;
}
export const REPORT_PDF_CSS = `body{font:11pt/1.45 Arial,sans-serif;color:#111;margin:0}h1{font-size:22pt}h2,h3,h4,h5{break-after:avoid;margin:12pt 0 6pt}p,li,dd{overflow-wrap:anywhere}section{margin:14pt 0}ul{padding-left:18pt}.report-lens-grid{list-style:none;padding:0}.report-lens-card{border-top:1px solid #777;padding:10pt 0;break-inside:avoid}.report-lens-score{font-size:24pt;font-weight:bold;margin:0}.report-metrics{display:flex;flex-wrap:wrap;gap:14pt}.report-metrics div{min-width:80pt}dt{font-size:9pt;color:#444}dd{margin:0}details{font-size:8pt;color:#444}svg{max-width:100%;height:auto}figure{margin:10pt 0;break-inside:avoid}.lens-agree-row{break-inside:avoid}.report-observations li{margin:6pt 0}.report-evidence-row{break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border:1px solid #aaa;padding:5pt;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.radar-narrow{display:none!important}.radar-wide{display:block!important}@page{margin:14mm 12mm 16mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt Arial}}`;
function documentHtml(body, {paper='letter',lang='en',title='',css=''}) {
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>${esc(title)}</title><style>${css}\n@page{size:${paper==='a4'?'A4':'Letter'}}\n*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body><main>${body}</main></body></html>`;
}
export function surveyPdfDocument(model, {paper='letter'}={}) {
  const body = paperHtml(model,{paper});
  if (!body) throw new Error('Blank survey unavailable.');
  return documentHtml(body,{paper,lang:model.lang||'en',title:model.title||'Survey',css:PRINT_DOC_CSS+'\n'+pdfFontCss});
}
export function reportPdfDocument(result, {paper='letter',minimum=3}={}) {
  // This guard is additional to cap.report.get, which owns current access/suppression policy.
  if (!result || result.suppressed !== false || !result.report) throw new Error('Report unavailable.');
  const payload=result.report.payload;
  const key=lens=>String(lens).trim().toLowerCase().replace(/^translation team$/,'team');
  const counts=new Map();for(const [lens,n] of lensRespondents(payload))counts.set(key(lens),(counts.get(key(lens))||0)+n);
  const disclosed=new Set((payload?.lenses||[]).map(l=>key(l.lens)));
  for(const i of payload?.standalone_indicators||[])disclosed.add(key(i.lens));
  for(const row of [...(payload?.cross_lens_multi||[]),...(payload?.cross_lens_single||[])])for(const l of row.lens_scores||[])disclosed.add(key(l.lens));
  if(payload?.translation_type_agreement?.team_values?.length)disclosed.add('team');
  if(payload?.translation_type_agreement?.church_values?.length)disclosed.add('church');
  // This full-detail renderer includes exact scores. Hold the export if any perspective would be hidden by the UI.
  // A missing snapshot count is unknown, never permission to disclose; no live-answer fallback or rescoring.
  if ([...counts.values()].some(n=>n<minimum)||[...disclosed].some(l=>!counts.has(l)||counts.get(l)<minimum)||
    (payload?.standalone_indicators||[]).some(i=>!Number.isFinite(i.n_responses)||i.n_responses<minimum)) throw new Error('PDF_REPORT_HELD');
  const root = node('div');
  if (!renderReport({doc,root,report:result.report})) throw new Error('Report unavailable.');
  // PDF documents have no interactive disclosure: retain provenance on paper.
  // Only this isolated print tree is opened; the shared screen renderer stays closed.
  for (const child of root.children) if (child.tag === 'details') child.setAttribute('open', '');
  // The same exact stored aggregates in an accessible table beside the vector charts.
  const rows = (payload.lenses||[]).flatMap(l => (l.sub_dimensions||[]).map(s => `<tr><th scope="row">${esc(l.lens)}</th><td>${esc(s.sub_dimension)}</td><td>${esc(s.score)}</td></tr>`));
  const table = rows.length ? `<section><h2>Scores in this report</h2><table><thead><tr><th>Perspective</th><th>Area</th><th>Score (out of 100)</th></tr></thead><tbody>${rows.join('')}</tbody></table></section>` : '';
  // Existing chart token values (ui/design-system-v3/tokens.css), resolved for a self-contained white paper.
  const palette=':root{--paper:#fff;--ink:#111;--secondary:#555;--line:#ccc;--lens-green:#49a076;--lens-blue:#4885bb;--lens-yellow:#d8ae3c;--band-growing:#83b996;--band-needs-support:#dfc065;--band-urgent:#da8b83;--perspective-fill:#fff;--badge-fill:#edf5ef;--badge-ink:#294d37;--warning-fill:#fff5d7;--warning-ink:#664c10}';
  return documentHtml(`<h1>3D Review report</h1>${root.children.map(html).join('')}${table}`,{paper,title:'3D Review report',css:palette+lensesCss+REPORT_PDF_CSS});
}
