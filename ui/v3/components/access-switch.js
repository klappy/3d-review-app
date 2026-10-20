const switches = new WeakMap();
// The server supplies both eligibility and the effective mode; a preference never grants authority.
export function mountAccessSwitch({ app, principal, demo = false, document = globalThis.document, onSwitch }) {
  const previous = app && switches.get(app);
  if (demo || !principal?.super_admin || !app) {
    previous?.remove(); document.getElementById('access-scope')?.remove();
    if (app) switches.delete(app);
    return null;
  }
  if (previous && previous.dataset.principal === String(principal.id ?? '') && previous.dataset.mode === principal.access_mode) {
    if (!previous.isConnected || previous.nextElementSibling !== app) app.before(previous);
    return previous;
  }
  previous?.remove();
  document.getElementById('access-scope')?.remove();
  const global = principal.access_mode === 'global';
  const box = document.createElement('section');
  box.dataset.principal = String(principal.id ?? ''); box.dataset.mode = principal.access_mode;
  switches.set(app,box);
  box.id = 'access-scope'; box.className = 'access-scope panel';
  box.setAttribute('aria-label', 'Super admin access');
  box.innerHTML = `<div role="group" aria-label="Access mode"><button type="button" data-access="my" aria-pressed="${!global}">My Access</button><button type="button" data-access="global" aria-pressed="${global}">Global Access</button></div><p>${global ? 'Global Access · Browse every workspace and project.' : 'My Access · Your workspaces and projects.'}</p><a href="#workspaces">${global ? 'All workspaces' : 'My workspaces'}</a> · <a href="#projects">${global ? 'All projects' : 'My projects'}</a>`;
  app.before(box);
  for (const button of box.querySelectorAll('[data-access]')) button.addEventListener('click', () => {
    if (button.dataset.access === principal.access_mode) return;
    for (const b of box.querySelectorAll('button')) b.disabled = true;
    onSwitch(button.dataset.access);
  });
  return box;
}
