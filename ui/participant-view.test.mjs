import test from 'node:test';
import assert from 'node:assert/strict';
import {itemError} from './participant-view.js';
const data=rows=>{const f=new FormData();for(const [k,v]of rows)f.append(k,v);return f;};
test('required/optional single and multi match existing form semantics without normalization',()=>{
  assert.equal(itemError({id:'a',type:'single',required:false},data([])),null);
  assert.equal(itemError({id:'a',type:'single'},data([])),'Answer required: a');
  assert.equal(itemError({id:'a',type:'multi'},data([])),'Answer required: a');
  assert.equal(itemError({id:'a',type:'multi'},data([['a','0']])),null);
});
test('exclusive choice cannot combine, ordinary multiple choices preserve all values',()=>{
  const item={id:'a',text:'Source question',type:'multi',options:[{code:'none',exclusive:true},{code:'a'},{code:'b'}]};
  const f=data([['a','a'],['a','b']]);assert.equal(itemError(item,f),null);assert.deepEqual(f.getAll('a'),['a','b']);
  assert.equal(itemError(item,data([['a','none'],['a','a']])),'An exclusion choice cannot be combined: Source question');
  assert.equal(itemError(item,data([['a','none']])),null);
});

test('invalid Next stays paged; independent native form invalid still reveals hidden targets',async()=>{
  const {mountParticipantView}=await import('./participant-view.js');
  class Node {
    children=[];listeners={};hidden=false;dataset={};type='';
    append(...nodes){this.children.push(...nodes);}
    setAttribute(){}
    addEventListener(type,fn){this.listeners[type]=fn;}
    removeEventListener(type){delete this.listeners[type];}
    focus(){}
    remove(){}
    querySelector(selector){return selector==='legend'?new Node():this.inputs?.[0];}
    querySelectorAll(selector){return selector==='button'?[review]:this.inputs||[];}
  }
  const root=new Node(),form=new Node(),questions=new Node(),review=new Node();review.type='submit';form.contains=n=>n===review;
  const fields=[new Node(),new Node()];fields[0].dataset.item='scale';fields[1].dataset.item='text';questions.children=fields;
  let events=0;
  const input=new Node();input.checkValidity=()=>{events++;form.listeners.invalid({target:input});return false;};input.reportValidity=()=>{events++;form.listeners.invalid({target:input});return false;};fields[0].inputs=[input];fields[1].inputs=[new Node()];
  const doc={createElement:()=>new Node(),defaultView:{FormData:class extends FormData{constructor(){super();this.set('scale','9');}}}};
  const controller=mountParticipantView({doc,root,form,questions,reviewAnswers:new Node(),model:{items:[{id:'scale',type:'scale'},{id:'text',type:'text'}]},reviewButton:review});
  controller.showForm(0);const next=root.children[1].children[1].children[1];next.listeners.click();
  assert.equal(events,2);assert.deepEqual(fields.map(f=>f.hidden),[false,true]);
  assert.equal(root.children[1].children[0].textContent,'Question 1 of 2');
  form.listeners.invalid({target:fields[1].inputs[0]});assert.deepEqual(fields.map(f=>f.hidden),[false,false]);
  controller.showForm(0);next.listeners.click();assert.deepEqual(fields.map(f=>f.hidden),[false,true]);
  controller.destroy();assert.equal(form.listeners.invalid,undefined);
});

test('v3 L1-5: participant intro never paints the raw template source ref (375px overflow, NEED 5→1)',async()=>{
  const {mountParticipantView}=await import('./participant-view.js');
  class Node{children=[];listeners={};hidden=false;dataset={};type='';textContent='';append(...n){this.children.push(...n);}setAttribute(){}addEventListener(t,f){this.listeners[t]=f;}removeEventListener(){}focus(){}remove(){}querySelector(){return null;}querySelectorAll(s){return s==='button'?[review]:[];}}
  const root=new Node(),form=new Node(),questions=new Node(),review=new Node();review.type='submit';form.contains=n=>n===review;questions.children=[new Node()];questions.children[0].dataset.item='a';
  const doc={createElement:()=>new Node(),defaultView:{FormData}};
  const ref='klappy/3d-quality-review@f042cde:rubric_csv/Items.csv+Options.csv';
  mountParticipantView({doc,root,form,questions,reviewAnswers:new Node(),model:{assessment:'A',items:[{id:'a',type:'text'}],template:{perspective:'Church',source_ref:ref}},reviewButton:review});
  const texts=[];const walk=n=>{texts.push(String(n.textContent||''));(n.children||[]).forEach(walk);};walk(root);
  assert.ok(texts.some(t=>t.includes('Church')),'perspective still shown');
  assert.ok(!texts.some(t=>t.includes(ref)),'source ref not painted');
});

