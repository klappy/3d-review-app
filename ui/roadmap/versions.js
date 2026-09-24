import {VERSIONS} from './versions-data.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=(label,xs)=>xs.length?`<p class="small"><strong>${label}</strong></p><ul class="small">${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
export function renderVersions(d=VERSIONS){
 const f=d.forecast;
 const next=f.version?`<article class="work-card"><h3>Next: v${esc(f.version)} <span class="small muted">forecast · ${esc(f.bump)}</span></h3><ul class="small">${f.units.map(u=>`<li>${esc(u.section)} — ${esc(u.text)} <span class="muted">(lane ${esc(u.lane)})</span></li>`).join('')}</ul><p class="small muted">Forecast from work waiting on integration; the version is set when the train leaves.</p></article>`:'<p class="muted">Nothing waiting for the next version.</p>';
 const shipped=d.shipped.map(v=>`<details class="history" data-detail="v${esc(v.version)}"><summary>v${esc(v.version)}${v.version===d.current?' · current':''}</summary>${list('Added',v.added)}${list('Changed',v.changed)}${list('Fixed',v.fixed)}</details>`).join('');
 return `<h2>Versions <span>current v${esc(d.current)}</span></h2>${next}<div class="work-card"><h3>Shipped</h3>${shipped}</div>`;
}
if(typeof document!=='undefined'){const el=document.querySelector('#versions');if(el)el.innerHTML=renderVersions();}
