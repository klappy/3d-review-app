// DEV-ONLY local contract fixture; not the API; replaced by the real API candidate at integration
// Fakes four participant/staff endpoints for the browser-side unit test only:
//   POST /v2/participate/link, GET /v2/participate/form, POST /v2/participate/responses, GET /v2/participate/receipt
// plus POST /v2/assessments/{aid}/surveys/{sid}/links (dry_run / execute) for the staff URL case.
// Field names beyond the accepted contract facts (participant_token, response_id, error codes) are assumptions.

const ok = (result, capability) => new Response(JSON.stringify({ ok: true, result, capability, trace_id: 'tr_fixture' }), { status: 200, headers: { 'content-type': 'application/json' } });
const err = (status, code, message) => new Response(JSON.stringify({ ok: false, error: { code, message } }), { status, headers: { 'content-type': 'application/json' } });

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function ptToken(n) { let s = ''; for (let i = 0; i < 32; i++) s += chars[(n * 7 + i * 13) % chars.length]; return `pt_${s}`; }

export const FORM = {
  assessment: 'asmt_fixture', language: 'qaa', template: { id: 'tpl_team', version: 3 },
  items: [
    { id: 'q1', type: 'scale', text: 'Scale item', scale: { min: 1, max: 5 }, required: true },
    { id: 'q2', type: 'multi', text: 'Multi item', options: [{ code: 'a', label: 'A' }, { code: 'none', label: 'None', exclusive: true }], required: false },
  ],
};

// One fixture = one server. `links` maps link token -> { state: 'live'|'revoked'|'closed' }.
export function createFixture({ links = {} } = {}) {
  const respondents = new Map(); // bearer -> { linkToken, response }
  const responses = new Map(); // idempotency_key -> response_id
  const calls = [];
  let seq = 0, responseSeq = 0, confirmSeq = 0;
  const confirms = new Set();
  let failNextSubmit = false;

  async function fetchImpl(url, init = {}) {
    const headers = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method || 'GET', headers, credentials: init.credentials, body });
    const bearer = /^Bearer (pt_[A-Za-z0-9_-]{32})$/.exec(headers.authorization || '')?.[1] || null;
    const who = bearer ? respondents.get(bearer) : null;

    if (url === '/v2/participate/link' && init.method === 'POST') {
      if (headers.authorization) return err(400, 'BAD_REQUEST', 'no Authorization on open');
      const link = links[body?.token];
      if (!link || link.state === 'revoked') return err(404, 'LINK_REVOKED', 'link is not live');
      if (link.state === 'closed') return err(409, 'COLLECTION_CLOSED', 'collection closed');
      const resume = body.resume_token && respondents.get(body.resume_token);
      if (resume && resume.linkToken === body.token) return ok({ participant_token: body.resume_token, resumed: true }, 'cap.participant.open_link');
      const token = ptToken(++seq);
      respondents.set(token, { linkToken: body.token, response: null });
      return ok({ participant_token: token, resumed: false }, 'cap.participant.open_link');
    }
    if (/^\/v2\/assessments\/[^/]+\/surveys\/[^/]+\/links$/.test(url) && init.method === 'POST') {
      if (!/^Bearer st_/.test(headers.authorization || '')) return err(401, 'UNAUTHENTICATED', 'staff only');
      if (body.mode === 'dry_run') { const confirm_token = `cf_${++confirmSeq}`; confirms.add(confirm_token); return ok({ confirm_token, impact: { links: 1 }, expires_in: 120 }, 'cap.survey.issue_link'); }
      if (body.mode === 'execute') {
        if (!confirms.delete(body.confirm_token)) return err(409, 'CONFIRM_REQUIRED', 'preview again');
        const link_token = `lk_${confirmSeq}_${'x'.repeat(8)}/+=`; // includes URL-unsafe chars on purpose
        links[link_token] = { state: 'live' };
        return ok({ link_token, link_id: `inv_${confirmSeq}`, expires_at: null, entry_fragment: `#survey=${encodeURIComponent(link_token)}` }, 'cap.survey.issue_link');
      }
    }
    if (!who) return err(401, 'UNAUTHENTICATED', 'no participant');
    const linkState = links[who.linkToken]?.state;
    if (url === '/v2/participate/form') {
      if (linkState !== 'live') return err(409, linkState === 'closed' ? 'COLLECTION_CLOSED' : 'LINK_REVOKED', 'not live');
      return ok(FORM, 'cap.response.form');
    }
    if (url === '/v2/participate/receipt') {
      return ok(who.response ? { submitted: true, response_id: who.response, submitted_at: '2026-09-17T00:00:00Z' } : { submitted: false, response_id: null }, 'cap.response.receipt');
    }
    if (url === '/v2/participate/responses' && init.method === 'POST') {
      if (failNextSubmit) { failNextSubmit = false; return err(503, 'UNAVAILABLE', 'transient'); }
      if (linkState !== 'live') return err(409, 'COLLECTION_CLOSED', 'collection closed');
      if (who.response) return ok({ submitted: true, response_id: who.response }, 'cap.response.submit');
      const existing = responses.get(body.idempotency_key);
      const id = existing || `resp_${++responseSeq}`;
      responses.set(body.idempotency_key, id); who.response = id;
      return ok({ submitted: true, response_id: id, submitted_at: '2026-09-17T00:00:00Z' }, 'cap.response.submit');
    }
    return err(404, 'NOT_FOUND', url);
  }
  return { fetchImpl, calls, links, respondents, failNextSubmit: () => { failNextSubmit = true; }, close: token => { links[token].state = 'closed'; }, revoke: token => { links[token].state = 'revoked'; } };
}

// Independent browser context == independent sessionStorage.
export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, get size() { return m.size; }, keys: () => [...m.keys()] };
}
