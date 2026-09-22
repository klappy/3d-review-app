import {esc} from './core.js';
import {mountView,cards,fields} from './views-coordinator.js';
export const screens=['support','templates'];
// Only reviewed preview intents, never implied support powers or publish effects.
const ids=new Set(['navigation','support-preview','template-preview']);
export function mountAdminView(root,model,onIntent){return mountView(root,model,onIntent,screens,ids,(m,{actions,button})=>`<div class="glass panel">${fields(m)}<div class="row">${actions().map(a=>button(a)).join('')}</div></div>${m.screen==='templates'?`<div class="glass panel" style="overflow:auto"><table class="table"><thead><tr><th>Template</th><th>Version</th><th>Perspective</th><th>Questions</th></tr></thead><tbody>${(m.items||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.version)}</td><td>${esc(x.perspective)}</td><td>${esc(x.questions)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="grid">${cards(m.items)}</div>`}`);}
