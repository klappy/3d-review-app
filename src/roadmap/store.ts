/** Transactional store. Public reads select only explicit projection columns, never audit. */
export interface Clock { revision:number; generation:number }
export interface StoredEvent { seq:number; item_id:string; recorded_at:string; public_json:string|null }
export interface PublicItem { id:string; public_json:string|null; updated_seq:number }
export class RoadmapConflict extends Error {}
export interface AppendInput {
 expectedCursor:number; key:string; itemId:string; at:string; actor:string; requestHash:string;
 publicEvent:Record<string,unknown>; restrictedProvenance:Record<string,unknown>;
 /** Already validated reviewed summary or verifier materialization, never raw caller JSON. */
 item?:Record<string,unknown>; redact?:boolean;
}
export class RoadmapStore {
 constructor(private db:D1Database){}
 async receipt(key:string,actor:string,hash:string){
  const row=await this.db.prepare('SELECT e.seq, a.actor, a.request_hash FROM roadmap_event e JOIN roadmap_audit a ON a.seq=e.seq WHERE e.idempotency_key=?').bind(key).first<{seq:number;actor:string;request_hash:string}>();
  if(!row)return null;
  if(row.actor!==actor||row.request_hash!==hash)throw new RoadmapConflict('Idempotency key conflict.');
  // Minimal receipt only: old payload is never reconstructed after a redaction.
  return {sequence:row.seq,replayed:true};
 }
 async append(p:AppendInput){
  const prior=await this.receipt(p.key,p.actor,p.requestHash);if(prior)return prior;
  const event=JSON.stringify(p.publicEvent);
  const stmts=[this.db.prepare('INSERT INTO roadmap_event (idempotency_key,item_id,recorded_at,public_json) SELECT ?,?,?,? WHERE (SELECT revision FROM roadmap_clock WHERE id=1)=?').bind(p.key,p.itemId,p.at,event,p.expectedCursor)];
  const own='EXISTS (SELECT 1 FROM roadmap_event WHERE idempotency_key=?)';
  if(p.redact){
   stmts.push(this.db.prepare(`UPDATE roadmap_event SET public_json=NULL WHERE item_id=? AND idempotency_key<>? AND ${own}`).bind(p.itemId,p.key,p.key));
   stmts.push(this.db.prepare(`UPDATE roadmap_item SET public_json=NULL,updated_seq=(SELECT seq FROM roadmap_event WHERE idempotency_key=?) WHERE id=? AND ${own}`).bind(p.key,p.itemId,p.key));
  } else if(p.item){
   stmts.push(this.db.prepare(`INSERT INTO roadmap_item (id,public_json,updated_seq) SELECT ?,?,seq FROM roadmap_event WHERE idempotency_key=? ON CONFLICT(id) DO UPDATE SET public_json=excluded.public_json,updated_seq=excluded.updated_seq`).bind(p.itemId,JSON.stringify(p.item),p.key));
  }
  stmts.push(this.db.prepare(`INSERT INTO roadmap_audit (seq,actor,request_hash,restricted_provenance) SELECT seq,?,?,? FROM roadmap_event WHERE idempotency_key=?`).bind(p.actor,p.requestHash,JSON.stringify(p.restrictedProvenance),p.key));
  stmts.push(this.db.prepare(`UPDATE roadmap_clock SET revision=(SELECT seq FROM roadmap_event WHERE idempotency_key=?),generation=generation+? WHERE id=1 AND ${own}`).bind(p.key,p.redact?1:0,p.key));
  try {await this.db.batch(stmts);}catch(e){const replay=await this.receipt(p.key,p.actor,p.requestHash);if(replay)return replay;throw e;}
  const receipt=await this.receipt(p.key,p.actor,p.requestHash);
  if(!receipt)throw new RoadmapConflict('Roadmap changed; read current cursor before retrying.');
  return {...receipt,replayed:false};
 }
 async read(after=0,itemAfter='',limit=100){
  // D1 batch is transactional: clock, current items and bounded replay share one snapshot.
  const r=await this.db.batch([
   this.db.prepare('SELECT revision,generation FROM roadmap_clock WHERE id=1'),
   this.db.prepare('SELECT id,public_json,updated_seq FROM roadmap_item WHERE public_json IS NOT NULL AND id>? ORDER BY id LIMIT ?').bind(itemAfter,limit+1),
   this.db.prepare('SELECT seq,item_id,recorded_at,public_json FROM roadmap_event WHERE seq>? AND public_json IS NOT NULL ORDER BY seq LIMIT ?').bind(after,limit+1),
   this.db.prepare('SELECT recorded_at FROM roadmap_event ORDER BY seq DESC LIMIT 1'),
  ]);
  const clock=r[0].results[0] as unknown as Clock;
  const items=r[1].results as unknown as PublicItem[],events=r[2].results as unknown as StoredEvent[];
  return {cursor:clock.revision,generation:clock.generation,last_event_at:(r[3].results[0] as {recorded_at?:string}|undefined)?.recorded_at??null,
   items:items.slice(0,limit).map(x=>({id:x.id,updated_seq:x.updated_seq,value:JSON.parse(x.public_json!)})),
   item_next:items.length>limit?items[limit-1].id:null,
   events:events.slice(0,limit).map(x=>({sequence:x.seq,item_id:x.item_id,recorded_at:x.recorded_at,value:JSON.parse(x.public_json!)})),
   event_next:events.length>limit?events[limit-1].seq:null,reset:after>clock.revision};
 }
 async history(itemId:string,after:number,limit:number){
  const r=await this.db.batch([this.db.prepare('SELECT revision,generation FROM roadmap_clock WHERE id=1'),this.db.prepare('SELECT seq,item_id,recorded_at,public_json FROM roadmap_event WHERE item_id=? AND seq>? AND public_json IS NOT NULL ORDER BY seq LIMIT ?').bind(itemId,after,limit+1)]);
  const clock=r[0].results[0] as unknown as Clock,events=r[1].results as unknown as StoredEvent[];
  return {cursor:clock.revision,generation:clock.generation,events:events.slice(0,limit).map(x=>({sequence:x.seq,recorded_at:x.recorded_at,value:JSON.parse(x.public_json!)})),next:events.length>limit?events[limit-1].seq:null};
 }
 async actor(sequence:number){const row=await this.db.prepare('SELECT actor FROM roadmap_audit WHERE seq=?').bind(sequence).first<{actor:string}>();return row?.actor??null;}
 async item(id:string){const row=await this.db.prepare('SELECT public_json FROM roadmap_item WHERE id=? AND public_json IS NOT NULL').bind(id).first<{public_json:string}>();return row?JSON.parse(row.public_json):null;}
 async event(seq:number){const row=await this.db.prepare('SELECT seq,item_id,recorded_at,public_json FROM roadmap_event WHERE seq=? AND public_json IS NOT NULL').bind(seq).first<StoredEvent>();return row?{...row,value:JSON.parse(row.public_json!)}:null;}
}