test('v3 L1-8: welcome and pager follow prototype frames 8/9 (eyebrow, title, full-width Start, segmented progress)',async()=>{
  const {mountParticipantView}=await import('./participant-view.js');
  class Node{children=[];listeners={};hidden=false;dataset={};type='';textContent='';className='';append(...n){this.children.push(...n);}setAttribute(){}addEventListener(t,f){this.listeners[t]=f;}removeEventListener(){}focus(){}remove(){}querySelector(){return null;}querySelectorAll(s){return s==='button'?[review]:[];}}
  const root=new Node(),form=new Node(),questions=new Node(),review=new Node();review.type='submit';form.contains=n=>n===review;
  questions.children=[new Node(),new Node(),new Node()];questions.children.forEach((f,i)=>f.dataset.item='q'+i);
  const doc={createElement:()=>new Node(),defaultView:{FormData}};
  const c=mountParticipantView({doc,root,form,questions,reviewAnswers:new Node(),model:{assessment:'Mark review',language:'Tok Pisin',project:'Hill Project',purpose:'Mark 1–4',format:'Audio',period:null,items:[0,1,2].map(i=>({id:'q'+i,type:'text',required:false})),template:{perspective:'Church'}},reviewButton:review});
  const intro=root.children[0];const texts=intro.children.map(n=>n.textContent);
  assert.equal(texts[0],'Church · Mark review');
  assert.ok(texts.includes('We would like your perspective'));
  assert.ok(texts.some(t=>t.includes('Tok Pisin translation')));
  // Bincy B10: the shared context step 3 lists, once, in one compact line (empty fields skipped).
  assert.equal(intro.children.filter(n=>n.className.includes('participant-context')).length,1);
  assert.ok(texts.includes('Hill Project · Tok Pisin · Mark 1–4 · Audio'));
  const start=intro.children.find(n=>n.textContent==='Start');assert.ok(start);assert.match(start.className,/primary/);
  assert.ok(!texts.includes('Begin'));
  start.listeners.click();
  const nav=root.children[1];assert.equal(nav.children[0].textContent,'Question 1 of 3');
  const bar=nav.children[2];assert.equal(bar.className,'participant-bar');assert.deepEqual(bar.children.map(s=>s.className),['done','','']);
  c.showForm(2);assert.deepEqual(bar.children.map(s=>s.className),['done','done','done']);
});

test('Bincy B30: welcome is one heading, the visible invitation/privacy line, B10 meta row, one primary action; Time and no-sign-in behind Learn more',async()=>{
  const {mountParticipantView}=await import('./participant-view.js');
  class Node{children=[];listeners={};hidden=false;dataset={};type='';textContent='';className='';constructor(tag){this.tag=tag;}append(...n){this.children.push(...n);}setAttribute(){}addEventListener(t,f){this.listeners[t]=f;}removeEventListener(){}focus(){}remove(){}querySelector(){return null;}querySelectorAll(s){return s==='button'?[review]:[];}}
  const root=new Node(),form=new Node(),questions=new Node(),review=new Node();review.type='submit';form.contains=n=>n===review;
  questions.children=[new Node(),new Node()];questions.children.forEach((f,i)=>f.dataset.item='q'+i);
  const doc={createElement:t=>new Node(t),defaultView:{FormData}};
  mountParticipantView({doc,root,form,questions,reviewAnswers:new Node(),model:{assessment:'A',language:'Tok Pisin',project:'Hill Project',purpose:'Mark 1–4',format:'Audio',period:'Oct',items:[0,1].map(i=>({id:'q'+i,type:'text'})),template:{perspective:'Church'}},reviewButton:review});
  const intro=root.children[0];const shown=intro.children;
  assert.deepEqual(shown.map(n=>n.tag),['p','h2','p','p','button','details']);
  assert.equal(shown[0].className,'eyebrow');
  // B27 privacy wording is captain-held: it stays visible, never behind Learn more.
  assert.equal(shown[2].className,'participant-lead');assert.match(shown[2].textContent,/Tok Pisin translation.*never shown on their own/);
  assert.match(shown[3].className,/participant-context/);assert.equal(shown[3].textContent,'Hill Project · Tok Pisin · Mark 1–4 · Audio · Oct');
  assert.equal(shown.filter(n=>n.tag==='button').length,1);assert.equal(shown[4].textContent,'Start');
  const more=shown[5];assert.equal(more.children[0].tag,'summary');assert.equal(more.children[0].textContent,'Learn more');
  const hidden=more.children.slice(1).map(n=>n.textContent).join(' ');
  for(const w of ['No account, no sign-in','Time: about 5 minutes · 2 questions'])assert.ok(hidden.includes(w),w);
  assert.ok(!hidden.includes('never shown on their own'),'privacy wording not hidden');
});
