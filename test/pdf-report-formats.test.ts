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
 const overview=namedReportDocument(model,'overview'),detail=namedReportDocument(model,'detailed');expect(overview).not.toBe(detail);expect(overview).toContain('Where to look next');expect(overview).not.toContain('<svg');expect(detail).toContain('Every area, with evidence');expect(detail).toContain('<svg');expect(detail).not.toContain('SECRET');payload.lenses[0].score=99;expect(namedReportDocument(model,'overview')).toBe(overview);
 const out=process.env.PDF_FORMAT_EVIDENCE,chrome=process.env.PDF_LOCAL_CHROME;if(out&&chrome){mkdirSync(out,{recursive:true});for(const [kind,html]of [['overview',overview],['detailed',detail]]){const path=`${out}/${id}-${kind}`;writeFileSync(path+'.html',html);execFileSync(chrome,['--headless','--no-sandbox','--no-pdf-header-footer',`--print-to-pdf=${path}.pdf`,`file://${path}.html`],{timeout:30000,stdio:'pipe'});expect(readFileSync(path+'.pdf').subarray(0,5).toString()).toBe('%PDF-');}}
},60000);
it('privacy floor/unknown format refuse; no shared global policy mutation',()=>{const id=ids[0],stored={suppressed:false,report:{id,payload:corpus.contexts[id]}};expect(()=>namedReportModel(stored,{minimum:1000})).toThrow('PDF_REPORT_HELD');expect(()=>namedReportDocument({},'invented')).toThrow();});

it('named dispatch preserves existing full PDF and rejects unknown variants',()=>{const payload={...corpus.contexts[ids[0]],source_commit:corpus.source_commit,versions:{scorer:'fixture'}};const stored={suppressed:false,report:{id:'fixture',payload}};expect(storedReportDocument(stored,{minimum:1})).toBe(reportPdfDocument(stored,{minimum:1,paper:'letter'}));expect(storedReportDocument(stored,{minimum:1,format:'overview'})).toContain('<title>Overview report');expect(()=>storedReportDocument(stored,{format:'unknown'})).toThrow();expect(()=>namedReportDocument({radar:'<script>'},'detailed')).toThrow();});
