/** Local micro-benchmark of the report build path (no D1): replays the attest/render/validate
 * sequence one cap.report.build (dry_run + execute) runs in synthetic-report-store.ts on a fixed
 * 200-response capture. Run: BENCH=1 npx vitest run test/report-build.bench.test.ts */
import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {attestPackedCapture,type CapturedAssessment} from '../src/report-capture';
import {canonicalJson,parseBoundedJson} from '../src/report-canonical-json';
import {REAL_RENDERER} from '../src/synthetic-report-store';
import fixture from './fixtures/report-build-capture-200.json';
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const aid=fixture.assessmentId,packed=fixture.packedCapture;
/** Per-stage CPU marks: same `report.stage` {stage, ms} span shape the store emits through ctx.log
 * (synthetic-report-store.ts stageSpan). The Node clock advances during CPU work, so these give the CPU
 * split that DEV spans cannot (Workers clocks move only across I/O). */
type Span={stage:string,ms:number};
let spans:Span[]=[];
const log=(name:string,data:Span)=>{if(name==='report.stage')spans.push(data);};
async function mark<T>(stage:string,f:()=>T|Promise<T>):Promise<T>{const t0=performance.now();const r=await f();log('report.stage',{stage,ms:performance.now()-t0});return r;}
async function attestRaw():Promise<CapturedAssessment>{const c=await attestPackedCapture(aid,packed,true);if(!c.eligible)throw new Error('held');return c.capture;}
const attest=(stage:string)=>mark(stage,attestRaw);
async function dryRun(){const c=await attest('attest_observe');await mark('render_preview',()=>REAL_RENDERER.render(c));}
async function execute(){
  await attest('attest_observe');                   // observeBuild
  const c=await attest('attest_commit');            // commitMaterialized re-attest
  const rendered=await mark('render',()=>REAL_RENDERER.render(c));
  const payloadBytes=await mark('canonicalize',()=>canonicalJson(rendered,524288));
  if(!await mark('validate',()=>REAL_RENDERER.validate(parseBoundedJson(payloadBytes,524288),c)))throw new Error('invalid');
  const hash=await mark('hash',()=>sha(payloadBytes));
  await attest('attest_current');                   // post-commit current capture
  const ok=await mark('validate_stored',async()=>{const original=await attestRaw();return sha(payloadBytes)===hash&&await REAL_RENDERER.validate(parseBoundedJson(payloadBytes,524288),original);});
  if(!ok)throw new Error('invalid');
  return hash;
}
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return a[a.length>>1];};
describe.skipIf(!process.env.BENCH)('report build micro-benchmark (200 responses)',()=>{
  it('times dry_run + execute',async()=>{
    const runs=Number(process.env.BENCH_RUNS??5),times:number[]=[];
    let t=performance.now();await dryRun();const h=await execute();const first=performance.now()-t;
    for(let i=0;i<runs;i++){t=performance.now();await dryRun();expect(await execute()).toBe(h);times.push(performance.now()-t);}
    const perRun:Record<string,number>[]=[];
    for(let i=0;i<runs;i++){spans=[];await dryRun();await execute();const r:Record<string,number>={};spans.forEach((sp,j)=>{r[(j<2?'dry.':'exec.')+sp.stage]=sp.ms;});perRun.push(r);}  // dry_run emits 2 spans, execute 8
    const stages:Record<string,number>={};for(const k of Object.keys(perRun[0]))stages[k]=Math.round(median(perRun.map(r=>r[k]))*10)/10;
    times.sort((a,b)=>a-b);
    console.log('REPORT_BUILD_BENCH '+JSON.stringify({responses:200,first_ms:Math.round(first),median_ms:Math.round(times[times.length>>1]),min_ms:Math.round(times[0]),runs,payload_sha256:h}));
    console.log('REPORT_BUILD_STAGES '+JSON.stringify({responses:200,runs,stat:'median_cpu_ms',stages}));
  },300000);
});
