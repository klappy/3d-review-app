// Share card for ONE survey (leaf page) — product brief row "Survey": outcome-first sharing with confirmed copy, QR, invitation
// sheet, revoke this session's link. Behaviour reference: legacy ui/app.js issue-link-* + ui/shared-link.js (staff side).
// Credential discipline (unchanged from legacy): the link token is shown ONCE, lives only in this module's in-memory model for
// the survey it was minted for (U36: shared in memory with Collect's per-survey cache, same aid|sid|epoch key), is never written to storage, never logged, never echoed into the URL, and is cleared when the
// identity, assessment, survey or data epoch changes. Revoke uses the link id, never the token.
// APIs (existing): POST /v2/assessments/{aid}/surveys/{sid}/links {params:{}, mode:'dry_run'|'execute', confirm_token}
//                  DELETE /v2/assessments/{aid}/surveys/{sid}/links/{link_id}
import { shareUrl } from '../shared-link.js';
import qrcode from './vendor-qrcode.js';
import { stageMoveConfirm } from '../v3/components/review-gate.js'; // U10: the shared in-page confirm (never window.confirm)
import { learnMore } from '../v3/components/learn-more.js'; // B30: the survey screen keeps one heading; the lead sits behind Learn more

export const CAN_SHARE = new Set(['owner', 'member']); // issue_link / revoke_link roles O, M (contract rows)
export const copy = Object.freeze({
  title: 'Share this survey',
  lead: 'Share a link, show a QR code or print invitations. Anyone with the link can answer without an account. Nothing is emailed from here.',
  open: 'Share survey', copyLink: 'Copy link', copied: 'Link copied.',
  qr: 'QR code', print: 'Print', printAll: 'Print all',
  revoke: 'Revoke this link',
  revoked: 'Link revoked. It no longer opens; answers already sent stay with the team.',
  onceShown: 'Keep a copy of this link before leaving. It is only available on this page for now.',
  readOnly: 'Your role here cannot share participant links (owner or member can).',
  notCollecting: 'This assessment is not collecting: the link opens only while the stage is Collect.',
  uncertain: 'The request may have created a link, but its result was not received. Trying again may create another link. Nothing was emailed.',
  codes: 'Access codes', codesOnce: 'Codes are shown once only: print or save them before you leave this page.',
});

// One reading of an execute failure, shared by the Share card and Collect: only an answer proving nothing was created (expired
// or missing confirmation, lost permission) is certain; anything else (lost response, incomplete receipt) may have made a link.
export function executeFailure(e) {
  if (['CONFIRM_EXPIRED', 'CONFIRM_REQUIRED'].includes(e?.code)) return { uncertain: false, message: 'Sharing options expired. Try sharing again.' };
  if (e?.status === 401 || e?.status === 403) return { uncertain: false, message: 'You no longer have permission to share. Sign in and check your access.' };
  return { uncertain: true, message: copy.uncertain };
}
export function failure(f = executeFailure()) { return Object.assign(new Error(f.message), { uncertain: f.uncertain, shareMessage: f.message }); }

export function blankShare() { return { stage: 'idle', open: false, confirm: null, deadline: 0, link: null, message: null, alert: false, codes: blankCodes() }; }
// U10: paper access codes on the same card (cap.survey.issue_codes, then cap.survey.export_codes dry_run → confirm_token → execute).
// Code values live only in this in-memory model, are never stored or logged, and are cleared with the link when identity,
// assessment, survey or data epoch changes.
// Nothing is issued until the in-page confirm; the batch is issued, dry-run previewed and released in that one step, and any
// exit short of showing the codes undoes the batch (receipt undo_token), so no live batch is ever left unseen.
export function blankCodes() { return { stage: 'idle', count: 20, list: null, live: null, message: '', alert: false }; }
// share model keyed to (aid, sid, epoch) — assess.js drops it whenever any of those changes.
export function shareFor(state, aid, sid, epoch) {
  const s = state.share;
  if (s && s.aid === aid && s.sid === sid && s.epoch === epoch) return s;
  state.share = { aid, sid, epoch, ...blankShare() };
  return state.share;
}

