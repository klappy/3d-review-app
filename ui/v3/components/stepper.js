// component: Stepper (captain rulings 12:28 + 12:34). ONE progress stepper for the setup wizard (Bincy 03–06) and the
// assessment page (Prepare · Collect · Understand · Improve). Pure string builder: no reads, no navigation of its own.
// Steps before `current` are ticked (done), `current` is the active dot (aria-current="step"), later steps are pending.
// A step with an app-local hash `href` renders as a link so each step can still navigate (assessment page); the wizard
// passes plain labels. Styles are self-contained (STEPPER_CSS, glass look on design-system-v3 tokens) so a page that
// imports the component gets its look without another stylesheet: call ensureStepperStyle(document) once on mount.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Only app-local hash routes become links (same rule as breadcrumbs.js / kit/core.js safeHref).
const safeHref = v => (typeof v === 'string' && /^#[A-Za-z0-9_/%?=&.-]*$/.test(v) ? v : null);

// steps: array of labels or { label, href? }; current: 1-based index of the active step (0 = none yet, > length = all done).
export function stepper(steps = [], current = 1, { label = 'Steps' } = {}) {
  const n = Number.isInteger(current) ? current : 1;
  const items = (Array.isArray(steps) ? steps : []).map(s => (typeof s === 'string' ? { label: s } : s || {}));
  return `<ol class="v3-stepper stepper" aria-label="${esc(label)}">${items.map((s, i) => {
    const k = i + 1, state = k < n ? 'done' : k === n ? 'on' : '';
    const href = safeHref(s.href);
    const body = `<i aria-hidden="true">${k < n ? '✓' : k}</i><span>${esc(s.label)}</span>`;
    const cur = k === n ? ' aria-current="step"' : '';
    return `<li class="${state}"${cur}>${href ? `<a href="${esc(href)}">${body}</a>` : body}</li>`;
  }).join('')}</ol>`;
}

export const STEPPER_CSS = `
.v3-stepper{display:flex;align-items:flex-start;gap:0;margin:8px 0 26px;padding:0;list-style:none}
.v3-stepper li{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--secondary,#5b6675);position:relative;text-align:center}
.v3-stepper li>a{display:flex;flex-direction:column;align-items:center;gap:6px;color:inherit;text-decoration:none;border-radius:var(--r-pip,8px)}
.v3-stepper li>a:hover span{text-decoration:underline}
.v3-stepper li>a:focus-visible{outline:2px solid var(--green,#2f7d5b);outline-offset:3px}
.v3-stepper li::before{content:"";position:absolute;top:calc(var(--step-dot,28px) / 2 - 1px);left:-50%;right:50%;height:2px;background:var(--pip,#c9d1db);z-index:0}
.v3-stepper li:first-child::before{display:none}
.v3-stepper li.done::before,.v3-stepper li.on::before{background:var(--pip-done,#2f7d5b)}
.v3-stepper li i{width:var(--step-dot,28px);height:var(--step-dot,28px);border-radius:50%;display:grid;place-items:center;border:2px solid var(--glass-edge,var(--pip,#c9d1db));background:var(--glass,rgba(255,255,255,.72));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-style:normal;font-weight:600;font-size:12px;color:var(--secondary,#5b6675);position:relative;z-index:1}
.v3-stepper li.done i{background:var(--pip-done,#2f7d5b);border-color:var(--pip-done,#2f7d5b);color:var(--primary-ink,#fff)}
.v3-stepper li.on{color:var(--ink,#1c2430);font-weight:600}
.v3-stepper li.on i{border-color:var(--green,#2f7d5b);color:var(--green,#2f7d5b);box-shadow:0 0 0 4px color-mix(in srgb,var(--green,#2f7d5b) 16%,transparent)}
@media (max-width:650px){.v3-stepper li span{display:none}.v3-stepper li.on span{display:block}}
`;
export const STEPPER_STYLE_ID = 'v3-stepper-css';
// Inject STEPPER_CSS once per document; safe to call on every mount, a no-op without a document.
export function ensureStepperStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById?.(STEPPER_STYLE_ID)) return false;
  const el = doc.createElement('style'); el.id = STEPPER_STYLE_ID; el.textContent = STEPPER_CSS; doc.head.appendChild(el);
  return true;
}
