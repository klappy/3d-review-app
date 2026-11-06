import {it,expect} from 'vitest';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {reportPdfDocument} from '../ui/pdf/documents.js';
import {namedReportModel,namedReportDocument,storedReportDocument} from '../ui/pdf/report-formats.js';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/synthetic-report-renderer-v1.json',import.meta.url),'utf8'));
const ids=Object.keys(corpus.contexts).slice(0,2);
for(const id of ids)it(`distinct named documents preserve immutable snapshot ${id}`,()=>{
 const payload={...structuredClone(corpus.contexts[id]),synthetic:true,source_commit:corpus.source_commit,versions:{scorer:'fixture',narrative:'fixture',policy:'fixture'}};const original=JSON.stringify(payload);const stored={suppressed:false,report:{id,created_at:'2026-10-31',payload}};
 const model=namedReportModel(stored,{minimum:1,identity:{title:'Synthetic QA review'}});expect(Object.isFrozen(model)).toBe(true);expect(JSON.stringify(payload)).toBe(original);
 const overview=namedReportDocument(model,'overview'),detail=namedReportDocument(model,'detailed');expect(overview).not.toBe(detail);expect(overview).toContain('Where to look next');expect(overview).not.toContain('class="radar-row"');expect(detail).toContain('Every area, with evidence');expect(detail).toContain('<svg');expect(detail).not.toContain('SECRET');payload.lenses[0].score=99;expect(namedReportDocument(model,'overview')).toBe(overview);
 const out=process.env.PDF_FORMAT_EVIDENCE,chrome=process.env.PDF_LOCAL_CHROME;if(out&&chrome){mkdirSync(out,{recursive:true});for(const [kind,html]of [['overview',overview],['detailed',detail]]){const path=`${out}/${id}-${kind}`;writeFileSync(path+'.html',html);execFileSync(chrome,['--headless','--no-sandbox','--no-pdf-header-footer',`--print-to-pdf=${path}.pdf`,`file://${path}.html`],{timeout:30000,stdio:'pipe'});const bytes=readFileSync(path+'.pdf');expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
    // Chromium's emitted page objects count physical pages, catching overflow beyond the declared paper sheets.
    expect((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe((html.match(/<div\b[^>]*class="paper"/g)||[]).length);}}
},60000);
it('privacy floor/unknown format refuse; no shared global policy mutation',()=>{const id=ids[0],stored={suppressed:false,report:{id,payload:corpus.contexts[id]}};expect(()=>namedReportModel(stored,{minimum:1000})).toThrow('PDF_REPORT_HELD');expect(()=>namedReportDocument({},'invented')).toThrow();});

it('named dispatch preserves existing full PDF and rejects unknown variants',()=>{const payload={...corpus.contexts[ids[0]],source_commit:corpus.source_commit,versions:{scorer:'fixture'}};const stored={suppressed:false,report:{id:'fixture',payload}};expect(storedReportDocument(stored,{minimum:1})).toBe(reportPdfDocument(stored,{minimum:1,paper:'letter'}));expect(storedReportDocument(stored,{minimum:1,format:'overview'})).toContain('<title>Overview report');expect(()=>storedReportDocument(stored,{format:'unknown'})).toThrow();expect(()=>namedReportDocument({radar:'<script>'},'detailed')).toThrow();});

it('Decision 25 findings are visible in all three PDF documents; missing status-perspective counts still hold',()=>{
 const payload={...structuredClone(corpus.contexts[ids[0]]),source_commit:corpus.source_commit,versions:{scorer:'decision25-fixture'},translation_type_agreement:{team_values:[],church_values:[],agree:null,team_statuses:['no-brief'],church_statuses:['no-agreement','not-aware']}};
 const stored={suppressed:false,report:{id:'decision25',payload}};
 for(const format of ['overview','detailed','full']){
  const html=storedReportDocument(stored,{minimum:1,format});
  expect(html).toContain('Translation team: No translation brief');
  expect(html).toContain('Church: No prior agreement on translation type');
  expect(html).toContain('Not comparable');
  expect(html).toContain('excluded from the agreement comparison');
 }
 const missing={suppressed:false,report:{id:'missing-count',payload:{lenses:[],evidence:[],translation_type_agreement:payload.translation_type_agreement}}};
 expect(()=>storedReportDocument(missing,{minimum:1,format:'full'})).toThrow('PDF_REPORT_HELD');
});
it('Other-only visible side and suppressed status presence have identical PDF outcomes',()=>{
 const payload={...structuredClone(corpus.contexts[ids[0]]),source_commit:corpus.source_commit,versions:{scorer:'fixture'},translation_type_agreement:{team_values:[],church_values:[],agree:null,team_statuses:[],church_statuses:['not-aware']},evidence:[{label:'Translation Team — Translators',n:3},{label:'Church — Involved Pastor',n:1}]};
 for(const format of ['overview','detailed','full']){
  const outcome=(p:any)=>{try{return storedReportDocument({suppressed:false,report:{id:'privacy',payload:p}},{minimum:3,format});}catch(e){return (e as Error).message;}};
  expect(outcome(payload)).toBe(outcome({...payload,translation_type_agreement:null}));
 }
});
// G02 (PR #605 review r4481475123 / r4481475133): named PDFs keep selected zero-response perspectives and carry report provenance.
const dropLens=(x:any,lens:string):any=>Array.isArray(x)?x.filter(v=>!(v&&typeof v==='object'&&v.lens===lens)).map(v=>dropLens(v,lens)):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,dropLens(v,lens)])):x;
function zeroChurch(){
 const id=ids[0],payload=dropLens({...structuredClone(corpus.contexts[id]),synthetic:true,source_commit:corpus.source_commit,versions:{scorer:'fixture',narrative:'fixture',policy:'fixture'}},'Church');
 payload.evidence=payload.evidence.filter((e:any)=>!String(e.label).startsWith('Church — '));
 if(payload.translation_type_agreement)payload.translation_type_agreement={...payload.translation_type_agreement,church_values:[],church_statuses:[],agree:null};
 expect(JSON.stringify(payload.lenses)).not.toContain('Church');
 return {suppressed:false,report:{id:'rep_g02_provenance',created_at:'2026-11-05T12:00:00Z',payload}};
}
const surveys=[{id:'s1',perspective:'Translation Team',state:'selected'},{id:'s2',perspective:'Community',state:'selected'},{id:'s3',perspective:'Church',state:'selected',secret:'SECRET-SURVEY-FIELD'}];
const tile=(html:string,lens:string)=>new RegExp(`class="sheet-tile"[^>]*data-lens="${lens}"`).test(html);
it('selected zero-response perspective stays present (no data) in overview and detailed named PDFs',()=>{
 const stored=zeroChurch();
 for(const format of ['overview','detailed'] as const){
  const html=storedReportDocument(stored,{minimum:1,format,paper:'a4',surveys});
  expect(tile(html,'team')).toBe(true);expect(tile(html,'community')).toBe(true);
  expect(tile(html,'church')).toBe(true);expect(html).toContain('Church');
  expect(html).not.toContain('SECRET-SURVEY-FIELD');
 }
 // Without a selected-survey list nothing is invented; an archived or unselected perspective stays hidden.
 expect(tile(storedReportDocument(stored,{minimum:1,format:'overview',paper:'a4'}),'church')).toBe(false);
 expect(tile(storedReportDocument(stored,{minimum:1,format:'overview',paper:'a4',surveys:[{perspective:'Church',state:'selected',archived_at:'2026-11-01'},{perspective:'Church',state:'unselected'}]}),'church')).toBe(false);
});
it('zero-response perspective card is present-with-no-data: held level, 0 responses, no score',()=>{
 for(const format of ['overview','detailed'] as const){
  const html=storedReportDocument(zeroChurch(),{minimum:1,format,paper:'a4',surveys});
  const start=html.search(/class="sheet-tile"[^>]*data-lens="church"/);expect(start).toBeGreaterThan(-1);
  const card=html.slice(start,html.indexOf('</div></div>',start)+12).replace(/<svg[\s\S]*?<\/svg>/g,'');
  expect(card).toContain('data-level="more"');expect(card).toContain('More input needed');expect(card).toContain('0 responses');
  expect(card).not.toMatch(/\b\d+\.\d+\b/);
 }
});
it('detailed named PDF carries the saved report id and top-level created_at',()=>{
 const html=storedReportDocument(zeroChurch(),{minimum:1,format:'detailed',paper:'a4',surveys});
 expect(html).toContain('Report: rep_g02_provenance');expect(html).toContain('Built: 2026-11-05T12:00:00Z');
});

