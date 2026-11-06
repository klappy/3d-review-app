import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextDefaultTarget, bootDefaultEntry } from '../ui/default-entry.js';

const locationFor = value => new URL(value, 'https://example.invalid');

test('ordinary root entry selects live Next before loading the legacy identity handler', async () => {
    let currentLoads = 0;
    const moves = [];
    const location = { pathname: '/', search: '', hash: '', replace: target => moves.push(target) };
    const result = await bootDefaultEntry({ location, probeNext: async () => true, loadCurrent: () => { currentLoads++; } });
    assert.deepEqual(result, { ui: 'next', target: '/next/?ui_next=on' });
    assert.deepEqual(moves, ['/next/?ui_next=on']);
    assert.equal(currentLoads, 0);
});

test('explicit legacy opt-in, opt-out and demo query keep current UI; explicit Next preserves presentation', () => {
  for (const query of ['?ui=legacy', '?ui=current', '?ui_next=off', '?ui=next&ui=legacy', '?demo=1'])
    assert.equal(nextDefaultTarget(locationFor('/' + query)), null, query);
  assert.equal(nextDefaultTarget(locationFor('/?ui=next&theme=dark&w=phone')), '/next/?ui=next&theme=dark&w=phone&ui_next=on');
  assert.equal(nextDefaultTarget(locationFor('/?ui_next=on&theme=dark')), '/next/?ui_next=on&theme=dark');
  assert.equal(nextDefaultTarget(locationFor('/index.html')), '/next/?ui_next=on');
});

test('all seven existing invitation tokens and language query remain byte-for-byte on their existing entry path', async () => {
  for (let i = 0; i < 7; i++) {
    const href = `/?lang=es#survey=unchanged_existing_token_${i}`;
    const location = locationFor(href);
    location.replace = () => { throw Error('must not rewrite a participant link'); };
    let currentLoads = 0;
    assert.equal(nextDefaultTarget(location), null);
    await bootDefaultEntry({ location, probeNext: () => { throw Error('participant entry must not probe Next'); }, loadCurrent: () => { currentLoads++; } });
    assert.equal(currentLoads, 1);
    assert.equal(location.pathname + location.search + location.hash, href);
  }
});

test('existing session, invitation, report and return URLs retain their original handler and bytes', () => {
  for (const href of ['/?ui=legacy#session=EXISTING', '/#invite=EXISTING', '/#invite/list', '/#assessment/a/understand',
    '/#project/p', '/#workspace/w', '/#new/a', '/#reports-card', '/?return_to=%2F%23project%2Fp',
    '/?next=%2Fnext%2F%23%2Freview%2Fa', '/?unknown=keep%2Bexact']) {
    const location = locationFor(href), original = location.href;
    assert.equal(nextDefaultTarget(location), null, href);
    assert.equal(location.href, original);
  }
  for (const path of ['/next/', '/next/?ui_next=on#survey=EXISTING', '/participate/#survey=EXISTING',
    '/legacy/', '/v2/auth/access', '/v2/reports/r/pdf', '/roadmap/'])
    assert.equal(nextDefaultTarget(locationFor(path)), null, path);
});

test('replace avoids a new root history entry; existing Back/Forward legacy destinations stay put', async () => {
  const history = ['/previous', '/']; let index = 1;
  await bootDefaultEntry({ location: { pathname: '/', search: '', hash: '', replace: target => { history[index] = target; } },
    probeNext: async () => true,
    loadCurrent: () => { throw Error('must not boot current UI on Next entry'); } });
  assert.deepEqual(history, ['/previous', '/next/?ui_next=on']);
  index--; assert.equal(history[index], '/previous');
  index++; assert.equal(history[index], '/next/?ui_next=on');
  assert.equal(nextDefaultTarget(locationFor('/?ui=legacy#project/p')), null);
});

test('missing Next entry HTML, failed probe or refused navigation falls back to the existing UI', async () => {
  for (const failure of ['missing', 'network', 'navigation']) {
    let loads = 0, moves = 0;
    const location = { pathname: '/', search: '', hash: '', replace: () => { moves++; if (failure === 'navigation') throw Error('refused'); } };
    const result = await bootDefaultEntry({ location, probeNext: async () => { if (failure === 'network') throw Error('offline'); return failure !== 'missing'; }, loadCurrent: async () => { loads++; } });
    assert.deepEqual(result, { ui: 'current' });
    assert.equal(loads, 1);
    assert.equal(moves, failure === 'navigation' ? 1 : 0);
  }
});

