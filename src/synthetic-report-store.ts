/** Internal C2a store–renderer integration. No public handler or authorization shortcut. */
import type { Ctx } from './handlers/types.js';
import { REPORT_CAPTURE_CTE, attestPackedCapture, type CapturedAssessment } from './report-capture.js';
import { canonicalJson, parseBoundedJson, sha256Bytes } from './report-canonical-json.js';
import { ATTESTATION_TRUST } from './synthetic-attestation-trust.js';
import { renderSyntheticReport, REPORT_SCHEMA, REPORT_VERSIONS } from './synthetic-report-renderer.js';

type StoreContext = Pick<Ctx, 'db' | 'principal' | 'now'> & { env?: { ENVIRONMENT?: string } };
/** Fail closed: only an explicit ENVIRONMENT='dev' admits participant-source captures (captain 2026-09-24 15:03). */
function dev(ctx:StoreContext):boolean{return ctx.env?.ENVIRONMENT==='dev';}
type VersionTuple = Readonly<{sourcePin:string;indexRoot:string;scorerVersion:string;narrativeVersion:string;policyVersion:string;outputSchemaVersion:string}>;
type RendererDescriptor = Readonly<{
  tuple:VersionTuple;
  render:(capture:CapturedAssessment)=>unknown|Promise<unknown>;
  validate:(payload:unknown,capture:CapturedAssessment)=>boolean|Promise<boolean>;
}>;
async function renderCaptured(c:CapturedAssessment):Promise<unknown>{
  const result=await renderSyntheticReport(c.assessmentId,c.rows,c.participant===true);
  if(!result.eligible||result.captureDigest!==c.captureDigest)invalid();
  return result.payload;
}
/** Exact trusted projection validates the complete real schema and its values.
 * Always over the original attested capture; no tolerance, cache or DB read. */
async function validateSyntheticReportPayload(payload:unknown,c:CapturedAssessment):Promise<boolean>{
  try{
    const result=await renderSyntheticReport(c.assessmentId,c.rows,c.participant===true);
    return result.eligible&&result.captureDigest===c.captureDigest&&canonicalJson(payload,PAYLOAD_LIMIT)===result.payloadJson;
  }catch{return false;}
}
const REAL_RENDERER: RendererDescriptor = Object.freeze({
  tuple:Object.freeze({sourcePin:ATTESTATION_TRUST.sourcePin,indexRoot:ATTESTATION_TRUST.indexRoot,
    scorerVersion:REPORT_VERSIONS.scorer,narrativeVersion:REPORT_VERSIONS.narrative,
    policyVersion:REPORT_VERSIONS.policy,outputSchemaVersion:REPORT_SCHEMA}),
  render:renderCaptured,validate:validateSyntheticReportPayload,
});
// Sole private compiled integration point. Tests substitute exactly this declaration.
// No setter, registration function, caller-rendered product or runtime switch exists.
const APPROVED_RENDERER: RendererDescriptor = REAL_RENDERER;