export function qrSvg(url) { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }

// B43: THE share card's actions — Copy link · QR code · Print, always in this order, one tap each. Used by the survey page
// (prefix "share"), the launched screen and Collect (prefix "group", via groupLinks). Nothing here mints a link.
// U45 (Bincy B43): no QR toggle. Once the card has a link its QR shows inline (`qrShown`) and the QR button is gone; before
// that, "QR code" is the one tap that makes the link and shows the code.
export function shareActions(ctx, { prefix, key = null, disabled = false, qrShown = false, primary = false }) {
  const esc = ctx.esc, v = key == null ? '' : `="${esc(key)}"`, off = disabled ? ' disabled' : '';
  return `<span class="share-actions" data-share-actions><button type="button"${primary ? ' class="primary"' : ''} data-${prefix}-copy${v}${off}>${esc(copy.copyLink)}</button>${qrShown ? '' : `<button type="button" data-${prefix}-qr${v}${off}>${esc(copy.qr)}</button>`}<button type="button" data-${prefix}-print${v}${off}>${esc(copy.print)}</button></span>`;
}

export function render(ctx, { current, survey, share }) {
  const esc = ctx.esc, role = current.assessment.role;
  if (!CAN_SHARE.has(role)) return `<section class="panel" data-share><p class="eyebrow">Share</p><p class="muted">${esc(copy.readOnly)}</p></section>`;
  const collecting = survey.collection_status === 'open' || current.assessment.stage === 'collect';
  const busy = share.stage === 'busy';
  const link = share.link;
  const ready = !!link || share.stage === 'ready';
  const actions = !share.open
    ? `<button type="button" class="primary" data-share-open>${esc(copy.open)}</button>`
    : `<p class="note small">${link ? 'Everyone can use this one link; after a page reload, sharing makes a new one.' : `Choose how to share ${esc(survey.template_name || 'this survey')}. Your choice makes a participant link available.`} You can revoke the link later; answers already sent stay with the team.</p>
      ${link ? `<div class="share-link"><p data-share-url><code>${esc(link.url)}</code></p>${link.expires_at ? `<p class="small muted">Expires ${esc(link.expires_at)}</p>` : ''}</div>` : ''}
      <div class="actions">${ready || busy ? shareActions(ctx, { prefix: 'share', disabled: busy, qrShown: !!link, primary: true }) : `<button type="button" data-share-open>Try sharing again</button>`}${link ? `<button type="button" class="quiet" data-share-revoke ${busy ? 'disabled' : ''}>${esc(copy.revoke)}</button>` : ''}<button type="button" class="quiet" data-share-close ${busy ? 'disabled' : ''}>Close</button></div>
      ${link ? `<figure class="share-qr" data-share-qr-figure>${qrSvg(link.url)}<figcaption class="small muted">Scan to open the survey</figcaption></figure>` : ''}${link ? `<p class="small muted">${esc(copy.onceShown)}</p>` : ''}`;
  return `<section class="panel" data-share><p class="eyebrow">Share</p>${collecting ? '' : `<p class="small muted">${esc(copy.notCollecting)}</p>`}${actions}${codesBlock(ctx, survey, share.codes || (share.codes = blankCodes()))}${learnMore(`<p class="small muted">${esc(copy.lead)}</p>`)}<p class="small ${share.alert ? 'alert' : 'muted'}" role="status" data-share-status>${esc(share.message || '')}</p></section>`;
}

