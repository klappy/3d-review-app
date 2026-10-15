import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {attestPackedCapture} from '../src/report-capture';
import {attestCapture} from '../src/report-attestation';
import {isAttestedCapture} from '../src/report-capture';
import {renderAttestedCapture} from '../src/synthetic-report-renderer';
import {REAL_RENDERER} from '../src/synthetic-report-store';
import {renderSyntheticReport,REPORT_SCHEMA,REPORT_VERSIONS} from '../src/synthetic-report-renderer';
import {canonicalJson} from '../src/report-canonical-json';
import {ATTESTATION_TRUST} from '../src/synthetic-attestation-trust';
import fixture from './fixtures/report-build-capture-200.json';
/** Pinned on main @4877420 before the build-latency cut: payload bytes and every digest
 * must stay byte-identical on the same 200-response, 3-template participant capture. */
const PINNED={
  responses:200,
  captureDigest:'ad997e0eaf9b0de4c5d46b0079351fcaf59b7561993db5c3680572dff8a59235',
  reportKey:'29bd4b7dc6c29bee8081a1eeae2dda6a5a7050f8bf76be543842428a7035e2de',
  payloadSha256:'a12036ca0c974011f9601a36ca122de602d063945a6551beba613ab33146b8ec',
  payloadBytes:2013,
};
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
function reportKey(captureDigest:string){
  const t={sourcePin:ATTESTATION_TRUST.sourcePin,indexRoot:ATTESTATION_TRUST.indexRoot,scorerVersion:REPORT_VERSIONS.scorer,narrativeVersion:REPORT_VERSIONS.narrative,policyVersion:REPORT_VERSIONS.policy,outputSchemaVersion:REPORT_SCHEMA};
  return sha('3d-materialized-report-v1\0'+canonicalJson({schema:'3d-materialized-report-key-v1',assessmentId:fixture.assessmentId,captureDigest,indexRoot:t.indexRoot,sourcePin:t.sourcePin,scorerVersion:t.scorerVersion,narrativeVersion:t.narrativeVersion,policyVersion:t.policyVersion,outputSchemaVersion:t.outputSchemaVersion}));
}
describe('report build identity on a fixed 200-response capture',()=>{
  it('payload bytes, capture_digest, report_key and payload_sha256 match the pinned values',async()=>{
    const c=await attestPackedCapture(fixture.assessmentId,fixture.packedCapture,true);
    expect(c.eligible).toBe(true);if(!c.eligible)return;
    const r=await renderSyntheticReport(fixture.assessmentId,c.capture.rows,true);
    expect(r.eligible).toBe(true);if(!r.eligible)return;
    expect(r.captureDigest).toBe(c.capture.captureDigest);
    const payloadBytes=canonicalJson(r.payload,524288);
    expect(payloadBytes).toBe(r.payloadJson);
    const got={responses:c.capture.rows.length,captureDigest:c.capture.captureDigest,reportKey:reportKey(c.capture.captureDigest),payloadSha256:sha(payloadBytes),payloadBytes:Buffer.byteLength(payloadBytes)};
    console.log('REPORT_BUILD_IDENTITY '+JSON.stringify(got));
    expect(got).toEqual(PINNED);
  });
  it('store render/validate over the attested capture yield the same pinned bytes',async()=>{
    const c=await attestPackedCapture(fixture.assessmentId,fixture.packedCapture,true);if(!c.eligible)throw new Error('held');
    expect(isAttestedCapture(c.capture)).toBe(true);
    const payloadBytes=canonicalJson(await REAL_RENDERER.render(c.capture),524288);
    expect(sha(payloadBytes)).toBe(PINNED.payloadSha256);
    expect(await REAL_RENDERER.validate(JSON.parse(payloadBytes),c.capture)).toBe(true);
  });
  it('an object not minted by attestPackedCapture is attested in full, never trusted',async()=>{
    const c=await attestPackedCapture(fixture.assessmentId,fixture.packedCapture,true);if(!c.eligible)throw new Error('held');
    const copy={...c.capture};expect(isAttestedCapture(copy)).toBe(false);
    const same=await renderAttestedCapture(copy);expect(same.eligible&&sha(same.payloadJson)).toBe(PINNED.payloadSha256);
    const forged=await renderAttestedCapture({...c.capture,captureDigest:'0'.repeat(64)});
    expect(forged.eligible&&forged.captureDigest).not.toBe('0'.repeat(64));
    const tampered=c.capture.rows.map((r,i)=>i===0?{...r,answersRaw:'{}'}:{...r});
    await expect(REAL_RENDERER.validate(JSON.parse(canonicalJson((await renderAttestedCapture(c.capture) as any).payload)),{...c.capture,rows:tampered})).resolves.toBe(false);
  });
  it('template memo is keyed by exact bytes, not (template_id, version): one changed row template changes the digest',async()=>{
    const c=await attestPackedCapture(fixture.assessmentId,fixture.packedCapture,true);if(!c.eligible)throw new Error('held');
    const rows=c.capture.rows.map(r=>({...r}));const last=rows.length-1;
    rows[last]={...rows[last],templateRaw:rows[last].templateRaw.replace('"perspective":"','"perspective":"x')};
    expect(rows[last].templateRaw).not.toBe(c.capture.rows[last].templateRaw);
    const r=await attestCapture(fixture.assessmentId,rows,true);
    expect(r.eligible).toBe(true);if(r.eligible)expect(r.captureDigest).not.toBe(PINNED.captureDigest);
    const same=await attestCapture(fixture.assessmentId,c.capture.rows.map(r=>({...r})),true);
    expect(same.eligible&&same.captureDigest).toBe(PINNED.captureDigest);
  });
});
