export const STAGES = ['planned','built','reviewed','dev','production'];
export const LABELS = {planned:'Planned',built:'Built',reviewed:'Reviewed',dev:'DEV',production:'Production'};
export const STATES = {done:'✅ Done',pending:'🟡 Pending',blocked:'🔴 Blocked'};
export const WINDOWS = ['past','now','next'];
export function windowItems(items, all=false){
 const sorted=[...items].sort((a,b)=>(a.operations?.queue_rank??Infinity)-(b.operations?.queue_rank??Infinity)||a.id.localeCompare(b.id));
 const result={};
 for(const key of WINDOWS){
  const rows=sorted.filter(x=>(WINDOWS.includes(x.operations?.workflow)?x.operations.workflow:'next')===key);
  result[key]=all?rows:rows.slice(0,20);result[key+'Total']=rows.length;
 }
 return result;
}

// Existing stages remain verifier materializations; reported is an explicitly separate claim.
export function stagePresentation(item,key){
 const s=item.stages[key],r=item.reported?.[key];
 const verified=!!s.evidence?.length;
 const state = r?.state ?? (verified ? s.state : null);
 return {state:STATES[state]?state:'unknown',headline:STATES[state]??'Not reported',label:verified?'Verified: '+STATES[s.state]:'Not verified',
  report:r?`Reported: ${r.state}${r.version?' · '+r.version:''}${r.blocker?' · '+r.blocker.replaceAll('_',' '):''}`:'No publisher report'};
}
export function nextAction(item){
 if(item.operations?.next_action)return item.operations.next_action;
 const latest=latestReport(item);const blocked=latest?.state==='blocked'?latest.stage:null;
 if(blocked)return `Resolve reported ${LABELS[blocked]} blocker: ${(item.reported[blocked].blocker??'cause not recorded').replaceAll('_',' ')}. Verify the updated evidence.`;
 const claimed=STAGES.filter(k=>item.reported?.[k]&&!item.stages[k].evidence?.length);
 if(claimed.length)return `Review reported ${claimed.map(k=>LABELS[k]).join(', ')} evidence; independent acceptance is not recorded.`;
 if(/^Work item #/.test(item.title))return 'Publish a reviewed title and scope; delivery state is not established by a missing summary.';
 if(STAGES.every(k=>item.stages[k].state==='done'))return 'Evaluate the user outcome; release delivery alone does not establish success.';
 return 'Next delivery action is not recorded. Request an updated owner report.';
}

export function latestReport(item){return Object.entries(item.reported??{}).map(([stage,r])=>({...r,stage})).sort((a,b)=>(b.sequence??0)-(a.sequence??0))[0];}
export function happeningNow(item){if(item.operations?.happening_now)return item.operations.happening_now;const r=latestReport(item);return r?`Latest report: ${LABELS[r.stage]} ${r.state}${r.version?' · '+r.version:''}`:'Current work not reported';}
export function currentBlocker(item){if(item.operations?.blocker)return item.operations.blocker;const r=latestReport(item);return r?.state==='blocked'?(r.blocker??'Cause not recorded').replaceAll('_',' '):'No current blocker reported';}
