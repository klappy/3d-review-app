/** Pure internal source projection. No authorization, query, storage or route. */
import { attestCapture, type CaptureRow } from './report-attestation.js';
import { parseBoundedJson, canonicalJson } from './report-canonical-json.js';
import { scoreSourceItem, type SourceItem } from './source-item-score.js';
import { rollupReference, crossLensReference, translationTypeReference, type ScoredRow, type IndicatorResult, type TranslationTypeResponse } from './reference-rollup.js';
import { buildReferenceNarrative } from './reference-narrative.js';
import model from './pinned-report-model.json';
import labels from './pinned-report-labels.json';

export const REPORT_SCHEMA = '3d-synthetic-assessment-report-v1';
export const REPORT_VERSIONS = Object.freeze({ scorer:'steve-f042cde-single-assessment-v1', narrative:'steve-f042cde-rule-narrative-v1', policy:'synthetic-current-assessment-asof-query-v1' });
export const REPORT_MAX_BYTES = 524288;
const fields = ['responseId','assessmentId','assessmentSurveyId','responseTemplateId','responseTemplateVersion','selectedTemplateId','selectedTemplateVersion','submittedAt','answersRaw','templateRaw'] as const;
function refuse():never { throw new Error('RENDER_REFUSED'); }
/** Code-point array order matches Python; canonical JSON object order stays A-owned. */
export function sourceOrder(a:string,b:string):number {
  const x=Array.from(a),y=Array.from(b);for(let i=0;i<Math.min(x.length,y.length);i++){const d=x[i].codePointAt(0)!-y[i].codePointAt(0)!;if(d)return d;}return x.length-y.length;
}
function snapshot(rows:readonly CaptureRow[]):readonly CaptureRow[] {
  if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||Object.getOwnPropertySymbols(rows).length)refuse();
  const ds=Object.getOwnPropertyDescriptors(rows) as unknown as Record<string,PropertyDescriptor>,n=ds.length?.value;
  if(!Number.isSafeInteger(n)||n<1||n>425||Object.keys(ds).length!==n+1)refuse();
  const out:CaptureRow[]=[];
  for(let i=0;i<n;i++){
    const d=ds[String(i)];if(!d||!('value'in d)||!d.enumerable)refuse();
    const r=d.value;if(!r||typeof r!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(r))||Object.getOwnPropertySymbols(r).length)refuse();
    for(const k in r)if(!Object.hasOwn(r,k))refuse();
    const props=Object.getOwnPropertyDescriptors(r);if(Object.keys(props).length!==fields.length)refuse();
    const copy:Record<string,string|number>=Object.create(null);
    for(const k of fields){const p=props[k];if(!p||!('value'in p)||!p.enumerable||!['string','number'].includes(typeof p.value))refuse();copy[k]=p.value;}
    out.push(Object.freeze(copy) as unknown as CaptureRow);
  }
  return Object.freeze(out);
}
/** Source02 cleaning flags, distinct from whether source03 assigns a score.
 * Diagnostic helper only; never public respondent output or an eligibility test. */
