import test from 'node:test';
import assert from 'node:assert/strict';
import {mountScopeInvitations, invitationRoles, canRevokeGrant, canUpdateGrant} from '../ui/scope-invitations.js';
function node(tag) {
 const n={tag,children:[],listeners:{},attributes:{},hidden:false,disabled:false,value:'',textContent:'',className:'',type:'',required:false,
 append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=[...xs]},setAttribute(k,v){this.attributes[k]=v},
 addEventListener(k,f){(this.listeners[k]??=[]).push(f)},fire(k){for(const f of this.listeners[k]||[])f({preventDefault(){},target:this})},
 click(){if(!this.disabled)this.fire('click')},reportValidity(){return walk(this).filter(x=>x.required).every(x=>!!x.value)}};
 n.classList={add(x){n.className+=' '+x}};return n;
}
function walk(n){return[n,...n.children.flatMap(walk)]}
const text=n=>walk(n).map(x=>x.textContent).join(' ');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function world(respond) {
 let ctx={principalId:'person_a',kind:'user',generation:1,shared:false};const root=node('div'),calls=[];let changes=0;
 const api=mountScopeInvitations({document:{createElement:node},root,getContext:()=>ctx,request:async(url,opts)=>{calls.push({url,...opts});return respond(url,opts)},onGrantsChanged:async()=>{changes++}});
 return{api,root,calls,get changes(){return changes},ctx(c){ctx={...ctx,...c}},button(label){const n=walk(root).find(x=>x.tag==='button'&&x.textContent===label);assert.ok(n,`missing button ${label}: ${text(root)}`);return n},input(name){const n=walk(root).find(x=>x.name===name);assert.ok(n);return n},buttons(){return walk(root).filter(x=>x.tag==='button').map(x=>x.textContent)}};
}
const scope={type:'assessment',id:'a1',role:'owner'};
const list=(s=scope)=>({scope:{type:s.type,id:s.id},grants:[],pending_invitations:[]});
const confirmResult={confirm_token:'confirmation-secret',impact:{affected:[{scope:{type:'assessment',id:'a1'},role:'member',currently:'owner'}]}};
async function emailPreview(w){w.input('invite-email').value='recipient@example.invalid';w.button('Preview invitation').click();await flush()}
async function acceptPreview(w,value='SECRET_TOKEN'){w.api.openAcceptance();w.input('invitation-token').value=value;w.button('Preview acceptance').click();await flush()}

