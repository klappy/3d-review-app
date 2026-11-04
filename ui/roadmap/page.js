import {STAGES,LABELS,STATES,windowItems} from './model.js';
import {stagePresentation,nextAction,happeningNow,currentBlocker} from './model.js';
import {createLiveFeed} from './live.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=v=>new Date(v).toLocaleString(undefined,{timeZone:'UTC'})+' UTC';
const links=xs=>xs.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a>`).join(' · ');
export function renderCards(items,label){
 if(!items.length)return `<p class="muted">No ${label.toLowerCase()} currently published.</p>`;
 return items.map(item=>`<article class="work-card"><h3>${esc(item.title)}</h3><p class="badges"><span>${esc(item.operations?.work_type??'Type not assigned')}</span><span>${item.operations?.release_reference?'v'+esc(item.operations.release_reference):'Version not assigned'}</span><span>${item.operations?.release_impact?esc(item.operations.release_impact.toUpperCase()):'Impact not assigned'}</span>${item.operations?.breaking===true?'<span>Breaking change</span>':''}</p><p>${esc(item.provenance.scope??'Scope not yet reviewed.')}</p><p class="outcome"><strong>Outcome:</strong> ${esc(item.provenance.outcome??'Outcome not recorded.')}</p><p class="small">${item.version?'Attested version reference '+esc(item.version)+' · ':''}${links(item.links)}</p>
 <div class="stage-matrix" aria-label="Delivery stages">${STAGES.map(k=>{const p=stagePresentation(item,k);return `<div class="stage-${p.state}"><strong>${LABELS[k]}</strong><span class="stage-state">${esc(p.headline)}</span><small>${esc(p.report)}</small><small>${esc(p.label)}</small></div>`;}).join('')}</div>
 ${!item.operations?.workflow?'<p class="small muted">Future · workflow placement not yet reviewed; not active work.</p>':''}
 <dl class="actions"><dt>Status</dt><dd>${esc(happeningNow(item))}</dd><dt>Blocker</dt><dd>${esc(currentBlocker(item))}</dd><dt>Next</dt><dd>${esc(nextAction(item))}</dd><dt>Queue</dt><dd>${esc(item.operations?.queue_order??(item.operations?.queue_rank?'Position '+item.operations.queue_rank:'Not ranked'))}</dd></dl>
 ${item.operations?.reviewed_at?`<p class="small muted">Context reviewed ${esc(stamp(item.operations.reviewed_at))}</p>`:''}
 <details class="history" data-detail="${esc(item.id)}-history"><summary>Why this work · evidence · history</summary><dl>${Object.entries(item.provenance).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${STAGES.map(k=>`<p><strong>${LABELS[k]} evidence</strong>: ${esc(item.stages[k].reason)} ${links(item.stages[k].evidence)}</p>`).join('')}<ol>${item.history.map(e=>`<li><strong>${esc(e.kind)} · ${esc(stamp(e.at))}</strong><p>${esc(e.summary)}</p><p>${links(e.links)}</p></li>`).join('')}</ol><p class="small">Recent ${item.history.length} of ${item.history_count??item.history.length} events</p><button type="button" data-history="${esc(item.id)}">Read full history</button><div data-history-output="${esc(item.id)}"></div></details></article>`).join('');
}
export function mountRoadmap(doc=globalThis.document,createFeed=createLiveFeed){
 const output=doc.querySelector('#roadmap'),status=doc.querySelector('#roadmap-status'),refresh=doc.querySelector('#refresh'),all=doc.querySelector('#show-all');let latest=null,selected="now",generation=null,disposed=false;
 const histories=new Map();
 const renderHistory=(id,state)=>{const button=[...output.querySelectorAll('[data-history]')].find(x=>x.dataset.history===id),target=[...output.querySelectorAll('[data-history-output]')].find(x=>x.dataset.historyOutput===id);if(!button||!target)return;
  target.innerHTML=state.rows.join('')+(state.error?'<p role="alert">History could not be loaded. Try again.</p>':'');button.disabled=state.loading;button.hidden=state.done;button.textContent=state.loading?'Loading history…':state.next?'Read next history page':'Read full history';
 };
 const render=()=>{if(!latest)return;status.textContent=latest.error||(!latest.snapshot?'Loading roadmap…':'');status.setAttribute('role',latest.error?'alert':'status');refresh.textContent=latest.error?'Retry roadmap':'Refresh roadmap';
  if(!latest.snapshot){histories.clear();generation=null;output.innerHTML='';return;}
  if(generation!==latest.snapshot.generation){histories.clear();generation=latest.snapshot.generation;}
  const ids=new Set(latest.snapshot.items.map(item=>item.id));for(const id of histories.keys())if(!ids.has(id))histories.delete(id);
  const opened=new Set([...output.querySelectorAll('details[open]')].map(x=>x.dataset.detail));
  const focused=doc.activeElement?.closest('details')?.dataset.detail;
  const focusedWindow=doc.activeElement?.closest('[data-window]')?.dataset.window;
  const s=latest.snapshot,w=windowItems(s.items,all.checked);
  const labels={past:'Past',now:'Now',next:'Future'},descriptions={past:'Completed work',now:'Actively worked',next:'Not currently being worked'},empty={past:'Completed work',now:'Active work',next:'Future work'};
  output.innerHTML=`<p class="small freshness">${s.source_mode==='production_canonical'?'Production feed':'DEV provisional feed'} · Last successful read: ${latest.fetchedAt!=null?esc(stamp(latest.fetchedAt)):'not recorded'} · Last public update: ${latest.lastEventAt!=null?esc(stamp(latest.lastEventAt)):'none recorded'}</p>${!s.items.length?'<p class="roadmap-empty">No roadmap work is currently published. Published plans and updates will appear here.</p>':''}<nav class="window-nav" aria-label="Work window">${['past','now','next'].map(k=>`<button type="button" data-window="${k}" aria-pressed="${selected===k}"><strong>${k==='past'?'← ':''}${labels[k]}${k==='next'?' →':''} · ${w[k+'Total']}</strong><span>${descriptions[k]}</span></button>`).join('')}</nav><div class="roadmap-lanes" data-selected="${selected}">${['past','now','next'].map(k=>`<section data-lane="${k}" class="${selected===k?'focus':''}"><h2>${labels[k]} <span>${w[k].length} of ${w[k+'Total']}</span></h2>${renderCards(w[k],empty[k])}</section>`).join('')}</div><details data-detail="transport" class="transport"><summary>Connection details · ${esc(latest.connection)}</summary><p>Event sequence ${s.cursor}. Connection is not proof of completion.</p><p>Committed-event updates about every 2 seconds; disconnected polling every 15 seconds.</p></details>`;
  for(const d of output.querySelectorAll('details')){if(opened.has(d.dataset.detail))d.open=true;if(focused===d.dataset.detail)d.querySelector('summary')?.focus();}
  for(const [id,state] of histories)renderHistory(id,state);
  if(focusedWindow)output.querySelector(`[data-window="${focusedWindow}"]`)?.focus();
 };
 const historyClick=async(e)=>{const windowButton=e.target.closest('[data-window]');if(windowButton){selected=windowButton.dataset.window;render();output.querySelector(`[data-window="${selected}"]`)?.focus();return;}const button=e.target.closest('[data-history]');if(!button)return;const id=button.dataset.history,captured=latest?.snapshot?.generation;if(captured==null)return;
  let state=histories.get(id);if(!state){state={rows:[],next:0,loading:false,done:false,error:false};histories.set(id,state);}if(state.loading||state.done)return;state.loading=true;state.error=false;renderHistory(id,state);
  const current=()=>!disposed&&captured===latest?.snapshot?.generation&&histories.get(id)===state;
  const after=state.next;
  try{const response=await fetch(`/v2/roadmap/items/${encodeURIComponent(id)}/history?after=${after}&limit=25`,{credentials:'omit',cache:'no-store'});const body=await response.json();if(!response.ok||!body.ok)throw Error();if(!current())return;const r=body.result;if(r.generation!==captured){feed.refresh();return;}
   const rows=r.events.map(x=>`<li><strong>${esc(stamp(x.recorded_at))}</strong><p>${esc(x.value.kind==='claim'?'Publisher claim: '+x.value.claim.kind.replaceAll('_',' '):x.value.kind.replaceAll('_',' '))}</p>${x.value.summary?`<dl>${Object.entries(x.value.summary).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:''}</li>`).join('');state.rows.push(`<ol>${rows}</ol>`);state.next=r.next;state.done=r.next===null;
  }catch{if(current())state.error=true;}finally{if(current()){state.loading=false;renderHistory(id,state);}}
 };
 output.addEventListener('click',historyClick);
 const feed=createFeed({onChange:s=>{latest=s;render();}}),onRefresh=()=>feed.refresh();refresh.addEventListener('click',onRefresh);all.addEventListener('change',render);
 const visibility=()=>{if(doc.hidden)feed.pause();else feed.resume();};doc.addEventListener('visibilitychange',visibility);feed.start();
 return()=>{disposed=true;histories.clear();doc.removeEventListener('visibilitychange',visibility);refresh.removeEventListener('click',onRefresh);all.removeEventListener('change',render);output.removeEventListener('click',historyClick);feed.dispose();};
}
if(typeof document!=='undefined' && document.querySelector('#roadmap')){let dispose=mountRoadmap();globalThis.addEventListener('pagehide',()=>dispose());globalThis.addEventListener('pageshow',e=>{if(e.persisted)dispose=mountRoadmap();});}
