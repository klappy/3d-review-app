/** Named report PDFs reuse the actual Next components and CSS, compiled by the checked-in build-only entry. */
import {reportPdfDocument} from './documents.js';
import {nextReportMarkup,nextReportCss} from './next-layout.generated.js';
const trustedModels=new WeakSet();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export function namedReportModel(stored,{minimum=3,identity={}}={}){
 if(!Number.isInteger(minimum)||minimum<1)throw Error('PDF_REPORT_HELD');
 // Keep the existing full-detail disclosure guard, including all snapshot counts and standalone cells.
 reportPdfDocument(stored,{minimum});
 const model=freeze(JSON.parse(JSON.stringify({stored,identity:{title:identity.title,project:identity.project,language:identity.language},minimum})));
 trustedModels.add(model);return model;
}
function papers(markup){
 const found=[];const open=/<div\b[^>]*\bclass="paper"[^>]*>/g;let hit;
 while((hit=open.exec(markup))){let depth=1,end=open.lastIndex;const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=end;let t;
  while(depth&&(t=tags.exec(markup))){depth+=t[0].startsWith('</')?-1:1;end=tags.lastIndex;}
  if(depth)throw Error('PDF_LAYOUT_INVALID');found.push(markup.slice(hit.index,end));open.lastIndex=end;
 }
 if(!found.length)throw Error('PDF_LAYOUT_INVALID');return found;
}
export function namedReportDocument(model,format,{paper='a4'}={}){
 if(!['overview','detailed'].includes(format))throw Error('INVALID_PDF_FORMAT');
 if(!trustedModels.has(model))throw Error('PDF_REPORT_HELD');
 if(!['a4','letter'].includes(paper))throw Error('INVALID_PDF_PAPER');
 const pages=papers(nextReportMarkup(model.stored,model.identity,model.minimum,format));
 if(format==='overview'&&pages.length!==1)throw Error('PDF_LAYOUT_INVALID');
 const size=paper==='a4'?'210mm 297mm':'8.5in 11in',width=paper==='a4'?'210mm':'8.5in',height=paper==='a4'?'297mm':'11in';
 // Only physical-page framing differs: report content, typography, diagrams and tables come from Next unchanged.
 const framing=`@page{size:${size};margin:0}html,body{margin:0;background:#fff}.app{display:block;min-height:0;overflow:visible;background:#fff}.paper[data-sheet]{width:${width};max-width:none;min-height:${height};margin:0;border:0;border-radius:0;box-shadow:none;break-after:page}.paper[data-sheet]:last-child{break-after:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';img-src data:;font-src data:;base-uri 'none';form-action 'none'"><title>${esc(format==='overview'?'Overview report':'Detailed report')}</title><style>${nextReportCss}\n${framing}</style></head><body><div class="app" data-theme="light" data-imagery="bars">${pages.join('')}</div></body></html>`;
}
/** Full keeps its existing renderer and Letter default; route callers select the server-owned paper value. */
export function storedReportDocument(stored,{format='full',minimum=3,identity={},paper='letter'}={}){
 if(format==='full')return reportPdfDocument(stored,{minimum,paper});
 return namedReportDocument(namedReportModel(stored,{minimum,identity}),format,{paper});
}