// U10: Access codes — count → preview (dry run) → in-page confirm → shown once → print-ready list. Owners and members only
// (render returns before this for any other role).
export function codesBlock(ctx, survey, c) {
  const esc = ctx.esc, busy = c.stage === 'busy', n = c.count;
  const body = c.stage === 'shown' && c.list
    ? `<ol class="share-codes-list" data-share-codes-list>${c.list.map(x => `<li><code>${esc(x.code)}</code></li>`).join('')}</ol><div class="actions"><button type="button" class="primary" data-share-codes-print>${esc(copy.print)}</button><button type="button" class="quiet" data-share-codes-done>Done</button></div>`
    : c.live
      ? `<p class="alert" data-share-codes-live>${esc(`${c.live.n} code${c.live.n === 1 ? ' is' : 's are'} issued and still active.`)}</p><div class="actions"><button type="button" data-share-codes-undo${busy ? ' disabled' : ''}>Undo</button></div>`
      : c.stage === 'confirm'
        ? stageMoveConfirm(`Issue and show ${n} access code${n === 1 ? '' : 's'} for ${survey.template_name || 'this survey'} now? ${copy.codesOnce}`, 'Show codes once', esc).replace('data-stage-confirm ', 'data-share-codes-confirm ').replace('data-stage-confirm-go', 'data-share-codes-go').replace('data-stage-confirm-cancel', 'data-share-codes-cancel')
        : `<div class="actions"><label class="small">How many <input type="number" min="1" max="100" value="${esc(c.count)}" data-share-codes-count${busy ? ' disabled' : ''}></label><button type="button" data-share-codes-prepare${busy ? ' disabled' : ''}>Preview codes</button></div>`;
  return `<div class="share-codes" data-share-codes><p class="eyebrow">${esc(copy.codes)}</p><p class="small muted">${esc(copy.codesOnce)}</p>${body}<p class="small ${c.alert ? 'alert' : 'muted'}" role="status" data-share-codes-status>${esc(c.message || '')}</p></div>`;
}
export function codesSheetHtml(ctx, { current, survey, codes }) {
  const esc = ctx.esc;
  return `<div class="share-sheet-print share-codes-sheet"><h1>${esc(survey.template_name || 'Survey')}</h1><p>${esc(current.assessment.name)}${survey.perspective ? ` · ${esc(survey.perspective)} perspective` : ''}</p><p>Each access code opens the survey once. No account is needed.</p><ol class="share-codes-list">${codes.map(x => `<li><code>${esc(x.code)}</code></li>`).join('')}</ol></div>`;
}
// Invitation sheet: a print-only element mounted directly on <body> (same approach as the blank-survey print, Auditor 2A-1),
// removed after printing. Carries the URL, the QR and plain instructions; nothing else about the project.
export function invitationSheetHtml(ctx, { current, survey, url }) {
  return oneSheetHtml(ctx, { title: survey.template_name || 'Survey', line: `${current.assessment.name}${survey.perspective ? ` · ${survey.perspective} perspective` : ''}`, url });
}
export function oneSheetHtml(ctx, { title, line, url }) {
  const esc = ctx.esc;
  return `<div class="share-sheet-print"><h1>${esc(title || 'Survey')}</h1>${line ? `<p>${esc(line)}</p>` : ''}<p>Open this link on your phone or computer to answer. No account is needed. Your answers stay with the team.</p><p class="share-sheet-url">${esc(url)}</p><div class="share-sheet-qr">${qrSvg(url)}</div><p>Or scan the code with your camera.</p></div>`;
}
// B43 "Print all": one print-ready page (A4 or Letter) listing every survey — title, one-line description, QR (and the link).
export function printAllHtml(ctx, { heading, items }) {
  const esc = ctx.esc;
  return `<div class="share-sheet-print share-all" data-print-all-sheet><h1>${esc(heading || 'Surveys')}</h1><p>Scan a code or open its link. No account is needed.</p><ol class="share-all-list">${items.map(i => `<li class="share-all-item"><div class="share-all-qr">${qrSvg(i.url)}</div><div><h2>${esc(i.title || 'Survey')}</h2>${i.line ? `<p>${esc(i.line)}</p>` : ''}<p class="share-sheet-url">${esc(i.url)}</p></div></li>`).join('')}</ol></div>`;
}
// Mount a print-only sheet directly on <body>, print, remove it (the blank-survey print approach, Auditor 2A-1).
export function printOnBody(doc, html, print = () => globalThis.print?.()) {
  const sheet = doc.createElement('div'); sheet.className = 'stage-print-only share-sheet'; sheet.innerHTML = html;
  doc.body.append(sheet); try { print(); } finally { sheet.remove(); }
}
export const printAllButton = ctx => `<p class="share-print-all"><button type="button" data-share-print-all>${ctx.esc(copy.printAll)}</button><span class="small muted" role="status" data-print-all-status></span></p>`;
// items() → Promise<[{ title, line, url }]>. Delegated on `root`. One tap, one page.
export function bindPrintAll(root, { heading, items, doc = globalThis.document, print = () => globalThis.print?.(), signal } = {}) {
  let busy = false;
  root.addEventListener('click', async e => {
    const b = e.target?.closest?.('[data-share-print-all]'); if (!b || busy) return;
    const status = b.parentElement?.querySelector?.('[data-print-all-status]');
    const say = (t, alert = false) => { if (status) { status.textContent = t; status.className = `small ${alert ? 'alert' : 'muted'}`; } };
    busy = true;
    try {
      const list = (await items()).filter(i => i && i.url);
      if (!list.length) { say('No survey link is ready to print.', true); return; }
      printOnBody(doc, printAllHtml({ esc: escHtml }, { heading: typeof heading === 'function' ? heading() : heading, items: list }), print); say('');
    } catch (err) { say(err?.shareMessage || 'The page could not be prepared. Try again.', true); }
    finally { busy = false; }
  }, signal ? { signal } : undefined);
}
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bind(ctx, root, { current, survey, share, api, apiFull = null, onChange, links = null, linkKey = null, print = () => globalThis.print?.(), clipboard = globalThis.navigator?.clipboard, doc = globalThis.document, origin = globalThis.location?.origin, now = Date.now }) {
  const aid = current.assessment.id, sid = survey.id, base = `/v2/assessments/${ctx.enc(aid)}/surveys/${ctx.enc(sid)}/links`;
  // The model stays current until identity, survey or epoch changes. A same-page paint disconnects this root; that must
  // not blank the model or skip onChange. Copy/print still require the bound node so a gone page cannot receive a credential.
  const same = () => !ctx.isCurrent || ctx.isCurrent();
  const live = () => root.isConnected !== false && same();
  const update = () => { if (same()) onChange(); };
  const say = (message, alert = false) => { share.message = message; share.alert = alert; update(); };
  const fail = (message) => { share.stage = share.link ? 'linked' : 'idle'; say(message, true); };
  root.querySelector('[data-share-open]')?.addEventListener('click', async () => {
    if (!live() || share.stage === 'busy') return;
    share.open = true;
    if (share.link) { update(); return; }
    share.stage = 'busy'; share.confirm = null; say('Getting sharing options ready…');
    try {
      const r = await api(base, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
      if (!same()) { Object.assign(share, blankShare()); return; }
      if (!r.confirm_token || !(r.expires_in > 0)) throw new Error('Invalid preparation');
      share.confirm = r.confirm_token; share.deadline = now() + r.expires_in * 1000; share.stage = 'ready'; say('');
    } catch { if (!same()) { Object.assign(share, blankShare()); return; } fail('Sharing options could not be prepared. Try again, or sign in if your session has ended.'); }
  });
  root.querySelector('[data-share-close]')?.addEventListener('click', () => {
    if (share.stage === 'busy') return;
    share.open = false; share.confirm = null; share.stage = share.link ? 'linked' : 'idle'; say('');
  });
  const deliver = async action => {
    if (!live() || share.stage === 'busy' || !CAN_SHARE.has(current.assessment.role)) return;
    if (!share.link && links && linkKey) { const known = knownLink(links, linkKey); if (known) { share.link = known; share.confirm = null; share.stage = 'linked'; } } // U36: issued meanwhile (Collect/launch) — reuse it
    if (!share.link) {
      if (!share.confirm || now() >= share.deadline) { share.confirm = null; fail('Sharing options expired. Try sharing again.'); return; }
      const confirm_token = share.confirm;
      share.confirm = null; share.stage = 'busy'; say('Preparing your link…');
      try {
        const r = await api(base, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token } });
        if (!same()) { Object.assign(share, blankShare(), { message: copy.uncertain, alert: true }); return; }
        if (!r.link_id || typeof r.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(r.entry_fragment)) throw new Error('Incomplete result');
        share.link = { id: r.link_id, url: shareUrl(origin, r.entry_fragment), expires_at: r.expires_at || null };
        if (links && linkKey) rememberLink(links, linkKey, share.link); // U36: Collect's Copy/QR/Print reuse this link
      } catch (e) {
        if (!same()) { Object.assign(share, blankShare(), { message: copy.uncertain, alert: true }); return; }
        fail(executeFailure(e).message);
        return;
      }
    }
    if (!same()) return;
    share.stage = 'linked'; say('');
    if (!live()) return;
    if (action === 'qr') return; // U45: the QR already shows inline with the link (render); no toggle state
    if (action === 'copy') {
      try { await clipboard.writeText(share.link.url); if (same()) say(copy.copied); }
      catch { if (same()) say('Your link is ready. Press Copy link again, or select the link text and copy it.', true); }
      return;
    }
    try { printOnBody(doc, invitationSheetHtml(ctx, { current, survey, url: share.link.url }), print); }
    catch { if (same()) say('Your link is ready, but printing did not open. Press Print again.', true); }
  };
  root.querySelector('[data-share-copy]')?.addEventListener('click', () => deliver('copy'));
  root.querySelector('[data-share-qr]')?.addEventListener('click', () => deliver('qr'));
  root.querySelector('[data-share-print]')?.addEventListener('click', () => deliver('print'));
  root.querySelector('[data-share-revoke]')?.addEventListener('click', async () => {
    if (!live() || share.stage === 'busy' || !share.link) return;
    share.stage = 'busy'; update();
    try {
      await api(`${base}/${ctx.enc(share.link.id)}`, { method: 'DELETE' });
      if (links && linkKey && knownLink(links, linkKey)?.id === share.link.id) links.delete(linkKey); // never hand out a revoked link
      if (!same()) return;
      Object.assign(share, blankShare()); say(copy.revoked);
    } catch { if (same()) fail('Revocation could not be confirmed. The link may still work. Try revoking it again.'); }
  });
  bindCodes(ctx, root, { current, survey, share, api, apiFull: apiFull || (async (u, o) => ({ result: await api(u, o) })), same, live, update, print, doc });
}
function bindCodes(ctx, root, { current, survey, share, api, apiFull, same, live, update, print, doc }) {
  const c = share.codes || (share.codes = blankCodes()), base = `/v2/assessments/${ctx.enc(current.assessment.id)}/surveys/${ctx.enc(survey.id)}/codes`;
  const say = (message, alert = false) => { c.message = message; c.alert = alert; update(); };
  const ok = () => live() && c.stage !== 'busy' && CAN_SHARE.has(current.assessment.role);
  // Undo the whole batch (handlers/undo.ts revokes every unredeemed code or none). true only on a confirmed undo.
  const undo = async batch => { if (!batch?.token) return false; try { await api(`/v2/undo/${ctx.enc(batch.token)}`, { method: 'POST' }); return true; } catch { return false; } };
  root.querySelector('[data-share-codes-prepare]')?.addEventListener('click', () => {
    if (!ok()) return;
    const count = Number(root.querySelector('[data-share-codes-count]')?.value ?? c.count);
    if (!Number.isInteger(count) || count < 1 || count > 100) { say('Choose between 1 and 100 codes.', true); return; }
    c.count = count; c.stage = 'confirm'; say('');
  });
  root.querySelector('[data-share-codes-cancel]')?.addEventListener('click', () => { if (c.stage !== 'confirm') return; c.stage = 'idle'; say('Cancelled; no codes were issued.'); });
  root.querySelector('[data-share-codes-go]')?.addEventListener('click', async () => {
    if (!ok() || c.stage !== 'confirm') return;
    c.stage = 'busy'; say('Issuing codes…');
    let batch = null, shown = false;
    try {
      const j = await apiFull(base, { method: 'POST', body: { count: c.count } });
      const ids = j?.result?.ids; batch = { token: j?.receipt?.undo_token || null, n: Array.isArray(ids) ? ids.length : c.count };
      if (!Array.isArray(ids) || !ids.length) throw new Error('Incomplete result');
      const d = await api(`${base}/export`, { method: 'POST', body: { params: { ids }, mode: 'dry_run' } });
      if (!d?.confirm_token) throw new Error('Invalid preparation');
      const r = await api(`${base}/export`, { method: 'POST', body: { params: { ids }, mode: 'execute', confirm_token: d.confirm_token } });
      if (!Array.isArray(r?.codes) || r.codes.some(x => typeof x?.code !== 'string')) throw new Error('Incomplete result');
      if (!same()) return; // left the page: the finally below undoes the unseen batch
      c.list = r.codes.map(x => ({ code: x.code })); c.stage = 'shown'; shown = true; say('');
    } catch {
      if (!batch) { if (same()) { c.stage = 'idle'; say('Codes could not be issued. Try again, or sign in if your session has ended.', true); } return; }
    } finally {
      if (batch && !shown) {
        const undone = await undo(batch);
        if (same()) { c.stage = 'idle'; if (undone) { c.live = null; say('The codes could not be shown, so the batch was undone; no codes were issued.', true); } else { c.live = batch; say(''); } }
      }
    }
  });
  root.querySelector('[data-share-codes-undo]')?.addEventListener('click', async () => {
    if (!ok() || !c.live) return;
    c.stage = 'busy'; update();
    const undone = await undo(c.live);
    if (!same()) return;
    c.stage = 'idle';
    if (undone) { c.live = null; say('Undone; no codes are active from that batch.'); } else say('Undo did not go through. Try again.', true);
  });
  root.querySelector('[data-share-codes-print]')?.addEventListener('click', () => {
    if (!live() || !c.list) return;
    try { printOnBody(doc, codesSheetHtml(ctx, { current, survey, codes: c.list }), print); }
    catch { say('Printing did not open. Press Print again.', true); }
  });
  root.querySelector('[data-share-codes-done]')?.addEventListener('click', () => { Object.assign(c, blankCodes(), { count: c.count }); update(); });
}