test('role ceilings protect owners and prohibit viewer management',()=>{
 assert.deepEqual(invitationRoles('member'),['viewer','member']);assert.deepEqual(invitationRoles('owner'),['viewer','member','owner']);assert.deepEqual(invitationRoles('viewer'),[]);
 for(const r of ['viewer','member','owner'])assert.equal(canRevokeGrant(r,'owner'),false);
 assert.equal(canRevokeGrant('member','member'),true);assert.equal(canUpdateGrant('member','viewer'),false);assert.equal(canUpdateGrant('owner','viewer'),true);
});
test('signed-out and shared/participant context never requests staff data',async()=>{
 for(const c of [{principalId:null},{shared:true},{kind:'participant'}]){const w=world(()=>{throw Error('must notcall')});w.ctx(c);await w.api.setScope(scope);w.api.openAcceptance();assert.equal(w.calls.length,0);assert.equal(w.root.hidden,true)}
});
test('viewer has acceptance entry but no manager calls or invite controls',async()=>{
 const w=world(()=>{throw Error('must notcall')});await w.api.setScope({...scope,role:'viewer'});assert.equal(w.calls.length,0);assert.ok(w.buttons().includes('Accept an invitation'));assert.ok(!w.buttons().includes('Preview invitation'));
});
test('member list does not infer names and owner grants have no remove or edit control',async()=>{
 const w=world(()=>({...list(),grants:[{id:'gowner',principal_id:'powner',role:'owner'},{id:'gmember',principal_id:'p2',role:'member'}]}));await w.api.setScope({...scope,role:'member'});
 assert.equal(w.buttons().filter(x=>x==='Remove access').length,1);assert.ok(!w.buttons().includes('Preview role change'));assert.match(text(w.root),/powner/);
});
test('wrong returned scope fails closed without rendering grants',async()=>{
 const w=world(()=>({...list({type:'project',id:'other'}),grants:[{id:'g',principal_id:'private-other',role:'member'}]}));await w.api.setScope(scope);assert.ok(!text(w.root).includes('private-other'));assert.match(text(w.root),/could not be completed/);
});
test('scope change discards delayed list instead of leaking another context',async()=>{
 const old=deferred();const w=world(u=>u.includes('/a1/')?old.promise:list({type:'assessment',id:'a2'}));const a=w.api.setScope(scope);await w.api.setScope({...scope,id:'a2'});old.resolve({...list(),grants:[{id:'g',principal_id:'stale-person',role:'owner'}]});await a;assert.ok(!text(w.root).includes('stale-person'));assert.match(text(w.root),/a2/);
});
test('form edit invalidates pending preview and confirm credential',async()=>{
 const wait=deferred();const w=world((_u,o)=>o.method==='GET'?list():wait.promise);await w.api.setScope(scope);w.input('invite-email').value='first@example.invalid';w.button('Preview invitation').click();w.input('invite-email').value='second@example.invalid';w.input('invite-email').fire('input');wait.resolve(confirmResult);await flush();assert.ok(!w.buttons().includes('Confirm invitation'));assert.equal(w.calls.filter(x=>x.body?.mode==='execute').length,0);
});
test('invite is two step, honest non-delivery, private reveal cleared on context change',async()=>{
 const w=world((_u,o)=>o.method==='GET'?list():o.body.mode==='dry_run'?confirmResult:{invitation_id:'i1',delivered:false,status:'sent',accepted:true,dev_only_link_token:'PRIVATE_HANDOFF'});await w.api.setScope(scope);await emailPreview(w);assert.equal(w.calls.filter(x=>x.body?.mode==='execute').length,0);w.button('Confirm invitation').click();await flush();assert.match(text(w.root),/email not delivered/);assert.match(text(w.root),/has not accepted/);assert.ok(!text(w.root).includes('PRIVATE_HANDOFF'));
 w.button('Reveal private invitation token').click();assert.equal(walk(w.root).find(n=>n.attributes['aria-label']==='Private invitation token').value,'PRIVATE_HANDOFF');await w.api.setScope({...scope,id:'other'});assert.ok(!walk(w.root).some(n=>n.value==='PRIVATE_HANDOFF'));
});
test('missing dev token never invents a handoff or email success',async()=>{
 const w=world((_u,o)=>o.method==='GET'?list():o.body.mode==='dry_run'?confirmResult:{invitation_id:'i1',delivered:false});await w.api.setScope(scope);await emailPreview(w);w.button('Confirm invitation').click();await flush();assert.match(text(w.root),/No invitation credential/);assert.ok(!w.buttons().includes('Reveal private invitation token'));
});
test('zero-grant recipient previews actual scope and accepts with stronger role preserved',async()=>{
 const w=world((_u,o)=>o.body.mode==='dry_run'?confirmResult:{granted:true,scope:{type:'assessment',id:'a1'},role:'owner'});await acceptPreview(w);assert.match(text(w.root),/member access at assessment a1/);assert.match(text(w.root),/Current access: owner/);assert.ok(!text(w.root).includes('SECRET_TOKEN'));w.button('Confirm acceptance').click();await flush();assert.equal(w.changes,1);assert.match(text(w.root),/granted as owner/);assert.ok(!walk(w.root).some(n=>n.value==='SECRET_TOKEN'));assert.equal(w.calls.length,2);assert.equal(w.calls[1].body.confirm_token,'confirmation-secret');
});
test('acceptance preview with absent actual impact refuses to release action',async()=>{
 const w=world(()=>({confirm_token:'c'}));await acceptPreview(w);assert.ok(!w.buttons().includes('Confirm acceptance'));assert.match(text(w.root),/could not be completed/);
});
test('wrong-email/expired/used failures never echo credential or raw error URL',async()=>{
 for(const code of ['NOT_FOUND_OR_NOT_VISIBLE','INVALID_PARAMS','UNKNOWN']){
 const w=world(()=>{throw Object.assign(Error('/v2/invitations/SECRET_TOKEN/accept?email=private'),{code})});await acceptPreview(w);assert.ok(!text(w.root).includes('SECRET_TOKEN'));assert.ok(!text(w.root).includes('email=private'));assert.ok(!w.buttons().includes('Confirm acceptance'));
 }
});
test('uncertain execute clears acceptance token and makes no automatic retry',async()=>{
 const w=world((_u,o)=>{if(o.body.mode==='dry_run')return confirmResult;throw Error('SECRET_TOKEN')});await acceptPreview(w);w.button('Confirm acceptance').click();await flush();assert.equal(w.calls.length,2);assert.match(text(w.root),/outcome could not be confirmed/);assert.ok(!walk(w.root).some(n=>n.value==='SECRET_TOKEN'));assert.ok(!w.buttons().includes('Confirm acceptance'));
});
test('identity change/reset discards delayed successful acceptance',async()=>{
 const wait=deferred();const w=world((_u,o)=>o.body.mode==='dry_run'?confirmResult:wait.promise);await acceptPreview(w);w.button('Confirm acceptance').click();w.ctx({principalId:'person_b',generation:2});w.api.reset();wait.resolve({granted:true,scope:{type:'assessment',id:'a1'},role:'member'});await flush();assert.equal(w.changes,0);assert.equal(w.root.hidden,true);assert.equal(w.root.children.length,0);
});
test('destroy makes prior detached controls inert',async()=>{
 const w=world(()=>list());await w.api.setScope(scope);const old=w.button('Refresh access');const count=w.calls.length;w.api.destroy();old.click();await flush();assert.equal(w.calls.length,count);assert.equal(w.root.hidden,true);
});
test('support may manage exact grants but cannot impersonate invited user',async()=>{
 const w=world(()=>list());w.ctx({kind:'support'});await w.api.setScope(scope);assert.ok(w.buttons().includes('Preview invitation'));assert.ok(!w.buttons().includes('Accept an invitation'));w.api.openAcceptance();assert.ok(!w.buttons().includes('Preview acceptance'));
});