export function sourceInputFlags(item:SourceItem,answer:unknown):{is_missing:boolean;is_other:boolean} {
  if(answer==null||answer===''||(Array.isArray(answer)&&!answer.length))return {is_missing:true,is_other:false};
  if(item.source_type==='open-text')return {is_missing:typeof answer!=='string'||!answer.trim(),is_other:false};
  const codes=Array.isArray(answer)?answer:[answer];
  const options=codes.map(code=>item.options?.find(o=>o.code===code));
  if(options.some(o=>!o))refuse();
  return {is_missing:options.some(o=>o!.flag==='missing')||!options.length,is_other:options.some(o=>o!.flag==='other'||o!.code==='other')};
}
function boundedText(s:unknown,max=256):asserts s is string {if(typeof s!=='string'||!s.length||new TextEncoder().encode(s).length>max)refuse();}
function numeric(x:unknown):asserts x is number {if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>100)refuse();}
function count(x:unknown){if(typeof x!=='number'||!Number.isSafeInteger(x)||x<0||x>5743)refuse();}
function freeze<T>(v:T):T {if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const constructNames=new Map<string,string>();
const formTypes=new Map<string,string>();
const formCodes=new Set<string>();
for(const row of labels.constructs){boundedText(row.code);boundedText(row.name);if(constructNames.has(row.code))refuse();constructNames.set(row.code,row.name);}
for(const row of labels.forms){boundedText(row.template_id);boundedText(row.form_type);boundedText(row.label);if(formTypes.has(row.template_id)||formCodes.has(row.form_type))refuse();formTypes.set(row.template_id,row.form_type);formCodes.add(row.form_type);}
if(formTypes.size!==9||labels.source_commit!==model.commit||constructNames.size!==model.constructs.length||model.constructs.some(x=>!constructNames.has(x.code)))refuse();
function name(code:string):string {const n=constructNames.get(code);if(!n)refuse();return n;}
/** Formatting helper for independently sourced nonempty indicator fixtures. It
 * confers no trust; only renderSyntheticReport returns an attested full payload. */
export function projectStandaloneIndicators(indicators:readonly IndicatorResult[],items:ReadonlyMap<string,{item:SourceItem;lens:string}>) {
  return [...indicators].sort((a,b)=>sourceOrder(a.item_id,b.item_id)).map(ind=>{
    const found=items.get(ind.item_id);if(!found||!found.item.standalone_indicator)refuse();
    boundedText(ind.item_id);boundedText(found.lens);boundedText(found.item.group);boundedText(found.item.text,4096);numeric(ind.score);count(ind.n_responses);
    return {item_id:ind.item_id,lens:found.lens,sub_dimension:found.item.group,question_text:found.item.text,score:ind.score,n_responses:ind.n_responses};
  });
}
function assemble(aid:string,rows:readonly CaptureRow[]) {
  const scored:ScoredRow[]=[],categorical:TranslationTypeResponse[]=[];
  const itemMap=new Map<string,{item:SourceItem;lens:string}>(),evidenceCounts=new Map<string,number>();
  for(const row of rows){
    const t=parseBoundedJson(row.templateRaw,65536) as unknown as {items:SourceItem[];perspective:string};
    const answers=parseBoundedJson(row.answersRaw,8192) as Record<string,unknown>;
    const form=formTypes.get(row.selectedTemplateId);if(!form)refuse();evidenceCounts.set(form,(evidenceCounts.get(form)??0)+1);
    for(const item of t.items){
      const previous=itemMap.get(item.id);if(previous&&(canonicalJson(previous.item)!==canonicalJson(item)||previous.lens!==t.perspective))refuse();
      itemMap.set(item.id,{item,lens:t.perspective});
      const answer=Object.hasOwn(answers,item.id)?answers[item.id]:null;
      sourceInputFlags(item,answer); // preserve/validate source cleaning semantics; never add raw flags to payload
      const r=scoreSourceItem(item,answer);if(r.status==='held')refuse();
      scored.push({assessment_id:aid,item_id:item.id,lens:t.perspective,sub_dimension:item.group,score:r.score,standalone_indicator:r.standalone_indicator});
      if(['TR-Q2','ML-Q2','CHIP-Q1','CHCP-Q1','CHDL-Q1'].includes(item.id))categorical.push({assessment_id:aid,item_id:item.id,option_codes:typeof answer==='string'?[answer]:Array.isArray(answer)?answer as string[]:null});
    }
  }
  const included=new Set(model.subdimensions.filter(x=>x.included_in_lens_score).map(x=>JSON.stringify([x.lens,x.sub_dimension])));
  const rolled=rollupReference(scored,included);
  const lenses=rolled.lenses.sort((a,b)=>sourceOrder(a.lens,b.lens)).map(l=>({lens:l.lens,score:l.score,n_subdims_included:l.n_subdims_included,sub_dimensions:rolled.subdimensions.filter(s=>s.lens===l.lens).sort((a,b)=>sourceOrder(a.sub_dimension,b.sub_dimension)).map(s=>({sub_dimension:s.sub_dimension,score:s.score,n_items_included:s.n_items_included}))}));
  const cross=crossLensReference(scored,Object.fromEntries(model.constructs.filter(x=>!x.categorical).map(x=>[x.code,x.item_ids]))).map(x=>({construct_code:x.construct_code,construct_name:name(x.construct_code),triangulated_mean:x.triangulated_mean,agreement_range:x.agreement_range,n_lenses_included:x.n_lenses_included,lens_scores:x.per_lens.sort((a,b)=>sourceOrder(a.lens,b.lens))}));
  const cross_lens_multi=cross.filter(x=>x.lens_scores.length>=2).sort((a,b)=>(b.agreement_range!-a.agreement_range!)||sourceOrder(a.construct_code,b.construct_code));
  const cross_lens_single=cross.filter(x=>x.lens_scores.length===1).sort((a,b)=>sourceOrder(a.construct_code,b.construct_code));
  const standalone_indicators=projectStandaloneIndicators(rolled.indicators,itemMap);
  const cat=translationTypeReference(categorical)[0];
  const translation_type_agreement=cat?{construct_name:name('translation-type-agreement'),team_values:cat.team_values.sort(sourceOrder),church_values:cat.church_values.sort(sourceOrder),agree:cat.agree}:null;
  const evidence=[...evidenceCounts].sort((a,b)=>sourceOrder(a[0],b[0])).map(([form_type,n])=>{const entry=labels.forms.find(x=>x.form_type===form_type);if(!entry)refuse();return {form_type,label:entry.label,n};});
  const narrative=buildReferenceNarrative(lenses,cross_lens_multi.map(x=>({construct_name:x.construct_name,agreement:x.agreement_range,lens_scores:x.lens_scores})),evidence);
  const payload={schema_version:REPORT_SCHEMA,synthetic:true as const,source_commit:model.commit,versions:REPORT_VERSIONS,assessment_id:aid,lenses,cross_lens_multi,cross_lens_single,standalone_indicators,translation_type_agreement,evidence,narrative};
  if(lenses.length>3||cross.length>8||standalone_indicators.length>111||evidence.length>9||narrative.length>32)refuse();
  boundedText(aid);for(const l of lenses){boundedText(l.lens);numeric(l.score);count(l.n_subdims_included);if(l.sub_dimensions.length>17)refuse();for(const s of l.sub_dimensions){boundedText(s.sub_dimension);numeric(s.score);count(s.n_items_included);}}
  for(const c of cross){boundedText(c.construct_name);numeric(c.triangulated_mean);count(c.n_lenses_included);if(c.lens_scores.length!==c.n_lenses_included||c.lens_scores.length>3)refuse();if(c.agreement_range===null){if(c.n_lenses_included!==1)refuse();}else numeric(c.agreement_range);for(const l of c.lens_scores){boundedText(l.lens);numeric(l.score);}}
  for(const e of evidence){boundedText(e.form_type);boundedText(e.label);count(e.n);}for(const s of narrative)boundedText(s,4096);
  const payloadJson=canonicalJson(payload,REPORT_MAX_BYTES);
  return {payload:freeze(payload),payloadJson};
}
export type SyntheticReportPayload=ReturnType<typeof assemble>['payload'];
export type RenderResult={eligible:false;reason:'HELD'}|{eligible:true;payload:SyntheticReportPayload;payloadJson:string;captureDigest:string};
/** Own immutable primitive snapshot before await prevents caller mutation after
 * A's snapshot from changing rendered inputs. This still does not authorize or
 * prove DB membership: callers must use the separately reviewed B boundary. */
export async function renderSyntheticReport(expectedAssessmentId:string,rows:readonly CaptureRow[]):Promise<RenderResult> {
  try {
    const captured=snapshot(rows);
    const attested=await attestCapture(expectedAssessmentId,captured);if(!attested.eligible)return {eligible:false,reason:'HELD'};
    return {eligible:true,...assemble(expectedAssessmentId,[...captured].sort((a,b)=>sourceOrder(a.responseId,b.responseId))),captureDigest:attested.captureDigest};
  }catch{return {eligible:false,reason:'HELD'};}
}
