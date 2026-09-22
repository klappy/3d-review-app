// Synthetic, fail-closed transport for the normal-root kit harness. Literal GET allowlist installed BEFORE navigation;
// every mutation and every unknown or non-local request is refused and recorded. No cookies, no real session, no real people.
export const IDENTITIES = Object.freeze(['owner', 'member', 'viewer', 'direct']);
const ok = result => ({ ok: true, result });
const refuse = (code, message, status) => ({ status, body: { ok: false, error: { code, message } } });

export function dataset(identity = 'owner') {
  const role = identity === 'direct' ? null : identity;
  const w1 = { id: 'w1', name: 'Field team', role: identity === 'viewer' ? 'viewer' : identity === 'member' ? 'member' : 'owner', archived_at: null };
  const p1 = { id: 'p1', name: 'River Valley', role, workspace_id: 'w1', organization: 'Lakeside org', archived_at: null };
  const p2 = { id: 'p2', name: 'Hill project', role: 'viewer', workspace_id: null, archived_at: null };
  const a1 = { id: 'a1', name: 'September assessment', project_id: 'p1', stage: 'collect', role: role || 'viewer', language_id: 'l1', purpose: 'Synthetic purpose' };
  const a2 = { id: 'a2', name: 'Spring baseline', project_id: 'p1', stage: 'prepare', role: role || 'viewer', language_id: 'l1', purpose: '' };
  const a9 = { id: 'a9', name: 'Granted assessment', project_id: 'p9', stage: 'understand', role: 'viewer', language_id: 'l9', purpose: '' };
  const languages = [{ id: 'l1', name: 'Lake language', code: 'qaa', archived_at: null }, { id: 'l2', name: 'Old language', code: null, archived_at: '2026-01-01' }];
  const routes = new Map();
  routes.set('GET /v2/me', ok({ principal: { id: 'synthetic-' + identity, kind: 'facilitator' } }));
  routes.set('GET /v2/auth/access?view=account', { raw: { email: 'synthetic-' + identity + '@example.invalid' } });
  routes.set('GET /v2/templates', ok({ templates: [] }));
  routes.set('GET /v2/health', ok({ ok: true, version: '0.14.5', build: 'synthetic-build', deployed_at: '2026-09-22T00:00:00Z' }));
  routes.set('GET /changelog.json', { raw: { entries: [] } });
  if (identity === 'direct') {
    routes.set('GET /v2/projects', ok({ projects: [] }));
    routes.set('GET /v2/workspaces', ok({ workspaces: [] }));
    routes.set('GET /v2/assessments/a9', ok({ assessment: a9, surveys: [] }));
    routes.set('GET /v2/projects/p9/assessments', refuse('NOT_AUTHORIZED_AT_SCOPE', 'No role on this project', 403));
    routes.set('GET /v2/projects/p9', refuse('NOT_FOUND_OR_NOT_VISIBLE', 'Not visible', 404));
  } else {
    routes.set('GET /v2/projects', ok({ projects: [p1, p2] }));
    routes.set('GET /v2/workspaces', ok({ workspaces: [w1] }));
    routes.set('GET /v2/workspaces/w1', ok({ workspace: w1, projects: [p1] }));
    routes.set('GET /v2/projects/p1', ok({ project: p1, languages }));
    routes.set('GET /v2/projects/p1/assessments', ok({ assessments: [a1, a2] }));
    routes.set('GET /v2/projects/p1/languages', ok({ languages }));
    routes.set('GET /v2/projects/p2', ok({ project: p2, languages: [] }));
    // p2: assessments refused, languages transiently failed — two independent settled outcomes.
    routes.set('GET /v2/projects/p2/assessments', refuse('NOT_AUTHORIZED_AT_SCOPE', 'No role on this project', 403));
    routes.set('GET /v2/projects/p2/languages', refuse('UPSTREAM_UNAVAILABLE', 'Synthetic transient failure', 502));
    routes.set('GET /v2/assessments/a1', ok({ assessment: a1, surveys: [] }));
    routes.set('GET /v2/assessments/a2', ok({ assessment: a2, surveys: [] }));
  }
  return { routes, w1, p1, p2, a1, a2, a9, languages };
}

// createTransport({ routes, origin }) → { fetch, log, hold(key) }. `hold` defers one matching GET until released (stale-reply controls).
export function createTransport({ routes, origin = 'http://127.0.0.1' } = {}) {
  const log = [], holds = new Map();
  const response = (status, body, headers = { 'content-type': 'application/json' }) => ({ ok: status >= 200 && status < 300, status, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => body, text: async () => JSON.stringify(body) });
  async function fetch(input, init = {}) {
    const url = String(input instanceof URL ? input.href : input);
    const method = (init.method || 'GET').toUpperCase();
    const u = new URL(url, origin);
    const key = `${method} ${u.pathname}${u.search}`;
    const entry = { key, method, url, credentials: init.credentials, headers: init.headers || {}, body: init.body, outcome: null };
    log.push(entry);
    if (u.origin !== new URL(origin).origin) { entry.outcome = 'nonlocal-refused'; throw new TypeError('Synthetic transport refuses non-local request: ' + url); }
    if (method !== 'GET' && method !== 'HEAD') { entry.outcome = 'mutation-refused'; return response(405, { ok: false, error: { code: 'SYNTHETIC_MUTATION_REFUSED', message: 'Synthetic transport refuses every mutation (' + key + ')' } }); }
    const r = routes.get(key);
    if (r === undefined) { entry.outcome = 'unmapped-refused'; return response(404, { ok: false, error: { code: 'NOT_FOUND_OR_NOT_VISIBLE', message: 'Unmapped synthetic route ' + key } }); }
    if (holds.has(key)) { await holds.get(key).promise; }
    entry.outcome = 'served';
    if (r.raw) return response(200, r.raw);
    if (r.status) return response(r.status, r.body);
    return response(200, r);
  }
  function hold(key) { let release; const promise = new Promise(res => { release = res; }); holds.set(key, { promise, release }); return () => { holds.delete(key); release(); }; }
  return { fetch, log, hold };
}
