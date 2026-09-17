import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read=n=>readFileSync(fileURLToPath(new URL(n,import.meta.url)),'utf8');
const html=read('./index.html');
const css=read('./public-choices.css');
const home=html.slice(html.indexOf('<section id="public-home"'),html.indexOf('<section id="public-how"'));

test('the public home opens with exactly the four captain-named choices, in order, with accurate routes',()=>{
  const nav=home.slice(home.indexOf('<nav class="public-choices"'),home.indexOf('</nav>'));
  const links=[...nav.matchAll(/<a class="rv-btn[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map(m=>[m[2],m[1]]);
  assert.deepEqual(links,[
    ['Read about it','#public-about'],
    ['Take the tour','#how'],
    ['Take a survey','#participant'],
    ['Sign in','#facilitator'],
  ]);
  assert.ok(nav.includes('aria-label="Choose where to start"'));
  assert.ok(home.indexOf('<nav class="public-choices"')<home.indexOf('<h1>'),'choices sit above the headline');
});

test('Read about it lands on the description inside the same page (not the participant #about details)',()=>{
  assert.ok(home.includes('<p class="eyebrow" id="public-about">What is 3D Review?</p>'));
  assert.ok(html.includes('<details id="about">'),'participant #about still exists; the choice must not target it');
});

test('the sample and shared-report destinations remain, as labelled secondary links; the old unlabelled entry is gone',()=>{
  assert.ok(home.includes('href="#example">Browse a sample assessment (invented data) →'));
  assert.ok(home.includes('href="#reports-card">View a shared report'));
  assert.ok(!home.includes('Manage assessments'));
  assert.ok(!home.includes('Here to take the survey?'));
  assert.ok(!home.includes('Show me how'));
});

test('the tour is labelled as a tour that sends nothing',()=>{
  assert.ok(html.includes('<p class="eyebrow">Guided tour · nothing is sent · Step 1 of 5 · Prepare</p>'));
  assert.ok(home.includes('The tour: 5 short steps · Go at your own pace · Nothing is sent'));
});

test('real sign-in stays first; sandbox code controls sit in a labelled dev-only box beneath it',()=>{
  const signin=html.slice(html.indexOf('<h3>Sign in</h3>'),html.indexOf('<p id="dev-code"'));
  const access=signin.indexOf('href="/v2/auth/access"');
  const box=signin.indexOf('<div class="sandbox-signin"');
  assert.ok(access>-1&&box>access,'the /v2/auth/access link precedes the sandbox box');
  assert.ok(signin.includes('<h4 id="sandbox-signin-title">Sandbox test identities (dev only) — not a real sign-in</h4>'));
  assert.ok(signin.indexOf('<form id="request-login">')>box);
  const after=html.slice(box);
  assert.ok(after.indexOf('<form id="consume-login">')<after.indexOf('</div></article>'),'both sandbox forms are inside the box');
  assert.ok(html.includes('id="request-login"')&&html.includes('id="consume-login"'),'form ids app.js binds are unchanged');
});

test('the participant card explains shared links first and the code as optional',()=>{
  const p=html.slice(html.indexOf('<section id="participant"'));
  assert.ok(p.indexOf('<p class="note participant-arrival">')<p.indexOf('<details id="about">'));
  assert.ok(p.includes('open that link and you are already in the right place. If you were given an access code instead, enter it below. No account is needed.'));
});

test('stylesheet is wired and its hides are route-scoped: notice off public/participant faces, sign-out off while unconfirmed',()=>{
  assert.ok(html.includes('<link rel="stylesheet" href="/public-choices.css">'));
  assert.ok(read('./server.mjs').includes("'/public-choices.css': ['public-choices.css', 'text/css']"));
  assert.match(css,/\.rv:not\(\[data-entry-view="workspace"\]\) #notice,\s*\.rv\[data-workspace-route="participant"\] #notice \{ display:none; \}/);
  assert.match(css,/\.rv\[data-staff-confirmed="false"\] #signout \{ display:none; \}/);
  // no unscoped rule may hide anything
  for(const sel of css.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(c=>c.slice(0,c.indexOf('{')).trim()).filter(Boolean))
    for(const one of sel.split(',').map(x=>x.trim()).filter(x=>x&&!x.startsWith('@')))
      assert.ok(one.startsWith('.rv'),`unscoped selector: ${one}`);
  assert.ok(read('./.assetsignore').split('\n').includes('public-choices.test.mjs'));
});
