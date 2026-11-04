import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import app from '../src/index';
import {mintSession} from '../src/auth';
import {buildMaterialized} from '../src/synthetic-report-store';
import {PRINT_WORDS} from '../ui/stage-screens.js';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'pdf-routes',modules:true,script:'export default {fetch(){return new Response("fixture")}}',d1Databases:{DB:'pdf-routes'}}]}));
let db:D1Database,env:any,owner:string,other:string,reportId:string;
const binary=new TextEncoder().encode('%PDF-1.7\ntransport fixture');
const render=vi.fn(async()=>new Response(binary,{headers:{'content-type':'application/pdf'}}));
const survey='/v2/assessments/assess_tavo_collect/surveys/survey_tavo/print.pdf';
const request=(path:string,who:string|null=owner,extra:Record<string,unknown>={})=>app.fetch(new Request(`https://local.invalid${path}`,{headers:who?{authorization:`Bearer ${who}`}:{}}),{...env,...extra});
beforeAll(async()=>{
  db=await mf.getD1Database('DB');
  for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql','migrations/0011_context.sql','migrations/0012_translation.sql','migrations/0013_passages.sql']) {
    const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
    const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
  }
  env={DB:db,SESSION_SECRET:'local-synthetic-pdf-test',ENVIRONMENT:'dev',PDF_BROWSER:{quickAction:render}};
  owner=await mintSession(env,'person_mara','user');other=await mintSession(env,'person_ion','user');
  const r=await buildMaterialized({env,db,principal:{id:'person_mara',kind:'user'},now:()=>new Date('2026-10-29T12:00:00Z'),traceId:'pdf-test',log:()=>{}},'assess_syn_earning-trust-2026-01');
  if(!r.ok)throw new Error(`fixture report: ${r.reason}`);reportId=r.value.id;
},60000);
afterAll(()=>mf.dispose());
describe('PDF endpoints preserve existing authorization and report policy',()=>{
  it('returns binary attachment and safe cache headers for an authorized survey',async()=>{
    render.mockClear();const r=await request(survey);expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('application/pdf');expect(r.headers.get('content-disposition')).toBe('attachment; filename="survey-survey_tavo-en.pdf"');expect(r.headers.get('cache-control')).toContain('no-store');expect(new Uint8Array(await r.arrayBuffer())).toEqual(binary);
    const options:any=(render.mock.calls as any)[0][1];expect(options.html).toContain('p-items');expect(options.html).not.toContain('local-synthetic-pdf-test');expect(options.html).not.toContain('<script');
  });
  it('refuses unsigned and missing-scope users before rendering, including without a binding',async()=>{
    render.mockClear();expect((await request(survey,null)).status).toBe(401);expect((await request(survey,other)).status).toBeGreaterThanOrEqual(403);expect((await request('/v2/reports/not-visible/pdf',other,{PDF_BROWSER:undefined})).status).toBe(404);expect(render).not.toHaveBeenCalled();
  });
  it('returns a useful rendering-unavailable response, never HTML with a PDF filename',async()=>{
    const r=await request(survey,owner,{PDF_BROWSER:undefined});expect(r.status).toBe(503);expect((await r.json() as any).error.code).toBe('PDF_UNAVAILABLE');
  });
  it('validates paper/language/options and refuses incomplete Hindi translation',async()=>{
    for(const q of ['paper=huge','lang=made-up','html=raw'])expect((await request(`${survey}?${q}`)).status).toBe(400);
    const r=await request(`${survey}?lang=hi`);expect(r.status).toBe(409);expect((await r.json() as any).error.code).toBe('PDF_TRANSLATION_INCOMPLETE');
  });
  it('renders only an authorized stored report, with exact aggregates and no raw answers',async()=>{
    render.mockClear();const r=await request(`/v2/reports/${reportId}/pdf?paper=a4`);expect(r.status).toBe(200);const html=(render.mock.calls as any)[0][1].html;expect(html).toContain('<svg');expect(html).toContain('<table');expect(html).not.toContain('answersRaw');expect(html).not.toContain('responseId');
  });
  it('strict named formats preserve full/default bytes, paper, filenames and authorized reads',async()=>{
    const before=(await db.prepare('SELECT id,payload_sha256,capture_digest,created_at FROM synthetic_report ORDER BY id').all()).results;
    const htmls=new Map<string,string>();
    for(const format of ['full','overview','detailed']){
      render.mockClear();const r=await request(`/v2/reports/${reportId}/pdf?format=${format}`);expect(r.status,format).toBe(200);
      expect(r.headers.get('content-disposition')).toContain(`report-${reportId}${format==='full'?'':'-'+format}.pdf`);
      expect(r.headers.get('cache-control')).toContain('no-store');const opts=(render.mock.calls as any)[0][1];htmls.set(format,opts.html);
      expect(opts.pdfOptions.format).toBe(format==='full'?'letter':'a4');
      expect(opts.html).not.toMatch(/answersRaw|SECRET EXCERPT|Skip to main content|Download full report PDF/);
    }
    expect(htmls.get('overview')).toContain('What stands out');expect(htmls.get('detailed')).toContain('Every area, with evidence');expect(htmls.get('overview')).not.toBe(htmls.get('detailed'));
    render.mockClear();await request(`/v2/reports/${reportId}/pdf`);expect((render.mock.calls as any)[0][1].html).toBe(htmls.get('full'));
    for(const q of ['format=','format=unknown','format=Overview','format=overview&format=full','paper=a4&paper=letter','format=questions','html=raw','lang=en'])expect((await request(`/v2/reports/${reportId}/pdf?${q}`)).status).toBe(400);
    expect((await request(`${survey}?format=overview`)).status).toBe(400);
    expect((await db.prepare('SELECT id,payload_sha256,capture_digest,created_at FROM synthetic_report ORDER BY id').all()).results).toEqual(before);
  });
  it('named formats retain privacy, outsider, unavailable and actual session-revocation refusals',async()=>{
    for(const format of ['overview','detailed']){
      const path=`/v2/reports/${reportId}/pdf?format=${format}`;render.mockClear();
      expect((await request(path,other,{PDF_BROWSER:undefined})).status).toBe(404);expect((await request('/v2/reports/not-visible/pdf?format='+format,other)).status).toBe(404);
      expect((await request(path,null)).status).toBe(401);expect((await request(path,owner,{ENVIRONMENT:'production'})).status).toBe(409);expect(render).not.toHaveBeenCalled();
      expect((await request(path,owner,{PDF_BROWSER:undefined})).status).toBe(503);
      const temporary=await mintSession(env,'person_mara','user');expect((await request(path,temporary)).status).toBe(200);
      await db.prepare('DELETE FROM session WHERE token_hash = ?').bind(createHash('sha256').update(temporary).digest('hex')).run();render.mockClear();expect((await request(path,temporary)).status).toBe(401);expect(render).not.toHaveBeenCalled();
    }
  });
  it('named export cannot reuse an earlier authorized read after assessment-grant revocation',async()=>{
    const rows=(await db.prepare('SELECT * FROM "grant" WHERE principal_id=?').bind('person_mara').all<Record<string,unknown>>()).results;
    expect(rows.length).toBeGreaterThan(0);
    try{await db.prepare('DELETE FROM "grant" WHERE principal_id=?').bind('person_mara').run();render.mockClear();
      for(const format of ['full','overview','detailed'])expect((await request(`/v2/reports/${reportId}/pdf?format=${format}`)).status).toBe(404);expect(render).not.toHaveBeenCalled();
    }finally{for(const row of rows)await db.prepare(`INSERT INTO "grant" (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(()=>'?').join(',')})`).bind(...Object.values(row)).run();}
  });
  it('rechecks report visibility instead of trusting the id from a prior download',async()=>{
    render.mockClear();const r=await request(`/v2/reports/${reportId}/pdf`,other);expect(r.status).toBe(404);expect(render).not.toHaveBeenCalled();
  });
  it('does not disclose a perspective below the environment display minimum in a full-detail PDF',async()=>{
    render.mockClear();const r=await request(`/v2/reports/${reportId}/pdf`,owner,{ENVIRONMENT:'production'});
    expect(r.status).toBe(409);expect((await r.json() as any).error.code).toBe('PDF_REPORT_HELD');expect(render).not.toHaveBeenCalled();
  });
  it('retains current suppression when a stored report loses its eligible capture',async()=>{
    const rows=(await db.prepare("SELECT r.* FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?").bind('assess_syn_earning-trust-2026-01').all<Record<string,unknown>>()).results;
    try {
      for(const row of rows)await db.prepare('DELETE FROM response WHERE id=?').bind(row.id).run();
      render.mockClear();const r=await request(`/v2/reports/${reportId}/pdf`);expect(r.status).toBe(409);expect((await r.json() as any).error.code).toBe('PDF_REPORT_HELD');expect(render).not.toHaveBeenCalled();
    } finally {for(const row of rows)await db.prepare(`INSERT INTO response (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(()=>'?').join(',')})`).bind(...Object.values(row)).run();}
  });
  it.skipIf(!process.env.PDF_LOCAL_CHROME||!process.env.PDF_EVIDENCE_DIR)('downloads genuine PDFs through the authorized endpoints using local Chromium (explicit local evidence only)',async()=>{
    const out=process.env.PDF_EVIDENCE_DIR!;mkdirSync(out,{recursive:true});
    const localBrowser={quickAction:async(_:string,options:any)=>{
      const path=`${out}/endpoint-render`;writeFileSync(`${path}.html`,options.html);
      execFileSync(process.env.PDF_LOCAL_CHROME!,['--no-sandbox','--headless','--no-pdf-header-footer',`--print-to-pdf=${path}.pdf`,`file://${path}.html`],{timeout:25000,stdio:'pipe'});
      return new Response(readFileSync(`${path}.pdf`),{headers:{'content-type':'application/pdf'}});
    }};
    // This is fixture translation-memory content for layout/transport QA, not a human-validated translation.
    const printed=await request(survey.replace('print.pdf','print'));const result=(await printed.json() as any).result;
    const strings=[...Object.values(PRINT_WORDS),...result.items.flatMap((i:any)=>[i.text,...(i.options||[]).map((o:any)=>o.text)])];
    for(const text of new Set(strings))await db.prepare("INSERT OR REPLACE INTO translation_memory (locale,source_hash,source_text,text,status,provider,created_at) VALUES ('hi',?,?,?,'machine','local-fixture','2026-10-29')").bind(createHash('sha256').update(text as string).digest('hex'),text,'यह परीक्षण के लिए हिन्दी अनुवाद है।').run();
    for(const [name,path]of [['endpoint-survey-en',survey],['endpoint-survey-hi',`${survey}?lang=hi&paper=a4`],['endpoint-report',`/v2/reports/${reportId}/pdf`],['endpoint-overview',`/v2/reports/${reportId}/pdf?format=overview`],['endpoint-detailed',`/v2/reports/${reportId}/pdf?format=detailed`]]){
      const response=await request(path,owner,{PDF_BROWSER:localBrowser});expect(response.status,name).toBe(200);expect(response.headers.get('content-type')).toBe('application/pdf');
      const data=new Uint8Array(await response.arrayBuffer());expect(new TextDecoder().decode(data.slice(0,5))).toBe('%PDF-');expect(data.length).toBeGreaterThan(15_000);writeFileSync(`${out}/${name}.pdf`,data);writeFileSync(`${out}/${name}.html`,readFileSync(`${out}/endpoint-render.html`));
    }
  },60000);
});