it('G02 integration: provenance is visible outside details in BOTH named documents and selected zero-response notes stay consistent',()=>{
 const stored=zeroChurch();
 for(const format of ['overview','detailed'] as const){
  const html=storedReportDocument(stored,{minimum:1,format,paper:'a4',surveys});
  const withoutDetails=html.replace(/<details\b[\s\S]*?<\/details>/g,'');
  expect(withoutDetails,format).toContain('Report: rep_g02_provenance');expect(withoutDetails).toContain('Built: 2026-11-05T12:00:00Z');
  expect(withoutDetails).toContain('data-report-provenance');expect(withoutDetails).not.toContain('Church not asked');
  expect(withoutDetails).toContain('Church more input needed');
 }
});
it('G02 integration: missing historical selection is explicitly unknown, not reconstructed from invented zero-response cards',()=>{
 for(const format of ['overview','detailed'] as const){
  const html=storedReportDocument(zeroChurch(),{minimum:1,format,paper:'a4'});
  expect(tile(html,'church')).toBe(false);expect(html).toContain('Other perspectives’ participation is unknown.');
  expect(html).not.toContain('Church not asked');
 }
});
it('legacy reports without report_selection stay unknown; "not asked" requires saved selection proof',()=>{
 const stored=zeroChurch();
 expect(stored.report.payload).not.toHaveProperty('report_selection');
 expect(namedReportModel(stored,{minimum:1}).selectionKnown).toBe(false);
 expect(namedReportModel(stored,{minimum:1,surveys:[]}).selectionKnown).toBe(true);
 for(const format of ['overview','detailed'] as const){
  const html=storedReportDocument(stored,{minimum:1,format,paper:'a4'});
  expect(html).toContain('Other perspectives’ participation is unknown.');
  expect(html).not.toContain('Church not asked');
  expect(storedReportDocument(stored,{minimum:1,format,paper:'a4',surveys:[]})).not.toContain('Other perspectives’ participation is unknown.');
 }
 const proved={...stored,report:{...stored.report,payload:{...stored.report.payload,report_selection:{schema:'3d-report-selection-v1',selected_perspectives:['Translation Team','Community']}}}};
 expect(namedReportModel(proved,{minimum:1}).selectionKnown).toBe(true);
 for(const format of ['overview','detailed'] as const){
  expect(storedReportDocument(proved,{minimum:1,format,paper:'a4'})).not.toContain('Other perspectives’ participation is unknown.');
 }
});