// B36 (Bincy checklist): one row per group — "Group · Survey", then Copy link and Show QR code as secondary buttons, one tap
// each. The same copy strings, QR and clipboard path as the Share card above; used on the launched screen and on Collect.
// `url` is known on the launched screen; on Collect it is issued on the first tap (issueLink) and kept in memory only, and once
// the survey has an active link (U36 cache) Collect passes it, so the row's QR shows inline across repaints (U45). Collect
// rows pass no group/survey: the group heading and survey title sit just above, so only the buttons show (no repeated words).
// B43: each row is the share card — shareActions (Copy link · QR code · Print). `title`/`line` feed the printed page only.
const qrFigure = url => `${qrSvg(url)}<p class="small muted">Scan to open the survey</p>`;
export function groupLinks(ctx, rows) {
  const esc = ctx.esc;
  return `<ul class="share-groups" data-group-links>${rows.map(r => `<li class="share-group" data-group-link="${esc(r.key)}" data-print-title="${esc(r.title || r.survey || '')}" data-print-line="${esc(r.line || '')}">${r.group ? `<span class="share-group-label" data-group-label>${esc(r.group)} <span aria-hidden="true">·</span> ${esc(r.survey)}</span>` : ''}${r.url ? `<input class="share-group-url" readonly aria-label="${esc(r.group ? `${r.group} · ${r.survey} link` : `${r.title || 'Survey'} link`)}" value="${esc(r.url)}">` : ''}${shareActions(ctx, { prefix: 'group', key: r.key, qrShown: !!r.url })}<span class="small muted" role="status" data-group-status></span>${r.url ? `<div class="share-qr" data-group-qr-figure>${qrFigure(r.url)}</div>` : '<div class="share-qr" data-group-qr-figure hidden></div>'}</li>`).join('')}</ul>`;
}

