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
function fixture() {
  const dom = new JSDOM(source.split('<script>')[0], { runScripts: 'outside-only', url: 'https://panel.test' });
  const w = dom.window, calls: any[] = [], pending: any[] = [];
  w.McpApps = { App: class {
    addEventListener() {} connect() { return new Promise(() => {}); }
    callServerTool(req: any) {
      calls.push(req);
      if (req.name === 'danger') return new Promise(resolve => pending.push(resolve));
      const { capability: cap, params: p } = req.arguments;
      return Promise.resolve({ structuredContent: { ok: true, result: cap === 'cap.assessment.get'
        ? { assessment: { id: p.id, name: p.id, role: 'owner', stage: 'permissions', project_id: 'p' }, surveys: [] }
        : cap === 'cap.grant.list' ? { grants: [] } : {} } });
    }
  } };
  w.eval(script); const r = w.review; r.state.caps = { serverTools: {} };
  async function go(id: string) { r.go(`#assessment/${id}/permissions`); await tick(); }
  async function preview() {
    const f = w.document.querySelector('[data-invite-form]');
    Object.defineProperty(f, 'email', { value: f.querySelector('[name=email]') });
    Object.defineProperty(f, 'role', { value: f.querySelector('[name=role]') });
    f.email.value = 'review@example.test'; w.document.querySelector('[data-invite-preview]').click(); await tick();
  }
  const resolvePreview = () => pending.shift()({ structuredContent: { ok: true, result: { confirm_token: 'fixture-confirm', expires_in: 60, impact: { effect: 'invite' } } } });
  return { dom, w, r, calls, pending, go, preview, resolvePreview };
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

it('discards stale preview refusal instead of painting it on another assessment', async () => {
  const f = fixture();
  try {
    await f.go('A'); await f.preview(); await f.go('B');
    f.pending.shift()({ structuredContent: { ok: false, error: { code: 'NOT_AUTHORIZED', message: 'A refused' } } }); await tick();
    expect(f.w.document.querySelector('#status').textContent).not.toContain('A refused');
    expect(f.r.state.busy).toBe(false); expect(f.r.state.sheet).toBeNull();
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
