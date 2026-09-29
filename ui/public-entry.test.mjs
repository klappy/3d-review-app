import assert from 'node:assert/strict';
import test from 'node:test';
import {publicView,observedIdentity,mountPublicEntry} from './public-entry.js';
test('signed-out entry selects actual welcome/how/example screens',()=>{
 for(const [hash,expected] of [['','home'],['#home','home'],['#how','how'],['#example','example']])assert.equal(publicView({shared:false,authenticated:false,hash}),expected);
});
test('shared invitations and authenticated users bypass the generic landing regardless of hash',()=>{
 for(const hash of ['','#how','#example','#participant']){
 assert.equal(publicView({shared:true,authenticated:false,hash}),'workspace');assert.equal(publicView({shared:false,authenticated:true,hash}),'workspace');}
});
test('public intents reach real existing app controls without declaring authentication',()=>{
 for(const hash of ['#facilitator','#participant','#reports-card'])assert.equal(publicView({shared:false,authenticated:false,hash}),'workspace');
 assert.equal(observedIdentity({textContent:'Checking session…',dataset:{}}),false);assert.equal(observedIdentity({textContent:'Not signed in',dataset:{signedIn:'false'}}),false);assert.equal(observedIdentity({textContent:'Signed in',dataset:{signedIn:'true'}}),true);
 assert.equal(observedIdentity({textContent:'user · usr_1',dataset:{}}),false,'header text alone never signals identity');assert.equal(observedIdentity(null),false);
});

test('session restoration waits in existing workspace without flashing public home',()=>assert.equal(publicView({shared:false,authenticated:false,checking:true,hash:''}),'workspace'));

test('Access email-code return stays in workspace while a facilitator token is still unresolved',()=>{
 const identity={textContent:'Not signed in'};
 const nodes={identity,'public-home':{hidden:false},'public-how':{hidden:true},'public-example':{hidden:true},'public-entry':{hidden:false},facilitator:{hidden:false}};
 const document={body:{dataset:{}},getElementById:id=>nodes[id],querySelectorAll:()=>[]};
 mountPublicEntry(document,{location:{hash:''},sessionStorage:{getItem:k=>k==='facilitatorToken'?'tok':null},addEventListener(){},MutationObserver:class{observe(){}}});
 assert.equal(document.body.dataset.entryView,'workspace');assert.equal(nodes['public-entry'].hidden,true);
});

test('legacy participant reload stays on the existing recovery screen without treating its token as staff identity',()=>{assert.equal(publicView({shared:false,authenticated:false,participantResume:true,hash:''}),'workspace');assert.equal(observedIdentity({textContent:'Not signed in',dataset:{signedIn:'false'}}),false);assert.equal(publicView({shared:false,authenticated:false,participantResume:false,hash:''}),'home');});

test('explicit invitation presentation bypasses saved participant landing without implying identity',()=>{
 assert.equal(publicView({invitation:true,shared:true,participantResume:true,authenticated:false,hash:''}),'workspace');
 assert.equal(observedIdentity({textContent:'Invitation',dataset:{}}),false);
});

test('explicit invite page load stays isolated from saved participant storage after the intent ends (Bugbot 4039886032)',()=>{
 const identity={textContent:'Signed in',dataset:{signedIn:'true'}};
 const nodes={identity,'public-home':{hidden:false},'public-how':{hidden:true},'public-example':{hidden:true},'public-entry':{hidden:false},facilitator:{hidden:false,scrollIntoView(){}}};
 let render=null;
 const document={body:{dataset:{invitationEntry:'true'}},getElementById:id=>nodes[id],querySelectorAll:()=>[],querySelector:()=>null};
 mountPublicEntry(document,{location:{hash:''},sessionStorage:{getItem:k=>k==='participantToken'?'pt_leftover':k==='shared:current'?'ns_leftover':null},addEventListener(){},MutationObserver:class{constructor(fn){render=render||fn}observe(){}}});
 // intent already ended (no data-invitation-intent): a leftover participant token must not select the participant recovery screen
 assert.equal(document.body.dataset.entryView,'workspace');
 assert.equal(nodes['public-entry'].hidden,true);
});

test('legacy header "Signed in" + data-signed-in shows the workspace; signed out shows home (bincy-b31)',()=>{
 const mount=(identity)=>{
  const nodes={identity,'public-home':{hidden:false},'public-how':{hidden:true},'public-example':{hidden:true},'public-entry':{hidden:false},facilitator:{hidden:false,scrollIntoView(){}}};
  const document={body:{dataset:{}},getElementById:id=>nodes[id],querySelectorAll:()=>[],querySelector:()=>null};
  mountPublicEntry(document,{location:{hash:''},sessionStorage:{getItem:()=>null},addEventListener(){},MutationObserver:class{observe(){}}});
  return {document,nodes};
 };
 const inn=mount({textContent:'Signed in',dataset:{signedIn:'true'}});
 assert.equal(inn.document.body.dataset.entryView,'workspace');assert.equal(inn.nodes['public-entry'].hidden,true);
 const out=mount({textContent:'Not signed in',dataset:{signedIn:'false'}});
 assert.equal(out.document.body.dataset.entryView,'home');assert.equal(out.nodes['public-entry'].hidden,false);
});