// resolve(key) → Promise<url>. Delegated on `root`, so a repaint of the rows needs no rebinding.
export function bindGroupLinks(root, { resolve, clipboard = globalThis.navigator?.clipboard, signal, doc = globalThis.document, print = () => globalThis.print?.() } = {}) {
  const busy = new Set();
  root.addEventListener('click', async e => {
    const b = e.target?.closest?.('[data-group-copy],[data-group-qr],[data-group-print]'); if (!b) return;
    const row = b.closest('[data-group-link]'); if (!row) return;
    const key = b.dataset.groupCopy ?? b.dataset.groupQr ?? b.dataset.groupPrint, isQr = b.dataset.groupQr !== undefined, isPrint = b.dataset.groupPrint !== undefined;
    const status = row.querySelector('[data-group-status]'), fig = row.querySelector('[data-group-qr-figure]');
    const say = (t, alert = false) => { if (status) { status.textContent = t; status.className = `small ${alert ? 'alert' : 'muted'}`; } };
    if (busy.has(key)) return; busy.add(key);
    let url;
    try { url = await resolve(key); } catch (e) { busy.delete(key); say(e?.shareMessage || 'The link could not be prepared. Try again, or sign in if your session has ended.', true); return; }
    busy.delete(key);
    if (!url) { say('The link could not be prepared. Try again.', true); return; }
    // U45: once the row has its link the QR stays visible inline and the QR button goes (no toggle).
    if (fig && fig.hidden) { fig.innerHTML = qrFigure(url); fig.hidden = false; row.querySelector('[data-group-qr]')?.remove?.(); }
    if (isQr) { say(''); return; }
    if (isPrint) { try { printOnBody(doc, oneSheetHtml({ esc: escHtml }, { title: row.dataset?.printTitle, line: row.dataset?.printLine, url }), print); say(''); } catch { say('Printing did not open. Press Print again.', true); } return; }
    try { await clipboard.writeText(url); say(copy.copied); } catch { say(`Copy did not work. Select and copy: ${url}`, true); }
  }, signal ? { signal } : undefined);
}

