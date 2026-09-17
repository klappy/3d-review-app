/** Navigation projects existing authorized controls; it never fetches or grants access. */
export function projectContext(sources) {
  if (!sources.active) return [];
  const entries = source => source?.visible ? source.options.filter(o => o.value && !o.disabled).map(o => ({ value:o.value, label:o.label })) : [];
  const projects = entries(sources.projects).map(p => ({ ...p, source:'projects', selected:p.value===sources.projects.value, children:[] }));
  const selected = projects.find(p => p.selected);
  if (selected) selected.children = entries(sources.assessments).map(a => ({ ...a, source:'assessments', selected:a.value===sources.assessments.value, children:[] }));
  const assessment = selected?.children.find(a => a.selected);
  if (assessment) assessment.children = entries(sources.surveys).map(s => ({ ...s, source:'surveys', selected:s.value===sources.surveys.value, children:[] }));
  const direct = entries(sources.granted).map(a => ({ ...a, source:'granted-assessments', selected:a.value===sources.granted.value, children:[] }));
  return [...projects, ...direct];
}
export function selectContext(document, source, value, parents = {}) {
  const control = document.getElementById(source);
  const visible = node => !!node && !node.closest('[hidden]');
  if (document.getElementById('load-projects')?.disabled || !visible(control) || control.disabled || ![...control.options].some(o => o.value===value && !o.disabled)) return false;
  for (const [id, expected] of Object.entries(parents)) if (document.getElementById(id)?.value !== expected) return false;
  control.value=value;
  control.dispatchEvent(new document.defaultView.Event('change', {bubbles:true}));
  return true;
}
export function mountContextTree(document) {
  const host=document.getElementById('context-tree');
  if (!host) return;
  const ids=['projects','assessments','surveys','granted-assessments'];
  const read=id=>{
    const s=document.getElementById(id);
    return s ? {visible:!s.closest('[hidden]'), value:s.value, options:[...s.options].map(o=>({value:o.value,label:o.textContent,disabled:o.disabled}))} : null;
  };
  let previous='';
  function render(){
    const facilitator=document.getElementById('facilitator');
    const roots=projectContext({active:!!facilitator&&!facilitator.hidden,projects:read('projects'),assessments:read('assessments'),surveys:read('surveys'),granted:read('granted-assessments')});
    const busy=!!document.getElementById('load-projects')?.disabled;
    const key=JSON.stringify({roots,busy});if(key===previous)return;previous=key;
    const focused=document.activeElement?.dataset?.contextKey;
    const list=document.createElement('ul');list.className='context-branches';
    const add=(nodes,parent,ancestors={})=>nodes.forEach(node=>{
      const li=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.disabled=busy;button.className='tree-row context-node'+(node.selected?' on':'');
      button.dataset.contextKey=node.source+':'+node.value;
      button.textContent=node.label;button.setAttribute('aria-current',node.selected?'true':'false');
      button.addEventListener('click',()=>{if(selectContext(document,node.source,node.value,ancestors))render();});
      li.append(button);
      if(node.children.length){const kids=document.createElement('ul');kids.className='context-branches tree-kids';add(node.children,kids,{...ancestors,[node.source]:node.value});li.append(kids);}
      parent.append(li);
    });
    if(roots.length)add(roots,list);
    else {const note=document.createElement('li');note.className='tree-empty';note.textContent='Your available projects and assessments appear here after sign in.';list.append(note);}
    host.replaceChildren(list);
    if(focused) for(const button of host.querySelectorAll('button'))if(button.dataset.contextKey===focused){button.focus();break;}
  }
  const observer=new document.defaultView.MutationObserver(render);
  for(const id of [...ids,'project-card','assessment-card','survey-card','shared-assessments','facilitator','load-projects','identity','project-detail','assessment-detail']){
    const node=document.getElementById(id);if(node)observer.observe(node,{attributes:true,childList:true,subtree:true,characterData:true});
  }
  for(const id of ids)document.getElementById(id)?.addEventListener('change',render);
  render();
  return ()=>observer.disconnect();
}
if(typeof document!=='undefined')mountContextTree(document);
