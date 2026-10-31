/** Fixed, source-backed practice scenarios. No network, real rows, scoring or trust admission. */
import raw from '../../seed/synthetic/answer-sets.json';
import pinnedSql from '../../migrations/0004_pinned_instruments.sql';
import { validateAnswers } from '../handlers/response';
import { CapError } from '../errors';
import type { TemplateItem } from '../handlers/common';
export const GENERATOR_VERSION = 'practice-source-fixtures-v1';
export const SCENARIOS = Object.freeze(['earning-trust'] as const);
export interface PracticeSurvey { templateId: string; version: number; name: string; perspective: string; items: TemplateItem[] }
export interface PracticeSetup { format: string | null; language: string | null; surveys: PracticeSurvey[] }
export interface PracticeAnswer { templateId: string; version: number; ordinal: number; source: 'practice-synthetic'; answers: Record<string, unknown> }
const records = raw as Array<{ synthetic: boolean; project_id: string; assessment_cycle: string; form_variant: string; submission_id: string; answers: Record<string, { selected: string[] } | undefined> }>;
const fail = (): never => { throw new CapError('INVALID_PARAMS', 'This scenario does not support every selected template and version.'); };
const pinned = new Map(Array.from(pinnedSql.matchAll(/VALUES \('(tpl_[a-z_]*)', 2, '([^']*)', '[^']*', '[^']*', '(\[.*?\])', '(\{.*?\})', /gs), m =>
  [m[1], { name:m[2], items:JSON.parse(m[3].replaceAll("''", "'")) }]));
export function generate(setup: PracticeSetup, scenario: string): PracticeAnswer[] {
  if (!(SCENARIOS as readonly string[]).includes(scenario) || !setup.surveys.length || setup.surveys.length > 8) return fail();
  const rows: PracticeAnswer[] = [];
  for (const survey of setup.surveys) {
    const expected=pinned.get(survey.templateId);
    if (survey.version !== 2 || !survey.items.length || !expected || expected.name!==survey.name || JSON.stringify(expected.items)!==JSON.stringify(survey.items)) return fail();
    const candidates = records.filter(r => r.synthetic === true && r.project_id === scenario && r.form_variant === survey.name)
      .sort((a,b) => a.assessment_cycle.localeCompare(b.assessment_cycle) || a.submission_id.localeCompare(b.submission_id));
    if (!candidates.length) return fail();
    let ordinal=0;
    // Some original fixture records legitimately skipped conditional items. Use only complete
    // records accepted by today's validator; never invent answers to complete an old record.
    for (const record of candidates) {
      const answers: Record<string, unknown> = {};
      for (const item of survey.items) {
        const chosen = record.answers[item.id]?.selected;
        if (!chosen) continue;
        if (item.type === 'text') { answers[item.id] = chosen.join('; '); continue; }
        const mapped = chosen.map(text => item.options?.find(o => o.text === text)?.code);
        if (mapped.some(code => !code)) continue;
        answers[item.id] = item.type === 'multi' ? mapped : mapped[0];
      }
      // Required items and exact published options are validated by the ordinary answer validator.
      try { rows.push({ templateId: survey.templateId, version: survey.version, ordinal, source: 'practice-synthetic', answers: validateAnswers(survey.items, answers) }); }
      catch(error) { if(error instanceof CapError && error.code==='INVALID_PARAMS') continue;throw error; }
      ordinal++;
      if(ordinal===6) break;
    }
    if(ordinal<3) return fail();
  }
  if (rows.length > 60 || new TextEncoder().encode(JSON.stringify(rows)).length > 524288) return fail();
  return rows;
}
