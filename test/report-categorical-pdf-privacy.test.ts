/** Downstream #614 regression for #611 r4490069633. No runtime redaction fix here.
 * Synthetic presentation counterexample, not scoring or production-data acceptance. */
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {discloseTranslationAgreement} from '../ui/report-agreement.js';
import {renderReport} from '../ui/report-view.js';
import {storedReportDocument} from '../ui/pdf/report-formats.js';
import {participantReportMinimum,perspectiveLevelMinimum,translationAgreementMinimum} from '../src/report-admission';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/synthetic-report-renderer-v1.json',import.meta.url),'utf8'));
const env={ENVIRONMENT:'production',PARTICIPANT_REPORTS:'enabled',SUMMIT_ONE_RESPONSE_REPORTS:'enabled'};
const numeric=perspectiveLevelMinimum(env),categorical=translationAgreementMinimum(env);
function raw(hidden:boolean,visible=false){
 const payload={...structuredClone(corpus.contexts[Object.keys(corpus.contexts)[0]]),synthetic:true,source_commit:corpus.source_commit,versions:{scorer:'privacy-fixture',narrative:'fixture',policy:'fixture'}};
 // Same numeric evidence/scores in both cases. Team meets the categorical floor;
 // Church's one response is numeric-visible but categorically suppressed.
 payload.evidence=[{label:'Translation Team — Validation',n:3},{label:'Community — Written',n:1},{label:'Church — Involved Pastor',n:1}];
 // Other is excluded by the scorer: absent comparable values, no visible status.
 payload.translation_type_agreement=hidden||visible?{construct_name:'Translation Type Agreement',team_values:[],church_values:[],agree:null,team_statuses:visible?['no-brief']:[],church_statuses:hidden?['not-aware']:[]}:null;
 return payload;
}
const surfaces=['current','overview','detailed','full'] as const;
function presentation(surface:typeof surfaces[number],payload:any){
 const report={id:'same-saved-fixture',created_at:'2026-11-06T00:00:00Z',payload};
 let doc:Document;
 if(surface==='current'){
  doc=new JSDOM('<body><main></main></body>').window.document;
  expect(renderReport({doc,root:doc.querySelector('main'),report,minimum:numeric})).toBe(true);
 }else doc=new JSDOM(storedReportDocument({suppressed:false,report},{minimum:numeric,format:surface})).window.document;
 doc.querySelectorAll('style,script').forEach(x=>x.remove());
 const text=doc.body.textContent!.replace(/\s+/g,' ').trim();
 const agreement=[...doc.querySelectorAll('h1,h2,h3,h4,h5,[role="heading"],.sheet-head')].some(x=>x.textContent?.trim().toLowerCase()==='translation type agreement');
 return {text,agreement};
}
it.each(surfaces)('%s: hidden categorical presence cannot create a section at Summit numeric floor1',surface=>{
 expect(participantReportMinimum(env)).toBe(1);expect(numeric).toBe(1);expect(categorical).toBe(3);
 const without=raw(false),withHidden=raw(true),before=JSON.stringify(withHidden);
 const a=presentation(surface,discloseTranslationAgreement(without,categorical));
 const b=presentation(surface,discloseTranslationAgreement(withHidden,categorical));
 expect(a.text).toMatch(/1 responses?/i);expect(b.text).toMatch(/1 responses?/i);
 expect(b.text).not.toMatch(/not-aware|not aware of/i);
 expect(b.agreement,'suppressed status must not create an agreement section absent from the visible Other-only case').toBe(a.agreement);
 expect(b.text).toBe(a.text);
 expect(JSON.stringify(withHidden)).toBe(before);
});
it.each(surfaces)('%s: legitimate categorical finding at floor3 stays visible while floor1 numeric data renders',surface=>{
 const input=raw(true,true),before=JSON.stringify(input);
 const view=presentation(surface,discloseTranslationAgreement(input,categorical));
 expect(view.agreement).toBe(true);expect(view.text).toContain('No translation brief');
 expect(view.text).not.toMatch(/not-aware|not aware of/i);expect(view.text).toMatch(/1 responses?/i);
 expect(JSON.stringify(input)).toBe(before);
});
