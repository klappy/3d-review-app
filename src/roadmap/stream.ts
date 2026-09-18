import type {Hono} from 'hono';
import {streamSSE} from 'hono/streaming';
import type {Env,Ctx} from '../handlers/types';
import {execute} from '../dispatch';
import {newTraceId} from '../receipt';
import {allow,clientIp} from '../ratelimit';
/** Read-only event notifications. Payload and actor data are never copied into the stream. */
export function installRoadmapStream(app:Hono<{Bindings:Env}>,context:(req:Request,env:Env)=>Promise<Ctx>){
 app.get('/v2/roadmap/stream',async c=>{
  if(!await allow(c.env,'RL_HTTP_ANON',`roadmap:${clientIp(c.req.raw)}`))return c.text('Temporarily unavailable.',429);
  const raw=c.req.header('last-event-id')??c.req.query('after')??'0';if(!/^\d{1,16}$/.test(raw)||!Number.isSafeInteger(Number(raw)))return c.text('Invalid cursor.',400);
  const generation=c.req.query('generation');if(generation!==undefined&&!/^\d{1,16}$/.test(generation))return c.text('Invalid generation.',400);
  // EventSource includes same-origin cookies even with withCredentials:false.
  // This public projection never resolves or audits a viewer's signed-in identity.
  const publicHeaders=new Headers(c.req.raw.headers);publicHeaders.delete('cookie');publicHeaders.delete('authorization');
  const publicRequest=new Request(c.req.url,{headers:publicHeaders});
  const ctx=await context(publicRequest,c.env);let after=Number(raw),seenGeneration=generation===undefined?null:Number(generation);
  c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
  const response=streamSSE(c,async stream=>{
   let closed=false;stream.onAbort(()=>{closed=true;});const end=Date.now()+30000;
   try{while(!closed&&Date.now()<end){
    // Exact same capability/handler as HTTP and MCP reads; no alternate auth or data projection.
    const envelope=await execute({...ctx,traceId:newTraceId()},'cap.ops.roadmap_read',{after,limit:100},{tool:'read',transport:'http'});
    if(!envelope.ok)throw new Error('unavailable');
    const r=envelope.result as any;
    const reset=r.reset||(seenGeneration!==null&&seenGeneration!==r.generation);
    const cursor=reset?r.cursor:(r.event_next??r.cursor);
    const payload={cursor,generation:r.generation,last_event_at:r.last_event_at,source_mode:r.source_mode,sequences:reset?[]:r.events.map((e:any)=>e.sequence)};
    await stream.writeSSE({event:reset?'reset':r.events.length?'change':'heartbeat',id:String(cursor),data:JSON.stringify(payload),retry:3000});
    after=cursor;seenGeneration=r.generation;
    await stream.sleep(2000);
   }}catch{if(!closed)await stream.writeSSE({event:'unavailable',data:'{"message":"Live updates unavailable."}'});}
  });
  response.headers.set('Cache-Control','no-store');
  return response;
 });
}
