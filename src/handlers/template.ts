import type { Handler } from "./types";
import { CapError } from "./errors";
import { loadTemplate, nowIso, optInt, parseItems, renderItems, reqStr, requireSupport, requireUser, type TemplateRow } from "./common";

function meta(t: TemplateRow) { return { id:t.id, version:t.version, name:t.name, perspective:t.perspective, source_ref:t.source_ref, published_at:t.published_at }; }
export const list: Handler = async ctx => {
  requireUser(ctx);
  const {results} = await ctx.db.prepare("SELECT id, version, name, perspective, source_ref, published_at FROM survey_template WHERE published_at IS NOT NULL ORDER BY name, version DESC").all<TemplateRow>();
  return {result:{templates:results.map(meta)}};
};
export const get: Handler = async (ctx,params) => {
  requireUser(ctx);
  const id=reqStr(params,"id"), version=optInt(params,"ver",0,0);
  const row=await loadTemplate(ctx,id,version || undefined);
  return {result:{template:{...meta(row),items:parseItems(row)}}};
};
export const render: Handler = async (ctx,params) => {
  const id=reqStr(params,"id"), version=optInt(params,"ver",0,0);
  const row=await loadTemplate(ctx,id,version || undefined);
  const lang=typeof params.lang==="string" && params.lang ? params.lang : "en";
  return {result:{template:meta(row),lang,items:renderItems(parseItems(row),lang)}};
};
export const publish_version: Handler = async (ctx,params,opts) => {
  requireSupport(ctx);
  const id=reqStr(params,"id"), name=reqStr(params,"name"), perspective=reqStr(params,"perspective");
  const items=params.items, scoring=params.scoring;
  if(!Array.isArray(items)||!scoring||typeof scoring!=="object"||Array.isArray(scoring)) throw new CapError("INVALID_PARAMS","items array and scoring object required");
  const source_ref=reqStr(params,"source_ref");
  const row=await ctx.db.prepare("SELECT MAX(version) AS version FROM survey_template WHERE id = ?").bind(id).first<{version:number|null}>();
  const version=Number(row?.version??0)+1;
  const impact={affected:[{template:id,new_version:version}],irreversible:true,effect:"destructive" as const,retention:"Published versions are immutable; a later version supersedes rather than overwrites"};
  if(opts?.dryRun) return {result:{template_id:id,version},scope:{type:"platform",id},impact};
  const at=nowIso(ctx);
  await ctx.db.prepare("INSERT INTO survey_template (id, version, name, perspective, source_ref, items_json, scoring_json, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id,version,name,perspective,source_ref,JSON.stringify(items),JSON.stringify(scoring),at).run();
  return {result:{template:{id,version,name,perspective,source_ref,published_at:at}},scope:{type:"platform",id},impact};
};
export const handlers:Record<string,Handler>={"cap.template.list":list,"cap.template.get":get,"cap.template.render":render,"cap.template.publish_version":publish_version};
