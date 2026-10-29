import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {surveyPdfDocument,reportPdfDocument} from './documents.js';
import {fetchPdf,pdfLoader,pdfObjectUrl,sharePdf} from './download.js';
const model={visible:true,blank:true,title:'Survey',items:[{text:'Question <script>bad</script>',type:'single',options:[{text:'Yes'},{text:'No'}]}]};
test('survey reuses the paper, includes all choices, embedded font and page size without app tools/scripts',()=>{
  const s=surveyPdfDocument(model,{paper:'a4'}),d=new JSDOM(s).window.document;
  assert.match(d.body.textContent,/Question <script>bad<\/script>/);assert.match(d.body.textContent,/Yes/);assert.match(d.body.textContent,/No/);
  assert.equal(d.querySelectorAll('script,button,.doc-tools').length,0);assert.match(s,/data:font\/woff2;base64/);assert.match(s,/@page\{size:A4\}/);
});
test('report refuses held data and renders exact stored aggregates as text, charts and tables',()=>{
  assert.throws(()=>reportPdfDocument({suppressed:true,report:{payload:{}}}));
  const result={suppressed:false,report:{created_at:'2026-10-29',payload:{source_commit:'f042cde',versions:{scorer:'s',narrative:'n',policy:'p'},evidence:[{label:'Community — Written',n:7}],lenses:[{lens:'Community',score:68.25,sub_dimensions:[{sub_dimension:'Clarity',score:72.5,n_items_included:3}]}],narrative:['<img src=x onerror=bad>']}}};
  const d=new JSDOM(reportPdfDocument(result)).window.document;assert.match(d.body.textContent,/68.25/);assert.match(d.querySelector('table').textContent,/72.5/);assert.equal(d.querySelectorAll('img,script').length,0);assert.match(d.body.textContent,/<img src=x onerror=bad>/);
});
test('download validates bytes/type and uses the server filename; errors remain actionable',async()=>{
  const fetchImpl=async()=>new Response('%PDF-1.7\nfile',{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="survey.pdf"'}});
  const pdf=await fetchPdf('/v2/example',{fetchImpl});assert.equal(pdf.name,'survey.pdf');assert.equal(await pdf.blob.text(),'%PDF-1.7\nfile');
  await assert.rejects(fetchPdf('/x',{fetchImpl:async()=>new Response('html')}),/did not return a PDF/);
  await assert.rejects(fetchPdf('/x',{fetchImpl:async()=>new Response('html',{headers:{'content-type':'application/pdf'}})}),/invalid/);
  await assert.rejects(fetchPdf('/x',{fetchImpl:async()=>new Response(JSON.stringify({error:{message:'Use Print until PDF is available.'}}),{status:503})}),/Use Print/);
});
test('repeated clicks share a request; cancel permits retry; object URL is explicitly disposed',async()=>{
  let calls=0,finish;const loader=pdfLoader(async(_,opts)=>{calls++;return new Promise((resolve,reject)=>{finish=resolve;opts.signal.addEventListener('abort',()=>reject(new Error('cancelled')));});});
  const p=loader.load('/one');assert.equal(loader.load('/two'),p);assert.equal(calls,1);loader.cancel();await assert.rejects(p,/cancelled/);const retry=loader.load('/one');finish('ready');assert.equal(await retry,'ready');assert.equal(calls,2);
  const revoked=[],ref=pdfObjectUrl({blob:new Blob(['%PDF-']),name:'x.pdf'},{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>revoked.push(url)});assert.equal(ref.url,'blob:test');ref.dispose();assert.deepEqual(revoked,['blob:test']);
});
test('share cancellation keeps the prepared file available for save/open',async()=>{
  const pdf={blob:new Blob(['%PDF-']),name:'x.pdf'};
  assert.equal(await sharePdf(pdf,{canShare:()=>true,share:async()=>{throw Object.assign(new Error(),{name:'AbortError'});}}),false);
});

test('full report export holds if a scored perspective is below the current disclosure floor or count is unknown',()=>{
 const result={suppressed:false,report:{payload:{source_commit:'f042cde',versions:{},lenses:[{lens:'Church',score:12.345,sub_dimensions:[]}],evidence:[{label:'Church — Written',n:2}]}}};
 assert.throws(()=>reportPdfDocument(result),/PDF_REPORT_HELD/);assert.doesNotThrow(()=>reportPdfDocument(result,{minimum:1}));
 result.report.payload.evidence=[];assert.throws(()=>reportPdfDocument(result,{minimum:1}),/PDF_REPORT_HELD/);
});
test('disclosure guard includes standalone, cross-lens, categorical and narrative-only evidence perspectives',()=>{
 const base={suppressed:false,report:{payload:{source_commit:'f042cde',versions:{},lenses:[{lens:'Community',score:60,sub_dimensions:[]}],evidence:[{label:'Community — Written',n:7},{label:'Church — Written',n:1}]}}};
 for(const extra of [{standalone_indicators:[{lens:'Church',score:12.345}]},{cross_lens_multi:[{lens_scores:[{lens:'Church',score:12.345}]}]},{cross_lens_single:[{lens_scores:[{lens:'Church',score:12.345}]}]},{translation_type_agreement:{church_values:['Clarifying']}},{narrative:['Church scored 12.345']}]){
  const r=structuredClone(base);Object.assign(r.report.payload,extra);assert.throws(()=>reportPdfDocument(r),/PDF_REPORT_HELD/);
 }
 const missing=structuredClone(base);missing.report.payload.evidence.pop();missing.report.payload.standalone_indicators=[{lens:'Church',score:12.345}];assert.throws(()=>reportPdfDocument(missing),/PDF_REPORT_HELD/);
});
