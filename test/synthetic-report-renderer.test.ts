import {beforeAll,describe,it,expect,vi} from 'vitest';
import {buildIndex,readPinnedSources} from '../tools/build-synthetic-attestation';
import {renderSyntheticReport,sourceInputFlags,sourceOrder,projectStandaloneIndicators,REPORT_SCHEMA,REPORT_VERSIONS} from '../src/synthetic-report-renderer';
import {buildReferenceNarrative} from '../src/reference-narrative';
import {rollupReference} from '../src/reference-rollup';
import {canonicalJson} from '../src/report-canonical-json';
import type {CaptureRow} from '../src/report-attestation';
import type {SourceItem} from '../src/source-item-score';
import fixture from './fixtures/synthetic-report-renderer-v1.json';
import labels from '../src/pinned-report-labels.json';
let captures:CaptureRow[],templates:any[];
let groups:Map<string,CaptureRow[]>;
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const held={eligible:false,reason:'HELD'};
beforeAll(async()=>{const input=await readPinnedSources();templates=input.templates;captures=(await buildIndex(input.records,input.templates)).captures;groups=Map.groupBy(captures,x=>x.assessmentId);},20000);
/** Field sets/null/string/array order exact; established independent scalar
 * oracle tolerance accounts for Python/Pandas vs JS sum evaluation only. */
