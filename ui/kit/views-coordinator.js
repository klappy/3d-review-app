// Pure kit presentation. Controllers own permissions, data, confirmation and effects.
import {esc} from './core.js';
const phases=[['prepare','Prepare'],['collect','Collect'],['understand','Understanding'],['improve','Improve']];
const ids=new Set(['navigation','create','save','stage-preview','survey-select','survey-remove','share','report-preview','report-open','notes-save','invite-preview','role-preview','revoke-preview','transfer-preview','accept-preview','browse-view']);
export const screens=['projects','projectNew','project','workspaceNew','workspace','assessment','templatePreview','viewer','invite'];
const statuses={loading:'Loading…',empty:'Nothing here yet.',unauthenticated:'Sign in to continue.',refused:'Access unavailable.',notFound:'Not found.',notBuilt:'Not available yet.',error:'Unable to load. Try again.'};
export const heading=m=>`<div><p class="eyebrow">${esc(m.eyebrow)}</p>${m.title?`<h1>${esc(m.title)}</h1>`:""}${m.help?`<p class="muted">${esc(m.help)}</p>`:''}</div>`;
export const warnings=m=>(m.warnings||[]).map(x=>`<p class="note warning">${esc(x)}</p>`).join('');
export function fields(m){return (m.fields||[]).filter(f=>typeof f.name==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(f.name)).map(f=>`<label>${esc(f.label)}${f.type==='textarea'?`<textarea data-kit-field name="${esc(f.name)}">${esc(f.value)}</textarea>`:f.type==='select'?`<select data-kit-field name="${esc(f.name)}">${(f.options||[]).map(o=>`<option value="${esc(o.value)}"${o.value===f.value?' selected':''}>${esc(o.label)}</option>`).join('')}</select>`:`<input data-kit-field name="${esc(f.name)}" type="${f.type==='checkbox'?'checkbox':'text'}"${f.type==='checkbox'?(f.value===true?' checked':''):` value="${esc(f.value)}"`}>`}</label>`).join('');}
export function cards(items=[]){return items.map(x=>`<article class="glass panel" style="min-width:0;overflow-wrap:anywhere"><div class="row"><h3>${esc(x.title||x.label)}</h3>${x.role?`<span class="badge">${esc(x.role)}</span>`:''}</div>${x.description?`<p class="muted">${esc(x.description)}</p>`:''}${(x.facts||[]).map(f=>`<p><span class="muted">${esc(f.label)}</span> ${esc(f.value)}</p>`).join('')}${typeof x.responses==='number'?`<p>Responses: ${esc(x.responses)}${typeof x.denominator==='number'?` / ${esc(x.denominator)}`:''}</p>`:''}${(x.children||[]).map(c=>`<div class="nav">${esc(c.label)}<small>${esc(c.detail)}</small></div>`).join('')}</article>`).join('');}
export function mountView(root,initial,onIntent,screenSet,actionSet,body){
 let model,callback,generation=0,dead=false,dispatched=new Set();
 const allowed=a=>a&&actionSet.has(a.id)&&a.allowed===true;
 const blocked=a=>a.busy===true||dispatched.has(a.id)||(['pending','uncertain'].includes(model.interaction?.outcome)&&model.interaction.actionId===a.id)||(a.id==='report-open'&&model.report?.eligibility!=='eligible');
 const actions=()=> (model.actions||[]).filter(allowed);
 const button=(a,values={})=>`<button type="button" class="${a.primary?'primary':''}" data-intent="${esc(a.id)}" data-values="${esc(JSON.stringify(values))}"${values.view===model.view?' aria-current="page"':''}${blocked(a)?' disabled':''}>${esc(a.label)}</button>`;
 function render(){
  generation++;dispatched.clear();
  const status=model.status||'error',ready=status==='ready'&&screenSet.includes(model.screen);
  root.innerHTML=`<section data-kit-view="${esc(model.screen)}" style="min-width:0;overflow-wrap:anywhere">${model.sample?'<p class="badge demo">SAMPLE DATA · SIMULATED</p>':''}${heading(model)}${ready?body(model,{actions,button}):`<p class="note" role="status">${esc(statuses[status]||statuses.error)}</p>`}${ready?warnings(model):''}${ready?interaction():''}</section>`;
 }
 function interaction(){const i=model.interaction||{};const a=actions().find(a=>a.id===i.actionId);let html='';
  if(i.outcome==='uncertain')html='<p class="note warning" role="status">Outcome not confirmed. Check the current state before trying again.</p>';
  if(i.outcome==='pending')html='<p class="note" role="status">Waiting for confirmation…</p>';
  if(i.outcome==='error')html=`<p class="note warning" role="status">${esc(model.error||'Action could not be confirmed.')}</p>`;
  if(a&&['preview','confirmation'].includes(i.step))html+=`<section class="glass panel" aria-label="Action review"><h2>${i.step==='preview'?'Preview':'Confirm action'}</h2>${(i.impact||[]).map(x=>`<p>${esc(x)}</p>`).join('')}${i.step==='confirmation'?button(a):''}</section>`;
  if(i.outcome==='confirmed'&&model.receipt?.confirmed===true)html+=`<section class="note" role="status">${esc(model.receipt.label)}${model.receipt.details?`<details><summary>Details</summary><p>${esc(model.receipt.details)}</p></details>`:''}</section>`;
  return html;
 }
 function click(e){const b=e.target.closest?.('[data-intent]');if(!b||!root.contains(b)||b.closest('[data-slot]')||dead||model.status!=='ready')return;const a=actions().find(a=>a.id===b.dataset.intent);if(!a||blocked(a))return;
  const snapshot=generation,values=JSON.parse(b.dataset.values||'{}');
  if(a.id!=='browse-view'&&!['navigation','tour-next','tour-back','start-signin'].includes(a.id)){
   for(const f of root.querySelectorAll('[data-kit-field][name]')){if(f.closest('[data-slot]'))continue;values[f.name]=f.type==='checkbox'?f.checked:f.value;}
   dispatched.add(a.id);for(const x of root.querySelectorAll('[data-intent]'))if(x.dataset.intent===a.id&&!x.closest('[data-slot]'))x.disabled=true;
  }
  if(snapshot===generation)callback?.({action:a.id,context:{...model.context},values});
 }
 function key(e){if(e.key==='Escape'){const d=e.target.closest?.('details[open]');if(d&&root.contains(d)){d.open=false;d.querySelector('summary')?.focus();}}}
 root.addEventListener('click',click);root.addEventListener('keydown',key);
 function update(next,fn=callback){if(dead)return;model=structuredClone(next);callback=fn;render();}
 update(initial,onIntent);
 return {update,destroy(){dead=true;generation++;root.removeEventListener('click',click);root.removeEventListener('keydown',key);root.replaceChildren();}};
}
export function mountCoordinatorView(root,model,onIntent){return mountView(root,model,onIntent,screens,ids,(m,{actions,button})=>{
 const controls=()=>`<div class="row">${actions().filter(a=>a.id!=='browse-view'&&!(a.id===m.interaction?.actionId&&['preview','confirmation'].includes(m.interaction?.step))).map(a=>button(a)).join('')}</div>`;
 let html='';
 if(m.screen==='assessment'){
 html+=`<div class="stagebar">${(m.stages||[]).map(s=>`<span class="${s.id===m.stage?'on':''}">${esc(s.label)}</span>`).join('')}</div><nav class="phases" aria-label="Assessment views">${[...phases,['people','People']].map(([id,label],i)=>{const a=actions().find(a=>a.id==='browse-view');return a?button({...a,label:(i<4?`${i+1}. `:'')+label},{view:id}):`<span class="chip"${m.view===id?' aria-current="page"':''}>${esc(label)}</span>`;}).join('')}</nav>`;
 html+=`<h2>${esc([...phases,['people','People']].find(([id])=>id===m.view)?.[1]||'Assessment')}</h2>`;
 if(m.view==='understand')html+=`<section class="glass panel"><h3>Reports</h3>${m.report?.eligibility==='held'?`<p class="note warning">Report held</p>${(m.report.reasons||[]).map(x=>`<p>${esc(x)}</p>`).join('')}`:m.report?.eligibility==='eligible'?'':'<p class="note">Report not available.</p>'}${m.report?.provenance?`<details><summary>Evidence</summary><p>${esc(m.report.provenance)}</p></details>`:''}<div data-slot="report"></div></section>`;
 }
 if(['projectNew','workspaceNew'].includes(m.screen)||m.fields?.length)html+=`<div class="glass panel"><div class="grid">${fields(m)}</div>${controls()}</div>`;
 else html+=controls();
 if(m.screen==='assessment'&&m.view==='people')html+=`<section class="glass panel" style="overflow:auto"><h3>People</h3><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Access</th></tr></thead><tbody>${(m.items||[]).map(x=>`<tr><td>${esc(x.title||x.label)}</td><td style="white-space:nowrap">${esc(x.role)}</td><td>${esc(x.description)}</td></tr>`).join('')}</tbody></table></section>`;
 else if(m.screen==='project')html+=`<section class="glass panel" style="overflow:auto"><h2>Assessments</h2><table class="table"><thead><tr><th>Assessment</th><th>Context</th><th>Details</th></tr></thead><tbody>${(m.items||[]).map(x=>`<tr><td>${esc(x.title||x.label)}</td><td>${esc(x.description)}</td><td>${(x.facts||[]).map(f=>`${esc(f.label)}: ${esc(f.value)}`).join(' · ')}</td></tr>`).join('')}</tbody></table></section>`;
 else html+=`<div class="${m.screen==='projects'||(m.screen==='assessment'&&m.view==='collect')?'three':'grid'}">${cards(m.items)}</div>`;
 html+=(m.sections||[]).map(s=>`<section class="glass panel"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></section>`).join('');
 html+=['share','feedback','print',...(m.screen==='assessment'&&m.view==='understand'?[]:['report'])].map(s=>`<div data-slot="${s}"></div>`).join('');return html;
 });}
