// Actual panel source, DOM and deferred bridge calls; no live mutations.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const { JSDOM } = createRequire(import.meta.url)('jsdom');
const source = readFileSync(new URL('../ui/mcp/panel-src.html', import.meta.url), 'utf8');
const cards = readFileSync(new URL('../ui/assess/cards.js', import.meta.url), 'utf8').replace(/^export\s+(const|function)\s/gm, '$1 ');
const script = source.split('<script>')[2].split('</script>')[0].replace('/*__CARDS__*/', cards)
  .replace('})();', 'window.review = { state, go };})();');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture({ deferGet = false, deferWrite = false } = {}) {
  const dom = new JSDOM(source.split('<script>')[0], { runScripts: 'outside-only', url: 'https://panel.test' });
  const w = dom.window, calls: any[] = [], pending: any[] = [], pendingGets: any[] = [], pendingWrites: any[] = [];
  const assessment = (id: string) => ({ assessment: { id, name: id, role: 'owner', stage: 'permissions', project_id: 'p' }, surveys: [] });
  w.McpApps = { App: class {
    addEventListener() {} connect() { return new Promise(() => {}); }
    callServerTool(req: any) {
      calls.push(req);
      if (req.name === 'danger') return new Promise(resolve => pending.push(resolve));
      if (req.name === 'write') return deferWrite ? new Promise(resolve => pendingWrites.push(resolve)) : Promise.resolve({ structuredContent: { ok: true, result: {} } });
      const { capability: cap, params: p } = req.arguments;
      if (cap === 'cap.assessment.get') return deferGet ? new Promise(resolve => pendingGets.push({ id: p.id, resolve })) : Promise.resolve({ structuredContent: { ok: true, result: assessment(p.id) } });
      return Promise.resolve({ structuredContent: { ok: true, result: cap === 'cap.grant.list' ? { grants: [] } : {} } });
    }
  } };
  w.eval(script); const r = w.review; r.state.caps = { serverTools: {} };
  async function go(id: string, view = 'permissions') { r.go(`#assessment/${id}/${view}`); await tick(); }
  async function preview() {
    const f = w.document.querySelector('[data-invite-form]');
    Object.defineProperty(f, 'email', { value: f.querySelector('[name=email]') });
    Object.defineProperty(f, 'role', { value: f.querySelector('[name=role]') });
    f.email.value = 'review@example.test'; w.document.querySelector('[data-invite-preview]').click(); await tick();
  }
  const resolvePreview = () => pending.shift()({ structuredContent: { ok: true, result: { confirm_token: 'fixture-confirm', expires_in: 60, impact: { effect: 'invite' } } } });
  const resolveGet = (id: string) => pendingGets.splice(pendingGets.findIndex(x => x.id === id), 1)[0].resolve({ structuredContent: { ok: true, result: assessment(id) } });
  const resolveWrite = (env: any = { ok: true, result: {} }) => pendingWrites.shift()({ structuredContent: env });
  return { dom, w, r, calls, pending, go, preview, resolvePreview, resolveGet, resolveWrite };
}

it.each([false, true])('discards deferred A preview after navigation, including return to A (%s)', async back => {
  const f = fixture();
  try {
    await f.go('A'); await f.preview(); await f.go('B'); if (back) await f.go('A');
    f.resolvePreview(); await tick();
    expect(f.w.document.querySelector('h1').textContent).toBe(back ? 'A' : 'B');
    expect(f.r.state.sheet).toBeNull(); expect(f.w.document.querySelector('[data-confirm-execute]')).toBeNull();
    expect(f.r.state.busy).toBe(false); expect(f.calls.filter(x => x.name === 'danger')).toHaveLength(1);
  } finally { f.dom.window.close(); }
});

it('does not unlock a destination preview when a stale preview settles', async () => {
  const f = fixture();
  try {
    await f.go('A'); await f.preview(); await f.go('B'); await f.preview();
    expect(f.r.state.busy).toBe(true); expect(f.calls.filter(x => x.name === 'danger')).toHaveLength(2);
    f.resolvePreview(); await tick();
    expect(f.r.state.busy).toBe(true); expect(f.r.state.sheet).toBeNull();
    expect(f.w.document.querySelector('h1').textContent).toBe('B');
    expect(f.w.document.querySelector('[data-invite-preview]').disabled).toBe(true);
    f.resolvePreview(); await tick();
    expect(f.r.state.busy).toBe(false); expect(f.r.state.sheet.params.id).toBe('B');
  } finally { f.dom.window.close(); }
});

it('discards stale preview refusal instead of painting it on another assessment', async () => {
  const f = fixture();
  try {
    await f.go('A'); await f.preview(); await f.go('B');
    f.pending.shift()({ structuredContent: { ok: false, error: { code: 'NOT_AUTHORIZED', message: 'A refused' } } }); await tick();
    expect(f.w.document.querySelector('#status').textContent).not.toContain('A refused');
    expect(f.r.state.busy).toBe(false); expect(f.r.state.sheet).toBeNull();
  } finally { f.dom.window.close(); }
});