// Collect: issue one participant link for a survey in one tap (dry_run → execute, the Share card's API pair). The token is
// returned to the caller only; never stored, never logged.
export async function issueLink(api, { aid, sid, origin = globalThis.location?.origin, enc = encodeURIComponent }) {
  const base = `/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`;
  const d = await api(base, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
  if (!d?.confirm_token) throw new Error('Invalid preparation');
  let r;
  try { r = await api(base, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token: d.confirm_token } }); }
  catch (e) { throw failure(executeFailure(e)); }
  if (!r?.link_id || typeof r.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(r.entry_fragment)) throw failure();
  return { id: r.link_id, url: shareUrl(origin, r.entry_fragment), expires_at: r.expires_at || null };
}
// Collect's per-key link cache. A certain failure clears the key; an uncertain one (the execute may have created a link) keeps
// an uncertain mark for the (aid, sid, epoch) key: every later tap shows the Share card's warning again and issues nothing, so a
// repaint that wipes the row's message can never turn the next tap into a silent second link. A new link is then a deliberate
// act on the survey's Share card.
export function cachedLink(cache, k, issue, now = Date.now) {
  let cur = cache.get(k);
  if (cur?.uncertain) return Promise.reject(failure());
  if (cur?.link && !liveLink(cur.link, now)) { cache.delete(k); cur = null; } // an expired link is never handed out again
  if (!cur) {
    const p = issue().then(l => { p.link = l; return l; }, e => { if (cache.get(k) === p) { if (e?.uncertain) cache.set(k, { uncertain: true }); else cache.delete(k); } throw e; });
    cache.set(k, p);
  }
  return cache.get(k);
}

