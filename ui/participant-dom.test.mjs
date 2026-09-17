import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as resume from './participant-resume.js';
import * as visibility from './visibility.js';
import * as present from './present.js';
import * as shared from './shared-link.js';

// Run the real app's bindings, state and rendering against a minimal DOM, not
// a duplicate recovery algorithm. Browser validation remains a separate gate.
function harness(saved = {}) {
  const nodes = new Map(), storage = new Map(Object.entries(saved)), requests = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, hidden: true, textContent: '', value: '', children: [], listeners: {},
      addEventListener(event, fn) { this.listeners[event] = fn; },
      replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); },
      prepend(child) { this.children.unshift(child); }, add(child) { this.children.push(child); },
      reset() {}, focus() { this.focused = true; }, querySelectorAll() { return []; } });
    return nodes.get(id);
  }
  let responder = async () => { throw Error('unconfigured request'); };
  const context = vm.createContext({ ...resume, ...visibility, ...present, ...shared, sharedCopy: shared.copy,
    initLanguageControls: () => ({refresh: async()=>{}}),
    document: {getElementById:node, createElement: tag => node(`generated-${nodes.size}-${tag}`), querySelectorAll:()=>[]},
    sessionStorage: {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    location:{hash:''}, history:{replaceState(){}}, crypto:{randomUUID:()=> 'synthetic-key'},
    Option:class {}, FormData:class { constructor(target){this.target=target} get(k){return this.target.fields?.[k]??null} },
    redactDiagnosticPath:u=>u, // app.js import stripped above; the real function is unit-tested in diagnostic-path.test.mjs
    createCollabHooks: () => ({ reset() {}, identity() {}, projects() {}, setScope() {}, destroy() {} }), mountEntityScreen: () => ({ render() {}, reset() {} }), // app.js import stripped above; hooks covered by collab-mount.test.mjs + Chromium
    fetch:async(url,options)=>{requests.push({url,options});return responder(url,options)},
  });
  const source = fs.readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source,context);
  return {node,storage,requests,setResponder(fn){responder=fn},async settle(){for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r))},
    async event(id,event){if(event==='click'){assert.equal(node(id).hidden,false,'clicked control must be visible');assert.notEqual(node(id).disabled,true,'clicked control must be enabled');}node(id).listeners[event]({preventDefault(){},currentTarget:node(id)});await this.settle()}};
}
const ok = result => ({ok:true,status:200,json:async()=>({ok:true,result})});

test('new participant token clears old rendered identity before a failed form fetch',async()=>{
 const h=harness();await h.settle();
 for(const id of ['answers','review','receipt']){h.node(id).hidden=false;h.node(id).textContent='participant A';}
 h.node('questions').children=['A question'];h.node('review-answers').children=['A answer'];
 h.node('form-context').textContent='A assessment';h.storage.set('responseKey','A-key');
 h.node('redeem').fields={code:'B-code'};
 h.setResponder(async url=>{
  if(url.endsWith('/code'))return ok({participant_token:'B-token'});
  assert.equal(h.storage.get('participantToken'),'B-token');
  for(const id of ['answers','review','receipt'])assert.equal(h.node(id).hidden,true,id);
  for(const id of ['questions','review-answers'])assert.deepEqual(h.node(id).children,[],id);
  assert.equal(h.node('form-context').textContent,'');assert.equal(h.node('receipt').textContent,'');
  throw Error('form transport failed');
 });
 await h.event('redeem','submit');
 assert.equal(h.storage.get('participantToken'),'B-token');assert.equal(h.storage.has('responseKey'),false);
 assert.equal(h.node('recover').hidden,false);assert.equal(h.node('answers').hidden,true);
 assert.equal(h.node('participant-error').hidden,true); // consumed code is not called invalid
 assert.equal(h.requests.length,2);
});

for(const submitted of [false,true])test(`successful ${submitted?'receipt':'form'} Recover clears failed-restore alert`,async()=>{
 const h=harness({participantToken:'saved-token'});await h.settle();
 assert.equal(h.node('participant-error').hidden,false);
 assert.equal(h.node('recover').hidden,false, 'retry must be reachable after failed restore');
 assert.notEqual(h.node('recover').disabled,true, 'retry must be enabled');
 h.setResponder(async url=>url.endsWith('/receipt')?ok({submitted,response_id:'synthetic-receipt'}):ok({assessment:'B',language:'test',template:{id:'tpl',version:2},items:[]}));
 await h.event('recover','click');
 assert.equal(h.node('participant-error').hidden,true);assert.equal(h.node('participant-error').textContent,'');
 assert.equal(h.storage.get('participantToken'),'saved-token');
 assert.equal(h.node(submitted?'receipt':'answers').hidden,false);
 assert.equal(h.requests.some(r=>r.url.endsWith('/code')),false);
});
