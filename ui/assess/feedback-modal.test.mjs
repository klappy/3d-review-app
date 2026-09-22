import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createFeedbackModal,pageContext} from './feedback-modal.js';
function fixture(api = async()=>({recorded:true,stripped:false,feedback_id:'fb_fixture'})) {
 const dom=new JSDOM('<a href="#feedback">App feedback</a><main><input value="UNSAVED SECRET"></main>',{url:'https://fixture.test/#assessment/private-id'});const doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 let identity=1,key=dom.window.location.hash;
 const modal=createFeedbackModal({doc,context:()=>({state:{principal:{kind:'person'}},api,identity}),route:()=>({kind:'assessment',id:'private-id'}),routeKey:()=>key,clientRelease:{version:'0.15.0',commit:'a'.repeat(40)},now:()=> '2026-09-18T00:00:00.000Z'});
 return {dom,doc,modal,opener:doc.querySelector('a'),change(){identity++;key='#projects';modal.reset();}};
}
test('in-place close/reopen preserves underlying DOM, unsaved input, route and feedback draft',async()=>{
 const f=fixture(),main=f.doc.querySelector('main'),input=main.querySelector('input');
 await f.modal.open(f.opener);f.doc.querySelector('textarea').value='Draft problem';
 f.doc.querySelector('[data-feedback-close]').click();
 assert.equal(f.doc.activeElement,f.opener);assert.equal(f.dom.window.location.hash,'#assessment/private-id');assert.equal(f.doc.querySelector('main'),main);assert.equal(input.value,'UNSAVED SECRET');
 await f.modal.open(f.opener);assert.equal(f.doc.querySelector('textarea').value,'Draft problem');f.dom.window.close();
});
test('submission captures only registered context and loaded UI identity without page inputs or identifiers',async()=>{
 let sent;const f=fixture(async(url,init)=>{sent=init.body;return {recorded:true,stripped:false,feedback_id:'fb_fixture'};});await f.modal.open(f.opener);
 f.doc.querySelector('textarea').value='Button did not respond';await f.doc.querySelector('form').onsubmit({preventDefault(){}});
 assert.deepEqual(sent.experience,{occurred_at:'2026-09-18T00:00:00.000Z',surface:'web',host:'browser',client_release:{version:'0.15.0',commit:'a'.repeat(40)},context:{page:'assessment',component:'app_feedback'}});
 assert.doesNotMatch(JSON.stringify(sent),/private-id|UNSAVED SECRET|fixture.test/);assert.equal(sent.require_authenticated,true);f.dom.window.close();
});
test('identity/route departure clears draft and ignores late receipt',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));await f.modal.open(f.opener);f.doc.querySelector('textarea').value='Old account draft';const send=f.doc.querySelector('form').onsubmit({preventDefault(){}});
 f.change();finish({recorded:true,stripped:false,feedback_id:'old_receipt'});await send;await f.modal.open(f.opener);
 assert.equal(f.doc.querySelector('textarea').value,'');assert.doesNotMatch(f.doc.querySelector('dialog').textContent,/old_receipt/);f.dom.window.close();
});
test('unregistered route details collapse to unknown and cannot enter metadata',()=>{assert.deepEqual(pageContext({kind:'https://secret/?token=x',id:'secret'}),{page:'unknown',component:'app_feedback'});});

// K3b1 strict containment: Tab/Shift+Tab wrap inside the dialog's own controls; the dialog element/BODY never receives focus.
test('Tab from the last control and Shift+Tab from the first wrap inside the open dialog; focus never leaves; initial focus is the textarea',async()=>{
 const f=fixture();await f.modal.open(f.opener);const d=f.doc.querySelector('dialog');const w=f.dom.window;
 // jsdom has no layout: give every control a client rect so the tabbable filter sees them
 for(const el of d.querySelectorAll('a,button,input,select,textarea'))el.getClientRects=()=>[{width:1,height:1}];
 assert.equal(f.doc.activeElement,d.querySelector('textarea'),'textarea focused first');
 const list=[...d.querySelectorAll('a[href],button,input,select,textarea')].filter(el=>!el.disabled);const first=list[0],last=list[list.length-1];
 last.focus();last.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,first,'Tab from last wraps to first');
 first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,last,'Shift+Tab from first wraps to last');
 // focus that escaped to BODY (browser edge) is pulled back on the next Tab in either direction
 f.doc.body.focus();d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.ok(d.contains(f.doc.activeElement));
 f.doc.body.focus();d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,last);
 // no document-level trap: Tab outside a closed dialog is untouched
 d.close();const ev=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});f.doc.body.dispatchEvent(ev);assert.equal(ev.defaultPrevented,false);f.dom.window.close();
});
test('outside pointer click dismisses; a click that starts inside and ends outside does not',async()=>{
 const f=fixture();await f.modal.open(f.opener);const d=f.doc.querySelector('dialog');const w=f.dom.window;
 d.getBoundingClientRect=()=>({left:100,top:100,right:400,bottom:400});
 d.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:150,clientY:150}));d.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:10,clientY:10}));assert.equal(d.open,true,'drag from inside to outside keeps the dialog');
 d.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:10,clientY:10}));d.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:10,clientY:10}));assert.equal(d.open,false,'actual outside click closes');
 assert.equal(f.doc.activeElement,f.opener);f.dom.window.close();
});
