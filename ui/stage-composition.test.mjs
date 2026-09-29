import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionState } from './stage-composition.js';
test('unselected and signed-out contexts default Prepare; selected context follows actual tab',()=>{
  assert.equal(compositionState({staff:true}).phase,'prepare');
  assert.equal(compositionState({context:false,selected:'understand'}).phase,'prepare');
  assert.equal(compositionState({context:true,selected:'understand'}).phase,'understand');
});
test('shared and legacy recovery take precedence over staff and report hashes',()=>{
  for(const mode of [{shared:true},{legacy:true}])assert.equal(compositionState({...mode,staff:true,hash:'#reports-card'}).route,'participant');
  assert.equal(compositionState({hash:'#participant'}).route,'participant');
  assert.equal(compositionState({hash:'#evidence'}).route,'evidence');
});

test('explicit invitation intent overrides saved participant presentation only until it ends',()=>{
 const saved={shared:true,legacy:true,staff:false};
 assert.deepEqual(compositionState({...saved,invitation:true}),{route:'workspace',phase:'prepare',staff:false});
 assert.equal(compositionState({...saved,invitation:false}).route,'participant');
});

import { mountStageComposition } from './stage-composition.js';
test('mounted: explicit invite page load ignores leftover participant storage after the intent ends (Bugbot 4039886032)',()=>{
 const el=()=>({hidden:false,textContent:'',querySelector:()=>null});
 const nodes={identity:{textContent:'Signed in',dataset:{signedIn:'true'}},'stage-tabs-root':el(),'stage-workspace':{hidden:true},facilitator:{hidden:false},participant:el()};
 const doc={body:{dataset:{invitationEntry:'true'}},getElementById:id=>nodes[id]};
 const win={location:{hash:''},sessionStorage:{getItem:k=>k==='participantToken'?'pt_leftover':null},addEventListener(){},MutationObserver:class{observe(){}}};
 mountStageComposition(doc,win);
 assert.equal(doc.body.dataset.workspaceRoute,'workspace','no invitation intent, leftover participantToken: route stays workspace on an isolated invite load');
 const doc2={body:{dataset:{}},getElementById:id=>nodes[id]};
 mountStageComposition(doc2,win);
 assert.equal(doc2.body.dataset.workspaceRoute,'participant','a normal (non-invite) load with a saved participant token still resumes the participant route');
});

test('mounted: staff confirmation reads #identity[data-signed-in], not the header text (bincy-b31)',()=>{
 const el=()=>({hidden:false,textContent:'',querySelector:()=>null});
 const win={location:{hash:''},sessionStorage:{getItem:()=>null},addEventListener(){},MutationObserver:class{observe(){}}};
 for(const [identity,want] of [[{textContent:'Signed in',dataset:{signedIn:'true'}},'true'],[{textContent:'Not signed in',dataset:{signedIn:'false'}},'false']]){
  const nodes={identity,'stage-tabs-root':el(),'stage-workspace':{hidden:true},facilitator:{hidden:false},participant:el()};
  const doc={body:{dataset:{}},getElementById:id=>nodes[id]};
  mountStageComposition(doc,win);
  assert.equal(doc.body.dataset.staffConfirmed,want);
 }
});
