import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { feedback } from './feedback.js';
function setup(api, options = {}) {
  const dom = new JSDOM('<main></main>', { url: 'https://fixture.test/#feedback' });
  const root = dom.window.document.querySelector('main'); let active = true; const calls = [];
  const ctx = { demo: false, state: { principal: { kind: 'user', id: 'fixture' } }, isCurrent: () => active, api: async (...args) => { calls.push(args); return api(...args); }, ...options };
  return feedback.load(ctx).then(model => {
    root.innerHTML = feedback.render(ctx, model); feedback.bind(ctx, root, model);
    return { root, calls, dom, fill(name,value) { root.querySelector(`[name="${name}"]`).value = value; }, text: () => root.textContent, submit: () => root.querySelector('form').onsubmit({preventDefault(){}}), stop(){active=false;} };
  });
}
const success = () => ({ recorded:true, stripped:false, feedback_id:'fb_fixture' });
test('normal shell exposes dedicated feedback route and module through both entries and local harness', () => {
  for (const name of ['../index.html','index.html']) assert.match(readFileSync(new URL(name,import.meta.url),'utf8'),/href="#feedback">App feedback/);
  const source=readFileSync(new URL('./assess.js',import.meta.url),'utf8');
  assert.match(source,/parts\[0\] === 'feedback'/); assert.match(source,/r.kind === 'feedback'\) return feedback/);
  assert.match(readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),/\/assess\/feedback.js/);
});
test('anonymous and demo visitors cannot mount a sending form or call API', async () => {
  for(const options of [{state:{principal:null}},{state:{principal:{kind:'anonymous'}}},{demo:true}]){
    const h=await setup(success,options); assert.equal(h.root.querySelector('form'),null); assert.match(h.text(),/Sign in/); assert.equal(h.calls.length,0);
  }
});
test('normal signed-in form sends only explicit contract values and shows recorded reference once', async () => {
  const h=await setup(success);h.fill('note','Keep my exact words  ');h.fill('helpful','false');h.fill('satisfaction','4');h.fill('sentiment_journey','confused → clear');await h.submit();await h.submit();
  assert.deepEqual(h.calls,[['/v2/feedback',{method:'POST',body:{require_authenticated:true,helpful:false,note:'Keep my exact words  ',satisfaction:4,sentiment_journey:'confused → clear'}}]]);
  assert.match(h.text(),/was recorded/);assert.match(h.text(),/fb_fixture/);assert.equal(h.root.querySelector('button').disabled,true);
  assert.equal(h.dom.window.localStorage.length,0);assert.equal(h.dom.window.sessionStorage.length,0);
});
test('empty form and UTF-8 note overflow refuse locally without losing entered text',async()=>{
  const h=await setup(success);await h.submit();assert.match(h.text(),/choose an answer/);h.fill('note','é'.repeat(2049));await h.submit();assert.match(h.text(),/too long/);assert.equal(h.calls.length,0);assert.equal(h.root.querySelector('textarea').value.length,2049);
});
test('permission, invalid input and expired sign-in retain exact draft with no raw server message',async()=>{
  for(const code of ['NOT_AUTHORIZED','INVALID_PARAMS','NOT_AUTHENTICATED','RATE_LIMITED']){
    const h=await setup(()=>{throw Object.assign(new Error('private server detail'),{code});});h.fill('note','Please fix this');await h.submit();assert.equal(h.root.querySelector('textarea').value,'Please fix this');assert.doesNotMatch(h.text(),/private server/);assert.equal(h.calls.length,1);assert.equal(h.root.querySelector('button').disabled,false);
    if(code==='NOT_AUTHENTICATED')assert.equal(h.root.querySelector('#feedback-status a').getAttribute('href'),'/v2/auth/access');
  }
});
test('uncertain and malformed receipt preserve text without automatic retry or false success',async()=>{
  for(const answer of [()=>{throw Error('offline');},()=>({recorded:true}),()=>({recorded:true,stripped:true,feedback_id:'fb_x'})]){
    const h=await setup(answer);h.fill('note','retain');await h.submit();assert.match(h.text(),/could not confirm/);assert.match(h.root.querySelector('button').textContent,/may duplicate/);assert.equal(h.calls.length,1);assert.equal(h.root.querySelector('#feedback-receipt').textContent,'');assert.equal(h.root.querySelector('textarea').value,'retain');
  }
});
test('double submit is blocked; late identity/navigation completion cannot publish receipt',async()=>{
  let resolve;const h=await setup(()=>new Promise(r=>{resolve=r;}));h.fill('note','fixture');const pending=h.submit();await h.submit();assert.equal(h.calls.length,1);h.stop();resolve(success());await pending;assert.equal(h.root.querySelector('#feedback-receipt').textContent,'');await h.submit();assert.equal(h.calls.length,1);
});


