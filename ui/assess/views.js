// ui/assess/views.js — understand / improve / permissions page modules for the assessment shell (UI overhaul, R1/I1).
// Module contract: { load(ctx, params) → model, render(ctx, model) → html, bind(ctx, root, model) }.
// ctx = { api, esc, enc, go, note, state, routes, cards, current, refresh? }; params = { aid, scope?, id? }.
// Rules carried: per-survey counts only (respondents are NEVER summed across surveys); results render the server's held
// literal; synthetic-only preview/confirmed build; recommendations are "not built" statically; RESERVED_NOT_BUILT/501 never hits
// the generic retry; refusals read "Not visible to you"; permissions are per scope (nothing inherited); danger twins never GET.
import { reportBuildMarkup, bindReportBuild } from './report-build.js';
import { renderReport } from '../report-view.js';
import { learnMore } from '../v3/components/learn-more.js'; // lane 9 L9-24: shared closed-by-default disclosure
import { v3CountLine, v3BandsMarkup, v3ReportScores, v3EvidenceRows, v3EvidenceMarkup, v3StageWord, V3_FLAGS, v3css, v3ReviewGateMarkup, v3SetStage, V3_SET_STAGE, V3_NEXT } from './v3-assessment.js'; // v3 lane 3 (rulings a/b/c) // relative: resolves at /report-view.js in the browser and under node --test

export const LENSES = ['Translation Team', 'Church', 'Community'];
const OTHER = 'Other perspective';
const DOTS = { 'Translation Team': '', Church: 'blue', Community: 'gold', [OTHER]: '' };
const UNAUTHENTICATED = new Set(['NOT_AUTHENTICATED', '401']);
const REFUSED = new Set(['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', '403', '404']);
const NOT_BUILT = new Set(['RESERVED_NOT_BUILT', '501']);
const SIGNIN = '<a href="/v2/auth/access">Sign in again</a>';
export const NOTES_VISIBILITY = 'Everyone with access to this assessment can read these notes.';
export const RECOMMENDATIONS_NOT_BUILT = 'Recommendations are not built yet.';
export const NOT_VISIBLE = 'Not visible to you';
// Live API path segment is the SINGULAR scope noun (observed DEV 2026-09-17: /v2/assessment/{id}/grants ok; plural → NOT_FOUND_OR_NOT_VISIBLE).
const SCOPE_SEG = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' };
const SCOPE_NOUN = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' };
const ROLES = ['viewer', 'member', 'owner'];
const RANK = { viewer: 1, member: 2, owner: 3 };

export const css = `
.lens-block{margin:18px 0 6px}.lens-block h3{margin-bottom:4px}.lens-sum{font-size:14px}
.grants{width:100%;border-collapse:collapse;margin-top:12px}.grants th,.grants td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:14px}.grants th{color:var(--muted);font-weight:600}
.grants select{margin-top:0;min-height:38px;padding:6px 10px;width:auto;display:inline-block}.grants button{min-height:38px;padding:6px 12px}
.inline-form{display:grid;gap:12px;margin-top:14px}.inline-form .actions{margin-top:0}
`;