// U36: one active link per survey. The launch page, Collect's rows and the survey's Share card read and write the same
// in-memory entry keyed by linkKey(aid, sid) — not by the data epoch, so moving between pages or refreshing the assessment
// data keeps the survey's link. A new link is issued only when none is active here (none yet, revoked here, expired) or on the
// Share card's explicit new-link action. The entry is dropped with identity. The server keeps only a hash of each token, so
// after a browser reload the link cannot be read back and sharing again makes a new one (see the card's sentence).
export const linkKey = (aid, sid) => `${aid}|${sid}`;
const liveLink = (l, now = Date.now) => !l.expires_at || !(Date.parse(l.expires_at) <= now());
export function knownLink(cache, k, now = Date.now) { const c = cache?.get(k); return c && !c.uncertain && c.link && liveLink(c.link, now) ? c.link : null; }
export function rememberLink(cache, k, link) { const p = Promise.resolve(link); p.link = link; cache.set(k, p); }
// The launch page's links (wizard ctx.links rows) join the same cache, so Collect and the survey page reuse them.
export function rememberLaunchLink(cache, aid, row, origin = globalThis.location?.origin) {
  if (!cache || !aid || !row?.id || !row.survey || typeof row.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(row.entry_fragment)) return;
  rememberLink(cache, linkKey(aid, row.survey), { id: row.id, url: shareUrl(origin, row.entry_fragment), expires_at: row.expires_at || null });
}

