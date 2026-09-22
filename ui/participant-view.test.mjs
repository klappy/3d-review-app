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
  // K4 kit pager: nav = [pips, progress, controls]; controls = [Back, Next].
  controller.showForm(0);const nav=root.children[1];const next=nav.children[2].children[1];next.listeners.click();
  assert.equal(events,2);assert.deepEqual(fields.map(f=>f.hidden),[false,true]);
  assert.equal(nav.children[1].textContent,'Question 1 of 2');
  assert.deepEqual(nav.children[0].children.map(p=>p.className),['done','']);
  form.listeners.invalid({target:fields[1].inputs[0]});assert.deepEqual(fields.map(f=>f.hidden),[false,false]);
  controller.showForm(0);next.listeners.click();assert.deepEqual(fields.map(f=>f.hidden),[false,true]);
  controller.destroy();assert.equal(form.listeners.invalid,undefined);
});
