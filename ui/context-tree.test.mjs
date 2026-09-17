import assert from 'node:assert/strict';
import test from 'node:test';
import {projectContext,selectContext,groupContext} from './context-tree.js';
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
 assert.deepEqual(projectContext(s),[{value:'direct',label:'Direct assessment · viewer',source:'granted-assessments',selected:true,children:[{value:'s1',label:'Actual survey · open',source:'surveys',selected:true,children:[]}]}]);
});
test('click dispatches existing change event, rejects stale parent or removed/disabled grant',()=>{
 let calls=0;const node={value:'',disabled:false,options:[{value:'a1',disabled:false}],closest:()=>null,dispatchEvent:e=>{assert.equal(e.type,'change');assert.equal(e.bubbles,true);calls++;}};
 const parent={value:'p1',closest:()=>null};const doc={getElementById:id=>id==='projects'?parent:node,defaultView:{Event}};
 assert.equal(selectContext(doc,'assessments','a1',{projects:'old'}),false);assert.equal(calls,0);
 assert.equal(selectContext(doc,'assessments','a1',{projects:'p1'}),true);assert.equal(node.value,'a1');assert.equal(calls,1);
 node.options=[];assert.equal(selectContext(doc,'assessments','a1'),false);
 node.options=[{value:'a1',disabled:true}];assert.equal(selectContext(doc,'assessments','a1'),false);
 node.closest=()=>({hidden:true});assert.equal(selectContext(doc,'assessments','a1'),false);assert.equal(calls,1);
});

test('disabled source excluded, direct selected assessment receives its surveys without a parent',()=>{
 const s=sources();s.projects.disabled=true;s.granted=select('direct',[['direct','Direct assessment']]);
 const tree=projectContext(s);assert.equal(tree.length,1);assert.equal(tree[0].source,'granted-assessments');assert.equal(tree[0].children[0].value,'s1');
 s.surveys.disabled=true;assert.equal(projectContext(s)[0].children.length,0);
});
test('workspace grouping intersects authorized projects and role badges never inherit',()=>{
 const roots=projectContext(sources());
 const tree=groupContext(roots,{active:true,workspaces:[{id:'w',name:'Authorized workspace',role:'owner',projectIds:['p1','private']}],roles:{projects:{p1:'member'}}});
 assert.equal(tree[0].children.length,1);assert.equal(tree[0].children[0].role,'member');assert.equal(tree[0].children[0].children[0].role,'');assert.equal(tree[1].value,'p2');assert.equal(JSON.stringify(tree).includes('private'),false);
 assert.equal(groupContext(roots,null),roots);
});
