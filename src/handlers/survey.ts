// Survey access is checked at the exact assessment grant, never project grant.
import type { Ctx, Handler, Role } from "./types";
import { CapError, notVisible } from "./errors";
import { countScalar, gate, loadTemplate, newId, nowIso, optInt, parseItems, randomToken, renderItems, reqStr, roleAt, sha256, type AssessmentRow, type SurveyRow } from "./common";

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
  await ctx.db.prepare("INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,created_at) VALUES (?, ?, ?, ?, 'selected', ?)").bind(id,aid,t.id,t.version,at).run();
  return {result:{survey:{id,assessment_id:aid,template_id:t.id,template_version:t.version,state:"selected",created_at:at},selected:true},scope:{type:"assessment",id:aid}};
};
export const deselect:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params), row=await survey(ctx,aid,sid,"member");
  const responses=await countScalar(ctx,"SELECT COUNT(*) AS n FROM response WHERE assessment_survey_id = ?",sid);
  const codes=await countScalar(ctx,"SELECT COUNT(*) AS n FROM access_code WHERE assessment_survey_id = ?",sid);
  const invitations=await countScalar(ctx,"SELECT COUNT(*) AS n FROM invitation WHERE scope_type = 'survey' AND scope_id = ?",sid);
  if(responses||codes||invitations){
    const at=nowIso(ctx);
    await ctx.db.prepare("UPDATE assessment_survey SET state = 'archived', archived_at = ? WHERE id = ?").bind(at,sid).run();
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
  const email_hash=typeof params.email_hash==="string"?params.email_hash:null;
  const id=newId("invite"), token=randomToken("link"), at=nowIso(ctx);
  await ctx.db.prepare("INSERT INTO invitation (id,scope_type,scope_id,role,email_hash,token_hash,state,created_by,created_at) VALUES (?, 'survey', ?, 'participant', ?, ?, 'prepared', ?, ?)").bind(id,sid,email_hash,await sha256(token),ctx.principal.id,at).run();
  // Preparing is not disclosure; the token remains server-side until the separately confirmed send flow.
  return {result:{id,state:"prepared",sent:false},scope:{type:"assessment",id:aid}};
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
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  // Persisting plaintext code_value is not acceptable; hashes alone cannot power later export.
  throw new CapError("RESERVED_NOT_BUILT","secure code release is not implemented","Requires encrypted-at-rest escrow or one-time confirmed disclosure");
};
export const export_codes:Handler=async(ctx,params,opts)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const count=await countScalar(ctx,"SELECT COUNT(*) AS n FROM access_code WHERE assessment_survey_id = ? AND state = 'issued'",sid);
  const impact={affected:[{survey:sid,codes:count}],irreversible:true,effect:"disclosure" as const,compensating_control:"revoke codes"};
  if(opts?.dryRun) return {result:{count},scope:{type:"assessment",id:aid},impact};
  throw new CapError("RESERVED_NOT_BUILT","secure code export is not implemented","Do not release plaintext code_value from D1");
};
export const revoke_link:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const id=reqStr(params,"id");
  const row=await ctx.db.prepare("SELECT id,state FROM invitation WHERE id = ? AND scope_type = 'survey' AND scope_id = ?").bind(id,sid).first<{id:string;state:string}>();
  if(!row) throw notVisible("link");
  await ctx.db.prepare("UPDATE invitation SET state = 'revoked' WHERE id = ?").bind(id).run();
  return {result:{id,state:"revoked"},scope:{type:"assessment",id:aid},priorState:{state:row.state}};
};
export const revoke_code:Handler=async(ctx,params)=>{
  const {aid,sid}=ids(params); await survey(ctx,aid,sid,"member");
  const id=reqStr(params,"id");
  const row=await ctx.db.prepare("SELECT id,redeemed_at FROM access_code WHERE id = ? AND assessment_survey_id = ?").bind(id,sid).first<{id:string;redeemed_at:string|null}>();
  if(!row) throw notVisible("code");
  if(row.redeemed_at) throw new CapError("INVALID_PARAMS","redeemed code cannot be revoked","revoke participant session instead");
  await ctx.db.prepare("UPDATE access_code SET state = 'revoked', code_value = NULL WHERE id = ?").bind(id).run();
  return {result:{id,revoked:true},scope:{type:"assessment",id:aid}};
};
export const handlers:Record<string,Handler>={
  "cap.survey.select":select,"cap.survey.deselect":deselect,"cap.survey.get_status":get_status,"cap.survey.print":print,
  "cap.survey.issue_link":issue_link,"cap.survey.send_links":send_links,"cap.survey.issue_codes":issue_codes,
  "cap.survey.export_codes":export_codes,"cap.survey.revoke_link":revoke_link,"cap.survey.revoke_code":revoke_code,
};
