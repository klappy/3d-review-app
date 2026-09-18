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
