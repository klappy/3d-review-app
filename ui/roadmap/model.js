export const STAGES = ['planned','built','reviewed','dev','production'];
export const LABELS = {planned:'Planned',built:'Built',reviewed:'Reviewed',dev:'DEV',production:'Production'};
export const STATES = {done:'✅ Done',pending:'🟡 Pending',blocked:'🔴 Blocked'};
export function windowItems(items, all=false){
  const sorted=[...items].sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)||a.id.localeCompare(b.id));
  const completed=sorted.filter(x=>STAGES.every(k=>x.stages[k].state==='done'));
  const active=sorted.filter(x=>!STAGES.every(k=>x.stages[k].state==='done'));
  return {active:all?active:active.slice(0,20),completed:all?completed:completed.slice(0,10),activeTotal:active.length,completedTotal:completed.length};
}