it('discards stale crumbs and current after a newer route has painted', async () => {
  const f = fixture({ deferGet: true });
  try {
    await f.go('A'); await f.go('B');
    f.resolveGet('B'); await tick();
    expect(f.w.document.querySelector('h1').textContent).toBe('B');
    expect(f.w.document.querySelector('#crumbs').textContent).toMatch(/B$/);
    expect(f.r.state.current.a.id).toBe('B');
    f.resolveGet('A'); await tick();
    expect(f.w.document.querySelector('h1').textContent).toBe('B');
    expect(f.w.document.querySelector('#crumbs').textContent).toMatch(/B$/);
    expect(f.w.document.querySelector('#crumbs').textContent).not.toContain('A');
    expect(f.r.state.current.a.id).toBe('B');
  } finally { f.dom.window.close(); }
});

it('discards stale notes status instead of disabling or painting it on another assessment', async () => {
  const f = fixture({ deferWrite: true });
  try {
    await f.go('A', 'improve');
    const form = f.w.document.querySelector('[data-notes-form]');
    Object.defineProperty(form, 'notes_reflection', { value: form.querySelector('[name=notes_reflection]') });
    Object.defineProperty(form, 'notes_next_steps', { value: form.querySelector('[name=notes_next_steps]') });
    form.dispatchEvent(new f.w.Event('submit', { bubbles: true, cancelable: true })); await tick();
    expect(f.r.state.busy).toBe(true);
    await f.go('B', 'improve');
    expect(f.r.state.busy).toBe(false);
    expect(f.w.document.querySelector('[data-notes-form] button').disabled).toBe(false);
    expect(f.w.document.querySelector('h1').textContent).toBe('B');
    f.resolveWrite({ ok: true, result: {}, receipt: { id: 'notes-receipt' } }); await tick();
    expect(f.w.document.querySelector('#status').textContent).not.toContain('notes-receipt');
    expect(f.w.document.querySelector('#status').textContent).not.toContain('Saving notes');
    expect(f.w.document.querySelector('h1').textContent).toBe('B');
    expect(f.r.state.busy).toBe(false);
    expect(f.calls.filter(x => x.name === 'write')[0].arguments.params.id).toBe('A');
  } finally { f.dom.window.close(); }
});

it('surfaces assessment-only grants as reachable cards and crumbs', async () => {
  const f = fixture();
  try {
    f.r.state.me = { principal: { id: 'person_viewer', kind: 'user', provisioned: true }, grants: [{ scope_type: 'assessment', scope_id: 'assess_shared', role: 'viewer' }] };
    f.r.go('#workspaces'); await tick();
    expect(f.w.document.querySelector('a[href="#assessment/assess_shared"]')).not.toBeNull();
    expect(f.w.document.querySelector('h1').textContent).toBe('Choose an assessment');
    await f.go('assess_shared');
    expect(f.w.document.querySelector('h1').textContent).toBe('assess_shared');
    expect(f.w.document.querySelector('#crumbs a[href="#shared-assessments"]')).not.toBeNull();
    expect(f.w.document.querySelector('#crumbs').textContent).not.toContain('Project');
    f.r.go('#shared-assessments'); await tick();
    expect(f.w.document.querySelector('a[href="#assessment/assess_shared"]')).not.toBeNull();
  } finally { f.dom.window.close(); }
});

it.each(['unrelated', 'p'])('keeps exact assessment entries with project grant %s and uses only accessible parent crumbs', async projectId => {
  const f = fixture();
  try {
    f.r.state.me = { principal: { id: 'person_owner', kind: 'user' }, grants: [{ scope_type: 'project', scope_id: projectId, role: 'owner' }, { scope_type: 'assessment', scope_id: 'assess_shared', role: 'viewer' }] };
    f.r.go('#workspaces'); await tick();
    const link = f.w.document.querySelector('a[href="#assessment/assess_shared"]');
    expect(link).not.toBeNull();
    link.click(); await tick();
    expect(f.w.document.querySelector('h1').textContent).toBe('assess_shared');
    expect(!!f.w.document.querySelector('#crumbs a[href="#project/p"]')).toBe(projectId === 'p');
    expect(!!f.w.document.querySelector('#crumbs a[href="#shared-assessments"]')).toBe(projectId !== 'p');
  } finally { f.dom.window.close(); }
});

it('blocks cancel, repeat confirm and navigation during execute; retains its receipt', async () => {
  const f = fixture();
  try {
    await f.go('A'); await f.preview(); f.resolvePreview(); await tick();
    f.w.document.querySelector('[data-confirm-execute]').click(); await tick();
    const cancel = f.w.document.querySelector('[data-confirm-cancel]');
    const confirm = f.w.document.querySelector('[data-confirm-execute]');
    expect(cancel.disabled).toBe(true); expect(confirm.disabled).toBe(true);
    // Bypass native disabled behavior to verify the handler guards too.
    cancel.dispatchEvent(new f.w.Event('click')); confirm.dispatchEvent(new f.w.Event('click'));
    await f.go('B');
    expect(f.r.state.sheet).not.toBeNull(); expect(f.w.document.querySelector('h1').textContent).toBe('A');
    const executions = f.calls.filter(x => x.name === 'danger' && x.arguments.mode === 'execute');
    expect(executions).toHaveLength(1); expect(executions[0].arguments.params.id).toBe('A');
    f.pending.shift()({ structuredContent: { ok: true, result: { delivered: true }, receipt: { id: 'fixture-receipt' }, trace_id: 'fixture-trace' } }); await tick();
    expect(f.w.document.querySelector('#status').textContent).toContain('fixture-receipt');
    expect(f.r.state.busy).toBe(false); expect(f.r.state.executing).toBe(false);
    await f.go('B'); expect(f.w.document.querySelector('h1').textContent).toBe('B');
  } finally { f.dom.window.close(); }
});
