// B38 (validator 2 #1): with email sign-in links OFF (production) every sign-in string, label and href the app renders is the
// base (ca83151) copy, byte for byte — /v2/auth/access directly, no hop through /v2/auth/email. The email-link copy exists
// only behind state.emailLinks === true (assess.js re-points Access sign-in clicks and the switch dialog at run time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

const BASE = {
  './assess.js': [
    `const SIGNIN = '<a href="/v2/auth/access">Sign in again</a>';`,
    '${expired ? `<a class="button primary" href="/v2/auth/access">Sign in again</a> ` : \'\'}',
    '<div class="actions"><a class="rv-btn primary" href="/v2/auth/access">Sign in with email code</a></div></div>`; return; }',
    '<p><a class="button primary" href="#">Go to sign in</a> <a class="button" href="/v2/auth/access">Sign in with an email code</a></p></div>`;',
  ],
  './scope.js': [
    '<a class="quiet button" href="/v2/auth/access">Sign in with email code</a></div></section></div>`;',
    `\${signedIn ? '' : '<a class="rv-btn primary" href="/v2/auth/access">Sign in</a>'}</nav>\``,
    '<p class="muted">We email you a one-time code; there is no password.</p><div class="actions"><a class="button rv-btn primary" href="/v2/auth/access" style="width:100%;justify-content:center;text-align:center;box-sizing:border-box">Sign in with an email code</a></div>',
  ],
  './views.js': [`const SIGNIN = '<a href="/v2/auth/access">Sign in again</a>';`],
  './feedback.js': [
    '<a class="button" href="/v2/auth/access">Sign in</a> <a href="/">Back to home</a></section>\';',
    "link.href = '/v2/auth/access'; link.textContent = ' Sign in again';",
  ],
  './permissions.js': ['Your sign-in is no longer active. <a href="/v2/auth/access">Sign in again</a></p>${status}</section>`;'],
  '../v3/home.js': [`'<p class="v3h-meta" role="alert">Your sign-in is no longer active. <a href="/v2/auth/access">Sign in again</a></p>'`],
  '../v3/components/demo-exit.js': [`export const DEMO_SIGN_IN_HREF = '/v2/auth/access';`],
  '../v3/components/invite.js': [`'<a class="rv-btn primary" href="/v2/auth/access" data-invite-signin>Sign in with an email code</a>'`],
  '../index.html': ['<p>This also signs you out of other apps protected by this Cloudflare Access account.</p><p>After signing out, the sign-in screen opens for the other email. Cloudflare may take up to 30 seconds to finish signing out.</p>'],
};

test('flag off: every base sign-in string, label and href is present verbatim', () => {
  for (const [file, strings] of Object.entries(BASE)) { const src = read(file); for (const s of strings) assert.ok(src.includes(s), `${file}: ${s.slice(0, 80)}`); }
});
test('flag off: no module renders a sign-in href to /v2/auth/email; the only email-link code sits behind state.emailLinks', () => {
  for (const file of ['./views.js', './feedback.js', './permissions.js', '../v3/home.js', '../v3/components/demo-exit.js', '../v3/components/invite.js', '../index.html'])
    assert.ok(!read(file).includes('/v2/auth/email'), file);
  for (const line of read('./assess.js').split('\n').filter(l => l.includes('/v2/auth/email')))
    assert.ok(/emailLinks|\?probe|^ev\.preventDefault\(\); location\.assign\('\/v2\/auth\/email'\);$/.test(line.trim()), `assess.js unguarded: ${line.trim().slice(0, 100)}`);
});
test('flag off: sign-in screen, signed-out page and public nav render the base Access hrefs', async () => {
  const { pages } = await import('./scope.js');
  const ctx = { esc: s => String(s ?? ''), state: {} };
  const signin = pages.entry.render(ctx, { mode: 'signin', signin: { email: '', devCode: null, stage: 'email' } });
  assert.ok(signin.includes(BASE['./scope.js'][2])); assert.ok(!signin.includes('/v2/auth/email'));
  const on = pages.entry.render({ ...ctx, state: { emailLinks: true } }, { mode: 'signin', signin: { email: '', devCode: null, stage: 'email' } });
  assert.ok(on.includes('action="/v2/auth/email"') && !on.includes('/v2/auth/access'));
});
