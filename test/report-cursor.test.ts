import { describe,it,expect } from 'vitest';
import {mintReportCursor,readReportCursor,REPORT_CURSOR_TTL_SECONDS} from '../src/report-cursor';
import {REPORT_SCHEMA,REPORT_VERSIONS} from '../src/synthetic-report-renderer';
import {ATTESTATION_TRUST} from '../src/synthetic-attestation-trust';
import {canonicalJson} from '../src/report-canonical-json';
const now=new Date('2026-09-17T07:00:00Z'),secret='synthetic raw secret, not base64',actor='staff',aid='assessment',after='report-last-disclosed';
const error={code:'INVALID_PARAMS',message:'Invalid report cursor.'};
const enc=new TextEncoder();
async function forged(changes:Record<string,unknown>,domain='report-list.v1',raw?:string){
 const body={v:1,actor,assessmentId:aid,sourcePin:ATTESTATION_TRUST.sourcePin,indexRoot:ATTESTATION_TRUST.indexRoot,scorerVersion:REPORT_VERSIONS.scorer,narrativeVersion:REPORT_VERSIONS.narrative,policyVersion:REPORT_VERSIONS.policy,outputSchemaVersion:REPORT_SCHEMA,afterId:after,exp:Math.floor(now.getTime()/1000)+300,...changes};
 const material=await crypto.subtle.importKey('raw',enc.encode(secret),'HKDF',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('3d-report-cursor-v1'),info:enc.encode(domain)},material,{name:'AES-GCM',length:256},false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(JSON.stringify([domain,actor,aid])),tagLength:128},key,enc.encode(raw??canonicalJson(body)));
 return 'cur1_'+Buffer.concat([Buffer.from(iv),Buffer.from(ct)]).toString('base64url');
}
describe('confidential strict report cursor',()=>{
 it('roundtrips raw configured secret and observes unique96-bit nonces without plaintext IDs',async()=>{
  expect(REPORT_CURSOR_TTL_SECONDS).toBe(300);const tokens=await Promise.all(Array.from({length:64},()=>mintReportCursor(secret,actor,aid,after,now)));
  expect(new Set(tokens.map(t=>Buffer.from(t.slice(5),'base64url').subarray(0,12).toString('hex'))).size).toBe(64);
  for(const t of tokens){expect(await readReportCursor(secret,t,actor,aid,now)).toBe(after);expect(Buffer.from(t.slice(5),'base64url').includes(Buffer.from(after))).toBe(false);}
 });
 it('uniformly rejects tamper, bindings, secret rotation, empty configuration and lifetime boundaries',async()=>{
  const token=await mintReportCursor(secret,actor,aid,after,now);
  for(const args of [[secret,token+'!',actor,aid,now],['rotated',token,actor,aid,now],['',token,actor,aid,now],[secret,token,'other',aid,now],[secret,token,actor,'other',now],[secret,token,actor,aid,new Date(now.getTime()+300000)],[secret,token,actor,aid,new Date(now.getTime()-1000)],[secret,'cur1_'+ 'A'.repeat(4096),actor,aid,now],[secret,'cur1_A',actor,aid,now],[secret,42,actor,aid,now]]){
   try{await readReportCursor(...args as Parameters<typeof readReportCursor>);throw Error('accepted');}catch(e:any){expect(e).toMatchObject(error);expect(e.hint).toBeUndefined();expect(e.docs).toBeUndefined();}
  }
  await expect(mintReportCursor('',actor,aid,after,now)).rejects.toMatchObject(error);
 });
 it('rejects validly encrypted wrong domain/version/shape/expiry and noncanonical JSON',async()=>{
  for(const token of await Promise.all([forged({v:2}),forged({sourcePin:'wrong'}),forged({policyVersion:'wrong'}),forged({exp:Math.floor(now.getTime()/1000)+301}),forged({exp:1}),forged({extra:1}),forged({afterId:''}),forged({actor:'wrong'}),forged({},'other-domain'),forged({},'report-list.v1','{"v":1,"v":1}')]))await expect(readReportCursor(secret,token,actor,aid,now)).rejects.toMatchObject(error);
 });
});
