import {VERSIONS} from './versions-data.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=(label,xs)=>xs.length?`<p class="small"><strong>${label}</strong></p><ul class="small">${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
export function renderVersions(d=VERSIONS){
 const shipped=d.shipped.map(v=>`<details class="history" data-detail="v${esc(v.version)}"><summary>v${esc(v.version)}${v.version===d.current?' · current':''}</summary>${list('Added',v.added)}${list('Changed',v.changed)}${list('Fixed',v.fixed)}</details>`).join('');
 return `<h2>Version history <span>current v${esc(d.current)}</span></h2><p class="muted">Release notes and changes, separate from the work roadmap.</p><div class="work-card"><h3>Changelog</h3>${shipped||'<p class="muted">No version history is currently available.</p>'}</div>`;
}
if(typeof document!=='undefined'){const el=document.querySelector('#versions');if(el)el.innerHTML=renderVersions();}
