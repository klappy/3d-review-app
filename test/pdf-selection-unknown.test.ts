import {readFileSync} from 'node:fs';
import {beforeEach,it,expect,vi} from 'vitest';
import {Hono} from 'hono';
const reads=vi.hoisted(()=>({stored:null as any}));
vi.mock('../src/dispatch',()=>({execute:async(_ctx:unknown,cap:string)=>({ok:true,result:cap==='cap.report.get'?reads.stored:cap==='cap.assessment.get'?{assessment:{name:'Historical review',project_id:'project',language:'Fixture'}}:cap==='cap.project.get'?{project:{name:'Project'}}:{languages:[]}})}));
import {installPdf} from '../src/pdf';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/synthetic-report-renderer-v1.json',import.meta.url),'utf8'));
const dropChurch=(x:any):any=>Array.isArray(x)?x.filter(v=>!(v&&typeof v==='object'&&v.lens==='Church')).map(dropChurch):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,dropChurch(v)])):x;
let html:string;
const app=new Hono();
installPdf(app as any,async(_request,env)=>({env} as any));
beforeEach(()=>{
 const payload=dropChurch(structuredClone(Object.values(corpus.contexts)[0])) as any;
 payload.evidence=payload.evidence.filter((e:any)=>!String(e.label).startsWith('Church — '));
 if(payload.translation_type_agreement)payload.translation_type_agreement={...payload.translation_type_agreement,church_values:[],church_statuses:[],agree:null};
 payload.synthetic=true;payload.source_commit=corpus.source_commit;payload.versions={scorer:'fixture',narrative:'fixture',policy:'fixture'};
 reads.stored={assessment_id:'fixture',suppressed:false,report:{id:'historical',created_at:'2026-11-05T12:00:00Z',payload}};html='';
});
async function render(format:string){
 const response=await app.fetch(new Request(`https://local.invalid/v2/reports/historical/pdf?format=${format}`),{ENVIRONMENT:'dev',PDF_BROWSER:{quickAction:async(_action:string,options:any)=>{html=options.html;return new Response('%PDF-1.7\nfixture',{headers:{'content-type':'application/pdf'}});}}});
 expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('application/pdf');return html.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
}
it.each(['overview','detailed'])('HTTP %s PDF keeps missing historical selection unknown',async format=>{
 const result=await render(format);
 expect(result).toContain('Other perspectives’ participation is unknown.');
 expect(result).not.toContain('Church not asked');
});
it.each(['overview','detailed'])('HTTP %s PDF preserves explicitly saved empty selection as known',async format=>{
 reads.stored.report.payload.report_selection={schema:'3d-report-selection-v1',selected_perspectives:[]};
 const result=await render(format);
 expect(result).not.toContain('Other perspectives’ participation is unknown.');
 expect(result).toContain('Church not asked');
});
