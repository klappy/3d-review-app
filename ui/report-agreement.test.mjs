import test from 'node:test';
import assert from 'node:assert/strict';
import {translationAgreementFor,discloseTranslationAgreement} from './report-agreement.js';
const payload=()=>({translation_type_agreement:{team_values:['clarifying'],church_values:['clarifying'],agree:true,team_statuses:['no-brief'],church_statuses:['not-aware']},evidence:[{label:'Translation Team — Translators',n:3},{label:'Church — Involved Pastor',n:1},{label:'Community — Written',n:1}]});
test('a suppressed perspective exposes neither findings, categories nor the derived match',()=>{
 const input=payload(),before=JSON.stringify(input),result=translationAgreementFor(input,3);
 assert.deepEqual(result.church_statuses,[]);assert.deepEqual(result.church_values,[]);assert.equal(result.agree,null);
 assert.deepEqual(result.team_statuses,['no-brief']);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(discloseTranslationAgreement(input,3).translation_type_agreement,result);
});
test('uses only immutable evidence: live counts, absent/invalid counts and invalid minima never restore a hidden side',()=>{
 const input={...payload(),counts:{team:999,church:999}};
 assert.deepEqual(translationAgreementFor(input,3).church_statuses,[]);
 assert.equal(translationAgreementFor({...input,evidence:[]},3),null);
 assert.equal(translationAgreementFor({...input,evidence:[{label:'Church — Involved Pastor',n:-1}]},3),null);
 assert.equal(translationAgreementFor({...input,evidence:[{label:'Church — Involved Pastor',n:'999'}]},3),null);
 assert.deepEqual(translationAgreementFor(input,0).church_statuses,[]);
});
test('configured DEV minimum1 permits both sides; exact threshold3 permits comparison',()=>{
 const input=payload();assert.deepEqual(translationAgreementFor(input,1).church_statuses,['not-aware']);
 input.evidence[1].n=3;assert.equal(translationAgreementFor(input,3).agree,true);
 input.translation_type_agreement.team_values=[];assert.equal(translationAgreementFor(input,3).agree,null);
});