function equivalent(actual:any,expected:any,path='root'){
 if(typeof expected==='number'){expect(typeof actual,path).toBe('number');expect(Number.isFinite(actual),path).toBe(true);expect(Math.abs(actual-expected),path).toBeLessThanOrEqual(1e-8);return;}
 if(Array.isArray(expected)){expect(Array.isArray(actual),path).toBe(true);expect(actual.length,path).toBe(expected.length);for(let i=0;i<expected.length;i++)equivalent(actual[i],expected[i],path+'['+i+']');return;}
 if(expected&&typeof expected==='object'){expect(Object.keys(actual).sort(),path).toEqual(Object.keys(expected).sort());for(const k of Object.keys(expected))equivalent(actual[k],expected[k],path+'.'+k);return;}
 expect(actual,path).toBe(expected);
}
describe('C1 source assembly, distinct from reporting authorization',()=>{
 it('all34 complete attested captures match original source07 assembly',async()=>{
  expect(groups.size).toBe(34);expect(captures.length).toBe(425);let max=0,strings=0;
  for(const [aid,rows]of groups){const result=await renderSyntheticReport(aid,rows);expect(result.eligible,aid).toBe(true);if(!result.eligible)throw new Error('gold refused');
   const {schema_version,synthetic,source_commit,versions,assessment_id,...body}=result.payload;
   expect({schema_version,synthetic,source_commit,versions,assessment_id}).toEqual({schema_version:REPORT_SCHEMA,synthetic:true,source_commit:fixture.source_commit,versions:REPORT_VERSIONS,assessment_id:aid});
   equivalent(body,fixture.contexts[aid as keyof typeof fixture.contexts],aid);
   expect(result.payloadJson).toBe(canonicalJson(result.payload));max=Math.max(max,Buffer.byteLength(result.payloadJson));strings+=body.narrative.length;
   expect(Object.isFrozen(result.payload)).toBe(true);expect(Object.isFrozen(result.payload.lenses)).toBe(true);
   const repeated=await renderSyntheticReport(aid,[...rows].reverse());expect(repeated.eligible).toBe(true);if(repeated.eligible)expect(repeated.payloadJson).toBe(result.payloadJson);
  }
  console.log('C1_ASSEMBLY '+JSON.stringify({assessments:groups.size,responses:captures.length,narrativeStrings:strings,maxPayloadBytes:max,source:fixture.source_commit}));
 });
 it('retains exact5743source cleaning flags separately from score eligibility',()=>{
  const observed:any[]=[];
  for(const r of captures){const t=JSON.parse(r.templateRaw),answers=JSON.parse(r.answersRaw);for(const item of t.items){const flag=sourceInputFlags(item,answers[item.id]??null);observed.push([r.responseId,item.id,flag.is_missing,flag.is_other]);}}
  const order=(a:any[],b:any[])=>sourceOrder(a[0],b[0])||sourceOrder(a[1],b[1]);
  expect(observed.sort(order)).toEqual(clone(fixture.flags).sort(order));
  expect(observed.filter(x=>x[2])).toHaveLength(960);expect(observed.filter(x=>x[3])).toHaveLength(54);
 });
 it('source labels cover exact8constructs/9templates without guessed names',()=>{
  expect(labels.constructs).toHaveLength(8);expect(new Set(labels.constructs.map(x=>x.code)).size).toBe(8);expect(labels.forms).toHaveLength(9);
  expect(labels.forms.map(x=>x.template_id).sort()).toEqual(templates.map(x=>x.id).sort());
  expect(labels.source_sha256['survey-pipeline/pipeline/07_language_report.py']).toBe(fixture.provenance['survey-pipeline/pipeline/07_language_report.py']);
 });
 it('nonempty standalone indicator matches source04+source07 helper fixture without extending A trust',()=>{
  const item=JSON.parse(templates.find(t=>t.id==='tpl_mid_level').items_json).find((x:any)=>x.id==='ML-Q10') as SourceItem;
  const rows=fixture.indicator_fixture.input_scores.map(score=>({assessment_id:'fixture_only',item_id:item.id,lens:'Translation Team',sub_dimension:item.group,score,standalone_indicator:true}));
  const rolled=rollupReference(rows,new Set());expect(rolled.lenses).toEqual([]);expect(rolled.subdimensions).toEqual([]);expect(rolled.indicators).toHaveLength(1);
  expect(projectStandaloneIndicators(rolled.indicators,new Map([[item.id,{item,lens:'Translation Team'}]]))).toEqual([fixture.indicator_fixture.expected]);
 });
 it('exact source narrative ties, half-even rounding and empty states',()=>{
  for(const f of fixture.narrative_edge_fixtures)expect(buildReferenceNarrative(f.lenses,f.cross,f.evidence)).toEqual(f.narrative);
  expect(['\u{10000}','\ue000','A'].sort(sourceOrder)).toEqual(['A','\ue000','\u{10000}']);
 });
 it('no respondent records/raw inputs/context decorations enter the output',async()=>{
  const [aid,rows]=[...groups][0],r=await renderSyntheticReport(aid,rows);expect(r.eligible).toBe(true);if(!r.eligible)throw new Error('gold');
  for(const key of ['response_id','responseId','answersRaw','templateRaw','project_name','cycle_date','medium','scripture_portion','snapshot_id','report_id'])expect(r.payloadJson).not.toContain('"'+key+'"');
  for(const row of rows)expect(r.payloadJson).not.toContain(row.responseId);
 });
});
describe('C1 actual attestation and immutable input boundary',()=>{
 it('refuses changed metadata, answers, templates, unknown rows and targets',async()=>{
  const [aid,rows]=[...groups][0];
  for(const field of ['responseId','assessmentSurveyId','submittedAt','answersRaw','templateRaw'] as const){const changed=clone(rows);changed[0][field]+='changed';expect(await renderSyntheticReport(aid,changed)).toEqual(held);}
  expect(await renderSyntheticReport('wrong',rows)).toEqual(held);expect(await renderSyntheticReport(aid,[])).toEqual(held);
  const duplicate=[...rows,rows[0]];expect(await renderSyntheticReport(aid,duplicate)).toEqual(held);
 });
 it('snapshots primitive descriptors before await; no getters or fake eligible flags',async()=>{
  const [aid,rows]=[...groups][0];let read=0;
  const getter=clone(rows);Object.defineProperty(getter[0],'answersRaw',{enumerable:true,get(){read++;return rows[0].answersRaw;}});
  expect(await renderSyntheticReport(aid,getter)).toEqual(held);expect(read).toBe(0);
  const extra=clone(rows) as any;extra[0].eligible=true;expect(await renderSyntheticReport(aid,extra)).toEqual(held);
  const changing=clone(rows);const pending=renderSyntheticReport(aid,changing);changing[0].answersRaw='{}';changing.pop();
  const result=await pending;expect(result.eligible).toBe(true);const original=await renderSyntheticReport(aid,rows);if(result.eligible&&original.eligible)expect(result.payloadJson).toBe(original.payloadJson);
 });
 it('does not read clock/random/network or accept new helper fixtures as public data',async()=>{
  const [aid,rows]=[...groups][0];
  const clock=vi.spyOn(Date,'now').mockImplementation(()=>{throw new Error('clock forbidden')});
  const random=vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('random forbidden')});
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(()=>{throw new Error('network forbidden')});
  const locale=vi.spyOn(String.prototype,'localeCompare').mockImplementation(()=>{throw new Error('locale forbidden')});
  try{expect((await renderSyntheticReport(aid,rows)).eligible).toBe(true);}finally{clock.mockRestore();random.mockRestore();fetch.mockRestore();locale.mockRestore();}
  const nonGold=clone(rows);nonGold[0].responseId='helper-indicator';expect(await renderSyntheticReport(aid,nonGold)).toEqual(held);
 });
 it('documents attestation does not establish complete authorized membership',async()=>{
  const [aid,rows]=[...groups][0];expect((await renderSyntheticReport(aid,rows.slice(0,1))).eligible).toBe(true);
  // Deliberate negative control: a known subset is source-valid. Only B's guarded
  // complete SELECT/current-grant boundary makes the eventual public use safe.
 });
});

describe('compiled source label refusal',()=>{
 it('rejects missing/duplicate source mappings instead of guessing labels',async()=>{
  for(const change of [(x:any)=>x.constructs.pop(),(x:any)=>x.constructs.push(x.constructs[0]),(x:any)=>x.forms.pop(),(x:any)=>x.forms[1].form_type=x.forms[0].form_type,(x:any)=>x.constructs[0].name='']){
   const bad=clone(labels);change(bad);vi.resetModules();vi.doMock('../src/pinned-report-labels.json',()=>({default:bad}));
   try{await expect(import('../src/synthetic-report-renderer')).rejects.toThrow('RENDER_REFUSED');}
   finally{vi.doUnmock('../src/pinned-report-labels.json');vi.resetModules();}
  }
 });
});
