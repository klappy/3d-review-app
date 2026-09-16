// Local synthetic HTTP proof for a fresh project, language, and pinned v2 form.
// Never prints authentication tokens or access-code values.
const base = process.env.DEMO_BASE ?? 'http://127.0.0.1:8796';
let ownerToken, participantToken;
async function call(method, path, body, actor = 'owner') {
  const token = actor === 'participant' ? participantToken : actor === 'owner' ? ownerToken : null;
  const response = await fetch(base + path, { method, headers: {
    accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) throw new Error(`${method} ${path}: ${envelope.error?.code ?? response.status}`);
  return envelope.result;
}

const email = 'demo.owner@example.invalid';
const login = await call('POST', '/v2/auth/link', { email }, 'anonymous');
ownerToken = (await call('POST', '/v2/auth/session', { email, code: login.dev_only_code }, 'anonymous')).session;
const project = (await call('POST', '/v2/projects', { name: `Pinned HTTP ${Date.now()}` })).project;
const language = (await call('POST', `/v2/projects/${project.id}/languages`, { name: 'Invented Tavo', code: 'qaa' })).language;
const listed = await call('GET', `/v2/projects/${project.id}/languages`);
if (!listed.languages.some(row => row.id === language.id)) throw new Error('new language missing from project');
const assessment = (await call('POST', `/v2/projects/${project.id}/assessments`, {
  name: 'Pinned questionnaire cycle', language_id: language.id,
})).assessment;
const selected = (await call('POST', `/v2/assessments/${assessment.id}/surveys`, {
  template_id: 'tpl_validation', version: 2,
})).survey;
await call('POST', `/v2/assessments/${assessment.id}/stage`, { stage: 'collect' });
const issued = await call('POST', `/v2/assessments/${assessment.id}/surveys/${selected.id}/codes`, { count: 1 });
const route = `/v2/assessments/${assessment.id}/surveys/${selected.id}/codes/export`;
const params = { ids: issued.ids };
const preview = await call('POST', route, { params, mode: 'dry_run' });
const released = await call('POST', route, { params, mode: 'execute', confirm_token: preview.confirm_token });
participantToken = (await call('POST', '/v2/participate/code', { code: released.codes[0].code }, 'anonymous')).participant_token;
const form = await call('GET', '/v2/participate/form', undefined, 'participant');
if (form.template.version !== 2 || form.items.length !== 17 || form.items[0].id !== 'TR-Q1')
  throw new Error('source-pinned Validation form mismatch');
const answers = {};
for (const item of form.items) {
  if (!item.required) continue;
  answers[item.id] = item.type === 'multi' ? [item.options.find(opt => !opt.exclusive).code]
    : item.type === 'single' ? item.options[0].code : item.type === 'scale' ? item.scale.min : 'Synthetic text';
}
const submitted = await call('POST', '/v2/participate/responses', {
  idempotency_key: `pinned-${Date.now()}`, answers,
}, 'participant');
const receipt = await call('GET', '/v2/participate/receipt', undefined, 'participant');
if (receipt.response_id !== submitted.response_id || receipt.template.version !== 2)
  throw new Error('pinned response receipt mismatch');
console.log(JSON.stringify({ ok: true, project_id: project.id, language_id: language.id,
  assessment_id: assessment.id, survey_id: selected.id, response_id: submitted.response_id,
  checks: ['fresh project', 'language create/list', 'assessment', 'Validation v2 selection',
    'Collect stage', 'one-time code export/redeem', '17 source questions', 'response/receipt pinned to v2'] }));
