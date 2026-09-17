// Shared survey link (C2): entry via `#survey=<token>`, per-link sessionStorage
// namespace keyed by a SHA-256 digest of the token, and a credential-less fetch
// for the participant endpoints. The link token never reaches a URL, a log, an
// error message or localStorage. Every open without a live resume credential is
// a new respondent; storage duplication (e.g. tab duplication) can resume the
// same respondent, so nothing here claims person uniqueness.

// All participant/staff-facing strings below are copy.md rows (cookbook design-system).
export const copy = {
  linkUnavailable: 'This link no longer works. It may have been replaced or the collection may have closed. Ask the person who invited you for a new one. Nothing about the project is shown here.',
  collectionClosed: 'Collection has closed. New answers are not accepted. If you already submitted from this device, your receipt is shown below.',
  draftMismatch: 'Your saved answers were for a different version of this survey and were not restored. Please answer again.',
  draftRestored: 'Your unsent answers were restored on this device.',
  submitFailed: 'Your answers were not submitted. They are still here; try again.',
  receiptThanks: 'Thank you. Your answers stay with the team, grouped with others from the community perspective. Reopening your link shows this receipt again.',
  sameLinkOthers: 'Someone else can answer using the same link on their own device.',
  issuePreview: 'Nothing is sent until you confirm. This is the impact preview the contract requires before every write with an outside effect.',
  issueConfirm: 'Create survey link',
  issueDone: 'Survey link created. Copy it now; it is shown once. Anyone with this link can answer. Revoking it stops new opens; it does not unsend.',
  copyLink: 'Copy link',
  linkCopied: 'Link copied.',
  refreshCounts: 'Refresh counts',
  linkNotConstructed: 'The survey link could not be built from the server reply. Preview and create it again.',
  labelOpening: 'Opening survey…',
  labelPreviewLink: 'Previewing survey link…',
  labelCreateLink: 'Creating survey link…',
  labelCopyLink: 'Copying link…',
  labelRefreshCounts: 'Refreshing counts…',
};

const FRAGMENT = /^#survey=([^&]+)$/;

// Only `#survey=<URL-encoded token>` is an entry; anything else (including an empty token) is not.
export function parseEntryFragment(hash) {
  const m = FRAGMENT.exec(hash || '');
  if (!m) return null;
  let token;
  try { token = decodeURIComponent(m[1]); } catch { return null; }
  return token.trim() ? token : null;
}

// Remove the fragment from the address bar and history without a navigation.
export function stripFragment(win) {
  win.history.replaceState(null, '', win.location.pathname + win.location.search);
}

function hex(buffer) { return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join(''); }

export async function digestNamespace(token, subtle = globalThis.crypto.subtle) {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(token));
  return `shared:${hex(digest)}:`;
}

// Keys: bearer (participant token), draft (JSON), submitKey (idempotency key). sessionStorage only.
export function scopedStorage(storage, namespace) {
  const key = name => namespace + name;
  return {
    get: name => { try { return storage.getItem(key(name)); } catch { return null; } },
    set: (name, value) => { try { storage.setItem(key(name), value); } catch { /* storage loss is a new respondent, not an error */ } },
    remove: name => { try { storage.removeItem(key(name)); } catch { /* ignore */ } },
  };
}

// Draft carries only known item ids plus the exact template identity it was written against.
export function draftFor(form, values) {
  const answers = {};
  for (const item of form.items) if (values[item.id] !== undefined) answers[item.id] = values[item.id];
  return { template: { id: form.template.id, version: form.template.version }, answers };
}

export function isEmptyDraft(draft) {
  return !draft || !draft.answers || Object.values(draft.answers).every(v => v == null || v === '' || (Array.isArray(v) && !v.length));
}

// Returns { answers } for a matching non-empty draft, { mismatch: true } when the
// template/version differs, or null when nothing usable is stored.
export function restoreDraft(store, form) {
  const raw = store.get('draft');
  if (!raw) return null;
  let draft;
  try { draft = JSON.parse(raw); } catch { store.remove('draft'); return null; }
  if (!draft?.template || draft.template.id !== form.template.id || draft.template.version !== form.template.version) return { mismatch: true };
  const known = new Set(form.items.map(item => item.id));
  const answers = {};
  for (const [id, value] of Object.entries(draft.answers || {})) if (known.has(id)) answers[id] = value;
  if (isEmptyDraft({ answers })) return null;
  return { answers };
}

