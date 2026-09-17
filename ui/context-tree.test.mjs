import assert from 'node:assert/strict';
import test from 'node:test';
import {projectContext,selectContext} from './context-tree.js';
const select=(value,options,visible=true)=>({visible,value,options:options.map(([value,label,disabled=false])=>({value,label,disabled}))});
function sources(){return {active:true,projects:select('p1',[['','Choose'],['p1','Actual project · owner'],['p2','Other project · viewer']]),assessments:select('a1',[['a1','Actual assessment · collect · member']]),surveys:select('s1',[['s1','Actual survey · open']]),granted:select('',[],false)};}
test('projects only actual enabled options, nests current context and preserves labels',()=>{
 const s=sources();s.projects.options.push({value:'forbidden',label:'disabled',disabled:true});
 const tree=projectContext(s);assert.equal(tree.length,2);assert.equal(tree[0].label,'Actual project · owner');assert.equal(tree[0].children[0].children[0].value,'s1');assert.deepEqual(tree[1].children,[]);assert.equal(JSON.stringify(tree).includes('forbidden'),false);
});
test('hidden controls and shared-route state never disclose retained option labels',()=>{
 const s=sources();s.active=false;assert.deepEqual(projectContext(s),[]);s.active=true;s.projects.visible=false;assert.deepEqual(projectContext(s),[]);s.projects.visible=true;s.assessments.visible=false;assert.deepEqual(projectContext(s)[0].children,[]);
});
test('assessment-only grants remain navigable without inventing a project/workspace',()=>{
 const s=sources();s.projects.visible=false;s.granted=select('direct',[['direct','Direct assessment · viewer']]);
 assert.deepEqual(projectContext(s),[{value:'direct',label:'Direct assessment · viewer',source:'granted-assessments',selected:true,children:[]}]);
});
test('click dispatches existing change event, rejects stale parent or removed/disabled grant',()=>{
 let calls=0;const node={value:'',disabled:false,options:[{value:'a1',disabled:false}],closest:()=>null,dispatchEvent:e=>{assert.equal(e.type,'change');assert.equal(e.bubbles,true);calls++;}};
 const parent={value:'p1'};const doc={getElementById:id=>id==='projects'?parent:node,defaultView:{Event}};
 assert.equal(selectContext(doc,'assessments','a1',{projects:'old'}),false);assert.equal(calls,0);
 assert.equal(selectContext(doc,'assessments','a1',{projects:'p1'}),true);assert.equal(node.value,'a1');assert.equal(calls,1);
 node.options=[];assert.equal(selectContext(doc,'assessments','a1'),false);
 node.options=[{value:'a1',disabled:true}];assert.equal(selectContext(doc,'assessments','a1'),false);
 node.closest=()=>({hidden:true});assert.equal(selectContext(doc,'assessments','a1'),false);assert.equal(calls,1);
});
