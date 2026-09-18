/** Confidential live-keyset cursor. A cursor never supplies assessment authority. */
import { CapError } from './handlers/errors';
import { canonicalJson } from './report-canonical-json';
import { ATTESTATION_TRUST } from './synthetic-attestation-trust';
import { REPORT_SCHEMA, REPORT_VERSIONS } from './synthetic-report-renderer';
export const REPORT_CURSOR_TTL_SECONDS = 300;
const enc = new TextEncoder();
const domain = 'report-list.v1';
const tuple = Object.freeze({sourcePin:ATTESTATION_TRUST.sourcePin,indexRoot:ATTESTATION_TRUST.indexRoot,
  scorerVersion:REPORT_VERSIONS.scorer,narrativeVersion:REPORT_VERSIONS.narrative,
  policyVersion:REPORT_VERSIONS.policy,outputSchemaVersion:REPORT_SCHEMA});
function fail():never { throw new CapError('INVALID_PARAMS', 'Invalid report cursor.'); }
function text(v:unknown):string {
  if(typeof v!=='string'||!v.length||enc.encode(v).length>256)fail();
  canonicalJson(v); return v;
}
function seconds(now:Date):number { const n=Math.floor(now.getTime()/1000);if(!Number.isSafeInteger(n))fail();return n; }
function b64(bytes:Uint8Array):string { let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64(s:string):Uint8Array {
  if(!/^[A-Za-z0-9_-]+$/.test(s)||s.length%4===1)fail();
  const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(b64(bytes)!==s)fail();return bytes;
}
async function key(secret:string):Promise<CryptoKey>{
  if(typeof secret!=='string'||!secret.length)fail();
  const material=await crypto.subtle.importKey('raw',enc.encode(secret),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('3d-report-cursor-v1'),info:enc.encode(domain)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
const aad=(actor:string,aid:string)=>enc.encode(JSON.stringify([domain,text(actor),text(aid)]));
export async function mintReportCursor(secret:string,actor:string,assessmentId:string,afterId:string,now:Date):Promise<string>{
  try{
    const body={v:1,actor:text(actor),assessmentId:text(assessmentId),...tuple,afterId:text(afterId),exp:seconds(now)+REPORT_CURSOR_TTL_SECONDS};
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128,additionalData:aad(actor,assessmentId)},await key(secret),enc.encode(canonicalJson(body))));
    const packed=new Uint8Array(iv.length+ciphertext.length);packed.set(iv);packed.set(ciphertext,12);
    const token='cur1_'+b64(packed);if(enc.encode(token).length>4096)fail();return token;
  }catch{return fail();}
}
export async function readReportCursor(secret:string,token:unknown,actor:string,assessmentId:string,now:Date):Promise<string>{
  try{
    if(typeof token!=='string'||enc.encode(token).length>4096||!token.startsWith('cur1_'))fail();
    const packed=unb64(token.slice(5));if(packed.length<29)fail();
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:packed.slice(0,12),tagLength:128,additionalData:aad(actor,assessmentId)},await key(secret),packed.slice(12));
    const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(clear);const body=JSON.parse(raw);
    const expected={v:1,actor:text(actor),assessmentId:text(assessmentId),...tuple,afterId:'',exp:0};
    if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!==Object.keys(expected).sort().join(',')||canonicalJson(body)!==raw)fail();
    for(const [k,v] of Object.entries(expected))if(k!=='afterId'&&k!=='exp'&&body[k]!==v)fail();
    const n=seconds(now);if(!Number.isSafeInteger(body.exp)||body.exp<=n||body.exp>n+REPORT_CURSOR_TTL_SECONDS)fail();
    return text(body.afterId);
  }catch{return fail();}
}
