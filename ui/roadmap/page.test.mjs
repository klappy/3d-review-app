import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {mountRoadmap} from './page.js';
import {STAGES} from './model.js';

const html=()=>readFileSync(new URL('./index.html',import.meta.url),'utf8');
const item=(id,workflow)=>({id:'roadmap-'+id,title:'Synthetic work '+id,links:[],provenance:{scope:'A reviewed public purpose.',outcome:'Outcome not measured.'},history:[],stages:Object.fromEntries(STAGES.map(k=>[k,{state:'pending',reason:'Not accepted',evidence:[]}])),...(workflow?{operations:{workflow}}:{})});
const loaded=items=>({snapshot:{items,source_mode:'production_canonical',cursor:7,generation:2},connection:'connected',error:null,lastEventAt:null,fetchedAt:Date.parse('2026-10-31T14:00:00Z')});
const settled=()=>new Promise(resolve=>setImmediate(resolve));
const historyPage=(text,next=null,generation=2)=>({ok:true,json:async()=>({ok:true,result:{generation,next,events:[{recorded_at:'2026-10-31T12:00:00Z',value:{kind:'summary',summary:{title:text}}}]}})});
function historyFetch(t,fetcher){const previous=globalThis.fetch;globalThis.fetch=fetcher;t.after(()=>{globalThis.fetch=previous;});}
function setup(initial){
 const dom=new JSDOM(html(),{url:'https://example.test/roadmap/'}),doc=dom.window.document;
 let emit;const calls={refresh:0,dispose:0};
 const dispose=mountRoadmap(doc,({onChange})=>{emit=onChange;return{start(){emit({snapshot:null,error:null,connection:'connecting'});},refresh(){calls.refresh++;},pause(){},resume(){},dispose(){calls.dispose++;}};});
 if(initial)emit(initial);
 return{doc,calls,emit,stop(){dispose();dom.window.close();}};
}

test('the actual shell mounts roadmap controls separately from version history',()=>{
 const doc=new JSDOM(html()).window.document;
 assert.ok(doc.querySelector('#roadmap'));
 assert.ok(doc.querySelector('#refresh'));
 assert.ok(doc.querySelector('#show-all'));
 assert.ok(doc.querySelector('script[src="/roadmap/page.js"]'));
 assert.ok(doc.querySelector('script[src="/roadmap/versions.js"]'));
 assert.equal(doc.querySelector('#roadmap-work').contains(doc.querySelector('#versions')),false);
 assert.equal(doc.querySelectorAll('main h1').length,1);
 assert.ok(doc.querySelector('a[href="#versions"]'));
});

test('an empty public snapshot is honest and still exposes each work window',t=>{
 const h=setup(loaded([]));t.after(()=>h.stop());const {doc}=h;
 assert.match(doc.querySelector('#roadmap').textContent,/No roadmap work is currently published/);
 assert.deepEqual([...doc.querySelectorAll('[data-window]')].map(x=>x.dataset.window),['past','now','next']);
 assert.equal(doc.querySelector('[data-window="now"]').getAttribute('aria-pressed'),'true');
 doc.querySelector('[data-window="next"]').click();
 assert.equal(doc.querySelector('[data-window="next"]').getAttribute('aria-pressed'),'true');
 assert.match(doc.querySelector('[data-lane="next"]').textContent,/No future work currently published/);
 assert.match(doc.querySelector('.freshness').textContent,/Last successful read/);
 assert.match(doc.querySelector('.freshness').textContent,/Last public update: none recorded/);
 assert.doesNotMatch(doc.body.textContent,/Nothing waiting for the next version/);
 assert.equal(h.calls.refresh,0);
});

test('reviewed placement, outcomes and reports stay distinct from acceptance',t=>{
 const unplaced=item(4);unplaced.stages=Object.fromEntries(STAGES.map(k=>[k,{state:'done',reason:'Accepted earlier delivery',evidence:[{label:'Public review',url:'https://github.com/klappy/3d-review-app/issues/140'}]}]));
 const now=item(2,'now');now.reported={production:{state:'blocked',blocker:'dependency'}};
 const h=setup(loaded([item(1,'past'),now,item(3,'next'),unplaced]));t.after(()=>h.stop());
 const {doc}=h;
 assert.equal(doc.querySelectorAll('[data-lane="past"] article').length,1);
 assert.equal(doc.querySelectorAll('[data-lane="now"] article').length,1);
 assert.equal(doc.querySelectorAll('[data-lane="next"] article').length,2);
 assert.match(doc.querySelector('[data-lane="next"]').textContent,/workflow placement not yet reviewed; not active work/);
 assert.match(doc.querySelector('[data-lane="now"] .outcome').textContent,/Outcome not measured/);
 assert.match(doc.querySelector('[data-lane="now"]').textContent,/🔴 Blocked/);
 assert.match(doc.querySelector('[data-lane="now"]').textContent,/Not verified/);
 assert.equal(now.stages.production.state,'pending');
 assert.equal(doc.querySelector('[data-window="now"]').getAttribute('aria-pressed'),'true');
});

