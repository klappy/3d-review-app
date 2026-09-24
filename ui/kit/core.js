import { breadcrumbs } from '../v3/components/breadcrumbs.js';
// Presentation adapted from cookbook c653482 core/tree. No fixture authority or transport.
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Only app-local hash routes. Controllers supply routes; labels never become destinations.
export const safeHref = value => typeof value === 'string' && /^#[A-Za-z0-9_/%?=&.-]*$/.test(value) ? value : null;
export const badge = role => role ? '<span class="tree-role">'+esc(role)+'</span>' : '';
export function link(item, current = false) {
  const href = safeHref(item.href);
  return href ? '<a href="'+esc(href)+'" data-navigate="'+esc(href)+'"'+(current?' aria-current="page"':'')+'>'+esc(item.label)+'</a>' : '<span>'+esc(item.label)+'</span>';
}
// [data-header-host] is an empty, caller-owned slot for real app controls (account, version); tree.js keeps the same element across paints.
// P0 12:32: the crumb row is the shared Breadcrumbs component (Home › Workspace › Project › Assessment › Page); ancestors carry their level.
export function crumbRow(ancestors, role) {
  const scope = {};
  for (const x of ancestors) if (['workspace','project','assessment','page'].includes(x.level)) scope[x.level] = { label: x.label, href: x.href };
  return breadcrumbs(scope).replace(/<\/nav>$/, badge(role) + '</nav>');
}
export function chrome(model) {
  const ancestors = (model.ancestors || []).filter(x => x.visible === true && safeHref(x.href));
  return '<header class="top"><a class="brand" href="#" data-navigate="#"><span>3D</span>Review</a>'+crumbRow(ancestors, model.role)+'<div class="right">'+(model.sample?'<span class="badge demo">SAMPLE DATA · SIMULATED</span>':'')+(model.identityLabel?'<span class="me">'+esc(model.identityLabel)+(model.role?' · '+esc(model.role):'')+'</span>':'')+'<span class="header-host" data-header-host></span></div></header>';
}
export function levelMenu(model) {
  const actions = (model.actions || []).filter(x => x.allowed === true && typeof x.id === 'string');
  return actions.length ? '<div class="level-menu"><button type="button" data-menu-toggle aria-expanded="false" aria-controls="kit-level-actions">'+esc(model.menuLabel || 'Actions')+' ▾</button><div id="kit-level-actions" class="glass" data-menu hidden>'+actions.map((x,i)=>'<button type="button" data-action="'+i+'">'+esc(x.label)+'</button>').join('')+'</div></div>' : '';
}

