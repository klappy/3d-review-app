/** Internal preparation only. No route/capability registration; D7 disclosure remains held. */
import type { Ctx } from './handlers/types';
import { gate, roleAt } from './handlers/common';
import { notVisible } from './handlers/errors';
import { perspectiveLevelMinimum } from './report-admission';
import { canonicalJson } from './report-canonical-json';
export type Question = {id:string;text:string;kind:'single'|'multi'|'text';options:{code:string;text:string;missing?:boolean}[]};
export type AggregateInput = {snapshotId:string;population:'synthetic'|'participant';perspective:string;questions:Question[];rows:ReadonlyArray<{source:'synthetic'|'participant';answers:Readonly<Record<string,unknown>>}>};
const fail=():never=>{throw new Error('QUESTION_RESULTS_HELD');};
/** Server-only computation, not authority to disclose. Input rows never appear in the result. */
export function prepareQuestionResults(input:AggregateInput, minimum:number) {
  if(!Number.isInteger(minimum)||minimum<1||!input.snapshotId||!['synthetic','participant'].includes(input.population)||!input.perspective||input.rows.length>425)fail();
  if(input.rows.some(row=>row.source!==input.population)||input.questions.length>200)fail();
  const ids=new Set<string>();
  const questions=input.questions.map(q=>{
    if(!q.id||ids.has(q.id)||!q.text||!['single','multi','text'].includes(q.kind))fail();ids.add(q.id);
    const codes=new Set(q.options.map(o=>o.code));if(codes.size!==q.options.length||q.options.some(o=>!o.code||!o.text))fail();
    // Text and companion Other fields are intentionally absent, including their values and lengths.
    if(q.kind==='text')return {id:q.id,text:q.text,kind:q.kind,status:'excerpts-held' as const};
    const counts=new Map(q.options.filter(o=>!o.missing).map(o=>[o.code,0]));let answered=0;
    for(const row of input.rows){
      const raw=row.answers[q.id];if(raw===undefined||raw===null||raw===''||(Array.isArray(raw)&&raw.length===0))continue;
      if(q.kind==='single'&&typeof raw!=='string')fail();
      if(q.kind==='multi'&&!Array.isArray(raw))fail();
      const selected=q.kind==='single'?[raw as string]:raw as unknown[];
      if(selected.some(c=>typeof c!=='string'||!codes.has(c))||new Set(selected).size!==selected.length)fail();
      const missing=selected.some(c=>q.options.find(o=>o.code===c)?.missing);
      if(missing){if(selected.length!==1)fail();continue;}
      answered++;for(const c of selected)counts.set(c as string,(counts.get(c as string)||0)+1);
    }
    const missing=input.rows.length-answered;
    // Conservative whole-question hold: no complementary small cell, missing-count or zero-cell leakage.
    const held=input.rows.length<minimum||answered<minimum||(missing>0&&missing<minimum)||[...counts.values()].some(n=>n>0&&n<minimum);
    if(held)return {id:q.id,text:q.text,kind:q.kind,status:'held' as const};
    return {id:q.id,text:q.text,kind:q.kind,status:'ready' as const,answered,missing,options:q.options.filter(o=>!o.missing).map(o=>({text:o.text,count:counts.get(o.code)!,percentage:Math.round(100*counts.get(o.code)!/answered)}))};
  });
  const model={schema:'question-results-preparation-v1',snapshotId:input.snapshotId,population:input.population,perspective:input.perspective,minimum,questions};
  // Canonical serialized copy binds the exact population and counts; caller mutation cannot change the snapshot.
  return canonicalJson(model);
}
/** Apply the existing Results assessment/viewer gate on every call, including after grant revocation.
 * There is deliberately no data query or override that can turn today's held policy into public cells. */
export async function readQuestionResults(ctx:Ctx,aid:string){
  const assessment=await ctx.db.prepare('SELECT id, stage FROM assessment WHERE id = ?').bind(aid).first();
  if(!assessment)throw notVisible('assessment');
  gate(await roleAt(ctx,'assessment',aid),'viewer','assessment');
  return {suppressed:true as const,status:'held' as const,reason:'Question-level disclosure policy remains held.',minimum:perspectiveLevelMinimum(ctx.env),excerpts:'held' as const};
}