test('failure, explicit retry and stale data remain visible without inferring progress',t=>{
 const h=setup();t.after(()=>h.stop());const {doc}=h;
 h.emit({snapshot:null,error:'Roadmap unavailable. No progress data is being inferred.',connection:'disconnected'});
 assert.equal(doc.querySelector('#roadmap-status').getAttribute('role'),'alert');
 assert.equal(doc.querySelector('#refresh').textContent,'Retry roadmap');
 assert.equal(doc.querySelectorAll('.work-card').length,0);
 doc.querySelector('#refresh').click();assert.equal(h.calls.refresh,1);
 h.emit(loaded([item(1,'now')]));
 assert.equal(doc.querySelector('#refresh').textContent,'Refresh roadmap');
 const warning='Refresh failed. Showing previously received data; removals may be missing.';
 h.emit({...loaded([item(1,'now')]),error:warning});
 assert.equal(doc.querySelector('#roadmap-status').textContent,warning);
 assert.match(doc.querySelector('#roadmap').textContent,/Synthetic work 1/);
 assert.match(doc.querySelector('.freshness').textContent,/Last successful read/);
});

test('reset clears old public work while preserving changelog and focused-window selection',t=>{
 const h=setup(loaded([item(1,'now')]));t.after(()=>h.stop());const {doc}=h;
 doc.querySelector('#versions').textContent='Previously published version history';
 doc.querySelector('[data-window="next"]').click();
 h.emit(loaded([item(2,'next')]));
 assert.equal(doc.activeElement.dataset.window,'next');
 assert.equal(doc.querySelector('[data-window="next"]').getAttribute('aria-pressed'),'true');
 h.emit({snapshot:null,error:null,connection:'connected'});
 assert.equal(doc.querySelector('#roadmap').textContent,'');
 assert.match(doc.querySelector('#roadmap-status').textContent,/Loading roadmap/);
 assert.equal(doc.querySelector('#versions').textContent,'Previously published version history');
 h.emit({...loaded([]),snapshot:{...loaded([]).snapshot,generation:3}});
 assert.doesNotMatch(doc.querySelector('#roadmap').textContent,/Synthetic work/);
});

test('show-all and keyboard window focus are presentation-only and cleanup removes listeners',()=>{
 const h=setup(loaded(Array.from({length:23},(_,i)=>item(i+1,'now')))),{doc}=h;
 assert.equal(doc.querySelectorAll('[data-lane="now"] article').length,20);
 const all=doc.querySelector('#show-all');all.checked=true;all.dispatchEvent(new doc.defaultView.Event('change'));
 assert.equal(doc.querySelectorAll('[data-lane="now"] article').length,23);
 assert.equal(h.calls.refresh,0);
 const button=doc.querySelector('#refresh');h.stop();button.click();assert.equal(h.calls.refresh,0);assert.equal(h.calls.dispose,1);
});

test('loaded full history survives same-generation connection and snapshot updates',async t=>{
 historyFetch(t,async()=>historyPage('Retained published history'));
 const state=loaded([item(1,'now')]),h=setup(state);t.after(()=>h.stop());const {doc}=h;
 doc.querySelector('[data-history]').click();await settled();
 assert.match(doc.querySelector('[data-history-output]').textContent,/Retained published history/);
 h.emit({...state,connection:'disconnected · polling fallback',error:'Refresh failed. Showing previously received data.'});
 assert.match(doc.querySelector('[data-history-output]').textContent,/Retained published history/);
 h.emit({...state,fetchedAt:state.fetchedAt+1000});
 assert.match(doc.querySelector('[data-history-output]').textContent,/Retained published history/);
 assert.equal(doc.querySelector('[data-history]')?.hidden??true,true);
});

test('a pending history read stays busy and renders its response after a feed emission',async t=>{
 let accept,requests=0;
 historyFetch(t,()=>{requests++;return new Promise(resolve=>{accept=resolve;});});
 const state=loaded([item(1,'now')]),h=setup(state);t.after(()=>h.stop());const {doc}=h;
 doc.querySelector('[data-history]').click();
 h.emit({...state,fetchedAt:state.fetchedAt+1000});
 assert.equal(doc.querySelector('[data-history]').disabled,true);
 doc.querySelector('[data-history]').click();assert.equal(requests,1);
 accept(historyPage('History received during refresh'));await settled();
 assert.match(doc.querySelector('[data-history-output]').textContent,/History received during refresh/);
 assert.equal(doc.querySelector('[data-history]')?.hidden??true,true);
});

