/** B2 internal storage ingredient. Production is deliberately disabled without C. */
import type { Ctx } from './handlers/types.js';
import { REPORT_CAPTURE_CTE, captureForBuild, attestPackedCapture, type CapturedAssessment } from './report-capture.js';
import { canonicalJson, parseBoundedJson, sha256Bytes } from './report-canonical-json.js';
import { ATTESTATION_TRUST } from './synthetic-attestation-trust.js';

type StoreContext = Pick<Ctx, 'db' | 'principal' | 'now'>;
type VersionTuple = Readonly<{sourcePin:string;indexRoot:string;scorerVersion:string;narrativeVersion:string;policyVersion:string;outputSchemaVersion:string}>;
type RendererDescriptor = Readonly<{
  tuple:VersionTuple;
  render:(capture:CapturedAssessment)=>unknown|Promise<unknown>;
  validate:(payload:unknown,capture:CapturedAssessment)=>boolean;
}>;
// Sole private compiled integration point. Tests substitute exactly this declaration.
// No setter, registration function, caller-rendered product or runtime switch exists.
const APPROVED_RENDERER: RendererDescriptor | null = null;

export type Report = Readonly<{id:string;assessmentId:string;reportKey:string;captureDigest:string;createdAt:string;payload:unknown}>;
export type ReportSummary = Omit<Report,'payload'>;
export type StoreResult<T> = {ok:true;value:T}|{ok:false;reason:'HELD'|'UNAVAILABLE'|'CONFLICT'|'DETERMINISM'};
export type ReportPage = {reports:readonly ReportSummary[];afterId:string|null};
const HELD = Object.freeze({ok:false as const,reason:'HELD' as const});
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
function descriptor():RendererDescriptor|null{return APPROVED_RENDERER;}
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
const COLUMNS=`m.id, m.assessment_id, m.report_key, m.capture_digest, m.index_root,
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
FROM synthetic_report m JOIN captured c ON c.assessment_id = m.assessment_id
WHERE m.id = ?2;`;
export const REPORT_BUILD_RESULT_SQL=REPORT_CAPTURE_CTE+`\nSELECT ${COLUMNS}
FROM synthetic_report m JOIN captured c ON c.assessment_id = m.assessment_id
WHERE m.report_key = ?6;`;
export const REPORT_LIST_SQL=REPORT_CAPTURE_CTE+`
, page AS (
  SELECT m.* FROM synthetic_report m
  WHERE m.assessment_id = (SELECT assessment_id FROM captured)
    AND (?6 IS NULL OR m.id > ?6 COLLATE BINARY)
  ORDER BY m.id COLLATE BINARY LIMIT ?7
)
SELECT p.id, c.assessment_id AS assessment_id, p.report_key, p.capture_digest, p.index_root,
  p.source_pin, p.scorer_version, p.narrative_version, p.policy_version,
  p.output_schema_version, p.capture_json AS stored_capture,
  c.capture_json AS current_capture, p.payload_json, p.payload_sha256, p.created_at
FROM captured c LEFT JOIN page p ON p.assessment_id = c.assessment_id
ORDER BY p.id COLLATE BINARY;`;
type StoredRow={id:string|null;assessment_id:string;report_key:string;capture_digest:string;index_root:string;source_pin:string;scorer_version:string;narrative_version:string;policy_version:string;output_schema_version:string;stored_capture:string;current_capture:string;payload_json:string;payload_sha256:string;created_at:string};
type Validated={report:Report;payloadBytes:string;payloadHash:string};
/** No queries here: both captures and metadata came from the same authorized SELECT. */
async function validateStored(row:StoredRow,r:RendererDescriptor,current?:CapturedAssessment):Promise<Validated>{
  const aid=text(row.assessment_id);
  if(!current){const c=await attestPackedCapture(aid,row.current_capture);if(!c.eligible)invalid();current=c.capture;}
  else if(current.assessmentId!==aid||current.packedCapture!==row.current_capture)invalid();
  const original=await attestPackedCapture(aid,row.stored_capture);if(!original.eligible)invalid();
  if(!DIGEST.test(row.capture_digest)||original.capture.captureDigest!==row.capture_digest)invalid();
  const tuple:VersionTuple={sourcePin:row.source_pin,indexRoot:row.index_root,scorerVersion:row.scorer_version,narrativeVersion:row.narrative_version,policyVersion:row.policy_version,outputSchemaVersion:row.output_schema_version};
  for(const key of versionKeys)if(tuple[key]!==r.tuple[key])invalid();
  if(!DIGEST.test(row.report_key)||await reportKey(original.capture,r.tuple)!==row.report_key)invalid();
  if(typeof row.payload_json!=='string'||row.payload_json.length>PAYLOAD_LIMIT||encoder.encode(row.payload_json).length>PAYLOAD_LIMIT||!DIGEST.test(row.payload_sha256))invalid();
  if(await sha256Bytes(encoder.encode(row.payload_json))!==row.payload_sha256)invalid();
  const payload=parseBoundedJson(row.payload_json,PAYLOAD_LIMIT);
  if(!r.validate(payload,original.capture))invalid();
  return {report:Object.freeze({id:text(row.id),assessmentId:aid,reportKey:row.report_key,captureDigest:row.capture_digest,createdAt:text(row.created_at,128),payload}),payloadBytes:row.payload_json,payloadHash:row.payload_sha256};
}
export async function buildMaterialized(ctx:StoreContext,assessmentId:string):Promise<StoreResult<Report>>{
  if(!descriptor())return HELD;
  const c=await captureForBuild(ctx,assessmentId);if(!c.eligible)return c.reason==='UNAVAILABLE'?UNAVAILABLE:HELD;
  return commitMaterialized(ctx,assessmentId,c.capture);
}
/** Internal captured token only: rendering is compiled, never accepted from an operation argument. */
export async function commitMaterialized(ctx:StoreContext,assessmentId:string,captured:CapturedAssessment):Promise<StoreResult<Report>>{
  const r=descriptor();if(!r)return HELD;
  const who=principal(ctx);if(!who)return HELD;
  let aid:string,key:string,payloadBytes:string,payloadHash:string,c:CapturedAssessment,id:string,createdAt:string;
  try{
    approved(r);aid=text(assessmentId);
    // Reattest the raw token, ignoring any caller assertion of its digest/rows/eligibility.
    const capture=await attestPackedCapture(aid,captured.packedCapture);if(!capture.eligible)return HELD;c=capture.capture;
    const rendered=await r.render(c);payloadBytes=canonicalJson(rendered,PAYLOAD_LIMIT);
    const parsed=parseBoundedJson(payloadBytes,PAYLOAD_LIMIT);if(!r.validate(parsed,c))return HELD;
    key=await reportKey(c,r.tuple);payloadHash=await sha256Bytes(encoder.encode(payloadBytes));
    id='sreport_'+crypto.randomUUID();createdAt=text(ctx.now().toISOString(),128);
  }catch{return HELD;}
  const t=r.tuple;
  try{
    const written=await ctx.db.prepare(REPORT_COMMIT_SQL).bind(who[0],null,aid,who[1],'member',id,key,c.captureDigest,t.indexRoot,t.sourcePin,t.scorerVersion,t.narrativeVersion,t.policyVersion,t.outputSchemaVersion,payloadBytes,payloadHash,createdAt,c.packedCapture).run();
    if(!written.success)return UNAVAILABLE;
  }catch{return UNAVAILABLE;}
  // A fresh secure read is mandatory even for a successful or duplicate INSERT.
  let row:StoredRow|null;
  try{row=await ctx.db.prepare(REPORT_BUILD_RESULT_SQL).bind(who[0],null,aid,who[1],'member',key).first<StoredRow>();}catch{return UNAVAILABLE;}
  if(!row)return {ok:false,reason:'CONFLICT'};
  try{
    const valid=await validateStored(row,r);
    if(valid.report.assessmentId!==aid||valid.report.reportKey!==key||valid.report.captureDigest!==c.captureDigest||valid.payloadHash!==payloadHash||valid.payloadBytes!==payloadBytes)return {ok:false,reason:'DETERMINISM'};
    return {ok:true,value:valid.report};
  }catch{return HELD;}
}
export async function readMaterialized(ctx:StoreContext,reportId:string):Promise<StoreResult<Report>>{
  const r=descriptor();if(!r)return HELD;
  const who=principal(ctx);if(!who)return HELD;
  let rid:string;try{approved(r);rid=text(reportId);}catch{return HELD;}
  let row:StoredRow|null;
  try{row=await ctx.db.prepare(REPORT_GET_SQL).bind(who[0],rid,null,who[1],'viewer').first<StoredRow>();}catch{return UNAVAILABLE;}
  if(!row)return HELD;
  try{return {ok:true,value:(await validateStored(row,r)).report};}catch{return HELD;}
}
export async function listMaterialized(ctx:StoreContext,assessmentId:string,afterId:string|null=null,pageSize=5):Promise<StoreResult<ReportPage>>{
  const r=descriptor();if(!r)return HELD;
  const who=principal(ctx);if(!who)return HELD;
  let aid:string;try{approved(r);aid=text(assessmentId);if(afterId!==null)text(afterId);if(!Number.isInteger(pageSize)||pageSize<1||pageSize>5)return HELD;}catch{return HELD;}
  let rows:StoredRow[];
  try{const result=await ctx.db.prepare(REPORT_LIST_SQL).bind(who[0],null,aid,who[1],'viewer',afterId,pageSize+1).all<StoredRow>();if(!result.success)return UNAVAILABLE;rows=result.results;}catch{return UNAVAILABLE;}
  if(rows.length<1||rows.length>pageSize+1||rows.some(row=>row.assessment_id!==aid))return HELD;
  try{
    const current=await attestPackedCapture(aid,rows[0].current_capture);if(!current.eligible)return HELD;
    if(rows.some(row=>row.current_capture!==current.capture.packedCapture))return HELD;
    if(rows.length===1&&rows[0].id===null)return {ok:true,value:{reports:[],afterId:null}};
    const validated:ReportSummary[]=[];let previous=afterId??'';
    for(const row of rows){
      const result=await validateStored(row,r,current.capture);if(result.report.id<=previous)invalid();previous=result.report.id;
      const {payload,...summary}=result.report;validated.push(Object.freeze(summary));
    }
    const reports=Object.freeze(validated.slice(0,pageSize));
    return {ok:true,value:{reports,afterId:validated.length>pageSize?reports[reports.length-1].id:null}};
  }catch{return HELD;}
}
