// Build-only entry: compile the actual Next report components; no second paper design.
import {render} from 'svelte/server';
import Report from '../../ui-next/src/screens/results/Report.svelte';
import Detailed from '../../ui-next/src/screens/results/ReportDetailed.svelte';
import {currentLevelMin,useLevelMinimum,sentLenses,lensCards,gapRows,scoreRows,bandRows,sameBand,lookNextOf,standsOutOf} from '../../ui-next/src/screens/results/data.js';
// surveys: the review's survey list (perspective/state/archived_at only). As the live report does (app/data.js sentLenses), a selected
// perspective with no response at build time keeps a zero-response "More input needed" card instead of vanishing (G02).
export function nextReportMarkup(stored,identity,minimum,format,surveys){
 const before=currentLevelMin();
 // Synchronous render in this private bundled module graph; restore before returning/throwing. No async/global UI mutation.
 try{useLevelMinimum(minimum);const payload=stored.report.payload,counts={},sent=sentLenses(surveys),cards=lensCards(payload,counts,{sent}),base={payload};const rows=gapRows(base,counts),placed=scoreRows(base,counts).filter(r=>r.spread!==null).map(r=>r.name);
 const report={payload,counts,sent,reportId:stored.report.id??null,created_at:stored.report.created_at||'',review:{title:identity.title||'3D Review',project:identity.project||'',language:identity.language||'',builtOn:stored.report.created_at||'',closedLong:''},gaps:{biggest:rows.slice(0,3).map(r=>r.name),agree:bandRows(base,counts,placed).filter(sameBand).map(r=>r.name)},radar:(payload.cross_lens_multi||[]).map(a=>a.construct_name).slice(0,8),lookNext:lookNextOf(cards),standsOut:standsOutOf(cards,rows)};
 return render(format==='overview'?Report:Detailed,{props:{phone:false,theme:'light',report,pdfUrl:null}}).body;
 }finally{useLevelMinimum(before);}
}
