import test from 'node:test';
import vm from 'node:vm';
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
test('E1: generic legacy backlink is retired; the statement is generated, hidden until signed in, and names where the rest lives', () => {
  for (const file of ['./index.html', '../index.html']) { // /assess/ alias and the root shell carry the same header
    const html = read(file);
    const back = html.match(/<a id="legacy-link"[^>]*>[^<]*<\/a>/g) || [];
    assert.equal(back.length, 0, file);
    assert.ok(html.includes('<details class="storage-note" id="whats-here-wrap" hidden>'), file);
    assert.ok(html.includes('<p class="storage-note" id="whats-here"></p>'), file);
  }
  assert.deepEqual(MOUNTED, ['entry (tour, example, survey code, sign-in)', 'workspaces', 'one workspace (its projects)', 'projects', 'one project (assessments, languages)', 'one assessment: Prepare · Collect · Understand · Improve · Permissions (roster, invite, revoke, role change, ownership transfer at that one scope)', 'stage move (one step, confirmed)', 'survey screen', 'survey counts', 'print blank survey', 'share survey: participant link (two-step), copy, QR, invitation sheet, revoke', 'invitation acceptance']);
  assert.deepEqual(ELSEWHERE.items, ['access codes and code-based participant surveys']);
  assert.ok(!/coming soon/i.test(whatsHere()));
  const ignored = read('../.assetsignore').split('\n');
  for (const t of ['assess/entry.test.mjs', 'assess/scope.test.mjs', 'assess/views.test.mjs']) assert.ok(ignored.includes(t), t);
});
;

// Auditor S1 (ac36b30 verdict): credential/legacy hashes are sanitised on the SAME path for load and for fragment-only navigation.
test('S1: scrubCredentialHash is the first statement of boot() and of the hashchange listener; a consumed #session= re-observes identity', () => {
  const js = read('./assess.js');
  assert.match(js, /async function boot\(\) \{\n\s*if \(scrubCredentialHash\(\) === 'forwarded'\) return;/);
  assert.match(js, /addEventListener\('hashchange', \(\) => \{ const r = scrubCredentialHash\(\); if \(r === 'forwarded'\) return; if \(r === 'session'\) \{ boot\(\); return; \} clearPageNote\(\); render\(\);/);
  assert.match(js, /location\.replace\('\/legacy\/' \+ h\); return 'forwarded';/);
  assert.match(js, /sessionStorage\.setItem\('facilitatorToken', m\[1\]\); \} catch \{\} resetIdentity\(\); return 'session';/);
  assert.ok(!/api\([^)]*\)[\s\S]*?scrubCredentialHash\(\) === 'forwarded'\) return;/.test(js.slice(js.indexOf('async function boot()'))), 'no api() call precedes the scrub in boot()');
});

// Auditor N4: the local harness allowlist serves every file the product shell and the legacy surface reference.
test('N4: ui/server.mjs allowlist covers /, /assess/, /legacy/ and every /assess/*.js module the shell imports', () => {
  const server = read('../server.mjs'), shell = read('./assess.js') + read('./index.html');
  for (const p of ['/', '/assess/', '/legacy/', '/assess/assess.js', '/assess/whats-here.js', '/assess/cards.js', '/assess/scope.js', '/assess/views.js']) assert.ok(server.includes(`'${p}':`), p);
  for (const m of shell.matchAll(/from ["'](\/assess\/[^"']+)["']/g)) assert.ok(server.includes(`'${m[1]}':`), `shell import ${m[1]} must be served`);
  assert.ok(server.includes("'/legacy/': ['legacy/index.html', 'text/html']"));
});


test('participant resume dispatches to legacy without reading or changing stored credentials; public survey stays current', () => {
  const source = read('./assess.js');
  const code = source.slice(source.indexOf('const LEGACY_HASHES'), source.indexOf('function resetIdentity()'));
  for (const hash of ['#participant', '#survey', '#survey=fixture', '#example']) {
    const replaced = [], historyCalls = [];
    const box = { demo:false, location:{ hash, pathname:'/', replace:path=>replaced.push(path) }, history:{replaceState: (...args)=>historyCalls.push(args)}, sessionStorage:{getItem(){throw Error('No credential read while forwarding');},setItem(){throw Error('No credential write while forwarding');}} };
    const run = vm.runInNewContext(code + '\nscrubCredentialHash', box);
    const result=run();
    if(hash==='#participant'){assert.equal(result,'forwarded');assert.deepEqual(replaced,['/legacy/#participant']);assert.equal(historyCalls.length,0);}
    if(hash==='#survey'){assert.equal(result,null);assert.deepEqual(replaced,[]);}
    if(hash==='#survey=fixture')assert.deepEqual(replaced,['/participate/#survey=fixture']);
    if(hash==='#example')assert.deepEqual(replaced,['/?demo=1#assessment/demo-assessment/prepare']);
  }
});

