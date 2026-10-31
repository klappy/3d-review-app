/** Isolated named report documents. No endpoint/UI wiring; full legacy PDF remains unchanged. */
import {renderLensRadar} from '../report-radar.js';
import {reportPdfDocument} from './documents.js';
import {lensRespondents,lensSpreadRows,lensLabel} from '../report-lenses.js';
import {v3ScoreBand,V3_BAND_CUTOFFS} from '../assess/v3-assessment.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number.isFinite(x)?String(Math.round(x*10)/10):'—';
function element(tag){return {tag,attrs:{},children:[],get lastChild(){return this.children.at(-1);},dataset:{},className:'',textContent:'',setAttribute(k,v){this.attrs[k]=v;},append(...v){this.children.push(...v);}};}
function serialized(n){if(n.tag==='#text')return esc(n.textContent);return `<${n.tag} ${Object.entries({...n.attrs,...Object.fromEntries(Object.entries(n.dataset||{}).map(([k,v])=>['data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),v])),...(n.className?{class:n.className}:{})}).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}>${n.tag==='style'?n.textContent:esc(n.textContent)}${n.children.map(serialized).join('')}</${n.tag}>`;}
function radarHtml(report){const doc={createElement:element,createElementNS:(_,tag)=>element(tag),createTextNode:text=>({tag:'#text',textContent:text})};const radar=renderLensRadar({doc,report});return radar?serialized(radar):'<p>Too few shared areas to draw the shape.</p>';}
const trustedModels=new WeakSet();
const bands=['Needs urgent attention','Needs support','Growing','Strong'];
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export function namedReportModel(stored,{minimum=3,identity={}}={}){
  if(!Number.isInteger(minimum)||minimum<1)throw Error('PDF_REPORT_HELD');
  // Existing full-detail privacy guard is reused unchanged; never infer counts from live collection.
  reportPdfDocument(stored,{minimum});
  const p=stored.report.payload,counts=lensRespondents(p);
  const level=(score,n)=>v3ScoreBand(score,n,V3_BAND_CUTOFFS,minimum);
  const cards=(p.lenses||[]).map(l=>({label:lensLabel(l.lens),n:counts.get(l.lens),level:level(l.score,counts.get(l.lens)),rows:(l.sub_dimensions||[]).map(s=>({name:s.sub_dimension,score:s.score,level:level(s.score,counts.get(l.lens)),items:s.n_items_included}))}));
  const compared=lensSpreadRows(stored.report,{exact:true}).map(r=>({...r,lenses:r.lenses.map(l=>({...l,label:lensLabel(l.lens),level:level(l.score,l.n)}))}));
  const overview=compared.filter(r=>r.lenses.length>=2).map(r=>({...r,apart:Math.max(...r.lenses.map(l=>bands.indexOf(l.level)))-Math.min(...r.lenses.map(l=>bands.indexOf(l.level)))}));
  const model=freeze(JSON.parse(JSON.stringify({snapshotId:stored.report.id,builtOn:stored.report.created_at,title:identity.title||'3D Review',project:identity.project||'',language:identity.language||'',synthetic:p.synthetic===true,minimum,cards,compared,radar:radarHtml(stored.report),overview:[...overview.filter(r=>r.apart>=1).slice(0,3),...overview.filter(r=>r.apart===0).slice(0,1)],lookNext:cards.flatMap(c=>c.rows.filter(r=>bands.indexOf(r.level)<=1).map(r=>({perspective:c.label,area:r.name,level:r.level}))).slice(0,3)})));trustedModels.add(model);return model;
}
const CSS=`:root{--lens-green:#49a076;--lens-blue:#4885bb;--lens-yellow:#d8ae3c;--line:#ccc;--ink:#111;--secondary:#555;--paper:#fff}@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:10pt/1.4 Arial;color:#111;margin:0}.sheet{break-after:page}.sheet:last-child{break-after:auto}h1{font-size:19pt;margin:0}h2{font-size:13pt;margin:14pt 0 6pt}h3{font-size:11pt}p{margin:5pt 0}.cards{display:flex;gap:10pt}.card{flex:1;border-top:3pt solid #39755c;padding:8pt 0}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{text-align:left;border-bottom:1px solid #aaa;padding:5pt}tr{break-inside:avoid}footer{font-size:8pt;margin-top:12pt;border-top:1px solid #aaa;padding-top:5pt}.radar-narrow{display:none!important}.radar-wide{display:block!important}.lens-radar svg{max-height:230px}svg{max-width:100%}.row{margin:7pt 0;break-inside:avoid}.axis{display:flex;gap:3pt}.axis span{flex:1;background:#eee;padding:3pt;font-size:8pt}.levels{display:flex;gap:8pt;flex-wrap:wrap}.scorebar{display:inline-block;background:#39755c;height:5pt}.meta{color:#555;font-size:9pt}`;
const header=(m,kind)=>`<h1>${esc(m.title)}</h1><p class="meta">${esc([m.project,m.language].filter(Boolean).join(' · '))}${m.project||m.language?' · ':''}${kind} · ${m.synthetic?'Synthetic fixture':'Stored report'}</p><div class="cards">${m.cards.map(c=>`<div class="card"><strong>${esc(c.label)}</strong><p>${c.n} responses</p><p>${esc(c.level)}</p></div>`).join('')}</div>`;
const foot=(m,n,total)=>`<footer>Snapshot ${esc(m.snapshotId)} · Built ${esc(m.builtOn)} · ${n} of ${total} · Levels are provisional bands; missing input is not a low score. Verbatim excerpts held.</footer>`;
const rows=(rr,numeric)=>rr.map(r=>`<div class="row"><strong>${esc(r.name)}</strong><div class="levels">${r.lenses.map(l=>`<span>${esc(l.label)}: ${numeric?`${fmt(l.score)} / 100 <i class="scorebar" style="width:${Math.max(0,Math.min(100,l.score))}pt"></i>`:esc(l.level)}</span>`).join('')}</div><p class="meta">${r.lenses.length<2?'Only one perspective scored this area':numeric?`Spread: ${fmt(r.spread)} points`:r.apart===0?'Perspectives share a band':`${r.apart} band${r.apart===1?'':'s'} apart`}</p></div>`).join('');
export function namedReportDocument(model,format){
  if(!['overview','detailed'].includes(format))throw Error('INVALID_PDF_FORMAT');
  if(!trustedModels.has(model))throw Error('PDF_REPORT_HELD');
  // Re-copy: document rendering cannot mutate the pinned model or add arbitrary fields/excerpts.
  const m=JSON.parse(JSON.stringify(model));let sheets=[];
  if(format==='overview')sheets=[header(m,'Overview report')+'<h2>What stands out</h2><p>'+m.cards.map(c=>`${esc(c.label)} reads ${esc(c.level)} from ${c.n} responses.`).join(' ')+'</p><h2>Where the perspectives disagree</h2>'+rows(m.overview,false)+'<h2>Where to look next</h2>'+(m.lookNext.length?`<ul>${m.lookNext.map(n=>`<li>${esc(n.perspective)} · ${esc(n.area)} — ${esc(n.level)}</li>`).join('')}</ul>`:'<p>No area reads Needs support or Needs urgent attention.</p>')];
  else {
    sheets=[header(m,'Detailed report')+'<h2>The perspectives as one shape</h2>'+m.radar+'<h2>The biggest tensions</h2>'+rows(m.compared.filter(r=>r.lenses.length>=2).slice(0,3),true),'<h2>All areas compared across perspectives</h2>'+rows(m.compared,true)+'<h2>How to read the scores</h2><p>Stored area values are scores out of 100; no new scoring is performed. Only shared areas can be compared. A low response count is limited evidence, not a low result.</p>'];
    for(let i=0;i<m.cards.length;i+=2)sheets.push('<h2>Every area, with evidence</h2>'+m.cards.slice(i,i+2).map(c=>`<h3>${esc(c.label)} · ${c.n} responses</h3><table><thead><tr><th>Area</th><th>Level</th><th>Score</th><th>Evidence</th><th>Observation</th></tr></thead><tbody>${c.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.level)}</td><td>${fmt(r.score)}</td><td>${r.items} items</td><td>No authored observation in this stored model.</td></tr>`).join('')}</tbody></table>`).join(''));
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>${format==='overview'?'Overview':'Detailed'} report</title><style>${CSS}</style></head><body>${sheets.map((s,i)=>`<section class="sheet">${s}${foot(m,i+1,sheets.length)}</section>`).join('')}</body></html>`;
}

/** Named dispatch for future route integration; existing full document remains the default. */
export function storedReportDocument(stored,{format='full',minimum=3,identity={},paper='letter'}={}){
 if(format==='full')return reportPdfDocument(stored,{minimum,paper});
 if(!['overview','detailed'].includes(format))throw Error('INVALID_PDF_FORMAT');
 return namedReportDocument(namedReportModel(stored,{minimum,identity}),format);
}
