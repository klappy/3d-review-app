import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {createActionCard} from '../ui/mcp/action-card.js';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function fixture(call=async()=>({ok:true,result:{},trace_id:'done'})) {
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');let explored=0;const executing:boolean[]=[];
 const card=createActionCard({root,esc:(s:unknown)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),call,explore:()=>explored++,execution:(on:boolean)=>executing.push(on)});
 return{card,root,dom,executing,explored:()=>explored};
}
it('docs and metadata render relevant cards without private authorization details or tool calls',()=>{
 const f=fixture(()=>{throw Error('unexpected call');});f.card.render();expect(f.root.textContent).toContain('Waiting');
 f.card.receiveInput({arguments:{topic:'orientation'}});f.card.receiveResult({structuredContent:{ok:true,result:{}}});expect(f.root.textContent).toContain('guidance');
 f.card.receiveInput({arguments:{capability:'cap.auth.me'}});f.card.receiveResult({structuredContent:{ok:true,capability:'cap.auth.me',result:{principal:{id:'private-id',email:'private-email'},grants:[{id:'private-grant'}]}}});
 expect(f.root.textContent).toContain('Sign-in checked');expect(f.root.textContent).not.toContain('private');expect(f.explored()).toBe(0);f.dom.window.close();
});
it('entity and feedback outputs never echo unrelated/private fields; successive calls replace the card',()=>{
 const f=fixture();f.card.receiveResult({structuredContent:{ok:true,capability:'cap.assessment.get',result:{assessment:{id:'a',name:'Assessment A'},unrelated:'private'}}});expect(f.root.textContent).toContain('Assessment A');
 f.card.receiveInput({arguments:{capability:'cap.ops.feedback',params:{note:'private note'}}});expect(f.root.textContent).not.toContain('Assessment A');
 f.card.receiveResult({structuredContent:{ok:true,capability:'cap.ops.feedback',result:{note:'private note'},trace_id:'safe-trace'}});expect(f.root.textContent).toContain('Feedback received');expect(f.root.textContent).not.toContain('private note');expect(f.root.textContent).toContain('safe-trace');f.dom.window.close();
});
it('danger consumes a matching preview once, holds later host events during execution and preserves parameters',async()=>{
 let resolve:any;const calls:any[]=[];const f=fixture(async(...args:any[])=>{calls.push(args);return new Promise(r=>{resolve=r;});});
 const args={capability:'cap.grant.invite',params:{scope:'assessment',id:'a',email:'fixture@example.test',role:'viewer'},mode:'dry_run'};
 f.card.receiveInput({arguments:args});args.params.id='other';f.card.receiveResult({structuredContent:{ok:true,capability:args.capability,result:{confirm_token:'private-token',expires_in:60}}});
 expect(f.root.innerHTML).not.toContain('private-token');const button=f.root.querySelector('[data-card-confirm]');button.click();button.click();
 expect(calls).toHaveLength(1);expect(calls[0][1].params.id).toBe('a');expect(f.card.receiveInput({arguments:{}})).toBe(false);expect(f.card.receiveResult({structuredContent:{ok:true}})).toBe(false);
 resolve({ok:true,result:{},trace_id:'done'});await new Promise(r=>setTimeout(r,0));expect(f.root.textContent).toContain('done');expect(f.executing).toEqual([true,false]);f.dom.window.close();
});
it('cancel, malformed/mismatched previews and refusal never execute; no private refusal message',()=>{
 const f=fixture(()=>{throw Error('unexpected execute');});const input={arguments:{capability:'cap.grant.invite',params:{id:'a'},mode:'dry_run'}};
 for(const result of [{capability:'cap.workspace.delete',result:{confirm_token:'t',expires_in:60}},{capability:'cap.grant.invite',result:{confirm_token:'t',expires_in:0}},{ok:false,error:{message:'private'}}]){f.card.receiveInput(input);f.card.receiveResult({structuredContent:{ok:true,...result}});expect(f.root.querySelector('[data-card-confirm]')).toBeNull();expect(f.root.textContent).not.toContain('private');}
 f.card.receiveInput(input);f.card.receiveResult({structuredContent:{ok:true,capability:'cap.grant.invite',result:{confirm_token:'t',expires_in:60}}});f.root.querySelector('[data-card-cancel]').click();expect(f.root.querySelector('[data-card-confirm]')).toBeNull();expect(f.root.textContent).toContain('Cancelled');f.dom.window.close();
});
it('expired preview and uncertain execution do not retry or reuse confirmation',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw new Error('private transport details');});
 const input={arguments:{capability:'cap.grant.invite',params:{id:'a'},mode:'dry_run'}};
 f.card.receiveInput(input);f.card.receiveResult({structuredContent:{ok:true,capability:'cap.grant.invite',result:{confirm_token:'t',expires_in:0.001}}});
 await new Promise(r=>setTimeout(r,5));f.root.querySelector('[data-card-confirm]').click();expect(calls).toBe(0);expect(f.root.textContent).toContain('expired');
 f.card.receiveInput(input);f.card.receiveResult({structuredContent:{ok:true,capability:'cap.grant.invite',result:{confirm_token:'t',expires_in:60}}});
 const confirm=f.root.querySelector('[data-card-confirm]');confirm.click();await new Promise(r=>setTimeout(r,0));confirm.click();
 expect(calls).toBe(1);expect(f.root.textContent).toContain('outcome could not be confirmed');expect(f.root.textContent).not.toContain('private transport');expect(f.root.querySelector('[data-card-confirm]')).toBeNull();f.dom.window.close();
});

