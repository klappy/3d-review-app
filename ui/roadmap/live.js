/** Same public HTTP twin as MCP read. No token, cookie or actor metadata is used. */
export function createLiveFeed({fetcher=globalThis.fetch,EventSourceClass=globalThis.EventSource,onChange,clock=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 let disposed=false,paused=false,source=null,sourceGeneration=null,timer=null,busy=false,pending=false,epoch=0,cursor=0,generation=null,inconsistencies=0;
 const state={snapshot:null,fetchedAt:null,error:null,connection:'connecting',lastEventAt:null};
 const emit=()=>{if(!disposed)onChange({...state});};
 async function refresh(){
  if(disposed||paused)return;if(busy){pending=true;return;}busy=true;const token=epoch;
  try{
   let items=[],page='',anchor=null,first;
   for(let n=0;n<50;n++){
    const response=await fetcher('/v2/roadmap?limit=100'+(page?'&item_after='+encodeURIComponent(page):''),{credentials:'omit',cache:'no-store'});if(!response.ok)throw Error();
    const body=await response.json(),r=body?.ok&&body.result;if(!r||!Number.isSafeInteger(r.cursor)||!Number.isSafeInteger(r.generation)||!Array.isArray(r.items)||!['dev_provisional','production_canonical'].includes(r.source_mode))throw Error();
    if(generation!==null&&r.generation!==generation){epoch++;state.snapshot=null;generation=r.generation;emit();pending=true;return;}
    if(anchor!==null&&anchor!==r.cursor){if(++inconsistencies>=3)throw Error();pending=true;return;}anchor=r.cursor;first??=r;
    items.push(...r.items.map(x=>x.value));page=r.item_next;if(!page)break;if(n===49)throw Error();
   }
   if(disposed||token!==epoch)return;
   inconsistencies=0;generation=first.generation;cursor=first.cursor;state.snapshot={items,source_mode:first.source_mode,cursor,generation};state.lastEventAt=first.last_event_at;state.fetchedAt=clock();state.error=null;
   // Native EventSource reconnects reuse their original URL. Refresh it only after
   // accepting a consistent snapshot, so reconnection carries the current cursor/generation.
   if(source&&sourceGeneration!==generation){source.close();source=null;connect();}
  }catch{if(token===epoch&&!disposed)state.error=state.snapshot?'Refresh failed. Showing previously received data; changes, including removals, may be missing while disconnected.':'Roadmap unavailable. No progress data is being inferred.';}
  finally{busy=false;emit();if(pending&&!disposed){pending=false;refresh();}}
 }
 function connect(){
  if(disposed||paused||source)return;
  state.connection='connecting';emit();
  if(!EventSourceClass){state.connection='polling fallback';emit();schedule();return;}
  source=new EventSourceClass('/v2/roadmap/stream?after='+cursor+(generation===null?'':'&generation='+generation));
  sourceGeneration=generation;const opened=source;const current=()=>!disposed&&!paused&&source===opened;
  source.onopen=()=>{if(!current())return;state.connection='connected';emit();};
  const message=(e,reset=false)=>{if(!current())return;let data;try{data=JSON.parse(e.data);}catch{return;}if(!Number.isSafeInteger(data.cursor)||!Number.isSafeInteger(data.generation)||(generation!==null&&data.generation<generation))return;
   const changed=state.connection!=='connected'||state.lastEventAt!==data.last_event_at;state.connection='connected';state.lastEventAt=data.last_event_at??state.lastEventAt;
   if(reset||(generation!==null&&generation!==data.generation)){epoch++;state.snapshot=null;generation=data.generation;state.error='Public history changed; reloading the current view.';emit();}
   if(reset||data.cursor!==cursor||!state.snapshot)refresh();else if(changed)emit();
  };
  source.addEventListener('change',e=>message(e));source.addEventListener('reset',e=>message(e,true));source.addEventListener('heartbeat',e=>message(e));
  source.addEventListener('unavailable',()=>{if(!current())return;state.connection='disconnected · polling fallback';emit();schedule();});
  source.onerror=()=>{if(!current())return;state.connection='disconnected · polling fallback';emit();schedule();};
 }
 function schedule(){if(timer||disposed)return;timer=setTimer(()=>{timer=null;refresh();if(state.connection!=='connected')schedule();},15000);}
 function pause(){paused=true;source?.close();source=null;if(timer)clearTimer(timer);timer=null;state.connection='paused while hidden';emit();}
 return {start(){refresh();connect();},refresh,pause,resume(){paused=false;refresh();connect();},dispose(){disposed=true;epoch++;pause();}};
}
