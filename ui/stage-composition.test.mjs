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