it('compact role preview displays server impact without exposing confirmation token',()=>{
 const f=fixture();f.card.receiveInput({arguments:{capability:'cap.grant.update_role',mode:'dry_run',params:{scope:'assessment',id:'a',gid:'g',role:'member'}}});
 f.card.receiveResult({structuredContent:{ok:true,capability:'cap.grant.update_role',result:{confirm_token:'secret-confirm',expires_in:300,impact:{effect:'disclosure',irreversible:true,compensating_control:'demotion does not undo disclosure',affected:[{grant:'g',from:'viewer',to:'member'}]}}}});
 for(const fact of ['disclosure','true','demotion does not undo disclosure','viewer','member','300'])expect(f.root.textContent).toContain(fact);
 expect(f.root.textContent).not.toContain('secret-confirm');expect(f.root.querySelector('[data-card-confirm]')).not.toBeNull();f.dom.window.close();
});

it('latest Written survey result replaces projects/assessment/selection with actual read-only questions',()=>{
 const f=fixture(()=>{throw Error('no automatic calls');});
 for(const [cap,result] of [['cap.project.list',{projects:[{name:'OLD PROJECT'}]}],['cap.assessment.get',{assessment:{name:'OLD ASSESSMENT'}}],['cap.template.list',{templates:[{name:'Community Written'}]}]]){f.card.receiveInput({arguments:{capability:cap}});f.card.receiveResult({structuredContent:{ok:true,capability:cap,result}});}
 const items=[{id:'q1',text:'How often is this useful?',type:'scale',scale:{min:1,max:5}},{id:'q2',text:'Which difficulties?',type:'multi',requiredness:'unresolved',answer_semantics:'unresolved_no_problems_vs_skipped',options:[{code:'a',text:'Travel <script>',weight:99},{code:'none',text:'None',flag:'exclusion'}]},{id:'q3',text:'Explain your choice',type:'text'}];
 for(const cap of ['cap.template.get','cap.template.render']){
  f.card.receiveInput({arguments:{capability:cap,params:{id:'written'}}});f.card.receiveResult({structuredContent:{ok:true,capability:cap,result:cap.endsWith('.get')?{template:{name:'Written',perspective:'Community',version:2,items}}:{template:{name:'Written',perspective:'Community',version:2},items}}});
  for(const phrase of ['Written','Community','version 2','3 questions','How often is this useful?','1 to 5','Which difficulties?','Travel <script>','cannot combine','Explain your choice','unknown'])expect(f.root.textContent).toContain(phrase);
  expect(f.root.textContent).not.toContain('OLD');expect(f.root.innerHTML).not.toContain('<script>');expect(f.root.textContent).not.toContain('99');expect(f.root.querySelector('input,textarea')).toBeNull();
 }
 f.card.receiveInput({arguments:{capability:'cap.ops.feedback'}});expect(f.root.textContent).not.toContain('How often');f.dom.window.close();
});