export type Report = Readonly<{id:string;assessmentId:string;reportKey:string;captureDigest:string;createdAt:string;payload:unknown}>;
export type ReportSummary = Omit<Report,'payload'>;
export type EligibilityMarker = Readonly<{assessment_id:string;eligible:boolean;policy_version:string}>;
export type EligibilityResult = {ok:true;marker:EligibilityMarker}|{ok:false;reason:'NOT_VISIBLE'|'UNAVAILABLE'};
export type StoreResult<T> = {ok:true;value:T}|{ok:false;reason:'HELD';marker:EligibilityMarker}|{ok:false;reason:'NOT_VISIBLE'|'UNAVAILABLE'|'CONFLICT'|'DETERMINISM'};
export type ReportPage = {reports:readonly ReportSummary[];afterId:string|null};
const NOT_VISIBLE = Object.freeze({ok:false as const,reason:'NOT_VISIBLE' as const});
function marker(aid:string,eligible:boolean):EligibilityMarker{return Object.freeze({assessment_id:aid,eligible,policy_version:REPORT_VERSIONS.policy});}
function held(aid:string){return {ok:false as const,reason:'HELD' as const,marker:marker(aid,false)};}
const UNAVAILABLE = Object.freeze({ok:false as const,reason:'UNAVAILABLE' as const});
const encoder=new TextEncoder();
const PAYLOAD_LIMIT=524288;
const DIGEST=/^[0-9a-f]{64}$/;
const versionKeys=['sourcePin','indexRoot','scorerVersion','narrativeVersion','policyVersion','outputSchemaVersion'] as const;
function invalid():never{throw new Error('REPORT_REFUSED');}
function text(v:unknown,max=256):string{
  if(typeof v!=='string'||v.length<1||v.length>max||encoder.encode(v).length>max)invalid();
  canonicalJson(v);return v;
}
function descriptor():RendererDescriptor{return APPROVED_RENDERER;}
function approved(r:RendererDescriptor):void{
  if(Object.keys(r.tuple).sort().join(',')!==[...versionKeys].sort().join(','))invalid();
  for(const key of versionKeys)text(r.tuple[key]);
  if(r.tuple.sourcePin!==ATTESTATION_TRUST.sourcePin||r.tuple.indexRoot!==ATTESTATION_TRUST.indexRoot)invalid();
}
function identity(c:CapturedAssessment,t:VersionTuple){
  return {schema:'3d-materialized-report-key-v1',assessmentId:c.assessmentId,captureDigest:c.captureDigest,indexRoot:t.indexRoot,sourcePin:t.sourcePin,scorerVersion:t.scorerVersion,narrativeVersion:t.narrativeVersion,policyVersion:t.policyVersion,outputSchemaVersion:t.outputSchemaVersion};
}
async function reportKey(c:CapturedAssessment,t:VersionTuple):Promise<string>{
  return sha256Bytes(encoder.encode('3d-materialized-report-v1\0'+canonicalJson(identity(c,t))));
}
function principal(ctx:StoreContext):[string,string]|null{
  if(ctx.principal.kind!=='user'&&ctx.principal.kind!=='support')return null;
  try{return[ctx.principal.kind,text(ctx.principal.id)];}catch{return null;}
}
const COLUMNS=`m.id, t.id AS assessment_id, m.report_key, m.capture_digest, m.index_root,
  m.source_pin, m.scorer_version, m.narrative_version, m.policy_version,
  m.output_schema_version, m.capture_json AS stored_capture,
  c.capture_json AS current_capture, m.payload_json, m.payload_sha256, m.created_at`;