test('a hash or query navigation while the entry probe is pending cannot be overwritten', async () => {
  for (const change of [{ hash: '#survey=existing_token' }, { hash: '#session=EXISTING' },
    { search: '?ui=legacy' }, { search: '?return_to=%2F%23project%2Fp' }]) {
    let finishProbe, loads = 0;
    const replacements = [];
    const probe = new Promise(resolve => { finishProbe = resolve; });
    const location = { pathname: '/', search: '', hash: '', replace: target => replacements.push(target) };
    const pending = bootDefaultEntry({ location, probeNext: () => probe, loadCurrent: async () => { loads++; } });
    Object.assign(location, change);
    finishProbe(true);
    assert.deepEqual(await pending, { ui: 'current' });
    assert.deepEqual(replacements, []);
    assert.equal(loads, 1);
    for (const [key, value] of Object.entries(change)) assert.equal(location[key], value);
  }
});

test('root wires one default bootstrap; legacy remains a conditional fallback', () => {
  const html = readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
  assert.match(html, /import \{ bootDefaultEntry \} from \"\/default-entry\.js\"; bootDefaultEntry\(\);/);
  assert.doesNotMatch(html, /<script[^>]+src=\"\/assess\/assess\.js/);
  assert.equal((html.match(/bootDefaultEntry\(\)/g) || []).length, 1);
  const server = readFileSync(new URL('../ui/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /'\/default-entry\.js': \['default-entry\.js', 'text\/javascript'\]/);
});


test('real email and Access session callback transfers the exact bearer to Next without URL credentials', async () => {
  for (const token of ['EXISTING_email_token_1', 'EXISTING_access_token_2']) {
    const calls = [], moves = [];
    const location = { pathname: '/', search: '', hash: '#session=' + token, replace: target => moves.push(target) };
    await bootDefaultEntry({ location, probeNext: async () => true, storage: { setItem: (k,v) => calls.push([k,v]) }, loadCurrent: () => { throw Error('must stay Next'); } });
    assert.deepEqual(calls, [['facilitatorToken',token]]);
    assert.deepEqual(moves, ['/next/?ui_next=on']);
    assert.ok(!moves[0].includes(token));
  }
});

test('stalled probe times out, aborts and loads current once', async () => {
  let loads = 0, signal;
  const result = await bootDefaultEntry({ location: { pathname:'/', search:'', hash:'', replace:()=>{throw Error('no redirect');} }, probeTimeoutMs: 10,
    probeNext: s => { signal=s; return new Promise(()=>{}); }, loadCurrent:()=>{loads++;} });
  assert.equal(result.ui,'current'); assert.equal(loads,1); assert.equal(signal.aborted,true);
});

test('callback storage failure and explicit legacy remain on the current handler', async () => {
  for(const query of ['', '?ui=legacy']) {
    let loads=0;
    const location={pathname:'/',search:query,hash:'#session=EXISTING',replace:()=>{throw Error('must not navigate');}};
    await bootDefaultEntry({location,probeNext:async()=>true,storage:{setItem:()=>{throw Error('unavailable');}},loadCurrent:()=>{loads++;}});
    assert.equal(loads,1);assert.equal(location.hash,'#session=EXISTING');
  }
});


test('real bare callback preserves legacy sign-in choice and pending private invitation continuation', async () => {
  const {rememberAuthReturn,authReturnUI}=await import('../ui/auth-return.js');
  for(const invitation of [false,true]) {
    const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
    let loads=0;
    await bootDefaultEntry({location:{pathname:'/',search:'?ui=legacy',hash:''},storage,loadCurrent:()=>{loads++;}});
    assert.equal(authReturnUI(storage),'legacy');
    if(invitation){rememberAuthReturn('next',storage);storage.setItem('pendingInvite','EXISTING_PRIVATE_INVITE');}
    const callback={pathname:'/',search:'',hash:'#session=EXISTING_AUTH_TOKEN',replace:()=>{throw Error('must keep current invitation/UI handler');}};
    await bootDefaultEntry({location:callback,storage,probeNext:()=>{throw Error('must not probe');},loadCurrent:()=>{loads++;}});
    assert.equal(loads,2);assert.equal(callback.hash,'#session=EXISTING_AUTH_TOKEN');
    assert.equal(storage.getItem('3dr-auth-return-ui'),null);
    if(invitation)assert.equal(storage.getItem('pendingInvite'),'EXISTING_PRIVATE_INVITE');
  }
});

test('Next sign-in intent replaces an earlier legacy choice without a stored preference', async()=>{
 const {rememberAuthReturn}=await import('../ui/auth-return.js');
 const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 rememberAuthReturn('legacy',storage);rememberAuthReturn('next',storage);
 const moves=[];await bootDefaultEntry({location:{pathname:'/',search:'',hash:'#session=NEXT_AUTH_TOKEN',replace:t=>moves.push(t)},storage,probeNext:async()=>true,loadCurrent:()=>{throw Error('must return Next');}});
 assert.deepEqual(moves,['/next/?ui_next=on']);assert.equal(storage.getItem('facilitatorToken'),'NEXT_AUTH_TOKEN');assert.equal(storage.getItem('3dr-auth-return-ui'),null);
});