export const css = `.share-codes{margin-top:14px;border-top:1px solid var(--line,#ddd);padding-top:10px}.share-codes-list{columns:2;gap:24px;font-size:18px;line-height:1.8}.share-groups{list-style:none;padding:0;margin:10px 0;display:grid;gap:10px}.share-group{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.share-group-label{font-weight:600;flex:1 1 180px;min-width:0}.share-group-url{flex:1 1 100%;min-width:0;font-size:13px}.share-actions{display:flex;gap:6px;flex-wrap:wrap}.share-print-all{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:12px 0}.share-group [data-group-status]{flex:1 1 100%;word-break:break-all}.share-group [data-group-status]:empty{display:none}.share-group .share-qr{flex:1 1 100%}.share-link code{word-break:break-all;user-select:all}.share-qr{margin:14px 0 0;max-width:220px}.share-qr svg{width:100%;height:auto;display:block;background:#fff;border-radius:8px}.share-sheet{display:none}@media print{.share-sheet{display:block}.share-sheet-print{font:16px/1.5 sans-serif;padding:24px;max-width:640px}.share-sheet-url{word-break:break-all;font-family:monospace;font-size:15px}.share-sheet-qr svg{width:240px;height:240px}.share-all{max-width:none;padding:0}.share-all h1{font-size:20px;margin:0 0 4px}.share-all-list{list-style:none;padding:0;margin:12px 0 0}.share-all-item{display:flex;gap:14px;align-items:flex-start;padding:10px 0;border-top:1px solid #ccc;break-inside:avoid;page-break-inside:avoid}.share-all-item h2{font-size:16px;margin:0 0 2px}.share-all-item p{margin:0 0 2px}.share-all-qr svg{width:110px;height:110px}.share-all .share-sheet-url{font-size:11px}@page{margin:12mm}}`;
