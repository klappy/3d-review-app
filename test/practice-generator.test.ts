import { describe, expect, it } from 'vitest';
import pinnedSql from '../migrations/0004_pinned_instruments.sql';
import { generate, SCENARIOS, type PracticeSetup } from '../src/practice/generator';
import { validateAnswers } from '../src/handlers/response';
const templates=Array.from(pinnedSql.matchAll(/VALUES \('(tpl_[a-z_]*)', 2, '([^']*)', '[^']*', '[^']*', '(\[.*?\])', '(\{.*?\})', /gs),m=>({templateId:m[1],version:2,name:m[2],perspective:'team',items:JSON.parse(m[3].replaceAll("''","'"))}));
const setup=(name='Validation'):PracticeSetup=>({format:'written',language:'en',surveys:[templates.find(t=>t.name===name)!]});
describe('practice generator is a deterministic validated source-fixture projection, never report trust',()=>{
 it.each(SCENARIOS)('%s yields complete current-validator answers without external generation',scenario=>{
  const input=setup(),a=generate(input,scenario),b=generate(input,scenario);
  expect(a).toEqual(b);expect(a.length).toBeGreaterThanOrEqual(3);expect(a.length).toBeLessThanOrEqual(6);
  for(const row of a){expect(row.source).toBe('practice-synthetic');expect(validateAnswers(input.surveys[0].items,row.answers)).toEqual(row.answers);}
  expect(JSON.stringify(a)).not.toMatch(/respondent_persona|submission_id|trusted|attestation/);
 });
 it('refuses altered templates, unpinned versions, unsupported scenarios and empty setup',()=>{
  const normal=setup();
  expect(()=>generate(normal,'invented')).toThrow();
  expect(()=>generate(normal,'struggling-project')).toThrow();
  expect(()=>generate({...normal,surveys:[]},SCENARIOS[0])).toThrow();
  expect(()=>generate({...normal,surveys:[{...normal.surveys[0],version:1}]},SCENARIOS[0])).toThrow();
  expect(()=>generate({...normal,surveys:[{...normal.surveys[0],items:normal.surveys[0].items.slice(1)}]},SCENARIOS[0])).toThrow();
  expect(()=>generate(setup('Audio'),SCENARIOS[0])).toThrow();
 });
});
