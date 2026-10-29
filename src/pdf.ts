/** Binary HTTP projections of existing authorized reads. Neither route can build a report or accept document content. */
import type { Hono } from 'hono';
import type { Ctx, Env } from './handlers/types';
import { execute } from './dispatch';
import { fail, statusFor } from './envelope';
import { existingBlankPrintLink } from './handlers/survey';
import { listPassages } from './passages';
import { handleTranslate } from './translate';
import { lwcLanguage } from './languages';
import { PdfError, pdfBytes, pdfResponse, type PdfEnv } from './pdf-render';
import { surveyPdfDocument, reportPdfDocument } from '../ui/pdf/documents.js';
import { paperLink, printIdentityFrom } from '../ui/assess/print.js';
import { translatePrint } from '../ui/assess/print-lang.js';
import { printItemsFrom, printTitleFromHtml } from '../ui/stage-screens.js';

const error = (code:string,message:string,status:number) => new Response(JSON.stringify(fail(code,message)),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
async function read(ctx:Ctx,cap:string,params:Record<string,string>):Promise<Record<string,any>> {
  const r=await execute(ctx,cap,params,{tool:'read',transport:'http'});
  if(!r.ok)throw new PdfError(r.error.code,r.error.message,statusFor(r.error.code));
  return r.result;
}
function options(request:Request,survey:boolean) {
  const q=new URL(request.url).searchParams;
  for(const k of q.keys())if(!['paper',...(survey?['lang']:[])].includes(k))throw new PdfError('INVALID_PARAMS','Unknown PDF option.',400);
  const paper=q.get('paper')||'letter',lang=q.get('lang')||'en';
  if(!['letter','a4'].includes(paper))throw new PdfError('INVALID_PARAMS','Choose letter or a4.',400);
  if(survey&&lang!=='en'&&!lwcLanguage(lang))throw new PdfError('INVALID_PARAMS','Choose a supported survey language.',400);
  return {paper:paper as 'letter'|'a4',lang};
}
export async function surveyDocument(ctx:Ctx,request:Request,aid:string,sid:string,lang:string,paper:'letter'|'a4') {
  const printed=await read(ctx,'cap.survey.print',{aid,sid}); // exact member role, selected template, choices
  const {assessment:a,surveys}=await read(ctx,'cap.assessment.get',{id:aid});
  const s=surveys.find((s:Record<string,any>)=>s.id===sid);
  let project:Record<string,any>|null=null;
  let languages:unknown[]=[];
  // A direct assessment grant need not include a visible project.
  try { project=(await read(ctx,'cap.project.get',{id:a.project_id})).project; languages=(await read(ctx,'cap.language.list',{pid:a.project_id})).languages; } catch(e) { if(!(e instanceof PdfError)||![403,404].includes(e.status))throw e; }
  const passages=await listPassages(ctx.db,aid);
  const passage=[...new Set(passages.map(p=>String(p.reference||p.title||'').trim()).filter(Boolean))].join(' · ')||String(a.purpose||'').trim();
  const token=await existingBlankPrintLink(ctx,sid);
  const origin=new URL(ctx.env.PUBLIC_ORIGIN||request.url).origin;
  let model:Record<string,any>={visible:true,blank:true,template_id:printed.template_id,template_version:printed.template_version,title:printTitleFromHtml(printed.html),items:printItemsFrom(printed),identity:printIdentityFrom(a,{project,languages,survey:s,perspective:s?.perspective||''}),passageLine:passage?`Before you answer, read or listen to: ${passage}`:'',link:paperLink(token?{url:`${origin}/#survey=${encodeURIComponent(token)}`}:null)};
  if(lang!=='en') {
    const localTranslate:typeof fetch=async(input,init)=>{
      if(String(input)!=='/v2/translate')throw new Error('Unexpected translation path');
      return handleTranslate(new Request(`${origin}/v2/translate`,{...init,headers:{'content-type':'application/json'},signal:request.signal}),ctx.env);
    };
    model=await translatePrint(model,{lang,fetchImpl:localTranslate});
    if(!model.lang||model.english>0)throw new PdfError('PDF_TRANSLATION_INCOMPLETE','Translation is incomplete. Retry, choose English, or use Print with marked English fallbacks.',409);
  }
  return surveyPdfDocument(model,{paper});
}
export function installPdf(app:Hono<{Bindings:Env}>,context:(request:Request,env:Env)=>Promise<Ctx>) {
  const handle=async(request:Request,env:Env,build:(ctx:Ctx,paper:'letter'|'a4',lang:string)=>Promise<{html:string;name:string}>,survey:boolean)=>{
    try {
      const {paper,lang}=options(request,survey),ctx=await context(request,env);
      // Authorize/read before checking rendering availability: configuration must not reveal hidden report existence.
      const {html,name}=await build(ctx,paper,lang);
      return pdfResponse(await pdfBytes(html,paper,env as Env&PdfEnv,request.signal),name);
    } catch(e) {return e instanceof PdfError?error(e.code,e.message,e.status):error('PDF_FAILED','PDF download failed. Try again or use Print.',503);}
  };
  app.get('/v2/assessments/:aid/surveys/:sid/print.pdf',c=>handle(c.req.raw,c.env,async(ctx,paper,lang)=>({html:await surveyDocument(ctx,c.req.raw,c.req.param('aid'),c.req.param('sid'),lang,paper),name:`survey-${c.req.param('sid')}-${lang}`}),true));
  app.get('/v2/reports/:id/pdf',c=>handle(c.req.raw,c.env,async(ctx,paper)=>{
    const stored=await read(ctx,'cap.report.get',{id:c.req.param('id')}); // current store policy; never report.build
    if(stored.suppressed!==false||!stored.report)throw new PdfError('PDF_REPORT_HELD','This report is unavailable under the current reporting policy.',409);
    return {html:reportPdfDocument(stored,{paper}),name:`report-${c.req.param('id')}`};
  },false));
}
