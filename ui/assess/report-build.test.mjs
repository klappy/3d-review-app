import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { reportBuildMarkup, bindReportBuild } from './report-build.js';
const ready = { assessment_id: 'a', suppressed: false, status: 'ready', confirm_token: 'secret-confirm', expires_in: 60 };
function setup(api, role = 'owner') {
  const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main');
  let active = true, builds = 0; const calls = [];
  const ctx = { enc: encodeURIComponent, isCurrent: () => active, api: async (url, init) => { calls.push({ url, ...init }); return api(init.body); } };
  root.innerHTML = reportBuildMarkup(ctx, role);
  bindReportBuild(ctx, root, { aid: 'a', role }, async () => { builds++; });
  return { root, calls, stop: () => { active = false; }, builds: () => builds, click: async key => root.querySelector(`[data-${key}]`).onclick(), text: () => root.textContent };
}
test('preview→confirm sends exact scope and body once; no token rendered', async () => {
  const s = setup(body => body.mode === 'dry_run' ? ready : { assessment_id: 'a', suppressed: false, report: { id: 'r' } });
  await s.click('preview-report'); assert.equal(s.calls.length, 1); assert.doesNotMatch(s.root.innerHTML, /secret-confirm/);
  const confirm = s.root.querySelector('[data-confirm-report]').onclick;
  await Promise.all([confirm(), confirm()]); assert.equal(s.calls.length, 2); assert.equal(s.builds(), 1);
  assert.deepEqual(s.calls[1], { url: '/v2/assessments/a/reports', method: 'POST', body: { mode: 'execute', confirm_token: 'secret-confirm' } });
});
test('viewer has no build controls', () => { const s = setup(() => { throw Error(); }, 'viewer'); assert.equal(s.root.innerHTML, ''); });
test('held preview, malformed preview and wrong scope cannot execute', async () => {
  for (const r of [{ ...ready, suppressed: true, status: 'held', reason: 'Policy held' }, { ...ready, confirm_token: null }, { ...ready, assessment_id: 'other' }, { ...ready, expires_in: '60' }]) {
    const s = setup(() => r); await s.click('preview-report'); assert.equal(s.root.querySelector('[data-confirm-report]'), null); assert.equal(s.calls.length, 1); assert.equal(s.builds(), 0);
  }
});
test('cancel discards token; expired preview never executes', async () => {
  const s = setup(() => ready); await s.click('preview-report'); await s.click('cancel-report'); assert.match(s.text(), /Cancelled/); assert.equal(s.calls.length, 1);
  const t = setup(() => ({ ...ready, expires_in: 0.001 })); await t.click('preview-report'); await new Promise(r => setTimeout(r, 5)); await t.click('confirm-report'); assert.match(t.text(), /expired/); assert.equal(t.calls.length, 1);
});
test('stale identity/navigation cannot restore preview or execute a captured confirmation', async () => {
  let resolve; const s = setup(() => new Promise(r => { resolve = r; })); const request = s.click('preview-report'); s.stop(); resolve(ready); await request;
  assert.equal(s.root.querySelector('[data-confirm-report]'), null);
  const t = setup(() => ready); await t.click('preview-report'); const confirm = t.root.querySelector('[data-confirm-report]').onclick; t.stop(); await confirm(); assert.equal(t.calls.length, 1);
});
test('held execute stays held, uncertain execute never retries or refreshes as success', async () => {
  for (const error of [false, true]) {
    const s = setup(body => { if (body.mode === 'dry_run') return ready; if (error) throw Error('network'); return { assessment_id: 'a', suppressed: true, reason: 'Changed inputs held' }; });
    await s.click('preview-report'); await s.click('confirm-report'); assert.equal(s.calls.length, 2); assert.equal(s.builds(), 0);
    assert.match(s.text(), error ? /outcome could not be confirmed.*Refresh reports/ : /Changed inputs held.*No report was built/);
    assert.equal(s.root.querySelector('[data-confirm-report]'), null);
    if (error) { await s.click('preview-report'); assert.equal(s.calls.length, 2); assert.equal(s.root.querySelector('[data-preview-report]').disabled, true); }
  }
});
test('refused preview gives no confirmation; detached view ignores settled execute', async () => {
  const s = setup(() => { throw Object.assign(Error(), { code: 'NOT_AUTHORIZED_AT_SCOPE' }); }); await s.click('preview-report'); assert.match(s.text(), /not visible/); assert.equal(s.root.querySelector('[data-confirm-report]'), null);
  let resolve; const t = setup(body => body.mode === 'dry_run' ? ready : new Promise(r => { resolve = r; })); await t.click('preview-report'); const request = t.click('confirm-report'); t.root.remove(); resolve({ assessment_id: 'a', suppressed: false, report: { id: 'r' } }); await request; assert.equal(t.builds(), 0);
});

import { views } from './views.js';
test('normal Understand journey: preview, build, refreshed list, reopen with unchanged provenance', async () => {
  const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main'); let built = false;
  const report = { id: 'r', created_at: '2026-09-18', payload: { source_commit: 'f042cde', versions: { scorer: 'source', narrative: 1, policy: 'synthetic' } } };
  const ctx = { enc: encodeURIComponent, esc: s => String(s ?? ''), current: { assessment: { id: 'a', role: 'owner' }, surveys: [] }, isCurrent: () => true, routes: {}, go() {}, api: async (url, init) => {
    if (init?.body?.mode === 'dry_run') return ready;
    if (init?.body?.mode === 'execute') { built = true; return { assessment_id: 'a', suppressed: false, report }; }
    if (url === '/v2/reports/r') return { assessment_id: 'a', suppressed: false, report };
    if (url.endsWith('/reports')) return { assessment_id: 'a', suppressed: false, reports: built ? [{ id: 'r', created_at: report.created_at }] : [] };
    return { status: 'held', reason: 'Results held' };
  } };
  const m = await views.understand.load(ctx, { aid: 'a' }); root.innerHTML = views.understand.render(ctx, m); views.understand.bind(ctx, root, m);
  await root.querySelector('[data-preview-report]').onclick(); assert.equal(built, false);
  await root.querySelector('[data-confirm-report]').onclick(); assert.equal(built, true);
  assert.match(root.querySelector('[data-report-status]').textContent, /Report built/);
  await root.querySelector('[data-open-report]').onclick(); assert.equal(root.querySelector('[data-report-full]').hidden, false); assert.match(root.querySelector('[data-report-view]').textContent, /Synthetic data · source f042cde/);
  await root.querySelector('[data-preview-report]').onclick(); assert.equal(root.querySelector('[data-report-full]').hidden, true); assert.equal(root.querySelector('[data-report-view]').textContent, ''); assert.equal(root.querySelector('[data-report-list]'), null);
});