// Bincy B03: `#invite=<token>` stays in the v3 app — never forwarded to /legacy/. The token leaves the address bar at once and is kept
// only in memory + this tab's sessionStorage (so the sign-in round trip returns to #invite); a malformed token stores nothing.
test('B03: #invite= opens the v3 Invitation page; token out of the URL, kept for the sign-in return; #session= returns to #invite', () => {
  const source = read('./assess.js');
  const code = source.slice(source.indexOf('const LEGACY_HASHES'), source.indexOf('function resetIdentity()'));
  const drive = (hash, store = new Map()) => {
    const replaced = [], historyCalls = [];
    const box = { demo:false, INVITE_KEY:'pendingInvite', parseInvitationFragment: h => /^#invite=([A-Za-z0-9_-]+)$/.exec(h)?.[1] ?? null, route: () => ({ kind: 'invite' }), resetIdentity(){}, token:null,
      location:{ hash, pathname:'/', replace:path=>replaced.push(path) }, history:{replaceState:(...args)=>historyCalls.push(args)},
      sessionStorage:{ getItem:k=>store.get(k) ?? null, setItem:(k,v)=>store.set(k,v), removeItem:k=>store.delete(k) } };
    const result = vm.runInNewContext(code + '\nscrubCredentialHash()', box);
    return { result, replaced, historyCalls, store };
  };
  const a = drive('#invite=tok_123');
  assert.equal(a.result, null); assert.deepEqual(a.replaced, [], 'never forwarded to /legacy/');
  assert.equal(a.historyCalls[0][2], '/#invite'); assert.equal(a.store.get('pendingInvite'), 'tok_123');
  const bad = drive('#invite=%ZZ');
  assert.equal(bad.store.size, 0); assert.equal(bad.historyCalls[0][2], '/#invite');
  const back = drive('#session=st_abc', new Map([['pendingInvite', 'tok_123']]));
  assert.equal(back.result, 'session'); assert.equal(back.historyCalls[0][2], '/#invite');
  const plain = drive('#session=st_abc');
  assert.equal(plain.historyCalls[0][2], '/#projects', 'no invitation: B-F02a landing unchanged');
});
test('B03: an assessment with no known project shows no raw project id in its header', () => {
  const js = read('./assess.js');
  assert.ok(!js.includes('project?.name || a.project_id'));
  assert.match(js, /const roleLine = project \? `\$\{esc\(project\.name\)\} · your role: \$\{esc\(a\.role\)\}` : `Your role: \$\{esc\(a\.role\)\}`;/);
});
test('B03 (Bugbot): a failed project-list read never blocks the invitation page', () => {
  const js = read('./assess.js');
  assert.match(js, /if \(!\['assessment', 'survey', 'feedback', 'invite'\]\.includes\(route\(location\.hash\)\.kind\)\)/);
});

// Bincy B04 (captain ruling 2026-09-25): a fresh sign-in lands by Bincy's rule — invitation → accept screen; one project → it; several → Home.
test('B04: a consumed #session= marks the sign-in; boot() applies signInLanding once, after the project list, before render()', () => {
  const source = read('./assess.js');
  const code = source.slice(source.indexOf('const LEGACY_HASHES'), source.indexOf('function resetIdentity()'));
  const drive = (hash, store = new Map()) => {
    const historyCalls = [];
    const box = { demo:false, INVITE_KEY:'pendingInvite', parseInvitationFragment: () => null, resetIdentity(){}, token:null,
      location:{ hash, pathname:'/', replace(){} }, history:{replaceState:(...args)=>historyCalls.push(args)},
      sessionStorage:{ getItem:k=>store.get(k) ?? null, setItem:(k,v)=>store.set(k,v), removeItem:k=>store.delete(k) } };
    const [result, landing] = vm.runInNewContext(code + '\n[scrubCredentialHash(), landAfterSignIn]', box);
    return { result, landing, historyCalls };
  };
  assert.deepEqual([drive('#session=st_abc').result, drive('#session=st_abc').landing], ['session', true]);
  assert.equal(drive('#projects').landing, false, 'plain navigation is not a sign-in');
  assert.equal(drive('#session=st_abc', new Map([['pendingInvite', 'tok']])).historyCalls[0][2], '/#invite');
  const boot = source.slice(source.indexOf('async function boot()'));
  assert.match(boot, /state\.projects = result\.projects \|\| \[\];[\s\S]*if \(landAfterSignIn\) \{ landAfterSignIn = false; if \(\['projects', 'invite', 'entry'\]\.includes\(route\(location\.hash\)\.kind\)\) \{ try \{ history\.replaceState\(null, '', location\.pathname \+ location\.search \+ signInLanding\(\{ invite: !!\(pendingInvite \|\| storedInvite\(\)\), projects: state\.projects \}\)\); \} catch \{\} \} \}\n\s*listen\(\);\n\s*await render\(\);/);
  assert.match(source, /const setToken = t => \{ if \(demo\) return; token = t \|\| null; landAfterSignIn = !!t;/, 'the entry form sign-in lands the same way');
});