test('history paging retains prior rows and retry cursor across error and feed updates',async t=>{
 const requests=[];let attempt=0;
 historyFetch(t,async(url,options)=>{
  requests.push({url,options});attempt++;
  if(attempt===2)throw Error('Synthetic connection failure');
  return historyPage(attempt===1?'First history page':'Second history page',attempt===1?25:null);
 });
 const state=loaded([item(1,'now')]),h=setup(state);t.after(()=>h.stop());const {doc}=h;
 doc.querySelector('[data-history]').click();await settled();
 h.emit({...state,fetchedAt:state.fetchedAt+1000});
 assert.match(doc.querySelector('[data-history-output]').textContent,/First history page/);
 doc.querySelector('[data-history]').click();await settled();
 assert.match(doc.querySelector('[data-history-output]').textContent,/First history page/);
 assert.match(doc.querySelector('[data-history-output]').textContent,/History could not be loaded/);
 h.emit({...state,connection:'disconnected · polling fallback'});
 assert.match(doc.querySelector('[data-history-output]').textContent,/History could not be loaded/);
 doc.querySelector('[data-history]').click();await settled();
 const text=doc.querySelector('[data-history-output]').textContent;
 assert.match(text,/First history page/);assert.match(text,/Second history page/);
 assert.doesNotMatch(text,/History could not be loaded/);
 assert.deepEqual(requests.map(({url})=>new URL(url,'https://example.test').searchParams.get('after')),['0','25','25']);
 assert.ok(requests.every(({options})=>options.credentials==='omit'&&options.cache==='no-store'&&(!options.method||options.method==='GET')));
 assert.equal(doc.querySelector('[data-history]')?.hidden??true,true);
});

test('a public generation reset clears history and rejects a delayed old-generation response',async t=>{
 let accept;historyFetch(t,()=>new Promise(resolve=>{accept=resolve;}));
 const state=loaded([item(1,'now')]),h=setup(state);t.after(()=>h.stop());const {doc}=h;
 doc.querySelector('[data-history]').click();
 h.emit({snapshot:null,connection:'connected',error:'Public history changed; reloading the current view.'});
 h.emit({...state,snapshot:{...state.snapshot,generation:3}});
 accept(historyPage('Removed history from the old generation'));await settled();
 assert.doesNotMatch(doc.querySelector('#roadmap').textContent,/Removed history from the old generation/);
 assert.equal(doc.querySelector('[data-history]').disabled,false);
 globalThis.fetch=async()=>historyPage('Current generation history',null,3);
 doc.querySelector('[data-history]').click();await settled();
 assert.match(doc.querySelector('[data-history-output]').textContent,/Current generation history/);
 assert.doesNotMatch(doc.querySelector('[data-history-output]').textContent,/Removed history/);
});

test('removing then readding the same item does not revive its abandoned history request',async t=>{
 const accepts=[];historyFetch(t,()=>new Promise(resolve=>{accepts.push(resolve);}));
 const state=loaded([item(1,'now')]),h=setup(state);t.after(()=>h.stop());const {doc}=h;
 doc.querySelector('[data-history]').click();
 h.emit({...state,snapshot:{...state.snapshot,items:[]}});
 h.emit(state);
 doc.querySelector('[data-history]').click();assert.equal(accepts.length,2);
 accepts[0](historyPage('Abandoned history before removal'));await settled();
 assert.doesNotMatch(doc.querySelector('#roadmap').textContent,/Abandoned history before removal/);
 assert.equal(doc.querySelector('[data-history]').disabled,true);
 accepts[1](historyPage('History for the readded item'));await settled();
 assert.match(doc.querySelector('[data-history-output]').textContent,/History for the readded item/);
 assert.doesNotMatch(doc.querySelector('[data-history-output]').textContent,/Abandoned history/);
 assert.equal(h.calls.refresh,0);
});

test('disposing a pending history view prevents late response rendering and refresh side effects',async t=>{
 let accept;historyFetch(t,()=>new Promise(resolve=>{accept=resolve;}));
 const h=setup(loaded([item(1,'now')])),output=h.doc.querySelector('#roadmap');
 h.doc.querySelector('[data-history]').click();const before=output.innerHTML;
 h.stop();
 accept(historyPage('History arriving after leaving the page',null,999));await settled();
 assert.equal(output.innerHTML,before);
 assert.doesNotMatch(output.textContent,/History arriving after leaving the page/);
 assert.equal(h.calls.refresh,0);assert.equal(h.calls.dispose,1);
});
