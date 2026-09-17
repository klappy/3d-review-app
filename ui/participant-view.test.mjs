import test from 'node:test';
import assert from 'node:assert/strict';
import {itemError} from './participant-view.js';
const data=rows=>{const f=new FormData();for(const [k,v]of rows)f.append(k,v);return f;};
test('required/optional single and multi match existing form semantics without normalization',()=>{
  assert.equal(itemError({id:'a',type:'single',required:false},data([])),null);
  assert.equal(itemError({id:'a',type:'single'},data([])),'Answer required: a');
  assert.equal(itemError({id:'a',type:'multi'},data([])),'Answer required: a');
  assert.equal(itemError({id:'a',type:'multi'},data([['a','0']])),null);
});
test('exclusive choice cannot combine, ordinary multiple choices preserve all values',()=>{
  const item={id:'a',text:'Source question',type:'multi',options:[{code:'none',exclusive:true},{code:'a'},{code:'b'}]};
  const f=data([['a','a'],['a','b']]);assert.equal(itemError(item,f),null);assert.deepEqual(f.getAll('a'),['a','b']);
  assert.equal(itemError(item,data([['a','none'],['a','a']])),'An exclusion choice cannot be combined: Source question');
  assert.equal(itemError(item,data([['a','none']])),null);
});
