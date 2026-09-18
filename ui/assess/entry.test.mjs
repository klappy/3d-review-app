import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MOUNTED, ELSEWHERE, whatsHere } from './whats-here.js';
const read = n => readFileSync(fileURLToPath(new URL(n, import.meta.url)), 'utf8');

// Checkpoint 2 (root entry switch): the legacy surface moved byte-identical to /legacy/; `/` and `/assess/` are the product shell.
// The E1 behaviours are kept — one token-free way back, hidden until a session is observed; a generated statement of what is
// mounted here and what still lives on the legacy surface, hidden until signed in; tests excluded from the asset bundle —
// re-asserted against the new structure. Only the structural anchors changed (paths, wrapper element, reconciled unions).
test('E1: legacy header (now at /legacy/) carries exactly one Assessments link to /assess/# with no token, scoped by CSS to confirmed staff', () => {
  const html = read('../legacy/index.html'), css = read('../public-choices.css');
  const links = html.match(/<a id="assess-link"[^>]*>/g) || [];
  assert.equal(links.length, 1); assert.ok(links[0].includes('href="/assess/#"')); assert.ok(!/session=|st_/.test(links[0]));
  assert.match(css, /\.rv:not\(\[data-staff-confirmed="true"\]\) #assess-link,\s*\.rv:not\(\[data-entry-view="workspace"\]\) #assess-link,\s*\.rv\[data-workspace-route="participant"\] #assess-link \{ display:none; \}/);
});
test('E1: the shell way back is /legacy/#facilitator, hidden until a session is observed; the statement is generated, hidden until signed in, and names where the rest lives', () => {
  for (const file of ['./index.html', '../index.html']) { // /assess/ alias and the root shell carry the same header
    const html = read(file);
    const back = html.match(/<a id="legacy-link"[^>]*>[^<]*<\/a>/g) || [];
    assert.equal(back.length, 1, file); assert.ok(back[0].includes('href="/legacy/#facilitator"') && back[0].includes(' hidden'), file); assert.ok(!/session=|st_|invite=/.test(back[0]), file);
    assert.ok(html.includes('<details class="storage-note" id="whats-here-wrap" hidden>'), file);
    assert.ok(html.includes('<p class="storage-note" id="whats-here"></p>'), file);
  }
  assert.deepEqual(MOUNTED, ['entry (tour, example, survey code, sign-in)', 'workspaces', 'one workspace (its projects)', 'projects', 'one project (assessments, languages)', 'one assessment: Prepare · Collect · Understand · Improve · Permissions', 'stage move (one step, confirmed)', 'survey screen', 'survey counts', 'print blank survey', 'share survey: participant link (two-step), copy, QR, invitation sheet, revoke']);
  assert.deepEqual(ELSEWHERE.items, ['access codes', 'participant survey flow', 'shared links', 'invitations, role changes and ownership transfer', 'invitation acceptance']);
  assert.ok(!/coming soon/i.test(whatsHere()));
  const ignored = read('../.assetsignore').split('\n');
  for (const t of ['assess/entry.test.mjs', 'assess/scope.test.mjs', 'assess/views.test.mjs']) assert.ok(ignored.includes(t), t);
});
;

// Auditor S1 (ac36b30 verdict): credential/legacy hashes are sanitised on the SAME path for load and for fragment-only navigation.
test('S1: scrubCredentialHash is the first statement of boot() and of the hashchange listener; a consumed #session= re-observes identity', () => {
  const js = read('./assess.js');
  assert.match(js, /async function boot\(\) \{\n\s*if \(scrubCredentialHash\(\) === 'forwarded'\) return;/);
  assert.match(js, /addEventListener\('hashchange', \(\) => \{ const r = scrubCredentialHash\(\); if \(r === 'forwarded'\) return; if \(r === 'session'\) \{ boot\(\); return; \} render\(\);/);
  assert.match(js, /location\.replace\('\/legacy\/' \+ h\); return 'forwarded';/);
  assert.match(js, /sessionStorage\.setItem\('facilitatorToken', m\[1\]\); \} catch \{\} resetIdentity\(\); return 'session';/);
  assert.ok(!/api\([^)]*\)[\s\S]*?scrubCredentialHash\(\) === 'forwarded'\) return;/.test(js.slice(js.indexOf('async function boot()'))), 'no api() call precedes the scrub in boot()');
  const reset = js.slice(js.indexOf('function resetIdentity()'), js.indexOf('let listening'));
  for (const piece of ['state.openProjects.clear()', 'state.inflight.clear()', 'state.seq.clear()', 'state.message = null', 'state.dirty.clear()', 'state.countInflight.clear()']) assert.ok(reset.includes(piece), piece);
  assert.match(js, /catch \{ \/\* transient or refusal: do not cache null; the next read retries \*\/ \}/);
  assert.match(js, /function watchContextViewport\(\)/);
});

// Auditor N4: the local harness allowlist serves every file the product shell and the legacy surface reference.
test('N4: ui/server.mjs allowlist covers /, /assess/, /legacy/ and every /assess/*.js module the shell imports', () => {
  const server = read('../server.mjs'), shell = read('./assess.js') + read('./index.html');
  for (const p of ['/', '/assess/', '/legacy/', '/assess/assess.js', '/assess/whats-here.js', '/assess/cards.js', '/assess/scope.js', '/assess/views.js']) assert.ok(server.includes(`'${p}':`), p);
  for (const m of shell.matchAll(/from ["'](\/assess\/[^"']+)["']/g)) assert.ok(server.includes(`'${m[1]}':`), `shell import ${m[1]} must be served`);
  assert.ok(server.includes("'/legacy/': ['legacy/index.html', 'text/html']"));
});