export const REPORT_COMMIT_SQL=REPORT_CAPTURE_CTE+`
INSERT INTO synthetic_report
  (id, assessment_id, report_key, capture_digest, index_root, source_pin,
   scorer_version, narrative_version, policy_version, output_schema_version,
   capture_json, payload_json, payload_sha256, created_at, created_by)
SELECT ?6, c.assessment_id, ?7, ?8, ?9, ?10,
  ?11, ?12, ?13, ?14,
  c.capture_json, ?15, ?16, ?17, ?4
FROM captured c
WHERE c.capture_json = ?18
ON CONFLICT(assessment_id, report_key) DO NOTHING;
`;
export const REPORT_GET_SQL=REPORT_CAPTURE_CTE+`\nSELECT ${COLUMNS}
FROM target t LEFT JOIN captured c ON c.assessment_id = t.id
LEFT JOIN synthetic_report m ON m.assessment_id = t.id AND m.id = ?2;`;
export const REPORT_BUILD_RESULT_SQL=REPORT_CAPTURE_CTE+`\nSELECT ${COLUMNS}
FROM target t LEFT JOIN captured c ON c.assessment_id = t.id
LEFT JOIN synthetic_report m ON m.assessment_id = t.id AND m.report_key = ?6;`;
export const REPORT_LIST_SQL=REPORT_CAPTURE_CTE+`
, page AS (
  SELECT m.* FROM synthetic_report m
  WHERE m.assessment_id = (SELECT assessment_id FROM captured)
    AND (?6 IS NULL OR m.id > ?6 COLLATE BINARY)
  ORDER BY m.id COLLATE BINARY LIMIT ?7
)
SELECT p.id, t.id AS assessment_id, p.report_key, p.capture_digest, p.index_root,
  p.source_pin, p.scorer_version, p.narrative_version, p.policy_version,
  p.output_schema_version, p.capture_json AS stored_capture,
  c.capture_json AS current_capture, p.payload_json, p.payload_sha256, p.created_at
FROM target t LEFT JOIN captured c ON c.assessment_id = t.id
LEFT JOIN page p ON p.assessment_id = t.id
ORDER BY p.id COLLATE BINARY;`;
type StoredRow={id:string|null;assessment_id:string;report_key:string;capture_digest:string;index_root:string;source_pin:string;scorer_version:string;narrative_version:string;policy_version:string;output_schema_version:string;stored_capture:string;current_capture:string|null;payload_json:string;payload_sha256:string;created_at:string};
type Validated={report:Report;payloadBytes:string;payloadHash:string};
/** No queries here: both captures and metadata came from the same authorized SELECT. */
async function validateStored(row:StoredRow,r:RendererDescriptor,current?:CapturedAssessment,pd=false):Promise<Validated>{
  const aid=text(row.assessment_id);
  if(!current){const c=await attestPackedCapture(aid,row.current_capture??'',pd);if(!c.eligible)invalid();current=c.capture;}
  else if(current.assessmentId!==aid||current.packedCapture!==row.current_capture)invalid();
  const original=await attestPackedCapture(aid,row.stored_capture,pd);if(!original.eligible)invalid();
  if(!DIGEST.test(row.capture_digest)||original.capture.captureDigest!==row.capture_digest)invalid();
  const tuple:VersionTuple={sourcePin:row.source_pin,indexRoot:row.index_root,scorerVersion:row.scorer_version,narrativeVersion:row.narrative_version,policyVersion:row.policy_version,outputSchemaVersion:row.output_schema_version};
  for(const key of versionKeys)if(tuple[key]!==r.tuple[key])invalid();
  if(!DIGEST.test(row.report_key)||await reportKey(original.capture,r.tuple)!==row.report_key)invalid();
  if(typeof row.payload_json!=='string'||row.payload_json.length>PAYLOAD_LIMIT||encoder.encode(row.payload_json).length>PAYLOAD_LIMIT||!DIGEST.test(row.payload_sha256))invalid();
  if(await sha256Bytes(encoder.encode(row.payload_json))!==row.payload_sha256)invalid();
  const payload=parseBoundedJson(row.payload_json,PAYLOAD_LIMIT);
  if(!await r.validate(payload,original.capture))invalid();
  return {report:Object.freeze({id:text(row.id),assessmentId:aid,reportKey:row.report_key,captureDigest:row.capture_digest,createdAt:text(row.created_at,128),payload}),payloadBytes:row.payload_json,payloadHash:row.payload_sha256};
}
export const REPORT_OBSERVE_SQL=REPORT_CAPTURE_CTE+`
SELECT t.id AS assessment_id,c.capture_json AS current_capture
FROM target t LEFT JOIN captured c ON c.assessment_id=t.id;`;
type Observation={assessment_id:string;current_capture:string|null};
type BuildObservation={ok:true;aid:string;capture:CapturedAssessment|null}|{ok:false;reason:'NOT_VISIBLE'|'UNAVAILABLE'};
/** One authorized SELECT; subsequent attestation uses only its immutable bytes. */
async function observeBuild(ctx:StoreContext,assessmentId:string):Promise<BuildObservation>{
  const who=principal(ctx);if(!who)return NOT_VISIBLE;
  let aid:string;try{aid=text(assessmentId);approved(descriptor());}catch{return NOT_VISIBLE;}
  let row:Observation|null;
  try{row=await ctx.db.prepare(REPORT_OBSERVE_SQL).bind(who[0],null,aid,who[1],'member').first<Observation>();}catch{return UNAVAILABLE;}
  if(!row)return NOT_VISIBLE;
  if(row.assessment_id!==aid)return UNAVAILABLE;
  const current=await attestPackedCapture(aid,row.current_capture??'',dev(ctx));
  return {ok:true,aid,capture:current.eligible?current.capture:null};
}
/** Preview exposes no captured token, count, digest or report identity. */
export async function observeBuildEligibility(ctx:StoreContext,assessmentId:string):Promise<EligibilityResult>{
  const observation=await observeBuild(ctx,assessmentId);if(!observation.ok)return observation;
  if(!observation.capture)return {ok:true,marker:marker(observation.aid,false)};
  try{await descriptor().render(observation.capture);return {ok:true,marker:marker(observation.aid,true)};}
  catch{return {ok:true,marker:marker(observation.aid,false)};}
}
export async function buildMaterialized(ctx:StoreContext,assessmentId:string):Promise<StoreResult<Report>>{
  const observation=await observeBuild(ctx,assessmentId);if(!observation.ok)return observation;
  if(!observation.capture)return held(observation.aid);
  return commitMaterialized(ctx,assessmentId,observation.capture);
}
/** Internal captured token only: rendering is compiled, never accepted from an operation argument. */
export async function commitMaterialized(ctx:StoreContext,assessmentId:string,captured:CapturedAssessment):Promise<StoreResult<Report>>{
  const r=descriptor();
  const who=principal(ctx);if(!who)return NOT_VISIBLE;
  let aid:string,key:string,payloadBytes:string,payloadHash:string,c:CapturedAssessment,id:string,createdAt:string;
  try{
    approved(r);aid=text(assessmentId);
    // Reattest the raw token, ignoring any caller assertion of its digest/rows/eligibility.
    const capture=await attestPackedCapture(aid,captured.packedCapture,dev(ctx));if(!capture.eligible)return UNAVAILABLE;c=capture.capture;
    const rendered=await r.render(c);payloadBytes=canonicalJson(rendered,PAYLOAD_LIMIT);
    const parsed=parseBoundedJson(payloadBytes,PAYLOAD_LIMIT);if(!await r.validate(parsed,c))return UNAVAILABLE;
    key=await reportKey(c,r.tuple);payloadHash=await sha256Bytes(encoder.encode(payloadBytes));
    id='sreport_'+crypto.randomUUID();createdAt=text(ctx.now().toISOString(),128);
  }catch{return UNAVAILABLE;}
  const t=r.tuple;
  try{
    const written=await ctx.db.prepare(REPORT_COMMIT_SQL).bind(who[0],null,aid,who[1],'member',id,key,c.captureDigest,t.indexRoot,t.sourcePin,t.scorerVersion,t.narrativeVersion,t.policyVersion,t.outputSchemaVersion,payloadBytes,payloadHash,createdAt,c.packedCapture).run();
    if(!written.success)return UNAVAILABLE;
  }catch{return UNAVAILABLE;}
  // A fresh secure read is mandatory even for a successful or duplicate INSERT.
  let row:StoredRow|null;
  try{row=await ctx.db.prepare(REPORT_BUILD_RESULT_SQL).bind(who[0],null,aid,who[1],'member',key).first<StoredRow>();}catch{return UNAVAILABLE;}
  if(!row)return NOT_VISIBLE;
  if(row.assessment_id!==aid)return UNAVAILABLE;
  const current=await attestPackedCapture(aid,row.current_capture??'',dev(ctx));
  if(!current.eligible)return held(aid);
  if(row.id===null)return {ok:false,reason:'CONFLICT'};
  try{
    const valid=await validateStored(row,r,current.capture,dev(ctx));
    if(valid.report.assessmentId!==aid||valid.report.reportKey!==key||valid.report.captureDigest!==c.captureDigest||valid.payloadHash!==payloadHash||valid.payloadBytes!==payloadBytes)return {ok:false,reason:'DETERMINISM'};
    return {ok:true,value:valid.report};
  }catch{return held(aid);}
}
export async function readMaterialized(ctx:StoreContext,reportId:string):Promise<StoreResult<Report>>{
  const r=descriptor();
  const who=principal(ctx);if(!who)return NOT_VISIBLE;
  let rid:string;try{approved(r);rid=text(reportId);}catch{return NOT_VISIBLE;}
  let row:StoredRow|null;
  try{row=await ctx.db.prepare(REPORT_GET_SQL).bind(who[0],rid,null,who[1],'viewer').first<StoredRow>();}catch{return UNAVAILABLE;}
  if(!row)return NOT_VISIBLE;
  let aid:string;try{aid=text(row.assessment_id);}catch{return UNAVAILABLE;}
  try{return {ok:true,value:(await validateStored(row,r,undefined,dev(ctx))).report};}catch{return held(aid);}
}
export async function listMaterialized(ctx:StoreContext,assessmentId:string,afterId:string|null=null,pageSize=5):Promise<StoreResult<ReportPage>>{
  const r=descriptor();
  const who=principal(ctx);if(!who)return NOT_VISIBLE;
  let aid:string;try{approved(r);aid=text(assessmentId);if(afterId!==null)text(afterId);if(!Number.isInteger(pageSize)||pageSize<1||pageSize>5)return NOT_VISIBLE;}catch{return NOT_VISIBLE;}
  let rows:StoredRow[];
  try{const result=await ctx.db.prepare(REPORT_LIST_SQL).bind(who[0],null,aid,who[1],'viewer',afterId,pageSize+1).all<StoredRow>();if(!result.success)return UNAVAILABLE;rows=result.results;}catch{return UNAVAILABLE;}
  if(rows.length===0)return NOT_VISIBLE;
  if(rows.length>pageSize+1||rows.some(row=>row.assessment_id!==aid))return UNAVAILABLE;
  try{
    const current=await attestPackedCapture(aid,rows[0].current_capture??'',dev(ctx));if(!current.eligible)return held(aid);
    if(rows.some(row=>row.current_capture!==current.capture.packedCapture))return held(aid);
    if(rows.length===1&&rows[0].id===null)return {ok:true,value:{reports:[],afterId:null}};
    const validated:ReportSummary[]=[];let previous=afterId??'';
    for(const row of rows){
      const result=await validateStored(row,r,current.capture,dev(ctx));if(result.report.id<=previous)invalid();previous=result.report.id;
      const {payload,...summary}=result.report;validated.push(Object.freeze(summary));
    }
    const reports=Object.freeze(validated.slice(0,pageSize));
    return {ok:true,value:{reports,afterId:validated.length>pageSize?reports[reports.length-1].id:null}};
  }catch{return held(aid);}
}
