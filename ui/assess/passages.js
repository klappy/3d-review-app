// Passage files and links on an assessment (captain 2026-09-29; Lovable parity) — the facilitator panel on Prepare.
// Lists what participants will see, uploads USFM / SFM / USX / PDF / MP3 (sent as the raw file body), adds https links
// (e.g. a YouTube sign-language video), removes. Talks to /v2/assessments/:aid/passages (src/passages.ts).
export const PASSAGE_ACCEPT = '.usfm,.sfm,.usx,.pdf,.mp3';
const LABEL = { text: 'Text (USFM/USX)', pdf: 'PDF', audio: 'Audio', video: 'Video', link: 'Link' };
const size = n => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const PASSAGES_CSS = '.passages{margin-top:18px}.passages h3{margin:0 0 4px}.passages .p-list{list-style:none;margin:8px 0;padding:0;display:grid;gap:6px}.passages .p-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;border:1px solid #d5e2dc;border-radius:10px;background:#fbfcfb}.passages .p-kind{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#14685f;min-width:74px}.passages .p-title{flex:1;min-width:160px}.passages .p-forms{display:grid;gap:10px;margin-top:10px}.passages .p-forms form{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.passages .p-forms label{display:grid;gap:2px;font-size:14px}.passages .p-status{min-height:1.2em;font-size:14px}';

export function passagesHtml(esc, { mayEdit = false, passages = [], fileStorage = true, loading = false, status = '' } = {}) {
  const rows = passages.map(p => `<li class="p-row"><span class="p-kind">${esc(LABEL[p.media] || p.media)}</span><span class="p-title"><a href="${esc(p.href)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>${p.reference ? ` <span class="small muted">· ${esc(p.reference)}</span>` : ''}${p.size ? ` <span class="small muted">· ${esc(size(p.size))}</span>` : ''}</span>${mayEdit ? `<button type="button" class="quiet" data-passage-remove="${esc(p.id)}">Remove</button>` : ''}</li>`).join('');
  const forms = mayEdit ? `<div class="p-forms">
    <form data-passage-upload>${fileStorage ? `<label>File (USFM, SFM, USX, PDF or MP3 · up to 50 MB)<input type="file" name="file" accept="${PASSAGE_ACCEPT}" required></label><label>Passage<input name="reference" maxlength="120" placeholder="e.g. Mark 4:1-20"></label><button type="submit">Upload</button>` : '<p class="small muted">File uploads are not set up on this site yet. Add a link instead.</p>'}</form>
    <form data-passage-link><label>Link (https://, e.g. a sign-language video)<input type="url" name="url" required placeholder="https://youtu.be/…"></label><label>Title<input name="title" maxlength="120" placeholder="e.g. Mark 4 in sign language"></label><label>Passage<input name="reference" maxlength="120" placeholder="e.g. Mark 4:1-20"></label><button type="submit">Add link</button></form>
  </div>` : '';
  return `<section class="passages" aria-labelledby="passages-h"><style>${PASSAGES_CSS}</style><h3 id="passages-h">The passage for participants</h3><p class="small muted">Participants see these at the top of the survey and can read, listen or watch.</p>${loading ? '<p class="small muted">Loading…</p>' : rows ? `<ul class="p-list">${rows}</ul>` : '<p class="small muted">Nothing attached yet.</p>'}${forms}<p class="p-status" role="status" aria-live="polite">${esc(status)}</p></section>`;
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
      busy(up, true); root.querySelector('.p-status').textContent = `Uploading ${file.name}…`;
      try { await call(`${url}?name=${encodeURIComponent(file.name)}${ref ? `&reference=${encodeURIComponent(ref)}` : ''}`, { method: 'POST', headers: headers({ 'content-type': file.type || 'application/octet-stream' }), body: file }); state.status = `Added ${file.name}.`; }
      catch (err) { state.status = err.message; }
      await load();
    };
    const ln = root.querySelector('form[data-passage-link]');
    if (ln) ln.onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(ln);
      busy(ln, true); root.querySelector('.p-status').textContent = 'Adding link…';
      try { await call(url, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ url: String(fd.get('url') || '').trim(), title: String(fd.get('title') || '').trim(), reference: String(fd.get('reference') || '').trim() }) }); state.status = 'Link added.'; }
      catch (err) { state.status = err.message; }
      await load();
    };
  }
  paint(); load();
}
