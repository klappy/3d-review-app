// Searchable native controls. The hidden select only serializes the form; visible
// search and buttons use ordinary keyboard Tab/Enter, not an ARIA combobox.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function languagePicker({name,label,options=[],selected=[],multiple=false,disabled=false,max=1,addValue=''}) {
  return `<div class="language-picker" data-picker data-max="${max}" data-add-value="${esc(addValue)}"><label>${esc(label)}<input type="search" data-picker-query aria-label="Search ${esc(label.toLowerCase())}" placeholder="Search by name or code" autocomplete="off"${disabled?' disabled':''}></label><select name="${esc(name)}" hidden tabindex="-1" aria-hidden="true"${multiple?' multiple':''}${disabled?' disabled':''}>${multiple?'':'<option value=""></option>'}${options.map(o=>`<option value="${esc(o.id)}" data-search="${esc([o.name,o.native,o.code].filter(Boolean).join(' '))}"${selected.includes(o.id)?' selected':''}>${esc(o.name)}${o.native&&o.native!==o.name?' · '+esc(o.native):''}${o.code?' · '+esc(o.code):''}</option>`).join('')}</select><div data-picker-selected class="picker-selected" aria-label="Selected languages"></div><div data-picker-status class="small muted" role="status"></div><div data-picker-results class="picker-results"></div>${addValue?`<button type="button" class="quiet" data-picker-add${disabled?' disabled':''}>Add language…</button>`:''}</div>`;
}
export function refreshPicker(box) {
  const select=box.querySelector('select'), input=box.querySelector('[data-picker-query]');
  const all=[...select.options].filter(o=>o.value), selected=all.filter(o=>o.selected);
  const query=input.value.trim().toLocaleLowerCase();
  const available=all.filter(o=>!o.selected&&o.value!==box.dataset.addValue);
  const matches=available.filter(o=>(o.dataset.search||o.textContent).toLocaleLowerCase().includes(query));
  const shown=query?matches.slice(0,6):[];
  const full=select.multiple&&selected.length>=Number(box.dataset.max);
  const add=box.querySelector('[data-picker-add]');if(add)add.hidden=select.value===box.dataset.addValue;
  box.querySelector('[data-picker-selected]').innerHTML=selected.map(o=>`<button type="button" class="picker-chip" data-picker-remove="${esc(o.value)}" aria-label="Remove ${esc(o.textContent)}"${select.disabled?' disabled':''}>${esc(o.textContent)} <span aria-hidden="true">×</span></button>`).join('');
  box.querySelector('[data-picker-status]').textContent=full?`Up to ${box.dataset.max} languages selected. Remove one to add another.`:query?(matches.length?`${matches.length} match${matches.length===1?'':'es'}${matches.length>6?'; showing first 6. Refine your search.':''}`:'No matching languages.'):(select.multiple?`${selected.length} of ${box.dataset.max} selected. Search to add a language.`:(selected.length?'Search to change the language.':'Search to choose a language.'));
  box.querySelector('[data-picker-results]').innerHTML=shown.map(o=>`<button type="button" class="quiet picker-result" data-picker-pick="${esc(o.value)}"${select.disabled||full?' disabled':''}>${esc(o.textContent)}</button>`).join('');
}
function refreshArchived(box) {
  const q=box.querySelector('[data-archive-query]').value.trim().toLocaleLowerCase();
  const matches=[...box.querySelectorAll('[data-wz=restore-language]')].filter(b=>b.dataset.search.toLocaleLowerCase().includes(q));
  box.querySelectorAll('[data-wz=restore-language]').forEach(b=>b.hidden=!matches.slice(0,6).includes(b));
  box.querySelector('[data-archive-status]').textContent=matches.length?`Restore a language to use it. ${matches.length>6?'Showing first 6 matches; refine your search.':''}`:'No matching archived languages.';
}
export function refreshPickers(root) { root.querySelectorAll('[data-picker]').forEach(refreshPicker); root.querySelectorAll('[data-archive-picker]').forEach(refreshArchived); }
export function bindLanguagePickers(root,{signal,canEdit=()=>true}={}) {
  root.addEventListener('input',e=>{if(e.target.matches('[data-archive-query]'))refreshArchived(e.target.closest('[data-archive-picker]'));if(e.target.matches('[data-picker-query]'))refreshPicker(e.target.closest('[data-picker]'));},{signal});
  root.addEventListener('keydown',e=>{if(e.target.matches('[data-picker-query],[data-archive-query]')&&e.key==='Enter')e.preventDefault();if(e.target.matches('[data-picker-query]')&&e.key==='Escape'){e.target.value='';refreshPicker(e.target.closest('[data-picker]'));}},{signal});
  root.addEventListener('click',e=>{
    const button=e.target.closest('[data-picker-pick],[data-picker-remove],[data-picker-add]');if(!button||!canEdit())return;
    const box=button.closest('[data-picker]'),select=box.querySelector('select'),input=box.querySelector('[data-picker-query]');if(select.disabled)return;
    const removing=button.hasAttribute('data-picker-remove');
    const value=removing?button.dataset.pickerRemove:button.hasAttribute('data-picker-add')?box.dataset.addValue:button.dataset.pickerPick;
    const option=[...select.options].find(o=>o.value===value);if(!option)return;
    if(!removing&&select.multiple&&select.selectedOptions.length>=Number(box.dataset.max))return;
    if(removing)option.selected=false;else if(select.multiple)option.selected=true;else select.value=value;
    if(!select.multiple&&removing)select.value='';
    input.value='';refreshPicker(box);
    const EventCtor=root.ownerDocument.defaultView.Event;
    select.dispatchEvent(new EventCtor('change',{bubbles:true}));
    select.dispatchEvent(new EventCtor('input',{bubbles:true}));
    const live=root.querySelector(`[data-picker] select[name="${select.name}"]`)?.closest('[data-picker]');
    if(!button.hasAttribute('data-picker-add'))live?.querySelector('[data-picker-query]')?.focus();
  },{signal});
}
