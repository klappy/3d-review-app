// Passage files and links on an assessment (captain 2026-09-29; Lovable parity) — the facilitator panel on Prepare.
// Lists what participants will see, uploads USFM / SFM / USX / PDF / MP3 (sent as the raw file body), adds https links
// (e.g. a YouTube sign-language video), removes. Talks to /v2/assessments/:aid/passages (src/passages.ts).
export const PASSAGE_ACCEPT = '.usfm,.sfm,.usx,.pdf,.mp3';
const LABEL = { text: 'Text (USFM/USX)', pdf: 'PDF', audio: 'Audio', video: 'Video', link: 'Link', reference: 'Named only' };
const size = n => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const PASSAGES_CSS = '.passages{margin-top:18px}.passages h3{margin:0 0 4px}.passages .p-list{list-style:none;margin:8px 0;padding:0;display:grid;gap:6px}.passages .p-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;border:1px solid #d5e2dc;border-radius:10px;background:#fbfcfb}.passages .p-kind{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#14685f;min-width:74px}.passages .p-title{flex:1;min-width:160px}.passages .p-forms{display:grid;gap:10px;margin-top:10px}.passages .p-forms form{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.passages .p-forms label{display:grid;gap:2px;font-size:14px}.passages .p-status{min-height:1.2em;font-size:14px}';

