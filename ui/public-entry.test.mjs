import assert from 'node:assert/strict';
import test from 'node:test';
import {publicView,observedIdentity} from './public-entry.js';
test('signed-out entry selects actual welcome/how/example screens',()=>{
 for(const [hash,expected] of [['','home'],['#home','home'],['#how','how'],['#example','example']])assert.equal(publicView({shared:false,authenticated:false,hash}),expected);
});
test('shared invitations and authenticated users bypass the generic landing regardless of hash',()=>{
 for(const hash of ['','#how','#example','#participant']){
 assert.equal(publicView({shared:true,authenticated:false,hash}),'workspace');assert.equal(publicView({shared:false,authenticated:true,hash}),'workspace');}
});
test('public intents reach real existing app controls without declaring authentication',()=>{
 for(const hash of ['#facilitator','#participant','#reports-card'])assert.equal(publicView({shared:false,authenticated:false,hash}),'workspace');
 assert.equal(observedIdentity('Checking session…'),false);assert.equal(observedIdentity('Not signed in'),false);assert.equal(observedIdentity('staff · observed-id'),true);
});

test('session restoration waits in existing workspace without flashing public home',()=>assert.equal(publicView({shared:false,authenticated:false,checking:true,hash:''}),'workspace'));

test('legacy participant reload stays on the existing recovery screen without treating its token as staff identity',()=>{assert.equal(publicView({shared:false,authenticated:false,participantResume:true,hash:''}),'workspace');assert.equal(observedIdentity('Not signed in'),false);assert.equal(publicView({shared:false,authenticated:false,participantResume:false,hash:''}),'home');});
