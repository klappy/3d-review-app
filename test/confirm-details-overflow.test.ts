// Guard: the permissions confirm's Details → Affected JSON must wrap inside the sheet, never widen the page.
// At 390×844 with Details open, an unwrapped <code> of JSON (no spaces) pushed document scrollWidth to ~1100 px on both
// surfaces that render the confirm: the assess Permissions page (ui/assess/permissions.js) and the MCP panel's Permissions
// view (ui/mcp/panel-src.html → src/mcp-panel.html). Both take their styles from ui/assess/index.html's first <style>.
// jsdom has no layout, so this asserts the cascade the browser fix relies on (white-space:pre-wrap + overflow-wrap:anywhere)
// on the REAL markup of each surface with its REAL shipped stylesheet. Browser proof: 390/1280 shots beside the cookbook unit.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { permissions } from '../ui/assess/permissions.js';
const { JSDOM } = createRequire(import.meta.url)('jsdom');

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const firstStyle = (html: string) => /<style>([\s\S]*?)<\/style>/.exec(html)![1];
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// The shape src/handlers/grant.ts returns for cap.grant.invite dry_run: one long JSON line with no break opportunity.
const impact = { affected: [{ scope: { type: 'assessment', id: 'a_01JABCDEFGHJKMNPQRSTVWXYZ' }, role: 'member', invitee: '3f9a1c0b7d2e', will_see: 'assessment contents at role member' }], irreversible: true, effect: 'external', compensating_control: 'cap.grant.revoke_invitation (does not unsend)' };

function affectedCodes(style: string, body: string) {
  const dom = new JSDOM(`<!doctype html><html><head><style>${style}</style></head><body>${body}</body></html>`);
  const codes = [...dom.window.document.querySelectorAll('[data-confirm-sheet] details dd code')] as any[];
  return codes.map(c => { const s = dom.window.getComputedStyle(c); return { text: c.textContent, whiteSpace: s.whiteSpace, overflowWrap: s.overflowWrap }; });
}
function expectWraps(codes: ReturnType<typeof affectedCodes>) {
  expect(codes.length, 'the Affected <code> sits under Details in the confirm sheet').toBeGreaterThan(0);
  for (const c of codes) {
    expect(c.text).toContain('will_see');
    expect(c.overflowWrap, 'Affected JSON breaks anywhere instead of widening the page at 390').toBe('anywhere');
    expect(['pre-wrap', 'normal', 'break-spaces', 'pre-line']).toContain(c.whiteSpace);
  }
}

describe('confirm Details: Affected JSON wraps at 390 (no horizontal page scroll)', () => {
  it('assess Permissions page: invite confirm Affected code wraps under the shell stylesheet', async () => {
    const table: Record<string, unknown> = {
      'GET /v2/assessment/a1/grants': { grants: [{ id: 'g_me', principal_id: 'me', role: 'owner' }], pending_invitations: [] },
      'POST /v2/assessment/a1/invitations': { confirm_token: 'cfm_1', expires_in: 300, impact },
    };
    const apiFull = async (url: string, init: any = {}) => { const v = table[`${init.method || 'GET'} ${url}`]; if (!v) throw Object.assign(new Error('nf'), { code: 'NOT_FOUND_OR_NOT_VISIBLE', status: 404 }); return { ok: true, result: v }; };
    const ctx: any = { api: async (u: string, o: any) => (await apiFull(u, o)).result, apiFull, esc, enc: encodeURIComponent, state: { principal: { id: 'me' } }, go: () => {} };
    (globalThis as any).location ??= { hash: '#assessment/a1/permissions' }; (globalThis as any).CSS ??= { escape: (s: string) => s };
    const m: any = await permissions.load(ctx, { scope: 'assessments', id: 'a1' });
    m.sheet = { kind: 'invite', label: 'Invitation', params: { email: 'new.person@example.test', role: 'member' }, token: 'cfm_1', expiresIn: 300, impact };
    const html = permissions.render(ctx, m);
    expectWraps(affectedCodes(firstStyle(read('../ui/assess/index.html')), html));
  });

  it('MCP panel Permissions view: invite confirm Affected code wraps under the built panel stylesheet', () => {
    const built = read('../src/mcp-panel.html');
    const sheetSrc = /function sheet\(s\) \{[\s\S]*?<\/section>`; \}/.exec(built)![0];
    const sheet = new Function('esc', 'state', `${sheetSrc}; return sheet;`)(esc, { busy: false });
    const markup = sheet({ label: 'Invitation', params: { email: 'new.person@example.test', role: 'member' }, token: 'cfm_1', expiresIn: 300, impact });
    expectWraps(affectedCodes(firstStyle(built), `<main id="app"><section class="panel"><form class="line" data-invite-form>${markup}</form></section></main>`));
  });
});