export function passagesHtml(esc, { mayEdit = false, passages = [], fileStorage = true, loading = false, status = '', linkDraft = null } = {}) {
  const kept = k => (linkDraft && linkDraft[k] ? ` value="${esc(linkDraft[k])}"` : ''); // S34: a refused link keeps what was typed
  const rows = passages.map(p => `<li class="p-row"><span class="p-kind">${esc(p.media === 'text' ? (p.pdf ? 'Text · PDF' : 'Text file') : LABEL[p.media] || p.media)}</span><span class="p-title">${p.href ? `<a href="${esc(p.href)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>` : esc(p.title)}${p.reference && p.reference !== p.title ? ` <span class="small muted">· ${esc(p.reference)}</span>` : ''}${p.size ? ` <span class="small muted">· ${esc(size(p.size))}</span>` : ''}</span>${mayEdit ? `<button type="button" class="quiet" data-passage-remove="${esc(p.id)}">Remove</button>` : ''}</li>`).join('');
  const forms = mayEdit ? `<div class="p-forms">
    <form data-passage-ref><label>Passage only, with nothing attached (you read or play it for the group)<input name="reference" maxlength="120" required placeholder="e.g. Genesis 1"></label><button type="submit">Add passage</button></form>
    <form data-passage-upload>${fileStorage ? `<label>File (USFM, SFM, USX, PDF or MP3 · up to 50 MB)<input type="file" name="file" accept="${PASSAGE_ACCEPT}" required></label><label>Passage<input name="reference" maxlength="120" placeholder="e.g. Mark 4:1-20"></label><button type="submit">Upload</button>` : '<p class="small muted">File uploads are not set up on this site yet. Add a link instead.</p>'}</form>
    <form data-passage-link><label>Link (https://, e.g. a sign-language video)<input${kept('url')} type="url" name="url" required placeholder="https://youtu.be/…"></label><label>Title<input${kept('title')} name="title" maxlength="120" placeholder="e.g. Mark 4 in sign language"></label><label>Passage<input${kept('reference')} name="reference" maxlength="120" placeholder="e.g. Mark 4:1-20"></label><button type="submit">Add link</button></form>
  </div>` : '';
  return `<section class="passages" aria-labelledby="passages-h"><style>${PASSAGES_CSS}</style><h3 id="passages-h">The passage for participants</h3><p class="small muted">Participants see these at the top of the survey and are asked to read or listen first. Name the passage even with no file: the survey and the printed form then say which passage to read or hear.</p>${loading ? '<p class="small muted">Loading…</p>' : rows ? `<ul class="p-list">${rows}</ul>` : '<p class="small muted">Nothing attached yet.</p>'}${forms}<p class="p-status" role="status" aria-live="polite">${esc(status)}</p></section>`;
}

// deps: { root, aid, mayEdit, esc, token: () => string|null, fetchImpl }
export function mountPassages({ root, aid, mayEdit, esc, token, fetchImpl = globalThis.fetch }) {
  if (!root) return;
  let state = { passages: [], fileStorage: true, loading: true, status: '' };
  const url = `/v2/assessments/${encodeURIComponent(aid)}/passages`;
  const headers = extra => { const h = { accept: 'application/json', ...extra }; const t = token?.(); if (t) h.authorization = `Bearer ${t}`; return h; };
  const call = async (u, init) => { let r; try { r = await fetchImpl(u, { credentials: 'same-origin', cache: 'no-store', ...init }); } catch { throw new Error('Could not reach the server. Check the connection and try again.'); } let j = null; try { j = await r.json(); } catch {} if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `Request failed (${r.status})`); return j.result; };
  const paint = () => { root.innerHTML = passagesHtml(esc, { mayEdit, ...state }); bind(); };
  const load = async () => { try { const r = await call(url, { headers: headers() }); state = { ...state, passages: r.passages || [], fileStorage: r.file_storage !== false, loading: false }; } catch (e) { state = { ...state, loading: false, status: e.message }; } paint(); };
  const busy = (form, on) => { for (const el of form.querySelectorAll('button,input')) el.disabled = on; };
  function bind() {
    root.querySelectorAll('[data-passage-remove]').forEach(b => b.onclick = async () => {
      b.disabled = true; state.status = 'Removing…'; root.querySelector('.p-status').textContent = state.status;
      try { await call(`${url}/${encodeURIComponent(b.dataset.passageRemove)}`, { method: 'DELETE', headers: headers() }); state.status = 'Removed.'; } catch (e) { state.status = e.message; }
      await load();
    });
    const up = root.querySelector('form[data-passage-upload]');
    if (up) up.onsubmit = async e => {
      e.preventDefault(); const file = up.querySelector('input[type=file]')?.files?.[0]; if (!file) return;
      const ref = up.querySelector('input[name=reference]').value.trim();
      busy(up, true); root.querySelector('.p-status').textContent = /\.(usfm|sfm)$/i.test(file.name) ? `Uploading ${file.name} and making a PDF (up to 30 seconds)…` : `Uploading ${file.name}…`;
      try { await call(`${url}?name=${encodeURIComponent(file.name)}${ref ? `&reference=${encodeURIComponent(ref)}` : ''}`, { method: 'POST', headers: headers({ 'content-type': file.type || 'application/octet-stream' }), body: file }); state.status = `Added ${file.name}.`; }
      catch (err) { state.status = err.message; }
      await load();
    };
    const rf = root.querySelector('form[data-passage-ref]');
    if (rf) rf.onsubmit = async e => {
      e.preventDefault(); const reference = String(new FormData(rf).get('reference') || '').trim(); if (!reference) return;
      busy(rf, true); root.querySelector('.p-status').textContent = 'Adding the passage…';
      try { await call(url, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ reference }) }); state.status = `Added ${reference}. The survey asks people to read or listen to it first.`; }
      catch (err) { state.status = err.message; }
      await load();
    };
    const ln = root.querySelector('form[data-passage-link]');
    if (ln) ln.onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(ln);
      busy(ln, true); root.querySelector('.p-status').textContent = 'Adding link…';
      const draft = { url: String(fd.get('url') || '').trim(), title: String(fd.get('title') || '').trim(), reference: String(fd.get('reference') || '').trim() };
      try { await call(url, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(draft) }); state.status = 'Link added.'; state.linkDraft = null; }
      catch (err) { state.status = err.message; state.linkDraft = draft; } // S34: a refused link (e.g. http://) stays in the fields to fix
      await load();
    };
  }
  paint(); load();
}
