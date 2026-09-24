/** Report transport projection; all grant/current/stored authority belongs to the store observation. */
import type { Handler, HandlerResult, Impact } from './types';
import { CapError, notVisible } from './errors';
import { buildMaterialized, readMaterialized, listMaterialized, observeBuildEligibility } from '../synthetic-report-store';
import { mintReportCursor, readReportCursor } from '../report-cursor';
import { REPORT_VERSIONS } from '../synthetic-report-renderer';
const enc=new TextEncoder();
const control='cap.report.get suppression / access control; a built report is never unsent';
const impact:Impact={affected:[],irreversible:true,effect:'disclosure',compensating_control:control};
function params(p:Record<string,unknown>,required:string,optional?:string):string{
  if(Object.keys(p).some(k=>k!==required&&k!==optional))throw new CapError('INVALID_PARAMS','Invalid report parameters.');
  const v=p[required];if(typeof v!=='string'||!v.length||enc.encode(v).length>256)throw new CapError('INVALID_PARAMS','Invalid report parameters.');
  return v;
}
const MIXED_REASON='This assessment mixes synthetic and participant responses; a report can only be built from one kind.';
function held(aid:string,list=false,reason='Report unavailable under the current synthetic reporting policy.'):HandlerResult{
  return {result:{assessment_id:aid,suppressed:true,status:'held',reason,
    ...(list?{reports:[]}:{report:null}),snapshot_version:null,algorithm_version:null,policy_version:REPORT_VERSIONS.policy},scope:{type:'assessment',id:aid}};
}
function failure(reason:string,executeBuild=false):never{
  if(reason==='NOT_VISIBLE')throw notVisible('report');
  throw new CapError('STAGE_CONFLICT',executeBuild?'The report build outcome could not be confirmed. Recheck reports before choosing to retry.':'The report request could not be completed.');
}
/** DEV only, after the store has already returned HELD for a visible assessment: name a mixed capture plainly. */
async function heldReason(ctx:Parameters<Handler>[0],aid:string):Promise<string|undefined>{
  if(ctx.env.ENVIRONMENT!=='dev')return undefined;
  try{
    const r=await ctx.db.prepare(`SELECT count(DISTINCT r.source) AS n FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?1`).bind(aid).first<{n:number}>();
    return r&&r.n>1?MIXED_REASON:undefined;
  }catch{return undefined;}
}
export const build:Handler=async(ctx,p,opts)=>{
  const aid=params(p,'aid');
  if(opts?.dryRun){
    const observed=await observeBuildEligibility(ctx,aid);
    if(!observed.ok)failure(observed.reason);
    const result=observed.marker.eligible?{result:{assessment_id:aid,suppressed:false,status:'ready',report:null},scope:{type:'assessment' as const,id:aid}}:held(observed.marker.assessment_id,false,await heldReason(ctx,aid));
    return {...result,impact};
  }
  const r=await buildMaterialized(ctx,aid);
  if(!r.ok){if(r.reason==='HELD')return held(r.marker.assessment_id,false,await heldReason(ctx,aid));return failure(r.reason,true);}
  return {result:{assessment_id:aid,suppressed:false,report:{id:r.value.id,created_at:r.value.createdAt,payload:r.value.payload}},scope:{type:'assessment',id:aid}};
};
export const get:Handler=async(ctx,p)=>{
  const id=params(p,'id');const r=await readMaterialized(ctx,id);
  if(!r.ok){if(r.reason==='HELD')return held(r.marker.assessment_id);return failure(r.reason);}
  return {result:{assessment_id:r.value.assessmentId,suppressed:false,report:{id:r.value.id,created_at:r.value.createdAt,payload:r.value.payload}},scope:{type:'assessment',id:r.value.assessmentId}};
};
export const list:Handler=async(ctx,p)=>{
  const aid=params(p,'aid','cursor');
  const after=p.cursor===undefined?null:await readReportCursor(ctx.env.SESSION_SECRET,p.cursor,ctx.principal.id,aid,ctx.now());
  const r=await listMaterialized(ctx,aid,after,5);
  if(!r.ok){if(r.reason==='HELD')return held(r.marker.assessment_id,true);return failure(r.reason);}
  const next=r.value.afterId===null?null:await mintReportCursor(ctx.env.SESSION_SECRET,ctx.principal.id,aid,r.value.afterId,ctx.now());
  return {result:{assessment_id:aid,suppressed:false,reports:r.value.reports.map(v=>({id:v.id,created_at:v.createdAt})),next_cursor:next},scope:{type:'assessment',id:aid}};
};
export const handlers:Record<string,Handler>={'cap.report.build':build,'cap.report.get':get,'cap.report.list':list};
