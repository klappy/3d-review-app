// BCS training demo 2026-09-29 (bee:10809312; cookbook work/active/2026-09-29-3d-labels-open-survey-signin):
// "Open survey" leads each share row on Collect and after launch; sign-in says "paste once" and "check Spam".
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLinks, copy } from './share.js';
import { renderDone } from '../v3/wizard.js';
import { pages, SIGNIN_CODE_HINT, SIGNIN_LINK_SENT } from './scope.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('a share row with href leads with Open survey and says what it is for; without href nothing changes', () => {
  const h = groupLinks({ esc }, [{ key: 's1', title: 'Translators', line: 'The people doing the translation work.', href: '#assessment/a1/survey/s1', url: 'https://x/#survey=T' }]);
  assert.match(h, /<p class="share-open" data-group-open><a class="button" href="#assessment\/a1\/survey\/s1">Open survey<\/a> <span class="small muted">Print the questions or give access codes<\/span><\/p>/);
  assert.ok(h.indexOf('data-group-open') < h.indexOf('data-share-actions'), 'Open survey comes before Copy link · QR code · Print');
  assert.doesNotMatch(h, /class="primary"/, 'Copy link stays the only primary elsewhere; Open survey is a plain button');
  const plain = groupLinks({ esc }, [{ key: 's1', title: 'Translators', url: 'https://x/#survey=T' }]);
  assert.doesNotMatch(plain, /data-group-open/);
  assert.equal(copy.openSurvey, 'Open survey');
});

test('after launch, every survey row opens its own survey page (questions to print, access codes)', () => {
  const templates = [{ id: 'tpl_validation', version: 2, name: 'Translators', perspective: 'Translation Team' }, { id: 'tpl_written', version: 2, name: 'Written', perspective: 'Community' }];
  const h = renderDone({ aid: 'a 1', links: [{ survey: 's1', template: 'tpl_validation', entry_fragment: '#survey=AAA' }, { survey: 's2', template: 'tpl_written', entry_fragment: '#survey=BBB' }] }, 'https://x.test', templates);
  assert.match(h, /href="#assessment\/a%201\/survey\/s1">Open survey</);
  assert.match(h, /href="#assessment\/a%201\/survey\/s2">Open survey</);
  assert.equal((h.match(/class="primary"/g) || []).length, 1, 'still one primary action (Open the review)');
  assert.match(h, /Translators/);
});

test('Access sign-in (production) keeps the base copy byte for byte and adds the paste-once / Spam hint after it', () => {
  const ctx = { esc, state: {} };
  const html = pages.entry.render(ctx, { mode: 'signin', signin: { email: '', devCode: null, stage: 'email' } });
  const base = 'Sign in with an email code</a></div>';
  assert.ok(html.includes(base));
  assert.ok(html.indexOf(esc(SIGNIN_CODE_HINT)) > html.indexOf(base), 'hint follows the pinned actions block');
  assert.match(SIGNIN_CODE_HINT, /Paste the code once and wait/); assert.match(SIGNIN_CODE_HINT, /Spam or Junk/);
  const on = pages.entry.render({ esc, state: { emailLinks: true } }, { mode: 'signin', signin: { email: '', devCode: null, stage: 'email' } });
  assert.doesNotMatch(on, /data-code-hint/, 'email-link environments have no code to paste');
});

test('email-link "sent" line names Spam', () => {
  assert.equal(SIGNIN_LINK_SENT(30), 'Check your email — we sent you a sign-in link. It expires in 30 minutes. Not there after a minute? Check your Spam or Junk folder.');
});
