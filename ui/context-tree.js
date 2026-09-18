/** Navigation projects existing authorized controls; it never fetches or grants access. */
export function projectContext(sources) {
  if (!sources.active) return [];
  const entries = source => source?.visible && !source.disabled ? source.options.filter(o => o.value && !o.disabled).map(o => ({ value:o.value, label:o.label })) : [];
  const projects = entries(sources.projects).map(p => ({ ...p, source:'projects', selected:p.value===sources.projects.value, children:[] }));
  const selected = projects.find(p => p.selected);
  if (selected) selected.children = entries(sources.assessments).map(a => ({ ...a, source:'assessments', selected:a.value===sources.assessments.value, children:[] }));
  const assessment = selected?.children.find(a => a.selected);
  const surveys = () => entries(sources.surveys).map(s => ({ ...s, source:'surveys', selected:s.value===sources.surveys.value, children:[] }));
  if (assessment) assessment.children = surveys();
  const direct = entries(sources.granted).map(a => ({ ...a, source:'granted-assessments', selected:a.value===sources.granted.value, children:[] }));
  if (!assessment) { const current=direct.find(a=>a.selected); if(current)current.children=surveys(); }
  return [...projects, ...direct];
}
/** Metadata supplies presentation only; project membership is intersected with current controls. */
export function groupContext(roots, metadata) {
  if (!metadata?.active) return roots;
  const decorate=node=>({...node,role:metadata.roles?.[node.source]?.[node.value] || '',children:node.children.map(decorate)});
  const nodes=roots.map(decorate),used=new Set();
  const workspaces=(metadata.workspaces || []).filter(w=>w.id && w.name).map(w=>({value:w.id,label:w.name,role:w.role || '',source:'workspaces',selected:w.id===metadata.selectedWorkspaceId,children:nodes.filter(n=>n.source==='projects' && w.projectIds?.includes(n.value)).map(n=>{used.add(n.value);return n;})}));
  return [...workspaces,...nodes.filter(n=>n.source!=='projects'||!used.has(n.value))];
}
export function selectContext(document, source, value, parents = {}) {
  const control = document.getElementById(source);
  const visible = node => !!node && !node.closest('[hidden]');
  if (document.getElementById('load-projects')?.disabled || !visible(control) || control.disabled || ![...control.options].some(o => o.value===value && !o.disabled)) return false;
  for (const [id, expected] of Object.entries(parents)) { const parent=document.getElementById(id); if(!visible(parent)||parent.disabled||parent.value!==expected)return false; }
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
    return s ? {visible:!s.closest('[hidden]'),disabled:s.disabled,value:s.value,options:[...s.options].map(o=>({value:o.value,label:o.textContent,disabled:o.disabled}))} : null;
  };
  let previous='',metadata=null,generation=-1,bridgeSeen=false;
  const expanded=new Map();
  const icons={workspaces:'▦',projects:'▣',assessments:'◔','granted-assessments':'◔',surveys:'▤'};
  function render(){
    const facilitator=document.getElementById('facilitator');
    const active=!!facilitator&&!facilitator.closest('[hidden]')&&(!bridgeSeen||metadata?.active===true);
    if(!active){expanded.clear();if(metadata)metadata={generation,active:false};}
    const roots=groupContext(projectContext({active,projects:read('projects'),assessments:read('assessments'),surveys:read('surveys'),granted:read('granted-assessments')}),active?metadata:null);
    const busy=!!document.getElementById('load-projects')?.disabled;
    const key=JSON.stringify({roots,busy,expanded:[...expanded]});if(key===previous)return;previous=key;
    const focused=document.activeElement?.dataset?.contextKey;
    const list=document.createElement('ul');list.className='context-branches';
    const current=node=>node.selected||node.children.some(current);
    const add=(nodes,parent,ancestors={})=>nodes.forEach(node=>{
      const id=node.source+':'+node.value,li=document.createElement('li'),row=document.createElement('div'),button=document.createElement('button');
      const selected=node.selected&&!node.children.some(current);
      li.className='tree-node'+(current(node)?' cur':'');row.className='tree-row context-row'+(selected?' on':'');
      const open=expanded.has(id)?expanded.get(id):current(node);
      if(node.children.length){
        const caret=document.createElement('button');caret.type='button';caret.className='tree-caret';caret.disabled=busy;caret.textContent=open?'▾':'▸';caret.dataset.contextKey=id+':caret';
        caret.setAttribute('aria-label',(open?'Collapse ':'Expand ')+node.label);caret.setAttribute('aria-expanded',String(open));
        caret.addEventListener('click',()=>{expanded.set(id,!open);previous='';render();});row.append(caret);
      }else{const spacer=document.createElement('span');spacer.className='tree-caret none';spacer.setAttribute('aria-hidden','true');row.append(spacer);}
      button.type='button';button.disabled=busy;button.className='context-nav';button.dataset.contextKey=id;
      if(selected)button.setAttribute('aria-current','page');
      const icon=document.createElement('span');icon.className='tree-ico';icon.textContent=icons[node.source];icon.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.className='tree-label';label.textContent=node.label;button.append(icon,label);
      if(node.role){const badge=document.createElement('span');badge.className='tree-role';badge.textContent=node.role;badge.title='Your role at this scope';button.append(badge);}
      button.addEventListener('click',()=>{
        if(node.source==='workspaces'){
          if(!busy&&metadata?.active&&metadata.workspaces?.some(w=>w.id===node.value))host.dispatchEvent(new document.defaultView.CustomEvent('context-workspace-select',{detail:{id:node.value,generation},bubbles:true}));
        }else if(selectContext(document,node.source,node.value,ancestors))render();
      });
      row.append(button);li.append(row);
      if(node.children.length){const kids=document.createElement('ul');kids.className='context-branches tree-kids';kids.hidden=!open;add(node.children,kids,node.source==='workspaces'?ancestors:{...ancestors,[node.source]:node.value});li.append(kids);}
      parent.append(li);
    });
    if(roots.length)add(roots,list);
    else {const note=document.createElement('li');note.className='tree-empty';note.textContent='Your available projects and assessments appear here after sign in.';list.append(note);}
    host.replaceChildren(list);
    if(focused) for(const button of host.querySelectorAll('button'))if(button.dataset.contextKey===focused){button.focus();break;}
  }
  const receive=event=>{
    const next=event.detail;
    if(!next||!Number.isInteger(next.generation)||next.generation<generation)return;
    if(next.generation!==generation)expanded.clear();
    generation=next.generation;bridgeSeen=true;metadata=next.active?next:{generation,active:false};previous='';render();
  };
  host.addEventListener('context-tree-data',receive);
  const observer=new document.defaultView.MutationObserver(render);
  for(const id of [...ids,'project-card','assessment-card','survey-card','shared-assessments','facilitator','load-projects','identity','project-detail','assessment-detail']){
    const node=document.getElementById(id);if(node)observer.observe(node,{attributes:true,childList:true,subtree:true,characterData:true});
  }
  for(const id of ids)document.getElementById(id)?.addEventListener('change',render);
  render();
  return ()=>{observer.disconnect();host.removeEventListener('context-tree-data',receive);for(const id of ids)document.getElementById(id)?.removeEventListener('change',render);};
}
if(typeof document!=='undefined')mountContextTree(document);