export function saveDraft(store, form, values) {
  const draft = draftFor(form, values);
  if (isEmptyDraft(draft)) { store.remove('draft'); return; }
  store.set('draft', JSON.stringify(draft));
}

// Codes the handlers actually throw (src/handlers/{shared-link,participant,response}.ts):
//   NOT_FOUND_OR_NOT_VISIBLE — unknown/revoked/expired link, or a revoked/expired/foreign session;
//   STAGE_CONFLICT — survey not collecting (closed, archived, wrong stage), link changed during open,
//                    OR "response already submitted" (another client key after a committed response).
// STAGE_CONFLICT is therefore ambiguous on its own. Agreed recovery with the API author (no new code):
// GET /v2/participate/receipt with the same bearer; submitted:true → own receipt; submitted:false →
// closed; a receipt refusal (NOT_FOUND_OR_NOT_VISIBLE) → link unavailable.
export function errorKind(error) {
  const code = String(error?.code || '').trim();
  if (code === 'STAGE_CONFLICT') return 'conflict';
  if (code === 'NOT_FOUND_OR_NOT_VISIBLE' || code === 'NOT_AUTHENTICATED') return 'unavailable';
  return null;
}
// Resolve a STAGE_CONFLICT (or check state before showing an editable form).
// Returns { state: 'receipt', receipt } | { state: 'closed' } | { state: 'unavailable' }.
export async function resolveConflict(client) {
  if (!client.bearer) return { state: 'closed' }; // a conflict before any session exists cannot be "already submitted"
  let receipt;
  try { receipt = await client.receipt(); } catch { return { state: 'unavailable' }; }
  return receipt.submitted ? { state: 'receipt', receipt } : { state: 'closed' };
}

// sessionStorage key holding the CURRENT namespace (the digest, never the raw token) so a
// same-tab reload without the fragment resumes this participant context.
export const CURRENT_KEY = 'shared:current';
export function rememberCurrent(storage, namespace) { try { storage.setItem(CURRENT_KEY, namespace); } catch { /* ignore */ } }
export function currentNamespace(storage) {
  try { const v = storage.getItem(CURRENT_KEY); return v && /^shared:[0-9a-f]{64}:$/.test(v) ? v : null; } catch { return null; }
}

export function shareUrl(origin, entryFragment) {
  if (typeof entryFragment !== 'string' || !parseEntryFragment(entryFragment)) throw new Error(copy.linkNotConstructed);
  return `${origin}/${entryFragment}`;
}

// A participant client for one shared link. `fetchImpl` is the only network path;
// it always sends credentials:'omit' and never a staff Authorization header.
export function createSharedLinkClient({ fetchImpl = globalThis.fetch, store, onEvent } = {}) {
  let bearer = store.get('bearer');
  async function call(url, { method = 'GET', body, auth = true } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth && bearer) headers.authorization = `Bearer ${bearer}`;
    let response;
    try { response = await fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store' }); }
    catch { throw new Error('Local API unavailable. For a write, its outcome is unknown; check server state before retrying.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error(`Unreadable API response (${response.status}).`); }
    if (!response.ok || !data.ok) { const error = new Error(`${data.error?.code || response.status}: ${data.error?.message || 'Request failed'}`); error.code = data.error?.code || String(response.status); throw error; }
    onEvent?.({ method, url, capability: data.capability, receipt: data.receipt, trace_id: data.trace_id });
    return data.result;
  }
  return {
    get bearer() { return bearer; },
    request: (url, opts) => call(url, opts),
    // POST /v2/participate/link {token, resume_token?}; the token goes in the body only.
    async open(token) {
      const body = { token };
      if (bearer) body.resume_token = bearer;
      const result = await call('/v2/participate/link', { method: 'POST', body, auth: false });
      bearer = result.participant_token; store.set('bearer', bearer);
      return result;
    },
    form: () => call('/v2/participate/form'),
    receipt: () => call('/v2/participate/receipt'),
    submitKey() {
      let key = store.get('submitKey');
      if (!key) { key = globalThis.crypto.randomUUID(); store.set('submitKey', key); }
      return key;
    },
    async submit(answers) {
      const result = await call('/v2/participate/responses', { method: 'POST', body: { answers, idempotency_key: this.submitKey() } });
      // Confirmed success only: clear this context's draft and key.
      store.remove('draft'); store.remove('submitKey');
      return result;
    },
  };
}
