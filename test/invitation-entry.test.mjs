import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInvitationFragment} from '../ui/public-entry.js';
test('exact bounded invitation fragment accepts only token alphabet and rejects mixed routes',()=>{
 assert.equal(parseInvitationFragment('#invite=SECRET_abc-12'),'SECRET_abc-12');
 for(const h of ['#invite=','#invite=%ZZ','#invite=abc&survey=def','#survey=abc&invite=def','#invite='+ 'a'.repeat(4097),'#invite=abc%0A','#invite=abc#participant'])assert.equal(parseInvitationFragment(h),null,h.slice(0,50));
});
