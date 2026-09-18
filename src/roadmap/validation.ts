/** Proposed live-roadmap metadata boundary. Narrative publication is a separate reviewed path. */
export const lifecycleKinds = ['work_started','review_requested','review_findings','checks_passed','checks_failed','dev_verified','production_verified','blocked','resumed','outcome_recorded','correction','redaction'] as const;
export const stages = ['planned','built','reviewed','dev','production'] as const;
export const states = ['pending','done','blocked'] as const;
export const blockerCodes = ['awaiting_implementation','awaiting_review','review_findings','checks_failed','awaiting_deployment','awaiting_verification','awaiting_user_confirmation','dependency','unknown'] as const;
export interface PublicReference { repo: '3d-review-app'|'3d-review-cookbook'|'kitchen'; kind:'issue'|'pull'|'commit'; number?:number; sha?:string }
export interface MetadataEvent { idempotency_key:string; item_id:string; kind:typeof lifecycleKinds[number]; stage:typeof stages[number]; state:typeof states[number]; evidence:PublicReference[]; version?:string; source_sha?:string; blocker?:typeof blockerCodes[number] }
const obj=(v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const exact=(v:unknown,allowed:string[]):v is Record<string,unknown> => obj(v) && Object.keys(v).every(k=>allowed.includes(k));
const member=(v:unknown,values:readonly string[])=>typeof v==='string'&&values.includes(v);
const sha=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{40}$/.test(v);
const invalid=():never=>{throw new Error('Invalid roadmap metadata.');};
function reference(v:unknown):v is PublicReference{
 if(!exact(v,['repo','kind','number','sha'])||!member(v.repo,['3d-review-app','3d-review-cookbook','kitchen'])||!member(v.kind,['issue','pull','commit']))return false;
 return v.kind==='commit'?sha(v.sha)&&v.number===undefined:Number.isSafeInteger(v.number)&&Number(v.number)>0&&Number(v.number)<100000000&&v.sha===undefined;
}
export function metadataEvent(input:unknown):MetadataEvent{
 if(!exact(input,['idempotency_key','item_id','kind','stage','state','evidence','version','source_sha','blocker']))return invalid();
 if(typeof input.idempotency_key!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.idempotency_key)||typeof input.item_id!=='string'||!/^roadmap-[1-9][0-9]{0,7}$/.test(input.item_id)||!member(input.kind,lifecycleKinds)||!member(input.stage,stages)||!member(input.state,states)||!Array.isArray(input.evidence)||input.evidence.length>8||!input.evidence.every(reference))return invalid();
 if(input.version!==undefined&&(typeof input.version!=='string'||!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(input.version)))return invalid();
 if(input.source_sha!==undefined&&!sha(input.source_sha))return invalid();
 if(input.blocker!==undefined&&!member(input.blocker,blockerCodes))return invalid();
 if(input.state==='done'&&!input.evidence.length)return invalid();
 // Do not let the default status producer express removal or publish outcome prose.
 // Those require their separately reviewed, scoped contract paths.
 if(['redaction','correction','outcome_recorded'].includes(String(input.kind)))return invalid();
 return structuredClone(input) as unknown as MetadataEvent;
}
export function publicReferenceUrl(ref:PublicReference):string{
 if(!reference(ref))return invalid();
 return `https://github.com/klappy/${ref.repo}/${ref.kind==='issue'?'issues':ref.kind==='pull'?'pull':'commit'}/${ref.kind==='commit'?ref.sha:ref.number}`;
}
