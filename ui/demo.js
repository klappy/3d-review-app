import fixture from './demo-data.js';
// Demonstration data only. Reuses production screens; never falls through to network.
export const isDemo = search => new URLSearchParams(search).get('demo') === '1';
export function memoryStorage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; }
const assessment = { id: 'demo-assessment', project_id: 'demo-project', name: 'Earning trust · synthetic January 2026', period: 'Demonstration', language_id: 'demo-language', format: 'written', stage: 'collect', role: 'viewer', purpose: 'Explore the real review screens with demonstration data.', notes_reflection: '', notes_next_step: '' };
const project = { id: 'demo-project', workspace_id: 'demo-workspace', name: 'Earning trust · synthetic project', role: 'viewer' };
const workspace = { id: 'demo-workspace', name: 'Sample workspace', role: 'viewer' };
const surveys = fixture.forms.map((f, i) => ({ id: `demo-survey-${i}`, template_id: f.template.templateId, template_version: f.template.templateVersion, template_name: f.name, perspective: f.template.perspective, state: 'selected', collection_status: 'closed' }));
const templates = surveys.map(s => ({ id: s.template_id, version: s.template_version, name: s.template_name, perspective: s.perspective }));
const report = { id: 'demo-report', created_at: fixture.generated_at, payload: { schema_version: '3d-synthetic-assessment-report-v1', synthetic: true, source_commit: fixture.source, assessment_id: fixture.aid, versions: { scorer: 'steve-f042cde-single-assessment-v1', narrative: 'steve-f042cde-rule-narrative-v1', policy: 'synthetic-current-assessment-asof-query-v1' }, ...fixture.projection } };
export const sampleResponses = fixture.forms.map((f, i) => ({ survey: i, name: surveys[i].template_name, count: f.responses.length }));
export async function demoApi(url, { method = 'GET' } = {}) {
  const unavailable = () => Object.assign(new Error('This is a demonstration. Nothing is sent or saved.'), { code: 'NOT_AUTHORIZED_AT_SCOPE' });
  if (method !== 'GET') throw unavailable();
  const values = {
    '/v2/me': { principal: { id: 'demonstration', kind: 'user' } },
    '/v2/workspaces': { workspaces: [workspace] }, '/v2/workspaces/demo-workspace': { workspace, projects: [project] },
    '/v2/projects': { projects: [project] }, '/v2/projects/demo-project': { project },
    '/v2/projects/demo-project/languages': { languages: [{ id: 'demo-language', name: 'Sample language' }] },
    '/v2/projects/demo-project/assessments': { assessments: [assessment] },
    '/v2/assessments/demo-assessment': { assessment, surveys }, '/v2/templates': { templates },
    '/v2/assessments/demo-assessment/results': { status: 'held', reason: 'General scoring is held. Open the source-pinned synthetic report below to inspect this fixture’s supported projection.' },
    '/v2/assessments/demo-assessment/reports': { reports: [{ id: report.id, created_at: report.created_at }] },
    '/v2/assessment/demo-assessment/grants': { grants: [], invitations: [] },
  };
  values['/v2/reports/demo-report'] = { report };
  surveys.forEach((survey, i) => { const n = fixture.forms[i].responses.length; values[`/v2/assessments/demo-assessment/surveys/${survey.id}`] = { survey, counts: { responses: n, respondents: n } }; });
  if (!Object.hasOwn(values, url)) throw unavailable();
  return structuredClone(values[url]);
}
// Actual participant controller/client/view with an in-memory transport and storage.
// Practice prompts are not scored instruments or source-attested assessment evidence.
export function sampleParticipantEnvironment(surveyIndex = 0) {
  let submitted = false;
  const selected = fixture.forms[surveyIndex] || fixture.forms[0];
  const form = { template: { id: selected.template.templateId, version: selected.template.templateVersion }, title: 'Synthetic sample survey', items: selected.template.items };
  const receipt = { submitted: true, response_id: 'practice-only-not-saved', submitted_at: 'Demonstration — not sent' };
  return { sampleAnswers: structuredClone(selected.responses[0].answers), storage: memoryStorage(), window: { location: { hash: '#survey=practice', pathname: '/participate/', search: '?demo=1' }, history: { replaceState() {} } },
    async fetchImpl(url, options = {}) {
      let result;
      if (url === '/v2/participate/link') result = { participant_token: 'practice-only' };
      else if (url === '/v2/participate/form') result = form;
      else if (url === '/v2/participate/receipt') result = submitted ? receipt : { submitted: false };
      else if (url === '/v2/participate/responses' && options.method === 'POST') { submitted = true; result = receipt; }
      else throw new Error('Practice request is unavailable.');
      return { ok: true, status: 200, json: async () => ({ ok: true, result: structuredClone(result) }) };
    } };
}
