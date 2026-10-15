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
async function attest():Promise<CapturedAssessment>{const c=await attestPackedCapture(aid,packed,true);if(!c.eligible)throw new Error('held');return c.capture;}
async function dryRun(){const c=await attest();await REAL_RENDERER.render(c);}
async function execute(){
  await attest();                                   // observeBuild
  const c=await attest();                           // commitMaterialized re-attest
  const payloadBytes=canonicalJson(await REAL_RENDERER.render(c),524288);
  if(!await REAL_RENDERER.validate(parseBoundedJson(payloadBytes,524288),c))throw new Error('invalid');
  const hash=sha(payloadBytes);
  await attest();                                   // post-commit current capture
  const original=await attest();                    // validateStored original capture
  if(sha(payloadBytes)!==hash||!await REAL_RENDERER.validate(parseBoundedJson(payloadBytes,524288),original))throw new Error('invalid');
  return hash;
}
describe.skipIf(!process.env.BENCH)('report build micro-benchmark (200 responses)',()=>{
  it('times dry_run + execute',async()=>{
    const runs=Number(process.env.BENCH_RUNS??5),times:number[]=[];
    let t=performance.now();await dryRun();const h=await execute();const first=performance.now()-t;
    for(let i=0;i<runs;i++){t=performance.now();await dryRun();expect(await execute()).toBe(h);times.push(performance.now()-t);}
    times.sort((a,b)=>a-b);
    console.log('REPORT_BUILD_BENCH '+JSON.stringify({responses:200,first_ms:Math.round(first),median_ms:Math.round(times[times.length>>1]),min_ms:Math.round(times[0]),runs,payload_sha256:h}));
  },300000);
});
