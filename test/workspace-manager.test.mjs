import test from 'node:test';
import assert from 'node:assert/strict';
import {mountWorkspaceManager,mayGroup} from '../ui/workspace-manager.js';
class Node {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attrs={};this.textContent='';this.value='';this.hidden=false;this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(key,val){this.attrs[key]=val;}
  querySelector(){return walk(this).find(n=>'data-wm-confirm' in n.attrs);}
}
const walk=n=>[n,...n.children.flatMap(walk)];
const text=n=>walk(n).map(x=>x.textContent).join(' ');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
function fixture({role='owner',kind='user',provisioned=true,projects=[],grouped=[]}={}) {
  const root=new Node();let ctx={generation:1,principalId:'actor',kind,shared:false,provisioned,authorizedProjects:projects};
  let ws=[{id:'ws1',name:'Actual workspace',role,archived_at:null}],selected=[],changes=0;const calls=[];let override;
  const request=async(path,opts)=>{
    calls.push({path,...opts});if(override){const value=override(path,opts);if(value!==undefined)return value;}
    if(path==='/v2/workspaces'&&opts.method==='GET')return{workspaces:ws};
    if(path==='/v2/workspaces'&&opts.method==='POST'){const w={id:'ws2',name:opts.body.name,role:'owner'};ws.push(w);return{workspace:w};}
    if(opts.method==='GET')return{workspace:ws.find(w=>path.endsWith(w.id)),projects:grouped};
    if(opts.method==='DELETE'&&opts.body?.mode==='dry_run')return{confirm_token:'secret-confirm',expires_in:300,impact:{affected:[{projects:0,grants:1}],irreversible:true}};
    if(opts.method==='DELETE'&&opts.body?.mode==='execute'){ws=ws.filter(w=>!path.endsWith(w.id));return{deleted:true};}
    return{};
  };
  const api=mountWorkspaceManager({document:{createElement:tag=>new Node(tag)},root,request,getContext:()=>ctx,onWorkspaceSelected:w=>selected.push(w),onMutation:()=>{changes++;}});
  const click=async label=>{const b=walk(root).find(n=>n.tagName==='button'&&n.textContent===label);assert.ok(b,`missing ${label}`);assert.equal(b.disabled,false);await b.listeners.click();};
  const open=async()=>{await api.refresh();await click('Open workspace');};
  return{api,root,calls,click,open,selected,get changes(){return changes;},setContext:patch=>{ctx={...ctx,...patch};},override:fn=>{override=fn;}};
}
test('grouping requires both exact independent roles',()=>{
 for(const w of ['owner','member','viewer'])for(const p of ['owner','member','viewer',undefined])assert.equal(mayGroup(w,p),(w==='owner'&&['owner','member'].includes(p))||(w==='member'&&p==='owner'));
});
test('signed out, shared, participant and unsupported identity perform no reads',async()=>{
 for(const patch of [{principalId:null},{shared:true},{participant:true},{kind:'participant'}]){const f=fixture();f.setContext(patch);await f.api.refresh();assert.equal(f.calls.length,0);assert.equal(f.root.hidden,true);}
});
test('create uses unwrapped result, selects new workspace and notifies integration',async()=>{
 const f=fixture();await f.api.refresh();const form=walk(f.root).find(n=>n.tagName==='form');walk(form).find(n=>n.tagName==='input').value='New actual';await form.listeners.submit({preventDefault(){}});
 assert.deepEqual(f.calls.find(c=>c.method==='POST').body,{name:'New actual'});assert.equal(f.selected.at(-1).id,'ws2');assert.equal(f.changes,1);assert.match(text(f.root),/New actual/);
});
test('unprovisioned user and support do not see create; viewer sees no owner actions',async()=>{
 for(const options of [{provisioned:false},{kind:'support',provisioned:true},{role:'viewer',provisioned:false}]){const f=fixture(options);await f.open();assert.doesNotMatch(text(f.root),/Create workspace/);if(options.role==='viewer')assert.doesNotMatch(text(f.root),/Rename workspace|Archive workspace|Preview deletion/);}
});
test('grouped names never confer access or group removal; authorized role enables actual endpoint',async()=>{
 const f=fixture({role:'member',projects:[{id:'p2',name:'Owned',role:'owner'},{id:'p3',name:'Member',role:'member'}],grouped:[{id:'p1',name:'Listing only'}]});await f.open();assert.match(text(f.root),/Listing only/);assert.doesNotMatch(text(f.root),/Remove from workspace/);const options=walk(f.root).filter(n=>n.tagName==='option');assert.deepEqual(options.map(n=>n.value),['p2']);await f.click('Add project to workspace');assert.ok(f.calls.some(c=>c.path==='/v2/workspaces/ws1/projects/p2'&&c.method==='POST'));assert.equal(f.calls.filter(c=>c.path.startsWith('/v2/projects')).length,0);
});
test('delete is explicit preview/confirm; token never rendered; cancellation cannot execute',async()=>{
 const f=fixture();await f.open();await f.click('Preview deletion');assert.doesNotMatch(text(f.root),/secret-confirm/);assert.match(text(f.root),/grants: 1/);await f.click('Cancel');assert.equal(f.calls.some(c=>c.body?.mode==='execute'),false);await f.click('Preview deletion');await f.click('Confirm deletion');assert.deepEqual(f.calls.find(c=>c.body?.mode==='execute').body,{mode:'execute',confirm_token:'secret-confirm'});assert.equal(f.selected.at(-1),null);
});
test('editing form invalidates delete confirmation',async()=>{
 const f=fixture();await f.open();await f.click('Preview deletion');const input=walk(f.root).find(n=>n.tagName==='input');input.listeners.input();const confirm=walk(f.root).find(n=>n.textContent==='Confirm deletion');assert.equal(confirm.disabled,true);await confirm.listeners.click();assert.equal(f.calls.some(c=>c.body?.mode==='execute'),false);
});
test('identity reset and late results never resurrect private rows',async()=>{
 const f=fixture();const d=deferred();f.override(()=>d.promise);const pending=f.api.refresh();f.setContext({generation:2,principalId:'other'});f.api.reset();d.resolve({workspaces:[{id:'private',name:'PRIVATE',role:'owner'}]});await pending;assert.equal(f.root.hidden,true);assert.doesNotMatch(text(f.root),/PRIVATE/);
});
test('refresh race cannot replace newer list; stale errors do not paint',async()=>{
 const f=fixture();const d=deferred();let first=true;f.override(()=>{if(first){first=false;return d.promise;}});const old=f.api.refresh();await f.api.refresh();d.reject(new Error('private details'));await old;assert.match(text(f.root),/Actual workspace/);assert.doesNotMatch(text(f.root),/private details|could not be confirmed/);
});
test('uncertain write receives no automatic retry or false success; explicit refresh recovers',async()=>{
 const f=fixture();await f.open();f.override((p,o)=>o.method==='POST'?Promise.reject(new Error('secret error')):undefined);await f.click('Archive workspace');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.match(text(f.root),/could not be confirmed/);assert.doesNotMatch(text(f.root),/secret error|Workspace updated/);assert.equal(f.changes,0);
});
test('destroy blocks refresh and clears pending private state',async()=>{const f=fixture();await f.open();const before=f.calls.length;f.api.destroy();await f.api.refresh();assert.equal(f.calls.length,before);assert.equal(f.root.hidden,true);});
test('expired deletion preview cannot execute',async()=>{
 const f=fixture();await f.open();await f.click('Preview deletion');const now=Date.now;try{Date.now=()=>now()+301000;await f.click('Confirm deletion');assert.equal(f.calls.some(c=>c.body?.mode==='execute'),false);assert.match(text(f.root),/Preview deletion again/);}finally{Date.now=now;}
});
test('renaming and archiving use exact routes without danger mode; removed grant clears selected host scope',async()=>{
 const f=fixture();await f.open();const rename=walk(f.root).filter(n=>n.tagName==='form')[1];walk(rename).find(n=>n.tagName==='input').value='Renamed';await rename.listeners.submit({preventDefault(){}});assert.deepEqual(f.calls.find(c=>c.method==='PATCH').body,{name:'Renamed'});
 f.override((p,o)=>p==='/v2/workspaces'&&o.method==='GET'?{workspaces:[]}:undefined);await f.click('Archive workspace');assert.equal(f.calls.find(c=>c.path.endsWith('/archive')).body,undefined);assert.equal(f.selected.at(-1),null);assert.doesNotMatch(text(f.root),/Rename workspace/);
});
