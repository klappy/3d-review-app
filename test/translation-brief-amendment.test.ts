import {beforeAll,describe,it,expect} from 'vitest';
import {readPinnedSources,buildIndex} from '../tools/build-synthetic-attestation';
import {parseItems,renderItems} from '../src/handlers/common';
import {validateAnswers} from '../src/handlers/response';
import {translationBriefItems,translationBriefSource,TRANSLATION_BRIEF_SOURCE} from '../src/translation-brief-amendment';
import {scoreSourceItem} from '../src/source-item-score';
import {translationTypeReference} from '../src/reference-rollup';
import {renderSyntheticReport,renderLegacySyntheticReport} from '../src/synthetic-report-renderer';
import type {CaptureRow} from '../src/report-attestation';
let templates:any[],captures:CaptureRow[];
beforeAll(async()=>{const input=await readPinnedSources();templates=input.templates;captures=(await buildIndex(input.records,input.templates)).captures;},20000);
const row=(item_id:string,code:string)=>{
  const template=templates.find(t=>JSON.parse(t.items_json).some((i:any)=>i.id===item_id));
  const question=translationBriefItems(JSON.parse(template.items_json),template.source_ref).find((i:any)=>i.id===item_id);
  return {assessment_id:'fixture',item_id,option_codes:[code],question,source_ref:template.source_ref};
};
describe('canonical Decision 25 amendment, all uses of the shared instrument',()=>{
  it('extends both canonical role questions, preserves stored bytes/codes and is idempotent',()=>{
    for(const [id,itemId,text] of [['tpl_validation','TR-Q2','We do not have a translation brief'],['tpl_mid_level','ML-Q2','The team does not have a translation brief']]){
      const template=templates.find(t=>t.id===id),before=template.items_json;
      const old=JSON.parse(before),items=parseItems(template),item=items.find(i=>i.id===itemId)!;
      expect(item.options!.find(o=>o.code==='no-brief')!.text).toBe(text);
      expect(item.options!.map(o=>o.code)).toEqual(['corresponding','resembling','clarifying','simplifying','no-brief','other']);
      expect(template.items_json).toBe(before);
      expect(items.filter(i=>!['TR-Q1','TR-Q2','ML-Q1','ML-Q2'].includes(i.id))).toEqual(old.filter((i:any)=>!['TR-Q1','TR-Q2','ML-Q1','ML-Q2'].includes(i.id)));
      expect(translationBriefItems(items)).toEqual(items);
      expect(renderItems(items,'en').find(i=>i.id===itemId)?.options).toEqual(expect.arrayContaining([expect.objectContaining({code:'no-brief',text})]));
      // The same parser supplies participant form, shared/code submission,
      // assisted entry, template render and survey print/PDF handlers.
      const answer=Object.fromEntries(items.map(i=>[i.id,i.type==='text'?'fixture':i.type==='multi'?[i.options![0].code]:i.options![0].code]));
      answer[itemId]='no-brief';
      expect(validateAnswers(items,answer)[itemId]).toBe('no-brief');
      expect(old.find((i:any)=>i.id===itemId).options.some((o:any)=>o.code==='no-brief')).toBe(false);
    }
  });
  it('never adds the choice to unrelated or noncanonical questions',()=>{
    for(const item of [{id:'unrelated',source_type:'descriptive',options:[]},{id:'TR-Q2',source_type:'ordinal-scored',options:[]},{id:'TR-Q2',source_type:'descriptive',options:[{code:'custom',text:'Custom'}]}])expect(translationBriefItems([item])).toEqual([item]);
  });
  it('refuses custom published lookalikes even with matching IDs, types and option codes',()=>{
    for(const id of ['tpl_validation','tpl_mid_level']){
      const template=templates.find(t=>t.id===id),base=JSON.parse(template.items_json),question=base.find((i:any)=>['TR-Q2','ML-Q2'].includes(i.id));
      for(const altered of [{...question,text:'Custom question'}, {...question,options:question.options.map((o:any,i:number)=>i?o:{...o,text:'Custom choice'})}, {...question,source_notes:'Custom source'}]){
        expect(translationBriefItems([altered],template.source_ref)).toEqual([altered]);
        expect(translationBriefSource([altered],template.source_ref)).toBe(null);
      }
      expect(translationBriefItems(base,'custom-published-source')).toEqual(base);
      const amended=translationBriefItems(base,template.source_ref);expect(translationBriefSource(amended,'custom-published-source')).toBe(null);
      expect(translationBriefSource(amended,template.source_ref)).toBe(TRANSLATION_BRIEF_SOURCE);
    }
  });
  it('does not attest altered metadata or structure on an already-amended question',()=>{
    for(const id of ['tpl_validation','tpl_mid_level']){
      const template=templates.find(t=>t.id===id),items=translationBriefItems(JSON.parse(template.items_json),template.source_ref) as any[];
      const question=items.find(i=>['TR-Q2','ML-Q2'].includes(i.id));
      const mutations=[{source_score:999},{weight:999},{flag:'scored'},{source_notes:'custom'},{source_order:999},{text:'Custom no brief'},{extra:true}];
      for(const delta of mutations){
        const changed={...question,options:question.options.map((o:any)=>o.code==='no-brief'?{...o,...delta}:o)};
        expect(translationBriefSource([changed],template.source_ref),JSON.stringify(delta)).toBe(null);
        expect(translationBriefItems([changed],template.source_ref)).toEqual([changed]);
      }
      const duplicate={...question,options:[...question.options,question.options.find((o:any)=>o.code==='no-brief')]};
      expect(translationBriefSource([duplicate],template.source_ref)).toBe(null);
      const reordered={...question,options:[...question.options].reverse()};expect(translationBriefSource([reordered],template.source_ref)).toBe(null);
      const other={...question,options:question.options.map((o:any)=>o.code==='other'?{...o,source_order:999}:o)};expect(translationBriefSource([other],template.source_ref)).toBe(null);
      expect(translationBriefSource(items,template.source_ref)).toBe(TRANSLATION_BRIEF_SOURCE);
    }
  });
  it('keeps absence/awareness as findings, never agreement or disagreement; Other disappears',()=>{
    expect(translationTypeReference([row('TR-Q2','other'),row('CHIP-Q1','other')])).toEqual([]);
    expect(translationTypeReference([row('TR-Q2','no-brief'),row('ML-Q2','no-brief'),row('CHIP-Q1','no-agreement'),row('CHCP-Q1','not-aware')])).toEqual([{assessment_id:'fixture',team_values:[],church_values:[],agree:null,team_statuses:['no-brief'],church_statuses:['no-agreement','not-aware']}]);
    const result=translationTypeReference([row('TR-Q2','no-brief'),row('CHIP-Q1','clarifying')])[0];
    expect(result.agree).toBe(null);expect(result.team_values).toEqual([]);
    expect(translationTypeReference([row('TR-Q2','clarifying'),row('CHIP-Q1','clarifying')])[0].agree).toBe(true);
    expect(translationTypeReference([row('TR-Q2','clarifying'),row('CHIP-Q1','simplifying')])[0].agree).toBe(false);
  });
  it.each(['tpl_validation','tpl_mid_level'])('does not reinterpret legitimate custom no-brief answers on %s',async(templateId)=>{
    const template=templates.find(t=>t.id===templateId),aid=captures[0].assessmentId;
    const items=translationBriefItems(JSON.parse(template.items_json),template.source_ref) as any[];
    for(const question of items.filter(i=>['TR-Q1','TR-Q2','ML-Q1','ML-Q2'].includes(i.id)))question.text='Custom local briefing question';
    const question=items.find(i=>['TR-Q2','ML-Q2'].includes(i.id));
    expect(translationBriefSource(items,template.source_ref)).toBe(null);
    expect(translationBriefItems(items,template.source_ref)).toEqual(items);
    const answers=Object.fromEntries(items.map(i=>[i.id,i.type==='text'?'fixture':i.type==='multi'?[i.options[0].code]:i.options[0].code]));
    answers[question.id]='no-brief';
    const changed=captures.filter(r=>r.assessmentId===aid).slice(0,5).map(r=>({...r,
      responseId:'custom_'+r.responseId,responseTemplateId:templateId,selectedTemplateId:templateId,
      selectedTemplateVersion:2,responseTemplateVersion:2,answersRaw:JSON.stringify(answers),
      templateRaw:JSON.stringify({templateId,templateVersion:2,sourceRef:template.source_ref,perspective:template.perspective,items})}));
    const result=await renderSyntheticReport(aid,changed,true);
    expect(result.eligible).toBe(true);if(!result.eligible)throw new Error('custom answer rejected');
    expect(result.payload.translation_type_agreement?.team_statuses??[]).not.toContain('no-brief');
    // Historical rendering retains the custom question's original semantics.
    const historical=await renderLegacySyntheticReport(aid,changed,true);
    expect(historical.eligible).toBe(true);
  });
  it('new participant reports accept no-brief on the unchanged stored template/version',async()=>{
    const aid=captures[0].assessmentId;
    const original=captures.filter(r=>r.assessmentId===aid);
    const changed=original.map(r=>{
      const answers=JSON.parse(r.answersRaw),t=JSON.parse(r.templateRaw);
      for(const item of t.items){
        if(['TR-Q2','ML-Q2'].includes(item.id))answers[item.id]='no-brief';
        if(['CHIP-Q1','CHCP-Q1','CHDL-Q1'].includes(item.id))answers[item.id]='no-agreement';
      }
      return {...r,responseId:'participant_'+r.responseId,answersRaw:JSON.stringify(answers)};
    });
    const result=await renderSyntheticReport(aid,changed,true);
    expect(result.eligible).toBe(true);if(!result.eligible)throw new Error('new answer rejected');
    expect(result.payload.instrument_amendment).toBe(TRANSLATION_BRIEF_SOURCE);
    expect(result.payload.translation_type_agreement).toMatchObject({agree:null,team_values:[],church_values:[],team_statuses:['no-brief'],church_statuses:['no-agreement']});
    expect(changed.map(r=>[r.templateRaw,r.selectedTemplateVersion,r.responseTemplateVersion])).toEqual(original.map(r=>[r.templateRaw,r.selectedTemplateVersion,r.responseTemplateVersion]));
    // The historical renderer never retrofits the new option into old captures.
    expect((await renderLegacySyntheticReport(aid,changed,true)).eligible).toBe(false);
  });
  it('inserts Q1 no-brief from the same instrument Q2 wording, before Other, and accepts it',()=>{
    for(const [id,itemId,text] of [['tpl_validation','TR-Q1','We do not have a translation brief'],['tpl_mid_level','ML-Q1','The team does not have a translation brief']]){
      const template=templates.find(t=>t.id===id),before=template.items_json;
      const items=translationBriefItems(JSON.parse(before),template.source_ref),item=items.find(i=>i.id===itemId)!;
      expect(item.options!.map(o=>o.code)).toEqual(['documented','shared-undocumented','working-on','no-brief','other']);
      expect(item.options!.find(o=>o.code==='no-brief')).toMatchObject({code:'no-brief',text,flag:'descriptive',source_score:null,weight:null});
      expect(template.items_json).toBe(before);
      const answer=Object.fromEntries(items.map(i=>[i.id,i.type==='text'?'fixture':i.type==='multi'?[i.options![0].code]:i.options![0].code]));
      answer[itemId]='no-brief';
      expect(validateAnswers(items,answer)[itemId]).toBe('no-brief');
    }
  });
  it('refuses Q1 look-alikes the same way it refuses Q2 look-alikes',()=>{
    for(const id of ['tpl_validation','tpl_mid_level']){
      const template=templates.find(t=>t.id===id),base=JSON.parse(template.items_json),question=base.find((i:any)=>['TR-Q1','ML-Q1'].includes(i.id));
      for(const altered of [{...question,text:'Custom question'}, {...question,options:question.options.map((o:any,i:number)=>i?o:{...o,text:'Custom choice'})}, {...question,source_notes:'Custom source'}]){
        expect(translationBriefItems([altered],template.source_ref)).toEqual([altered]);
        expect(translationBriefSource([altered],template.source_ref)).toBe(null);
      }
    }
  });
  it('keeps Q1 no-brief out of the translation-type rollup',()=>{
    expect(translationTypeReference([row('TR-Q1','no-brief'),row('ML-Q1','no-brief')])).toEqual([]);
    const result=translationTypeReference([row('TR-Q1','no-brief'),row('TR-Q2','clarifying'),row('CHIP-Q1','clarifying')])[0];
    expect(result.team_statuses).toEqual([]);
    expect(result.agree).toBe(true);
  });
  it('does not emit no-agreement or not-aware from custom or republished church questions',()=>{
    const template=templates.find(t=>JSON.parse(t.items_json).some((i:any)=>i.id==='CHIP-Q1'));
    const question=translationBriefItems(JSON.parse(template.items_json),template.source_ref).find((i:any)=>i.id==='CHIP-Q1');
    const base={assessment_id:'fixture',item_id:'CHIP-Q1',option_codes:['no-agreement','not-aware'],question,source_ref:template.source_ref};
    expect(translationTypeReference([base])[0].church_statuses).toEqual(['no-agreement','not-aware']);
    expect(translationTypeReference([{...base,question:{...question,text:'Custom church type'},source_ref:template.source_ref}])).toEqual([]);
    expect(translationTypeReference([{...base,source_ref:'custom-published-source'}])).toEqual([]);
  });
  it('scores canonical Q1 no-brief as excluded, not 0',()=>{
    for(const [id,itemId] of [['tpl_validation','TR-Q1'],['tpl_mid_level','ML-Q1']]){
      const template=templates.find(t=>t.id===id);
      const item=translationBriefItems(JSON.parse(template.items_json),template.source_ref).find((i:any)=>i.id===itemId)!;
      expect(scoreSourceItem(item,'no-brief')).toMatchObject({status:'missing',score:null});
      expect(scoreSourceItem(item,'documented')).toMatchObject({status:'scored',score:100});
    }
  });
  it('does not stamp instrument_amendment without a canonical amended TR/ML question',async()=>{
    const aid=captures[0].assessmentId;
    const church=captures.filter(r=>r.assessmentId===aid && ['tpl_involved_pastor','tpl_community_pastor','tpl_denom_leader'].includes(r.responseTemplateId || r.selectedTemplateId));
    expect(church.length).toBeGreaterThan(0);
    const result=await renderSyntheticReport(aid,church,true);
    expect(result.eligible).toBe(true);if(!result.eligible)throw new Error('church-only rejected');
    expect(result.payload.instrument_amendment).toBeUndefined();
  });
  it('does not stamp instrument_amendment for a custom look-alike only',async()=>{
    const template=templates.find(t=>t.id==='tpl_validation'),aid=captures[0].assessmentId;
    const items=translationBriefItems(JSON.parse(template.items_json),template.source_ref) as any[];
    for(const question of items.filter(i=>['TR-Q1','TR-Q2'].includes(i.id)))question.text='Custom local briefing question';
    const question=items.find(i=>i.id==='TR-Q2');
    expect(translationBriefSource(items,template.source_ref)).toBe(null);
    const answers=Object.fromEntries(items.map(i=>[i.id,i.type==='text'?'fixture':i.type==='multi'?[i.options[0].code]:i.options[0].code]));
    answers[question.id]='no-brief';
    const changed=captures.filter(r=>r.assessmentId===aid).slice(0,5).map(r=>({...r,
      responseId:'lookalike_'+r.responseId,responseTemplateId:'tpl_validation',selectedTemplateId:'tpl_validation',
      selectedTemplateVersion:2,responseTemplateVersion:2,answersRaw:JSON.stringify(answers),
      templateRaw:JSON.stringify({templateId:'tpl_validation',templateVersion:2,sourceRef:template.source_ref,perspective:template.perspective,items})}));
    const result=await renderSyntheticReport(aid,changed,true);
    expect(result.eligible).toBe(true);if(!result.eligible)throw new Error('look-alike rejected');
    expect(result.payload.instrument_amendment).toBeUndefined();
    expect(result.payload.translation_type_agreement?.team_statuses??[]).not.toContain('no-brief');
  });
});
