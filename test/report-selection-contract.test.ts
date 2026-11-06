/** Distinct #614 compatibility regression, composed with the accepted #611 helper.
 * Tests real producer bytes; does not duplicate the owner's schema parser or fixes. */
import {it,expect} from 'vitest';
import {attestPackedCapture,attestSelectionCapture,SELECTION_CAPTURE_SCHEMA} from '../src/report-capture';
import {REAL_RENDERER} from '../src/synthetic-report-store';
import {renderLegacyAttestedCapture} from '../src/synthetic-report-renderer';
import {schemaErrors,reportPayloadSchema,reportResultErrors} from './report-contract-check';
import fixture from './fixtures/report-build-capture-200.json';

it('published report contracts accept real selection/known-empty and historical bytes while rejecting private fields and unknown tuples',async()=>{
 const original=await attestPackedCapture(fixture.assessmentId,fixture.packedCapture,true,1);
 expect(original.eligible).toBe(true);if(!original.eligible)throw Error('source capture refused');
 const selected=[...new Map(original.capture.rows.map(r=>{
  const t=JSON.parse(r.templateRaw);
  return [r.assessmentSurveyId,[r.assessmentSurveyId,r.assessmentId,r.selectedTemplateId,r.selectedTemplateVersion,t.perspective,t.sourceRef]];
 })).values()].sort((a,b)=>String(a[0])<String(b[0])?-1:String(a[0])>String(b[0])?1:0);
 const old=await renderLegacyAttestedCapture(original.capture);expect(old.eligible).toBe(true);if(!old.eligible)throw Error('historical renderer refused');
 expect(old.payload).not.toHaveProperty('report_selection');
 expect(schemaErrors(reportPayloadSchema,old.payload)).toEqual([]);
 expect(reportPayloadSchema.required).not.toContain('report_selection');
 for(const selection of [selected,[]]){
  const wrapped=await attestSelectionCapture(fixture.assessmentId,JSON.stringify([SELECTION_CAPTURE_SCHEMA,fixture.assessmentId,fixture.packedCapture,selection]),true,1);
  expect(wrapped.eligible).toBe(true);if(!wrapped.eligible)throw Error('new capture refused');
  const payload=JSON.parse(JSON.stringify(await REAL_RENDERER.render(wrapped.capture)));
  expect(schemaErrors(reportPayloadSchema,payload)).toEqual([]);
  expect(payload.report_selection.selected_perspectives).toEqual([...new Set(selection.map(r=>r[4]))].sort());
  const result={assessment_id:fixture.assessmentId,suppressed:false,level_minimum_responses:1,report:{id:'selection-contract-fixture',created_at:'2026-11-06T00:00:00Z',payload}};
  for(const cap of ['cap.report.build','cap.report.get'])expect(reportResultErrors(cap,result)).toEqual([]);
  expect(schemaErrors(reportPayloadSchema,{...payload,private_capture:'forbidden'})).toContain('$.private_capture additionalProperties');
  expect(schemaErrors(reportPayloadSchema,{...payload,versions:{...payload.versions,scorer:payload.versions.scorer+'-unknown'}})).toContain('$.versions.scorer enum');
  const valid=payload.report_selection;
  for(const invalid of [null,{}, {schema:valid.schema}, {...valid,schema:'unknown'}, {...valid,selected_perspectives:['Team']}, {...valid,selected_perspectives:['Church','Church']}, {...valid,selected_perspectives:['Church','Community','Translation Team','Other']}, {...valid,survey_ids:['private']}, {...valid,surveys:selected}, {...valid,selected_perspectives:[{perspective:'Church',id:'private'}]}]){
   expect(schemaErrors(reportPayloadSchema,{...payload,report_selection:invalid}),JSON.stringify(invalid)).not.toEqual([]);
  }
 }
});
