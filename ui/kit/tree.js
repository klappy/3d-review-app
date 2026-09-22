// ContextTree presentation: explicit visibility supplied by authoritative caller.
// Callback context is a snapshot; update/destroy invalidate every previous binding.
// K3a: the content region is a div[role=main] so the host page keeps one real <main> landmark (index.html wraps the kit root).
import { esc, safeHref, badge, chrome, levelMenu } from './core.js';
const icons = {workspace:'▦',project:'▣',assessment:'◔',survey:'▤'};
export function mountShell(root, initialModel, initialCallbacks = {}) {
  let model, callbacks, revision = 0, cleanup = () => {}, expanded = new Set(), query = '', filterQuery = '';
  function update(next, nextCallbacks = callbacks) {
    cleanup(); revision++; model = structuredClone(next); callbacks = nextCallbacks || {};
    expanded = new Set(model.expanded || []); query = ''; filterQuery = ''; paint(undefined, false);
  }
  function paint(focusKey, preserveContent = true) {
    cleanup();
    // Caller-owned elements survive every paint: the content mount (cleared on model update) and the header host (never cleared here).
    const content = root.querySelector('[data-content]'), host = root.querySelector('[data-header-host]');
    if (!preserveContent) content?.replaceChildren();
    const generation = revision, context = Object.freeze({...model.context});
    const current = () => revision === generation && root.isConnected;
    const actions = (model.actions || []).filter(x=>x.allowed === true && typeof x.id === 'string');
    const visible = nodes => (nodes || []).filter(n=>n.visible === true);
    function node(n, depth) {
      const kids = visible(n.children), open = expanded.has(n.id);
      const href = safeHref(n.href), selected = href && href === model.currentHref;
      return '<div class="tree-node"><div class="tree-row lvl-'+Math.min(depth,4)+(selected?' on':'')+'">'+(kids.length?'<button type="button" class="tree-caret" data-expand="'+esc(n.id)+'" aria-label="'+(open?'Collapse ':'Expand ')+esc(n.label)+'" aria-expanded="'+open+'">'+(open?'▾':'▸')+'</button>':'<span class="tree-caret none"></span>')+'<span class="tree-ico" aria-hidden="true">'+(icons[n.kind]||'◦')+'</span>'+(href?'<a class="tree-label" href="'+esc(href)+'" data-navigate="'+esc(href)+'"'+(selected?' aria-current="page"':'')+'>':'<span class="tree-label">')+esc(n.label)+(n.detail?'<small>'+esc(n.detail)+'</small>':'')+(href?'</a>':'</span>')+badge(n.role)+'</div>'+(open?'<div class="tree-kids">'+kids.map(k=>node(k,depth+1)).join('')+'</div>':'')+'</div>';
    }
    function matches(nodes) { return visible(nodes).flatMap(n => [ ...(n.label.toLowerCase().includes(filterQuery.toLowerCase()) ? [{...n,children:[]}] : []), ...matches(n.children)]); }
    const nodes = filterQuery ? matches(model.nodes) : visible(model.nodes);
    root.innerHTML = chrome(model)+'<div class="shell"><aside class="tree" aria-label="Context"><label class="tree-search"><span aria-hidden="true">⌕</span><input data-search aria-label="Find a workspace, project or assessment" placeholder="Find…" value="'+esc(query)+'"></label><nav class="tree-section" aria-label="Scopes"><div class="eyebrow">'+esc(model.sectionLabel || 'Workspaces')+'</div>'+nodes.map(n=>node(n,1)).join('')+'</nav><div class="tree-tools tree-footer"><span class="tree-me">'+esc(model.identityLabel)+(model.role?' · '+esc(model.role):'')+'</span></div></aside><div class="content" role="main" tabindex="-1"><div class="eyebrow">'+esc(model.eyebrow || '')+'</div><div class="row" style="justify-content:space-between"><h1>'+esc(model.title)+'</h1>'+levelMenu(model)+'</div><div data-content></div></div></div>';
    // Preserve the caller-owned mount root and its delegated listeners across local changes AND model updates (same element, emptied on update).
    if (content) root.querySelector('[data-content]').replaceWith(content);
    if (host) root.querySelector('[data-header-host]').replaceWith(host);
    // Caller can mount trusted DOM in this empty slot; no arbitrary model HTML is interpreted.
    const menu = root.querySelector('[data-menu]'), toggle = root.querySelector('[data-menu-toggle]');
    const close = (focus=false) => { if(menu){menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();} };
    const click = e => {
      if (!current()) return;
      const expand=e.target.closest('[data-expand]');
      if(expand){ const id=expand.dataset.expand;expanded.has(id)?expanded.delete(id):expanded.add(id);paint(id);return; }
      if(e.target.closest('[data-menu-toggle]')){ menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button')?.focus();return; }
      const action=e.target.closest('[data-action]');
      if(action){const selected=actions[Number(action.dataset.action)];close(true);if(selected)callbacks.onAction?.(selected.id,context);return;}
      const nav=e.target.closest('[data-navigate]');
      if(nav){e.preventDefault();close();callbacks.onNavigate?.(nav.dataset.navigate,context);}
    };
    const key = e => {
      if(!current())return;
      if(e.key==='Escape'&&menu&&!menu.hidden){e.preventDefault();close(true);}
      if(menu&&!menu.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        const buttons=[...menu.querySelectorAll('button')],i=buttons.indexOf(root.ownerDocument.activeElement);
        const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
        e.preventDefault();buttons[next]?.focus();
      }
    };
    const outside = e => {if(!root.contains(e.target)||!e.target.closest('.level-menu'))close();};
    const focusout = e => { if(menu&&!menu.hidden && e.relatedTarget && !e.relatedTarget.closest?.('.level-menu'))close(); };
    const search = root.querySelector('[data-search]');
    let composing = false, deferred = false;
    // A composition committed by leaving search must not replace the pressed row.
    // Keep its committed text; apply the filter when search is entered again.
    const pointerdown = e => { if(current() && composing && !search.closest('.tree-search').contains(e.target)) deferred = true; };
    const focusin = e => { if(current() && e.target === search && (deferred || query !== filterQuery)) { deferred = false; filterSearch(); } };
    const filterSearch = () => {
      if (!current() || !search.isConnected) return;
      query = search.value;
      if (deferred) return;
      filterQuery = query;
      // Filter only the owned tree list. Search, focus, and mounted content stay put.
      const filtered = filterQuery ? matches(model.nodes) : visible(model.nodes);
      root.querySelector('[aria-label="Scopes"]').innerHTML = '<div class="eyebrow">'+esc(model.sectionLabel || 'Workspaces')+'</div>'+filtered.map(n=>node(n,1)).join('');
    };
    const compositionstart = e => { if(current() && e.target === search) composing = true; };
    const compositionend = e => {
      if(!current() || e.target !== search) return;
      composing = false;
      if(root.ownerDocument.activeElement !== search) deferred = true;
      filterSearch();
    };
    const input = e => {
      if(!current() || e.target !== search || composing || e.isComposing) return;
      filterSearch();
    };
    root.ownerDocument.addEventListener('pointerdown',pointerdown,true);root.addEventListener('focusin',focusin);root.addEventListener('click',click);root.addEventListener('keydown',key);root.addEventListener('input',input);root.addEventListener('compositionstart',compositionstart);root.addEventListener('compositionend',compositionend);root.addEventListener('focusout',focusout);root.ownerDocument.addEventListener('click',outside);
    cleanup=()=>{root.ownerDocument.removeEventListener('pointerdown',pointerdown,true);root.removeEventListener('focusin',focusin);root.removeEventListener('click',click);root.removeEventListener('keydown',key);root.removeEventListener('input',input);root.removeEventListener('compositionstart',compositionstart);root.removeEventListener('compositionend',compositionend);root.removeEventListener('focusout',focusout);root.ownerDocument.removeEventListener('click',outside);};
    if(focusKey==='search')root.querySelector('[data-search]')?.focus();
    else if(focusKey)[...root.querySelectorAll('[data-expand]')].find(x=>x.dataset.expand===focusKey)?.focus();
  }
  update(initialModel,initialCallbacks);
  return {update, get content(){return root.querySelector('[data-content]');},get headerHost(){return root.querySelector('[data-header-host]');},destroy(){cleanup();revision++;root.querySelector('[data-content]')?.replaceChildren();root.replaceChildren();}};
}