test('owner role edit requires preview, executes exact grant then refreshes authority',async()=>{
 const w=world((_u,o)=>o.method==='GET'?{...list(),grants:[{id:'g1',principal_id:'p2',role:'member'}]}:o.body.mode==='dry_run'?confirmResult:{grant:'g1',role:'member'});await w.api.setScope(scope);w.button('Preview role change').click();await flush();assert.equal(w.calls[1].method,'PATCH');assert.equal(w.calls[1].url,'/v2/assessment/a1/grants/g1');assert.equal(w.calls[1].body.mode,'dry_run');w.button('Confirm role change').click();await flush();assert.equal(w.calls[2].body.mode,'execute');assert.equal(w.changes,1);assert.match(text(w.root),/Role updated/);
});
test('revoke checks exact returned target and never reports unrelated success',async()=>{
 for(const wrong of [false,true]){const w=world((_u,o)=>o.method==='GET'?{...list(),grants:[{id:'g1',principal_id:'p2',role:'viewer'}]}:{grant:wrong?'other':'g1',revoked:true});await w.api.setScope(scope);w.button('Remove access').click();await flush();assert.equal(w.calls[1].method,'DELETE');assert.equal(w.calls[1].url,'/v2/assessment/a1/grants/g1');assert.match(text(w.root),wrong?/outcome could not be confirmed/:/Access removal completed/);assert.equal(w.changes,wrong?0:1)}
});
test('member can revoke member invitation but owner invitation has no revoke control',async()=>{
 const w=world((_u,o)=>o.method==='GET'?{...list(),pending_invitations:[{id:'im',role:'member',status:'sent'},{id:'io',role:'owner',status:'sent'}]}:{id:'im',status:'revoked'});await w.api.setScope({...scope,role:'member'});assert.equal(w.buttons().filter(x=>x==='Revoke invitation').length,1);w.button('Revoke invitation').click();await flush();assert.equal(w.calls[1].url,'/v2/invitations/im');assert.match(text(w.root),/Invitation revocation completed/);
});

test('completed invitation requires explicit handoff completion before refresh or another invite',async()=>{
 let created=false;
 const w=world((_u,o)=>o.method==='GET'?{...list(),pending_invitations:created?[{id:'created-i',role:'viewer',status:'sent'}]:[]}:o.body.mode==='dry_run'?confirmResult:(created=true,{invitation_id:'created-i',delivered:false,dev_only_link_token:'HANDOFF_SENTINEL'}));
 await w.api.setScope(scope);await emailPreview(w);const oldConfirm=w.button('Confirm invitation');oldConfirm.click();await flush();
 assert.match(text(w.root),/created-i/);
 assert.ok(!w.buttons().includes('Refresh access'));assert.ok(!w.buttons().includes('Preview invitation'));assert.ok(!w.buttons().includes('Accept an invitation'));
 oldConfirm.click();await flush();assert.equal(w.calls.filter(x=>x.body?.mode==='execute').length,1);
 w.button('Reveal private invitation token').click();assert.ok(walk(w.root).some(n=>n.value==='HANDOFF_SENTINEL'));
 w.button('Finish handoff and refresh access').click();await flush();
 assert.ok(!walk(w.root).some(n=>n.value==='HANDOFF_SENTINEL'));assert.match(text(w.root),/created-i · viewer · awaiting acceptance/);assert.ok(w.buttons().includes('Preview invitation'));
 assert.equal(w.calls.filter(x=>x.method==='GET').length,2);
});
