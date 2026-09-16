// Provisional project-language controls. All mutations and reads use the /v2
// envelope supplied by app.js; no browser-side language registry is kept.
export function initLanguageControls({ api, run, getProject }) {
  const form = document.getElementById('create-language');
  const refreshButton = document.getElementById('load-languages');
  const select = document.getElementById('languages');
  const status = document.getElementById('language-status');

  async function refresh(preferredId = null) {
    const pid = getProject();
    const previousId = preferredId || select.value;
    select.replaceChildren(new Option('Choose language', ''));
    if (!pid) {
      status.textContent = 'Choose a project to list its languages.';
      return [];
    }
    const result = await api(`/v2/projects/${encodeURIComponent(pid)}/languages`);
    const active = (result.languages || []).filter(language => !language.archived_at);
    for (const language of active) select.add(new Option(
      `${language.name}${language.code ? ` · ${language.code}` : ''}`,
      language.id,
    ));
    if (active.some(language => language.id === previousId)) select.value = previousId;
    status.textContent = `${active.length} active project language${active.length === 1 ? '' : 's'}; ${(result.languages || []).length - active.length} archived.`;
    return active;
  }

  refreshButton.addEventListener('click', () => run('Loading project languages…', () => refresh()));
  form.addEventListener('submit', event => {
    event.preventDefault();
    run('Creating project language…', async () => {
      const pid = getProject();
      if (!pid) throw new Error('Choose a project first.');
      const values = new FormData(form);
      const name = String(values.get('name') || '').trim();
      const code = String(values.get('code') || '').trim();
      if (!name) throw new Error('Language name is required.');
      const result = await api(`/v2/projects/${encodeURIComponent(pid)}/languages`, {
        method: 'POST', body: { name, ...(code ? { code } : {}) },
      });
      await refresh(result.language.id);
      form.reset();
    });
  });
  return { refresh };
}
