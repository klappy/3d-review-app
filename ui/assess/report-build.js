// Report creation (synthetic everywhere; participant responses on DEV) through the existing danger preview/execute contract.
// Confirmation lives only in this view's closure; navigation/identity generation invalidates it.
export function reportBuildMarkup(ctx, role) {
  if (!['owner', 'member'].includes(role)) return '';
  return `<section data-report-build><p class="small muted">Build a report from this assessment’s responses.</p><button type="button" data-preview-report>Preview report build</button><div data-report-preview></div><p class="status" role="status" aria-live="polite" data-build-status></p></section>`;
}
// B35: `extra` adds a second entry point (the band block's "Build the results") that runs the SAME preview → one confirm → execute,
// with its own box/status/labels; all entry points share one pending token and one busy/uncertain state. onBuilt(source) says which.
export function bindReportBuild(ctx, root, model, onBuilt, onClear = () => {}, extra = null) {
  const { aid, role } = model;
  const preview = root.querySelector('[data-preview-report]');
  if (!preview || !['owner', 'member'].includes(role)) return;
  const refresh = root.querySelector('button[data-retry="reports"]');
  const current = () => (!ctx.isCurrent || ctx.isCurrent()) && root.isConnected !== false;
  const url = `/v2/assessments/${ctx.enc(aid)}/reports`;
  const HELD = 'The results can’t be built yet.'; // never the server reason (U05)
  const entries = [{ source: 'reports', trigger: preview, box: root.querySelector('[data-report-preview]'), status: root.querySelector('[data-build-status]'), confirmLabel: 'Build report', cancelLabel: 'Cancel', busyText: 'Building report…' }];
  if (extra?.trigger && extra.box && extra.status) entries.push({ source: 'results', confirmLabel: 'Build the results', cancelLabel: 'Not now', busyText: 'Building the results…', ...extra });
  let pending = null, busy = false, uncertain = false;
  const clear = () => { pending = null; entries.forEach(e => e.box.replaceChildren()); };
  const disable = on => entries.forEach(e => { e.trigger.disabled = on; });
  const lockRefresh = on => { model.reportBuildBusy = on; if (refresh) refresh.disabled = on; };
  const failure = (e, executing) => {
    if (['NOT_AUTHENTICATED', '401'].includes(String(e?.code))) return 'Your sign-in is no longer active. Sign in again and preview again.';
    if (['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', '403', '404'].includes(String(e?.code))) return 'Report is not visible to you at this assessment.';
    return executing ? 'The report build outcome could not be confirmed. Refresh reports before choosing to preview again.' : 'Report preview could not be loaded. Nothing was built; you can preview again.';
  };
  const start = entry => async () => {
    const { box, status } = entry; const say = text => { entries.forEach(e => { if (e !== entry) e.status.textContent = ''; }); status.textContent = text; };
    if (!current() || busy || uncertain) return;
    busy = true; disable(true); clear(); onClear(); say('Checking report eligibility…');
    try {
      const r = await ctx.api(url, { method: 'POST', body: { mode: 'dry_run' } });
      if (!current()) return;
      if (r?.assessment_id !== aid) throw new Error('Invalid preview scope');
      if (r.suppressed === true || r.status === 'held') { say(`${HELD} Nothing was built.`); return; }
      if (r.suppressed !== false || r.status !== 'ready' || typeof r.confirm_token !== 'string' || !r.confirm_token || !Number.isFinite(r.expires_in) || r.expires_in <= 0) throw new Error('Invalid preview');
      pending = { token: r.confirm_token, expires: Date.now() + r.expires_in * 1000 };
      box.innerHTML = `<p>Build a report from this assessment’s responses? This makes an immutable report available to people with access to this assessment. Current inputs and access are checked again when you confirm.</p><div class="actions"><button type="button"${entry.source === 'results' ? ' class="primary"' : ''} data-confirm-report>${entry.confirmLabel}</button><button type="button" class="quiet" data-cancel-report>${entry.cancelLabel}</button></div>`;
      say('Preview ready. Nothing has been built.');
      box.querySelector('[data-cancel-report]').onclick = () => { if (!current() || busy) return; clear(); say('Cancelled. Nothing was built.'); };
      box.querySelector('[data-confirm-report]').onclick = async () => {
        if (!current() || busy || !pending) return;
        if (Date.now() >= pending.expires) { clear(); say('Preview expired. Preview again before building.'); return; }
        const confirm_token = pending.token; clear(); busy = true; disable(true); lockRefresh(true); onClear(); say(entry.busyText);
        let built = false;
        try {
          const result = await ctx.api(url, { method: 'POST', body: { mode: 'execute', confirm_token } });
          if (!current()) return;
          if (result?.assessment_id !== aid) throw new Error('Invalid build scope');
          if (result.suppressed === true) { say(`${HELD} No report was built.`); return; }
          if (result.suppressed !== false || !result.report?.id) throw new Error('Unconfirmed report');
          built = true; say(entry.source === 'results' ? 'Results built. Filling the bands…' : 'Report built. Refreshing the report list…');
          await onBuilt(entry.source);
        } catch (e) { uncertain = !built; if (current()) say(built ? 'Report built, but the list could not be refreshed. Refresh reports to reopen it.' : failure(e, true)); }
        finally { if (current()) { busy = false; disable(uncertain); lockRefresh(false); } }
      };
    } catch (e) { if (current()) { clear(); say(failure(e, false)); } }
    finally { if (current()) { busy = false; disable(uncertain); } }
  };
  entries.forEach(e => { e.trigger.onclick = start(e); });
}
