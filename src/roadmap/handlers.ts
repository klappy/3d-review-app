import type {Handler,Ctx} from '../handlers/types';
import {CapError,sha256} from '../handlers/types';
import {RoadmapStore,RoadmapConflict} from './store';
import {metadataEvent,publicReferenceUrl,stages,type PublicReference} from './validation';
const exact=(p:Record<string,unknown>,keys:string[])=>{if(Object.keys(p).some(k=>!keys.includes(k)))throw new CapError('INVALID_PARAMS','Unknown roadmap field.');};
const integer=(v:unknown,defaultValue?:number)=>{if(v===undefined&&defaultValue!==undefined)return defaultValue;const n=typeof v==='string'&&/^\d+$/.test(v)?Number(v):v;if(!Number.isSafeInteger(n)||Number(n)<0)throw new CapError('INVALID_PARAMS','Non-negative cursor required.');return Number(n);};
const gate=(ctx:Ctx,permission:'publish'|'verify'|'summary')=>{
 if(!['user','support'].includes(ctx.principal.kind))throw new CapError('NOT_AUTHENTICATED','Sign in through the existing authentication flow.');
 if(ctx.cookieAuthenticated && ctx.requestOrigin!==(ctx.env.PUBLIC_ORIGIN??ctx.requestUrlOrigin))throw new CapError('NOT_AUTHORIZED_AT_SCOPE','Same-origin publication required.');
 const raw=permission==='publish'?ctx.env.ROADMAP_PUBLISHER_IDS:permission==='verify'?ctx.env.ROADMAP_VERIFIER_IDS:ctx.env.ROADMAP_SUMMARY_REVIEWER_IDS;
 if(!raw?.split(',').map(s=>s.trim()).filter(Boolean).includes(ctx.principal.id))throw new CapError('NOT_AUTHORIZED_AT_SCOPE','Roadmap permission is required.');
};
const base=(p:Record<string,any>)=>{
 if(typeof p.item_id!=='string'||!/^roadmap-[1-9][0-9]{0,7}$/.test(p.item_id)||typeof p.idempotency_key!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.idempotency_key))throw new CapError('INVALID_PARAMS','Roadmap item and idempotency key required.');
 return {itemId:p.item_id,key:p.idempotency_key,expectedCursor:integer(p.expected_cursor)};
};
const evidence=(v:unknown):PublicReference[]=>{
 if(!Array.isArray(v)||!v.length||v.length>8)throw new CapError('INVALID_PARAMS','Public evidence required.');
 try{v.forEach(publicReferenceUrl);}catch{throw new CapError('INVALID_PARAMS','Invalid public evidence.');}return v;
};
const links=(refs:PublicReference[])=>refs.map(r=>({label:`${r.repo} ${r.kind} ${r.number??r.sha?.slice(0,7)}`,url:publicReferenceUrl(r)}));
const text=(v:unknown,max=500)=>{if(typeof v!=='string'||!v.length||v.length>max||/[<>]|https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|Bearer\s+|github_pat_|gh[pousr]_|(?:actor|tenant|trace|session|token)[_-]?(?:id)?\s*[:=]|\+?\d[\d ().-]{8,}\d/i.test(v))throw new CapError('INVALID_PARAMS','Reviewed public summary required.');return v;};
function blank(id:string,at:string){return {id,title:`Work item #${id.slice(8)}`,version:null,updated_at:at,remaining:'No verified completion recorded.',links:[{label:'Issue',url:`https://github.com/klappy/3d-review-app/issues/${id.slice(8)}`}],provenance:{feedback:'No reviewed summary published.',priority:'No reviewed rationale published.',scope:'No reviewed scope published.',outcome:'Unmeasured.',recurrence:'Unknown.'},history:[],history_count:0,stages:Object.fromEntries(stages.map(s=>[s,{state:'pending',reason:'No verifier attestation recorded.',evidence:[]}]))};}
const history=(item:any,at:string,kind:string,summary:string,refs:PublicReference[],seq:number)=>{
 item.updated_at=at;item.history_count=(item.history_count??0)+1;item.history=[...(item.history??[]),{id:'event-'+seq,at,kind,summary,links:links(refs),corrects:null}].slice(-20);
};
async function write(ctx:Ctx,p:Record<string,any>,opts:any,permission:'publish'|'verify'|'summary',build:(store:RoadmapStore,at:string)=>Promise<{publicEvent:Record<string,unknown>;item?:Record<string,unknown>;redact?:boolean}>){
 gate(ctx,permission);const b=base(p),store=new RoadmapStore(ctx.db),hash=await sha256(JSON.stringify(p));
 const prior=await store.receipt(b.key,ctx.principal.id,hash);if(prior&&!opts?.dryRun)return {result:prior};
 const at=ctx.now().toISOString(),change=await build(store,at);
 if(opts?.dryRun)return {result:{item_id:b.itemId,publication:'Public roadmap change; narrative requires independent review.'},impact:{affected:[{item_id:b.itemId}],irreversible:true,effect:'disclosure' as const,compensating_control:'Authorized redaction removes public replay; external copies cannot be recalled.'}};
 gate(ctx,permission);
 try{return {result:await store.append({...b,at,actor:ctx.principal.id,requestHash:hash,restrictedProvenance:{delegated:!!ctx.principal.delegatedBy,permission},...change})};}
 catch(e){if(e instanceof RoadmapConflict)throw new CapError('STAGE_CONFLICT',e.message);throw e;}
}
export const read:Handler=async(ctx,p)=>{
 exact(p,['after','item_after','limit']);const after=integer(p.after,0),limit=integer(p.limit,100);if(limit<1||limit>100||p.item_after!==undefined&&(typeof p.item_after!=='string'||!/^roadmap-[1-9][0-9]{0,7}$/.test(p.item_after)))throw new CapError('INVALID_PARAMS','Invalid page.');
 return {result:{...(await new RoadmapStore(ctx.db).read(after,p.item_after??'',limit)),source_mode:ctx.env.ENVIRONMENT==='production'?'production_canonical':'dev_provisional'}};
};
export const historyRead:Handler=async(ctx,p)=>{
 exact(p,['id','after','limit']);if(typeof p.id!=='string'||!/^roadmap-[1-9][0-9]{0,7}$/.test(p.id))throw new CapError('INVALID_PARAMS','Invalid roadmap item.');const limit=integer(p.limit,25);if(limit<1||limit>100)throw new CapError('INVALID_PARAMS','Invalid page.');return {result:await new RoadmapStore(ctx.db).history(p.id,integer(p.after,0),limit)};
};
export const publish:Handler=async(ctx,p,opts)=>{
 exact(p,['expected_cursor','event']);let event;try{event=metadataEvent(p.event);}catch{throw new CapError('INVALID_PARAMS','Invalid roadmap metadata.');}
 const input={...event,expected_cursor:p.expected_cursor};
 return write(ctx,input,opts,'publish',async(store,at)=>{const item=await store.item(event.item_id)??blank(event.item_id,at);const {idempotency_key,...claim}=event;
 const attribution=ctx.principal.delegatedBy?'agent_report':'operator_report';
 history(item,at,'decision',`Publisher claim: ${event.kind.replaceAll('_',' ')}. This does not verify stage completion.`,event.evidence,integer(p.expected_cursor)+1);
 return {item,publicEvent:{kind:'claim',attribution,claim}};});
};
export const summary:Handler=async(ctx,p,opts)=>{
 exact(p,['expected_cursor','idempotency_key','item_id','summary','publication_review']);
 if(!p.summary||typeof p.summary!=='object'||Array.isArray(p.summary))throw new CapError('INVALID_PARAMS','Reviewed summary required.');
 exact(p.summary,['title','feedback','priority','scope','outcome','recurrence']);const s=Object.fromEntries(['title','feedback','priority','scope','outcome','recurrence'].map(k=>[k,text(p.summary[k],k==='title'?150:500)]));const refs=evidence(p.publication_review);
 return write(ctx,p,opts,'summary',async(store,at)=>{const item=await store.item(p.item_id)??blank(p.item_id,at);item.title=s.title;item.provenance={feedback:s.feedback,priority:s.priority,scope:s.scope,outcome:s.outcome,recurrence:s.recurrence};
 history(item,at,'decision','Reviewed public summary published; review reference is a publisher attestation.',refs,integer(p.expected_cursor)+1);
 return {item,publicEvent:{kind:'summary',attribution:'publication_reviewer_attestation',review:refs,summary:s}};});
};
export const verify:Handler=async(ctx,p,opts)=>{
 exact(p,['expected_cursor','idempotency_key','item_id','event_sequence','evidence','attestation']);const sequence=integer(p.event_sequence),refs=evidence(p.evidence);
 if(p.attestation!=='independently_checked')throw new CapError('INVALID_PARAMS','Explicit independent verification attestation required.');
 return write(ctx,p,opts,'verify',async(store,at)=>{const event=await store.event(sequence),actor=await store.actor(sequence);if(!event||event.item_id!==p.item_id||event.value.kind!=='claim')throw new CapError('NOT_FOUND_OR_NOT_VISIBLE','Claim is not available.');
 if(actor===ctx.principal.id)throw new CapError('NOT_AUTHORIZED_AT_SCOPE','A publisher cannot verify their own claim.');
 const claim=event.value.claim,item=await store.item(p.item_id);if(!item)throw new CapError('NOT_FOUND_OR_NOT_VISIBLE','Item is not available.');
 const index=stages.indexOf(claim.stage);if(claim.state==='done'&&stages.slice(0,index).some(k=>item.stages[k].state!=='done'))throw new CapError('STAGE_CONFLICT','Earlier stages need verifier acceptance first.');
 item.stages[claim.stage]={state:claim.state,reason:'Authorized independent verifier attestation; not automatic provider verification.',evidence:links(refs)};if(claim.version)item.version=claim.version;
 item.remaining=claim.state==='blocked'?`Blocked: ${String(claim.blocker??'unknown').replaceAll('_',' ')}.`:'See pending stages and evidence. User outcome remains separately recorded.';
 history(item,at,'review','Independent verifier attested to the referenced claim and evidence.',refs,integer(p.expected_cursor)+1);
 return {item,publicEvent:{kind:'verification_attestation',claim_sequence:sequence,stage:claim.stage,state:claim.state,evidence:refs}};});
};
export const redact:Handler=async(ctx,p,opts)=>{
 exact(p,['expected_cursor','idempotency_key','item_id']);
 return write(ctx,p,opts,'summary',async()=>({redact:true,publicEvent:{kind:'redaction',notice:'Public content removed. Refresh the current projection.'}}));
};
export const handlers:Record<string,Handler>={'cap.ops.roadmap_read':read,'cap.ops.roadmap_history':historyRead,'cap.ops.roadmap_publish':publish,'cap.ops.roadmap_summary':summary,'cap.ops.roadmap_verify':verify,'cap.ops.roadmap_redact':redact};