test('bug report and suggestion lead with note and submit without optional ratings',async()=>{
 for(const note of ['The report would not open. I expected to read it.','Please make it easier to compare the survey questions.']){
  const h=await setup(success),form=h.root.querySelector('form'),ratings=form.querySelector('details');
  assert.equal(form.querySelector('input,textarea,select').name,'note');
  assert.match(form.querySelector('label').textContent,/What happened, or what would you improve/);
  assert.equal(ratings.open,false);assert.match(ratings.querySelector('summary').textContent,/optional/);
  assert.equal(ratings.querySelector('[name=helpful]').name,'helpful');
  h.fill('note',note);await h.submit();
  assert.deepEqual(h.calls[0][1].body,{note,require_authenticated:true});
 }
});
test('optional ratings stay compatible and leaving without submission sends nothing',async()=>{
 const h=await setup(success);h.root.querySelector('details').open=true;h.fill('helpful','true');await h.submit();
 assert.deepEqual(h.calls[0][1].body,{helpful:true,require_authenticated:true});
 const cancel=await setup(success);cancel.fill('note','Unsent draft');assert.equal(cancel.root.querySelector('.actions a').getAttribute('href'),'#');cancel.stop();assert.equal(cancel.calls.length,0);
});

// S54 (captain fb_c9324db7e9774c59a89b): the menu opens the same form in place as a dialog and closes back to the untouched screen.
import { openFeedbackDialog } from './feedback.js';
async function modal(api = success, options = {}) {
  const dom = new JSDOM('<button id="account-menu-toggle">Account</button><main id="app"><h1>Assessment</h1><label>Answer<input id="work"></label></main>', { url: 'https://fixture.test/#assessment/a1' });
  const doc = dom.window.document, toggle = doc.getElementById('account-menu-toggle'), calls = [];
  doc.getElementById('work').value = 'unfinished answer';
  const before = doc.getElementById('app').innerHTML;
  const ctx = { demo: false, state: { principal: { kind: 'user', id: 'fixture' } }, isCurrent: () => true, api: async (...args) => { calls.push(args); return api(...args); }, ...options };
  const handle = await openFeedbackDialog(ctx, { doc, returnFocus: toggle });
  return { dom, doc, toggle, calls, before, handle, dialog: () => doc.getElementById('feedback-dialog'), app: () => doc.getElementById('app') };
}
test('S54: menu feedback opens a labelled dialog over the current screen without changing the hash', async () => {
  const h = await modal();
  assert.equal(h.dom.window.location.hash, '#assessment/a1');
  const d = h.dialog(); assert.ok(d); assert.equal(d.hasAttribute('open'), true); assert.equal(d.getAttribute('aria-labelledby'), 'feedback-dialog-title');
  assert.match(h.doc.getElementById('feedback-dialog-title').textContent, /Share app feedback/);
  assert.equal(h.doc.activeElement, d.querySelector('textarea'));
  assert.equal(d.querySelector('a[href="#"]'), null); // no "Back to home" navigation inside the dialog
  assert.equal(h.app().innerHTML, h.before); assert.equal(h.doc.getElementById('work').value, 'unfinished answer');
});
test('S54: Close, Escape and backdrop each remove only the dialog, restore focus and leave the screen untouched', async () => {
  const ways = { close: (h, d) => d.querySelector('[data-feedback-close]').click(), escape: (h, d) => d.dispatchEvent(new h.dom.window.Event('cancel', { cancelable: true })), backdrop: (h, d) => { d.dispatchEvent(new h.dom.window.MouseEvent('mousedown', { bubbles: true })); d.dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true })); } };
  for (const [name, act] of Object.entries(ways)) {
    const h = await modal(); h.doc.querySelector('#feedback-dialog textarea').value = 'unsent';
    act(h, h.dialog());
    assert.equal(h.dialog(), null, name); assert.equal(h.doc.activeElement, h.toggle, name);
    assert.equal(h.app().innerHTML, h.before, name); assert.equal(h.doc.getElementById('work').value, 'unfinished answer', name);
    assert.equal(h.dom.window.location.hash, '#assessment/a1', name); assert.equal(h.calls.length, 0, name);
  }
});
test('S54: a click inside the dialog box does not close it', async () => {
  const h = await modal(), d = h.dialog();
  d.querySelector('textarea').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true }));
  assert.ok(h.dialog());
});
test('S54: dialog submit sends the same body as the route and shows the receipt with Close still available', async () => {
  const h = await modal(), d = h.dialog();
  d.querySelector('[name=note]').value = 'Keep my place'; d.querySelector('[name=satisfaction]').value = '2';
  await d.querySelector('form').onsubmit({ preventDefault() {} });
  assert.deepEqual(h.calls, [['/v2/feedback', { method: 'POST', body: { require_authenticated: true, note: 'Keep my place', satisfaction: 2 } }]]);
  assert.match(d.textContent, /was recorded/); assert.match(d.querySelector('#feedback-receipt').textContent, /fb_fixture/);
  const close = d.querySelector('[data-feedback-close]'); assert.equal(close.disabled, false); assert.equal(d.querySelector('button[type=submit]').disabled, true);
  close.click(); assert.equal(h.dialog(), null); assert.equal(h.app().innerHTML, h.before); assert.equal(h.doc.activeElement, h.toggle);
  assert.equal(h.dom.window.localStorage.length, 0); assert.equal(h.dom.window.sessionStorage.length, 0);
});
test('S54: a reply arriving after the dialog closed publishes nothing; signed-out dialog offers sign-in and Close', async () => {
  let resolve; const h = await modal(() => new Promise(r => { resolve = r; })), d = h.dialog();
  d.querySelector('[name=note]').value = 'late'; const pending = d.querySelector('form').onsubmit({ preventDefault() {} });
  h.handle.close(); resolve(success()); await pending; assert.equal(d.querySelector('#feedback-receipt').textContent, '');
  const anon = await modal(success, { state: { principal: null } });
  assert.equal(anon.dialog().querySelector('form'), null); assert.match(anon.dialog().textContent, /Sign in/); anon.dialog().querySelector('[data-feedback-close]').click(); assert.equal(anon.dialog(), null); assert.equal(anon.calls.length, 0);
});
test('S54: menu link is intercepted in place while the #feedback route still renders the page version', async () => {
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  assert.match(source, /a\[href="#feedback"\]/); assert.match(source, /openFeedbackDialog\(/);
  const h = await setup(success); assert.ok(h.root.querySelector('h1')); assert.equal(h.root.querySelector('.actions a').getAttribute('href'), '#'); assert.equal(h.root.querySelector('[data-feedback-close]'), null);
});
test('rev444: a press inside the form released on the backdrop keeps the dialog and its draft', async () => {
  const h = await modal(), d = h.dialog(), text = d.querySelector('textarea'); text.value = 'half-written draft';
  text.dispatchEvent(new h.dom.window.MouseEvent('mousedown', { bubbles: true }));
  d.dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true })); // browsers target the common ancestor (the dialog) on such a release
  assert.ok(h.dialog()); assert.equal(h.dialog().querySelector('textarea').value, 'half-written draft'); assert.equal(h.calls.length, 0);
});
test('rev444: an identity reset removes an open feedback dialog', async () => {
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  const reset = source.slice(source.indexOf('function resetIdentity()'), source.indexOf('\n}', source.indexOf('function resetIdentity()')));
  const line = reset.split('\n').find(l => l.includes("getElementById('feedback-dialog')"));
  assert.ok(line && /\?\.remove\(\)/.test(line), 'resetIdentity removes #feedback-dialog');
  let resolve; const h = await modal(() => new Promise(r => { resolve = r; })), d = h.dialog();
  d.querySelector('[name=note]').value = 'old identity'; const pending = d.querySelector('form').onsubmit({ preventDefault() {} });
  new Function('document', line.split('//')[0])(h.doc); // run resetIdentity's own line against this document
  assert.equal(h.dialog(), null); assert.equal(h.app().innerHTML, h.before);
  resolve(success()); await pending; assert.equal(d.querySelector('#feedback-receipt').textContent, '');
});
