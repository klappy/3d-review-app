// Version badge + "What changed" dialog (design-system RELEASE-IDENTITY §2).
// Dependency-free: no app.js import. Health is read with a plain fetch because
// /v2/health may be ok:false while still carrying a valid version.
// Fixtures for tests live inline in changelog.test.mjs; there is no ui/changelog.json in git.

export const copy = {
  pending: 'Version…',
  shared: 'Version',
  unavailable: 'Version unavailable',
  version: v => `Version ${v}`,
  notListed: 'Changes for this version are not listed yet.',
  candidate: sha7 => `Built as a candidate at cookbook ${sha7}; release status is recorded in the cookbook`,
  current: ' · current',
  sections: [['added', 'Added'], ['changed', 'Changed'], ['fixed', 'Fixed'], ['security', 'Security']],
};

const sha7 = value => (typeof value === 'string' ? value.slice(0, 7) : '');

// `{build} · app {commit7} · cookbook {release_source7}` + ` · build {build_uuid}` only when present.
export function detailsLine(health) {
  const h = health || {};
  let line = `${h.build ?? ''} · app ${sha7(h.commit)} · cookbook ${sha7(h.release_source)}`;
  if (h.build_uuid) line += ` · build ${h.build_uuid}`;
  return line;
}

function el(doc, tag, text) { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node; }

// Renders the changelog into `body` using text nodes only. `data` is the parsed
// /changelog.json (or null when the read failed / was malformed).
export function renderChangelog({ doc, body, data, health }) {
  const versions = data && Array.isArray(data.versions) ? data.versions : null;
  const current = data && typeof data.current === 'string' ? data.current : (health && health.version) || null;
  const nodes = [];
  const listed = versions !== null && versions.some(entry => entry && entry.version === current);
  if (!listed) nodes.push(el(doc, 'p', copy.notListed));
  for (const entry of versions || []) {
    if (!entry || typeof entry !== 'object') continue;
    const section = el(doc, 'section');
    const released = entry.status === 'released'; // any other value (or none) is never labelled released
    const isCurrent = entry.version === current;
    let heading = String(entry.version ?? '');
    if (released) heading += ` — ${entry.tag ?? ''} · ${entry.date ?? ''}`;
    if (isCurrent) heading += copy.current;
    section.append(el(doc, 'h3', heading));
    if (entry.status === 'candidate') section.append(el(doc, 'p', copy.candidate(sha7(health && health.release_source))));
    const sections = entry.sections && typeof entry.sections === 'object' ? entry.sections : {};
    for (const [key, label] of copy.sections) {
      const items = Array.isArray(sections[key]) ? sections[key] : [];
      if (!items.length) continue;
      section.append(el(doc, 'h4', label));
      const ul = el(doc, 'ul');
      for (const item of items) ul.append(el(doc, 'li', String(item)));
      section.append(ul);
    }
    nodes.push(section);
  }
  body.replaceChildren(...nodes);
}

async function readJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, credentials: 'omit', cache: 'no-store' });
  if (!response || !response.ok) return null;
  return response.json();
}

export function initVersionBadge({ fetchImpl = globalThis.fetch, doc = globalThis.document, shared = false } = {}) {
  const badge = doc.getElementById('version');
  const dialog = doc.getElementById('changelog');
  const build = doc.getElementById('changelog-build');
  const body = doc.getElementById('changelog-body');
  const close = doc.getElementById('changelog-close');
  const api = { health: null, ready: Promise.resolve() };
  let healthPromise = null, opening = false;

  function markUnavailable() { badge.textContent = copy.unavailable; badge.setAttribute('aria-disabled', 'true'); }

  // One GET /v2/health; on the staff route at load, on the shared route lazily on first activation.
  async function readHealth() {
    badge.textContent = copy.pending;
    let result = null;
    try { const data = await readJsonAllowingNotOk(fetchImpl, '/v2/health'); result = data && data.result && typeof data.result === 'object' ? data.result : null; }
    catch { result = null; }
    if (!result || typeof result.version !== 'string' || !result.version) { markUnavailable(); return null; }
    api.health = result;
    badge.textContent = copy.version(result.version);
    badge.removeAttribute('aria-disabled');
    return result;
  }

  // Memoised: the health read happens at most once per page, however many activations race it.
  function healthOnce() { return (healthPromise ??= readHealth()); }

  async function open() {
    if (opening || dialog.open || badge.getAttribute('aria-disabled') === 'true') return;
    opening = true;
    try {
      if (!api.health) { const h = await healthOnce(); if (!h) return; }
      let data = null;
      try { data = await readJson(fetchImpl, '/changelog.json'); } catch { data = null; }
      if (!data || typeof data !== 'object') data = null;
      build.textContent = detailsLine(api.health);
      renderChangelog({ doc, body, data, health: api.health });
      dialog.showModal();
      badge.setAttribute('aria-expanded', 'true');
      close.focus();
    } finally { opening = false; }
  }

  badge.addEventListener('click', () => { api.ready = open(); return api.ready; });
  close.addEventListener('click', () => dialog.close());
  // Covers the Close button, Esc/cancel and any programmatic dialog.close().
  dialog.addEventListener('close', () => { badge.setAttribute('aria-expanded', 'false'); badge.focus(); });

  if (shared) badge.textContent = copy.shared; else api.ready = healthOnce();
  return api;
}

// /v2/health may answer with a non-2xx status and ok:false while still carrying a version.
async function readJsonAllowingNotOk(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, credentials: 'omit', cache: 'no-store' });
  return response.json();
}

if (typeof globalThis.document !== 'undefined' && typeof globalThis.location !== 'undefined' && globalThis.document.getElementById('version')) {
  let shared = typeof globalThis.location.hash === 'string' && globalThis.location.hash.startsWith('#survey=');
  try { shared = shared || globalThis.sessionStorage.getItem('shared:current') !== null; } catch { /* storage unavailable: treat as staff route */ }
  initVersionBadge({ shared });
}