// Classify an api() failure into the four honest states the contract names. Never a generic retry for NOT_BUILT.
// Display helpers (readable, not new data): the payload and provenance are untouched — only the rendered text is rounded, with the
// exact value kept on the element (title + data-exact). IDs/timestamps stay available inside <details>.
export function humanDate(iso) { const d = new Date(iso); return isNaN(d) ? String(iso || '') : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
export function readableNumbers(rootEl) {
  if (!rootEl || !rootEl.ownerDocument) return 0;
  const doc = rootEl.ownerDocument, walker = doc.createTreeWalker(rootEl, 4 /* NodeFilter.SHOW_TEXT */); const nodes = []; let n; let count = 0;
  while ((n = walker.nextNode())) if (/(?<![:\d])\d+\.\d{3,}(?![\dZ])/.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest('details, code, .report-exact'))) nodes.push(n);
  for (const t of nodes) {
    const frag = doc.createDocumentFragment(); let last = 0; const text = t.nodeValue; const re = /(?<![:\d])(\d+\.\d{3,})(?![\dZ])/g; let m; // never a clock/timestamp fraction (…:39.634Z)
    while ((m = re.exec(text))) { frag.append(text.slice(last, m.index)); const span = doc.createElement('span'); span.className = 'report-exact'; span.title = `exact: ${m[1]}`; span.dataset.exact = m[1]; span.textContent = (Math.round(Number(m[1]) * 10) / 10).toFixed(1); frag.append(span); last = m.index + m[1].length; count++; }
    frag.append(text.slice(last)); t.replaceWith(frag);
  }
  return count;
}
export function classify(e) {
  const code = String(e?.code ?? '');
  if (UNAUTHENTICATED.has(code)) return 'unauthenticated';
  if (REFUSED.has(code)) return 'refused';
  if (NOT_BUILT.has(code)) return 'not_built';
  return 'failed';
}
const settle = p => p.then(value => ({ status: 'loaded', value }), e => ({ status: classify(e), error: String(e?.message || 'Request could not be completed.') }));
const isEditor = role => role === 'owner' || role === 'member';
const activeSurveys = surveys => (surveys || []).filter(s => s.state === 'selected' && !s.archived_at);
const lensFor = s => LENSES.includes(s.perspective) ? s.perspective : OTHER;
function refusalLine(ctx, status, retryAttr, what) {
  const esc = ctx.esc;
  if (status === 'unauthenticated') return `<p class="small muted" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" ${retryAttr}>Retry</a>.</p>`;
  if (status === 'refused') return `<p class="small muted" role="alert">${esc(NOT_VISIBLE)}.</p>`;
  if (status === 'not_built') return `<p class="small muted">${esc(what)} is not built yet.</p>`;
  return `<p class="small muted" role="alert">${esc(what)} could not be loaded. <a href="#" ${retryAttr}>Retry</a></p>`;
}

