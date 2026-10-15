import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {languagePicker,refreshPickers,bindLanguagePickers} from './language-picker.js';
const options=Array.from({length:12},(_,i)=>({id:'l'+i,name:'Language '+i,native:i===0?'ລາວ':'',code:'x'+i}));
function setup(extra={}){const dom=new JSDOM('<form>'+languagePicker({name:'lwc',label:'Survey languages',options,multiple:true,max:8,...extra})+'</form>');const root=dom.window.document.querySelector('form');refreshPickers(root);bindLanguagePickers(root);const q=root.querySelector('input');return{root,q,w:dom.window,search(v){q.value=v;q.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}};}
test('compact search caps results, matches native/code, retains selection and serializes only choices',()=>{
 const m=setup();assert.equal(m.root.querySelectorAll('[data-picker-pick]').length,0);
 m.search('language');assert.equal(m.root.querySelectorAll('[data-picker-pick]').length,6);
 m.search('ລາວ');m.root.querySelector('[data-picker-pick]').click();
 m.search('X10');assert.equal(m.root.querySelector('[data-picker-pick]').dataset.pickerPick,'l10');
 assert.deepEqual(new m.w.FormData(m.root).getAll('lwc'),['l0']);
 m.search('absent');assert.match(m.root.querySelector('[role=status]').textContent,/No matching/);
 assert.match(m.root.querySelector('[data-picker-selected]').textContent,/Language 0/);
 m.root.querySelector('[data-picker-remove]').click();assert.deepEqual(new m.w.FormData(m.root).getAll('lwc'),[]);assert.equal(m.w.document.activeElement,m.q);
});
test('max selections enforced and hidden serializer never participates in focus validation',()=>{
 const m=setup({selected:options.slice(0,8).map(o=>o.id)});m.search('Language');
 assert.ok(m.root.querySelector('[data-picker-pick]').disabled);
 const select=m.root.querySelector('select');assert.equal(select.hidden,true);assert.equal(select.required,false);assert.equal(select.tabIndex,-1);
 m.root.querySelector('[data-picker-remove]').click();m.search('X8');m.root.querySelector('[data-picker-pick]').click();assert.equal(new m.w.FormData(m.root).getAll('lwc').length,8);
});
test('search Enter does not submit and Escape clears results without losing selected languages',()=>{
 const m=setup({selected:['l0']});m.search('Language');
 const enter=new m.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});m.q.dispatchEvent(enter);assert.equal(enter.defaultPrevented,true);
 m.q.dispatchEvent(new m.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(m.q.value,'');assert.equal(m.root.querySelectorAll('[data-picker-pick]').length,0);assert.deepEqual(new m.w.FormData(m.root).getAll('lwc'),['l0']);
});
