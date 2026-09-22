// Presentation adapted from cookbook c653482 core/tree. No fixture authority or transport.
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Only app-local hash routes. Controllers supply routes; labels never become destinations.
export const safeHref = value => typeof value === 'string' && /^#[A-Za-z0-9_/%?=&.-]*$/.test(value) ? value : null;
export const badge = role => role ? '<span class="tree-role">'+esc(role)+'</span>' : '';
export function link(item, current = false) {
  const href = safeHref(item.href);
  return href ? '<a href="'+esc(href)+'" data-navigate="'+esc(href)+'"'+(current?' aria-current="page"':'')+'>'+esc(item.label)+'</a>' : '<span>'+esc(item.label)+'</span>';
}
export function chrome(model) {
  const ancestors = (model.ancestors || []).filter(x => x.visible === true && safeHref(x.href));
  return '<header class="top"><a class="brand" href="#" data-navigate="#"><span>3D</span>Review</a><nav class="crumbs" aria-label="Breadcrumb">'+ancestors.map(x=>link(x,x.href===model.currentHref)).join('<span class="sep" aria-hidden="true">›</span>')+badge(model.role)+'</nav><div class="right">'+(model.sample?'<span class="badge demo">SAMPLE DATA · SIMULATED</span>':'')+'<span class="me">'+esc(model.identityLabel)+' · '+esc(model.role)+'</span></div></header>';
}
export function levelMenu(model) {
  const actions = (model.actions || []).filter(x => x.allowed === true && typeof x.id === 'string');
  return actions.length ? '<div class="level-menu"><button type="button" data-menu-toggle aria-expanded="false" aria-controls="kit-level-actions">'+esc(model.menuLabel || 'Actions')+' ▾</button><div id="kit-level-actions" class="glass" data-menu hidden>'+actions.map((x,i)=>'<button type="button" data-action="'+i+'">'+esc(x.label)+'</button>').join('')+'</div></div>' : '';
}