// ───────────────────────────────── understand ─────────────────────────────────
const understand = {
  async load(ctx, { aid }) {
    const cur = ctx.current, surveys = activeSurveys(cur?.surveys);
    const [counts, results, reports] = await Promise.all([
      Promise.all(surveys.map(s => settle(ctx.api(`/v2/assessments/${ctx.enc(aid)}/surveys/${ctx.enc(s.id)}`)).then(r => [s.id, r]))),
      settle(ctx.api(`/v2/assessments/${ctx.enc(aid)}/results`)),
      settle(ctx.api(`/v2/assessments/${ctx.enc(aid)}/reports`)),
    ]);
    const countMap = new Map();
    for (const [sid, r] of counts) countMap.set(sid, r.status === 'loaded' ? { status: 'loaded', responses: Number(r.value?.counts?.responses ?? 0), respondents: Number(r.value?.counts?.respondents ?? 0), unconfirmed: r.value?.counts?.unconfirmed, expected: r.value?.expected_count ?? r.value?.survey?.expected_count } : r);
    // Ruling 12:22 band input: the newest built report's per-perspective scores (read-only; a failed read leaves bands held).
    let bandScores = null;
    const built = reports.status === 'loaded' && !reports.value?.suppressed && reports.value?.status !== 'held' && Array.isArray(reports.value?.reports) ? reports.value.reports : [];
    const newest = built.filter(x => x && x.id).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    if (newest) { const rr = await settle(ctx.api(`/v2/reports/${ctx.enc(newest.id)}`)); if (rr.status === 'loaded' && !rr.value?.suppressed) { const sc = v3ReportScores(rr.value?.report); if (Object.keys(sc).length) bandScores = sc; } }
    return { aid, role: cur?.assessment?.role, surveys, counts: countMap, results, reports, bandScores, openReport: null };
  },
  render(ctx, m) {
    const esc = ctx.esc;
    // (1) Counts per lens: each survey row shows its OWN responses/respondents; the lens line sums responses only (A1/A2).
    const groups = [...LENSES, OTHER].map(lens => ({ lens, surveys: m.surveys.filter(s => lensFor(s) === lens) })).filter(g => g.lens !== OTHER || g.surveys.length);
    const countCell = s => { const c = m.counts.get(s.id) || { status: 'failed' };
      if (c.status === 'loaded') return `<span data-count="${esc(s.id)}">${c.responses} response${c.responses === 1 ? '' : 's'} · ${c.respondents} respondent${c.respondents === 1 ? '' : 's'}</span><br><span data-v3-count="${esc(s.id)}">${v3CountLine({ responses: c.responses, expected: c.expected ?? s.expected_count, unconfirmed: c.unconfirmed }, esc)}</span>`;
      if (c.status === 'refused') return `<span data-count="${esc(s.id)}" role="alert">no longer available to you here</span>`;
      if (c.status === 'unauthenticated') return `<span data-count="${esc(s.id)}" role="alert">sign-in no longer active · ${SIGNIN}</span>`;
      return `<span data-count="${esc(s.id)}" role="alert">count unavailable · <a href="#" data-retry="counts">Retry</a></span>`; };
    const lensBlocks = groups.map(g => {
      const loaded = g.surveys.filter(s => m.counts.get(s.id)?.status === 'loaded');
      const sum = loaded.reduce((n, s) => n + m.counts.get(s.id).responses, 0);
      const sumLine = g.surveys.length ? `<p class="muted lens-sum" data-lens-sum="${esc(g.lens)}">${sum} response${sum === 1 ? '' : 's'} across ${loaded.length} of ${g.surveys.length} survey${g.surveys.length === 1 ? '' : 's'}${loaded.length !== g.surveys.length ? ' <strong>(partial)</strong>' : ''}</p>` : '<p class="small muted">No survey included for this lens.</p>';
      const rows = g.surveys.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3><a href="${esc(ctx.routes.survey(m.aid, s.id))}">${esc(s.template_name || s.template_id)}</a></h3><p class="small muted">${countCell(s)}</p></div></div>`).join('');
      return `<section class="lens-block" aria-label="${esc(g.lens)}"><h3>${esc(g.lens)}</h3>${sumLine}${rows}</section>`;
    }).join('');
    // (2) Results: the held literal with the server's reason. No numbers, no bands.
    let results;
    if (m.results.status === 'loaded') { const r = m.results.value || {}; results = `<p><span class="badge">${esc(r.status || 'held')}</span></p><p class="muted" data-results-reason>${esc(r.reason || '')}</p>`; }
    else results = refusalLine(ctx, m.results.status, 'data-retry="results"', 'Results');
    // v3 (ruling c): band layout, one card per perspective; a held result shows evidence gaps, never an invented band.
    // v3 U2: per-perspective server counts on each band card (Bincy screen 10 group counts) + evidence toggle and table.
    const lensGroups = Object.fromEntries(LENSES.map(lens => { const ss = m.surveys.filter(s => lensFor(s) === lens), ld = ss.filter(s => m.counts.get(s.id)?.status === 'loaded');
      return [lens, { surveys: ss.length, loaded: ld.length, responses: ld.reduce((n, s) => n + m.counts.get(s.id).responses, 0) }]; }));
    const ev = v3EvidenceMarkup(v3EvidenceRows(m.results.value, LENSES, lensGroups, m.bandScores), !!m.showEvidence, esc);
    const bands = V3_FLAGS.bandResults && (m.results.status === 'loaded' || m.bandScores) ? `<section class="panel v3-summary" data-v3-results><style>${v3css}</style><div class="row"><div><p class="eyebrow">Results</p><h2>What the perspectives say</h2></div><span class="badge" data-v3-state>${esc(v3StageWord(ctx.current?.assessment?.stage))}</span>${ev.btn}</div>${v3BandsMarkup(m.results.value, LENSES, esc, lensGroups, m.bandScores)}${ev.table}${v3ReviewGateMarkup(ctx.current?.assessment?.stage, m.role, esc)}</section>` : '';
    // (3) Reports: server-owned eligibility and provenance; preview never writes a report.
    let reports;
    if (m.reports.status === 'loaded') {
      const r = m.reports.value || {};
      if (r.suppressed || r.status === 'held') reports = `<p class="muted" data-reports-held>${esc(r.reason || 'Reports are held.')}</p>`;
      else { const list = Array.isArray(r.reports) ? r.reports : [];
        reports = list.length ? `<ul class="links" data-report-list>${list.map((x, i) => `<li data-report-id="${esc(x.id)}"><button type="button" data-open-report="${esc(x.id)}">Report ${list.length - i} · built ${esc(humanDate(x.created_at))}</button><details class="small muted report-ids"><summary>Report id</summary><code>${esc(x.id)}</code> · <code>${esc(x.created_at)}</code></details></li>`).join('')}</ul>` : '<p class="muted">No reports have been built for this assessment.</p>'; }
    } else if (m.reports.status === 'refused') reports = '<p class="muted" data-reports-unavailable>Reports are unavailable for this assessment.</p>';
    else reports = refusalLine(ctx, m.reports.status, 'data-retry="reports"', 'Reports');
    const open = m.openReport ? (m.openReport.status === 'held' ? `<p class="muted" data-open-report-reason>${esc(m.openReport.reason)}</p>` : m.openReport.status === 'error' ? `<p class="small muted" role="alert">${esc(m.openReport.text)}</p>` : '') : '';
    const countsNote = '<p class="small muted line">Counts are per survey. Respondents are counted within each survey and are not added across surveys.</p>';
    const reportsPanel = `<section class="panel" data-reports><p class="eyebrow">Reports</p>${reports}<p><button type="button" data-retry="reports">Refresh reports</button></p>${reportBuildMarkup(ctx, m.role)}${m.openReport && m.openReport.status !== 'shown' ? `<div>${open}</div>` : ''}<p class="status" role="status" aria-live="polite" data-report-status></p></section>`;
    const full = '<section class="panel report-full" data-report-full hidden><div class="report-tools"><p class="eyebrow" style="margin:0">Report · full view</p><button type="button" class="quiet" data-close-report>Close report</button></div><div data-report-view></div></section>';
    // No band panel (results unreadable, no scores): the per-survey counts and the results state stay up front (unchanged layout).
    if (!bands) return `<div class="grid"><section class="panel"><p class="eyebrow">Understand</p><h2>Bring the perspectives together</h2>${lensBlocks}${countsNote}</section><aside class="stack"><section class="panel" data-results><p class="eyebrow">Results</p>${results}</section>${reportsPanel}</aside></div>${full}`;
    // Lane 9 L9-24 (captain 17:05 "less text"): the band panel is the screen (one heading, one primary: the review gate).
    // Per-survey counts and the results state move behind the shared Learn more; reports stay visible (they are actions).
    // Validator #282: a results error (and its Retry) is never tucked away — only the loaded results state goes behind Learn more.
    const resultsPanel = `<section${m.results.status === 'loaded' ? '' : ' class="panel"'} data-results><p class="eyebrow">Results</p>${results}</section>`;
    return m.results.status === 'loaded'
      ? `${bands}${learnMore(`<section class="lens-detail"><p class="eyebrow">Counts per survey</p>${lensBlocks}${countsNote}</section>${resultsPanel}`)}${reportsPanel}${full}`
      : `${bands}${resultsPanel}${learnMore(`<section class="lens-detail"><p class="eyebrow">Counts per survey</p>${lensBlocks}${countsNote}</section>`)}${reportsPanel}${full}`;
  },
  bind(ctx, root, m) {
    const clearReport = () => {
      m.reportReadGeneration = (m.reportReadGeneration || 0) + 1; m.openReport = null;
      root.querySelector('[data-report-view]')?.replaceChildren();
      const full = root.querySelector('[data-report-full]'); if (full) full.hidden = true;
      const status = root.querySelector('[data-report-status]'); if (status) status.textContent = '';
    };
    bindReportBuild(ctx, root, m, async () => {
      const reports = await settle(ctx.api(`/v2/assessments/${ctx.enc(m.aid)}/reports`));
      if ((ctx.isCurrent && !ctx.isCurrent()) || root.isConnected === false) return;
      m.reportReadGeneration = (m.reportReadGeneration || 0) + 1; m.reports = reports; m.openReport = null;
      root.innerHTML = understand.render(ctx, m); understand.bind(ctx, root, m);
      root.querySelector('[data-report-status]').textContent = reports.status === 'loaded' ? (reports.value?.suppressed ? 'Report built, but current report access is held. See the reporting policy reason above.' : 'Report built. Open it from the current report list.') : 'Report built, but the list could not be refreshed. Refresh reports to reopen it.';
    }, clearReport);
    root.querySelectorAll('[data-retry]').forEach(el => el.onclick = e => { e.preventDefault(); if (m.reportBuildBusy) return; ctx.go(ctx.routes.assessment(m.aid, 'understand'), { reload: true }); });
    const evBtn = root.querySelector('[data-v3-evidence-toggle]'), evBox = root.querySelector('[data-v3-evidence]');
    if (evBtn && evBox) evBtn.onclick = () => { m.showEvidence = !m.showEvidence; evBox.hidden = !m.showEvidence; evBtn.setAttribute('aria-expanded', String(m.showEvidence)); evBtn.textContent = m.showEvidence ? 'Simple view' : 'Show evidence and details'; };
    const closeBtn = root.querySelector('[data-close-report]'); if (closeBtn) closeBtn.onclick = clearReport;
    // v3 U4 review gate: checkbox arms "Record my review"; each primary is one set_stage move, then the view reloads.
    const gateBtn = root.querySelector('[data-v3-gate-go]'), gateCheck = root.querySelector('[data-v3-review-check]');
    if (gateCheck && gateBtn) gateCheck.onchange = () => { gateBtn.disabled = !gateCheck.checked; };
    if (gateBtn) gateBtn.onclick = async () => {
      if (gateCheck && !gateCheck.checked) return;
      const action = gateBtn.dataset.v3GateGo, status = root.querySelector('[data-v3-gate-status]');
      gateBtn.disabled = true; if (status) status.textContent = 'Saving…';
      try {
        await v3SetStage(ctx.api, ctx.enc, m.aid, action);
        if ((ctx.isCurrent && !ctx.isCurrent()) || root.isConnected === false) return;
        if (status) status.textContent = action === 'recordReview' ? 'Review recorded.' : 'Moved to the next step.';
        // Bugbot 4093922740: the stage is committed server-side, so mark this assessment dirty (shell protocol: the next render
        // refetches it) and go to the target view; same hash → shell re-renders, new hash → hashchange renders.
        if (ctx.state?.dirty instanceof Map) ctx.state.dirty.set(m.aid, 'write');
        else if (typeof ctx.refresh === 'function') { await ctx.refresh(); if (action === 'recordReview') return; }
        ctx.go(ctx.routes.assessment(m.aid, V3_SET_STAGE[action] === 'improve' ? 'improve' : 'understand'));
      } catch (err) {
        const k = classify(err);
        if (status) { status.setAttribute('role', 'alert'); status.textContent = k === 'refused' ? `${NOT_VISIBLE}: nothing changed.` : k === 'unauthenticated' ? 'Your sign-in is no longer active. Sign in again; nothing changed.' : `Nothing changed: ${String(err.message || 'request failed')}`; }
        gateBtn.disabled = !!gateCheck && !gateCheck.checked;
      }
    };
    root.querySelectorAll('[data-open-report]').forEach(btn => btn.onclick = async () => {
      if (ctx.isCurrent && !ctx.isCurrent()) return;
      const readGeneration = (m.reportReadGeneration || 0) + 1; m.reportReadGeneration = readGeneration;
      const id = btn.dataset.openReport, view = root.querySelector('[data-report-view]'), status = root.querySelector('[data-report-status]');
      const all = root.querySelectorAll('[data-open-report]'); all.forEach(b => b.disabled = true); if (status) status.textContent = 'Opening report…';
      // R-1 (Auditor 04aee96): every NON-success outcome is written to the VISIBLE Reports status; the full-width section stays
      // hidden and its view is emptied. Only a rendered report opens the full section.
      const full = root.querySelector('[data-report-full]');
      const showFailure = text => { if (status) status.textContent = text; if (view) view.replaceChildren(); if (full) full.hidden = true; };
      try {
        const r = await ctx.api(`/v2/reports/${ctx.enc(id)}`);
        if ((ctx.isCurrent && !ctx.isCurrent()) || root.isConnected === false || readGeneration !== m.reportReadGeneration) return;
        if (r.suppressed) { m.openReport = { status: 'held', reason: String(r.reason || '') }; showFailure(m.openReport.reason); }
        else {
          const ok = renderReport({ doc: root.ownerDocument || globalThis.document, root: view, report: r.report });
          if (ok) { m.openReport = { status: 'shown', id }; if (view) readableNumbers(view); if (status) status.textContent = ''; if (full) { full.hidden = false; if (full.scrollIntoView) full.scrollIntoView({ block: 'start' }); } }
          else { m.openReport = { status: 'error', text: 'This report could not be displayed.' }; showFailure(m.openReport.text); }
        }
      } catch (e) {
        if ((ctx.isCurrent && !ctx.isCurrent()) || root.isConnected === false || readGeneration !== m.reportReadGeneration) return;
        const k = classify(e); m.openReport = { status: 'error', text: k === 'refused' ? NOT_VISIBLE : k === 'not_built' ? 'Reports are not built yet.' : k === 'unauthenticated' ? 'Your sign-in is no longer active.' : String(e.message || 'Report could not be opened.') };
        showFailure(m.openReport.text);
      } finally { all.forEach(b => b.disabled = false); }
    });
  },
};

// ───────────────────────────────── improve ─────────────────────────────────
const improve = {
  async load(ctx, { aid }) {
    const a = ctx.current?.assessment || {};
    return { aid, role: a.role, notes_reflection: a.notes_reflection ?? '', notes_next_steps: a.notes_next_steps ?? '', editable: isEditor(a.role) };
  },
  render(ctx, m) {
    const esc = ctx.esc;
    if (V3_FLAGS.nextStepPage) {
      // v3 lane 3 L3-4: Bincy screen 11 / prototype frame 11. Recommendations aside not drawn (PARITY I1).
      const T = V3_NEXT;
      const notes = m.editable
        ? `<form data-notes-form><label class="field">${esc(T.reflection)}<textarea name="notes_reflection" rows="3" maxlength="4000" placeholder="${esc(T.reflectionHint)}">${esc(m.notes_reflection)}</textarea></label><label class="field">${esc(T.next)}<textarea name="notes_next_steps" rows="2" maxlength="4000" placeholder="${esc(T.nextHint)}">${esc(m.notes_next_steps)}</textarea></label><p class="small muted">${esc(NOTES_VISIBILITY)}</p><div class="actions"><button class="primary" type="submit" data-save-notes>${esc(T.save)}</button></div><p class="status" role="status" aria-live="polite" data-notes-status></p></form>`
        : `<h3>${esc(T.reflection)}</h3><p data-notes-reflection>${m.notes_reflection ? esc(m.notes_reflection) : '<span class="muted">Nothing recorded yet.</span>'}</p><h3>${esc(T.next)}</h3><p data-notes-next-steps>${m.notes_next_steps ? esc(m.notes_next_steps) : '<span class="muted">No next step recorded yet.</span>'}</p><p class="small muted">${esc(NOTES_VISIBILITY)}</p>`;
      // Lane 9 L9-24: the schedule note and the role explanation move behind the shared Learn more (one line kept: who can read).
      const more = `<p class="muted">${esc(T.footer)}</p>${m.editable ? '' : `<p class="muted">Your role here is ${esc(m.role || 'viewer')}; editing needs a member or owner role.</p>`}`;
      return `<section class="panel" data-v3-next><p class="eyebrow">${esc(T.eyebrow)}</p><h2>${esc(T.title)}</h2>${notes}${learnMore(more)}</section>`;
    }
    const notes = m.editable
      ? `<form data-notes-form><label class="field">Reflection<textarea name="notes_reflection" maxlength="4000">${esc(m.notes_reflection)}</textarea></label><label class="field">Next steps<textarea name="notes_next_steps" maxlength="4000">${esc(m.notes_next_steps)}</textarea></label><p class="small muted">${esc(NOTES_VISIBILITY)}</p><div class="actions"><button class="primary" type="submit" data-save-notes>Save notes</button></div><p class="status" role="status" aria-live="polite" data-notes-status></p></form>`
      : `<h3>Reflection</h3><p data-notes-reflection>${m.notes_reflection ? esc(m.notes_reflection) : '<span class="muted">No reflection recorded.</span>'}</p><h3>Next steps</h3><p data-notes-next-steps>${m.notes_next_steps ? esc(m.notes_next_steps) : '<span class="muted">No next steps recorded.</span>'}</p><p class="small muted">${esc(NOTES_VISIBILITY)} Your role here is ${esc(m.role || 'viewer')}; editing needs a member or owner role.</p>`;
    return `<div class="grid"><section class="panel"><p class="eyebrow">Improve</p><h2>What comes next?</h2>${notes}</section><aside class="panel" data-recommendations><p class="eyebrow">Recommendations</p><p class="muted">${esc(RECOMMENDATIONS_NOT_BUILT)}</p></aside></div>`;
  },
  bind(ctx, root, m) {
    const form = root.querySelector('[data-notes-form]'); if (!form) return;
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('[data-save-notes]'), status = form.querySelector('[data-notes-status]');
      const body = { notes_reflection: form.querySelector('[name=notes_reflection]').value, notes_next_steps: form.querySelector('[name=notes_next_steps]').value };
      btn.disabled = true; if (status) { status.textContent = 'Saving…'; status.setAttribute('role', 'status'); }
      try {
        const r = await ctx.api(`/v2/assessments/${ctx.enc(m.aid)}/notes`, { method: 'PATCH', body });
        const a = r?.assessment || {}; m.notes_reflection = a.notes_reflection ?? body.notes_reflection; m.notes_next_steps = a.notes_next_steps ?? body.notes_next_steps;
        if (status) status.textContent = 'Notes saved.';
        if (typeof ctx.refresh === 'function') await ctx.refresh();
      } catch (err) {
        const k = classify(err);
        if (status) { status.setAttribute('role', 'alert'); status.textContent = k === 'refused' ? `${NOT_VISIBLE}: the notes were not saved.` : k === 'unauthenticated' ? 'Your sign-in is no longer active. Sign in again; the notes were not saved.' : k === 'not_built' ? 'Notes are not built yet.' : `Notes could not be saved: ${String(err.message || 'request failed')}`; }
      } finally { btn.disabled = false; }
    };
  },
};

// ───────────────────────────────── permissions ─────────────────────────────────
// One page per scope. Reads: GET /v2/{scope}/{id}/grants → { scope, grants:[{id, principal_id, role, created_at}], pending_invitations }.
// Writes: invite (danger two-step: dry_run → execute with confirm_token), revoke (DELETE), update_role (danger two-step),
// transfer_owner (danger two-step). Request-body shape follows the legacy client's danger calls: { params, mode, confirm_token }.
// G1: the Permissions page lives in ./permissions.js (Auth contract 2026-09-18); re-exported here so the shell's view table is unchanged.
import { permissions } from './permissions.js';
export const views = { understand, improve, permissions };
export default views;
