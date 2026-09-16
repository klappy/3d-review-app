// Survey access is checked at the exact assessment grant, never project grant.
import type { Ctx, Handler, Role } from "./types";
import { CapError, notVisible } from "./errors";
import { countScalar, gate, loadTemplate, newId, nowIso, optInt, parseItems, randomToken, renderItems, reqStr, roleAt, sha256, type AssessmentRow, type SurveyRow } from "./common";
import { decryptCode, encryptCode } from "../code-escrow";
import { randomCode } from "./common";

async function assessment(ctx:Ctx,id:string,min:Role="viewer") {
  const row=await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id).first<AssessmentRow>();
  if(!row) throw notVisible("assessment");
  return {row,role:gate(await roleAt(ctx,"assessment",id),min,"assessment")};
}
async function survey(ctx:Ctx,aid:string,sid:string,min:Role="viewer") {
  await assessment(ctx,aid,min);
  const row=await ctx.db.prepare("SELECT * FROM assessment_survey WHERE id = ? AND assessment_id = ?").bind(sid,aid).first<SurveyRow>();
  if(!row) throw notVisible("survey");
  return row;
}
function ids(params:Record<string,unknown>) {return {aid:reqStr(params,"aid"),sid:reqStr(params,"sid")};}
function only(params:Record<string,unknown>, allowed:string[]) {
  const extra=Object.keys(params).find(k=>!allowed.includes(k));
  if(extra) throw new CapError("INVALID_PARAMS",`unknown parameter ${extra}`);
}
function codeIds(params:Record<string,unknown>):string[] {
  const value=params.ids;
  if(!Array.isArray(value)||value.length===0||value.length>100||value.some(v=>typeof v!=="string"||!v)||new Set(value).size!==value.length)
    throw new CapError("INVALID_PARAMS","ids must be a nonempty unique code-id array (max 100)");
  return value as string[];
}
interface EscrowRow {id:string;assessment_survey_id:string;batch_id:string|null;code_ciphertext:string|null;code_iv:string|null;exported_at:string|null;redeemed_at:string|null}
async function exactBatch(ctx:Ctx,sid:string,requested:string[]):Promise<{batchId:string;rows:EscrowRow[]}> {
  const first=await ctx.db.prepare("SELECT id, assessment_survey_id, batch_id, code_ciphertext, code_iv, exported_at, redeemed_at FROM access_code WHERE id = ? AND assessment_survey_id = ?")
    .bind(requested[0],sid).first<EscrowRow>();
  if(!first?.batch_id) throw notVisible("code batch");
  const {results}=await ctx.db.prepare("SELECT id, assessment_survey_id, batch_id, code_ciphertext, code_iv, exported_at, redeemed_at FROM access_code WHERE batch_id = ? AND assessment_survey_id = ? ORDER BY id")
    .bind(first.batch_id,sid).all<EscrowRow>();
  if(results.length!==requested.length||results.some(r=>!requested.includes(r.id))) throw new CapError("INVALID_PARAMS","complete issued batch ids required");
  if(results.some(r=>r.exported_at||r.redeemed_at||!r.code_ciphertext||!r.code_iv)) throw new CapError("STAGE_CONFLICT","batch is no longer available for first export","revoke and reissue if the release was lost");
  return {batchId:first.batch_id,rows:results};
}
export const select:Handler=async(ctx,params)=>{
  const aid=reqStr(params,"aid"); await assessment(ctx,aid,"member");
  const template_id=reqStr(params,"template_id"), version=optInt(params,"version",0,0);
  const t=await loadTemplate(ctx,template_id,version||undefined);
  const existing=await ctx.db.prepare("SELECT * FROM assessment_survey WHERE assessment_id = ? AND template_id = ? AND template_version = ?").bind(aid,t.id,t.version).first<SurveyRow>();
  if(existing){
    if(existing.state==="archived") await ctx.db.prepare("UPDATE assessment_survey SET state = 'selected', archived_at = NULL WHERE id = ?").bind(existing.id).run();
    return {result:{survey:{...existing,state:"selected",archived_at:null},selected:true},scope:{type:"assessment",id:aid},priorState:{state:existing.state,archived_at:existing.archived_at}};
  }
  const id=newId("survey"), at=nowIso(ctx);
  await ctx.db.prepare("INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) VALUES (?, ?, ?, ?, 'selected', 'closed', ?)").bind(id,aid,t.id,t.version,at).run();
  return {result:{survey:{id,assessment_id:aid,template_id:t.id,template_version:t.version,state:"selected",collection_status:"closed",created_at:at},selected:true},scope:{type:"assessment",id:aid}};
};
export const deselect:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params), row=await survey(ctx,aid,sid,"member");
  const responses=await countScalar(ctx,"SELECT COUNT(*) AS n FROM response WHERE assessment_survey_id = ?",sid);
  const codes=await countScalar(ctx,"SELECT COUNT(*) AS n FROM access_code WHERE assessment_survey_id = ?",sid);
  const invitations=await countScalar(ctx,"SELECT COUNT(*) AS n FROM invitation WHERE assessment_survey_id = ?",sid);
  if(responses||codes||invitations){
    const at=nowIso(ctx);
    await ctx.db.prepare("UPDATE assessment_survey SET state = 'archived', archived_at = ?, collection_status = 'closed' WHERE id = ?").bind(at,sid).run();
    return {result:{id:sid,archived:true,preserved_responses:responses,preserved_codes:codes,preserved_invitations:invitations,undo:null},scope:{type:"assessment",id:aid},priorState:{state:row.state,archived_at:row.archived_at}};
  }
  await ctx.db.prepare("DELETE FROM assessment_survey WHERE id = ?").bind(sid).run();
  return {result:{id:sid,deselected:true,preserved_responses:0},scope:{type:"assessment",id:aid},priorState:{survey:row}};
};
export const get_status:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params), row=await survey(ctx,aid,sid);
  const counts=await ctx.db.prepare("SELECT COUNT(*) AS responses, COUNT(DISTINCT respondent_id) AS respondents FROM response WHERE assessment_survey_id = ?").bind(sid).first<{responses:number;respondents:number}>();
  const t=await loadTemplate(ctx,row.template_id,row.template_version);
  return {result:{survey:{...row,template_name:t.name,perspective:t.perspective},counts:{responses:Number(counts?.responses??0),respondents:Number(counts?.respondents??0)}},scope:{type:"assessment",id:aid}};
};
export const print:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params), row=await survey(ctx,aid,sid,"member");
  const t=await loadTemplate(ctx,row.template_id,row.template_version);
  const lang=typeof params.lang==="string"&&params.lang?params.lang:"en";
  const items=renderItems(parseItems(t),lang);
  const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]??c));
  const html=`<!doctype html><html lang="${esc(lang)}"><meta charset="utf-8"><title>${esc(t.name)}</title><style>@media print{button{display:none}}body{font:16px system-ui;max-width:48rem;margin:2rem auto}li{margin:1.5rem 0}</style><h1>${esc(t.name)}</h1><ol>${items.map(i=>`<li>${esc(String(i.text))}<hr></li>`).join("")}</ol></html>`;
  return {result:{html,content_type:"text/html; charset=utf-8",template_id:t.id,template_version:t.version,blank:true},scope:{type:"assessment",id:aid}};
};
export const issue_link:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const invitee_hash=typeof params.invitee_hash==="string"?params.invitee_hash:null;
  const id=newId("invite"), token=randomToken("link"), at=nowIso(ctx);
  await ctx.db.prepare("INSERT INTO invitation (id,scope_type,scope_id,assessment_survey_id,role,invitee_hash,token_hash,status,created_by,created_at) VALUES (?, 'survey', ?, ?, 'participant', ?, ?, 'pending', ?, ?)").bind(id,sid,sid,invitee_hash,await sha256(token),ctx.principal.id,at).run();
  // Preparing is not disclosure; the token remains server-side until the separately confirmed send flow.
  return {result:{id,status:"pending",sent:false},scope:{type:"assessment",id:aid}};
};
export const send_links:Handler=async(ctx,params,opts)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const invitationIds=params.ids;
  if(!Array.isArray(invitationIds)||invitationIds.length===0||invitationIds.some(x=>typeof x!=="string")) throw new CapError("INVALID_PARAMS","ids must be a nonempty invitation id array");
  const impact={affected:invitationIds.map(id=>({invitation:id})),irreversible:true,effect:"external" as const,compensating_control:"cap.survey.revoke_link"};
  if(opts?.dryRun) return {result:{accepted:false,count:invitationIds.length},scope:{type:"assessment",id:aid},impact};
  // No mail transport is configured in phase 0. Never assert delivery or expose an unusable token.
  throw new CapError("RESERVED_NOT_BUILT","link delivery is not configured","No mail transport; prepared links remain unsent");
};
export const issue_codes:Handler=async(ctx,params)=>{
  only(params,["aid","sid","count"]);
  const {aid,sid}=ids(params), selected=await survey(ctx,aid,sid,"member");
  if(selected.state!=="selected") throw new CapError("STAGE_CONFLICT","archived survey cannot issue codes");
  const count=optInt(params,"count",1,1,100), batchId=newId("batch"), at=nowIso(ctx);
  const minted:{id:string;hash:string;ciphertext:string;iv:string}[]=[];
  for(let n=0;n<count;n++) {
    const id=newId("code"), code=randomCode();
    const {ciphertext,iv}=await encryptCode(ctx.env.CODE_ESCROW_SECRET,code,id,sid,batchId);
    minted.push({id,hash:await sha256(code),ciphertext,iv});
  }
  await ctx.db.batch(minted.map(c=>ctx.db.prepare("INSERT INTO access_code (id, assessment_survey_id, code_hash, code_ciphertext, code_iv, batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(c.id,sid,c.hash,c.ciphertext,c.iv,batchId,at)));
  return {result:{count,ids:minted.map(c=>c.id)},scope:{type:"assessment",id:aid}};
};
export const export_codes:Handler=async(ctx,params,opts)=>{
  only(params,["aid","sid","ids"]);
  const {aid,sid}=ids(params), selected=await survey(ctx,aid,sid,"member");
  if(selected.state!=="selected") throw new CapError("STAGE_CONFLICT","archived survey cannot export codes");
  const requested=codeIds(params), {batchId,rows}=await exactBatch(ctx,sid,requested);
  const impact={affected:[{survey:sid,code_ids:requested}],irreversible:true,effect:"disclosure" as const,compensating_control:"cap.survey.revoke_code"};
  if(opts?.dryRun) return {result:{count:rows.length,ids:requested},scope:{type:"assessment",id:aid},impact};
  // Decrypt before claiming the release; on failure nothing is marked exported.
  const codes=await Promise.all(rows.map(async r=>({id:r.id,code:await decryptCode(ctx.env.CODE_ESCROW_SECRET,r.code_ciphertext!,r.code_iv!,r.id,sid,batchId)})));
  const changed=await ctx.db.prepare("UPDATE access_code SET code_ciphertext = NULL, code_iv = NULL, exported_at = ? WHERE batch_id = ? AND assessment_survey_id = ? AND exported_at IS NULL AND redeemed_at IS NULL")
    .bind(nowIso(ctx),batchId,sid).run();
  if(changed.meta.changes!==rows.length) throw new CapError("STAGE_CONFLICT","batch changed during export","revoke and reissue");
  return {result:{count:codes.length,codes},scope:{type:"assessment",id:aid},impact};
};
export const revoke_link:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const id=reqStr(params,"id");
  const row=await ctx.db.prepare("SELECT id,status FROM invitation WHERE id = ? AND assessment_survey_id = ?").bind(id,sid).first<{id:string;status:string}>();
  if(!row) throw notVisible("link");
  await ctx.db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind(id).run();
  return {result:{id,status:"revoked"},scope:{type:"assessment",id:aid},priorState:{status:row.status}};
};
export const revoke_code:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const id=reqStr(params,"id");
  const row=await ctx.db.prepare("SELECT id,redeemed_at FROM access_code WHERE id = ? AND assessment_survey_id = ?").bind(id,sid).first<{id:string;redeemed_at:string|null}>();
  if(!row) throw notVisible("code");
  if(row.redeemed_at) throw new CapError("INVALID_PARAMS","redeemed code cannot be revoked","revoke participant session instead");
  await ctx.db.prepare("DELETE FROM access_code WHERE id = ?").bind(id).run();
  return {result:{id,revoked:true},scope:{type:"assessment",id:aid}};
};
export const handlers:Record<string,Handler>={
  "cap.survey.select":select,"cap.survey.deselect":deselect,"cap.survey.get_status":get_status,"cap.survey.print":print,
  "cap.survey.issue_link":issue_link,"cap.survey.send_links":send_links,"cap.survey.issue_codes":issue_codes,
  "cap.survey.export_codes":export_codes,"cap.survey.revoke_link":revoke_link,"cap.survey.revoke_code":revoke_code,
};
