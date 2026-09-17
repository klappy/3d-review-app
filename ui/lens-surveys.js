// Assessment = three lenses; within each lens the facilitator chooses which surveys are included.
// Source: cookbook 2c29676 views-coordinator V._collect (survey cards per perspective + "Add a survey" template list),
// regrouped by lens per the captain's ruling (Translation Team · Church · Community). Real data only: the lens of a
// survey or template is the server's `perspective`; inclusion is the existing cap.survey.select / cap.survey.deselect;
// "Open" selects the survey through the existing #surveys control. No scoring, no content, no new backend.
export const LENSES = ['Translation Team', 'Church', 'Community'];

export function groupByLens({ surveys = [], templates = [] }) {
  const included = surveys.filter(s => s.state === 'selected' && !s.archived_at);
  const groups = LENSES.map(lens => ({ lens, included: [], available: [] }));
  const other = { lens: 'Other perspective', included: [], available: [] };
  const groupFor = p => groups.find(g => g.lens === p) || other;
  for (const s of included) groupFor(s.perspective).included.push(s);
  // Only the current (highest published) version of each template is offered; a template already included is not offered twice.
  const latest = new Map();
  for (const t of templates) { const cur = latest.get(t.id); if (!cur || t.version > cur.version) latest.set(t.id, t); }
  for (const t of latest.values()) { if (!included.some(s => s.template_id === t.id)) groupFor(t.perspective).available.push(t); }
  return other.included.length || other.available.length ? [...groups, other] : groups;
}

export function mountLensSurveys({ document: doc, root, actions }) {
  let snapshot = null, busy = false, message = '', counts = new Map(), gen = 0;
  const el = (tag, text, cls) => { const n = doc.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const button = (label, fn, cls = 'quiet') => { const b = el('button', label, cls); b.type = 'button'; b.disabled = busy; b.addEventListener('click', () => guard(fn)); return b; };
  async function guard(fn) { if (busy) return; busy = true; message = ''; render(); try { await fn(); } catch (e) { message = String(e?.message || 'Action needs attention. No completion is assumed.'); } finally { busy = false; render(); } }
  function render() {
    root.replaceChildren(); root.classList.add('lens-surveys');
    if (!snapshot) { root.hidden = true; return; }
    root.hidden = false;
    const { role, stage } = snapshot; const mayEdit = role === 'owner' || role === 'member';
    root.append(el('h3', 'Surveys by lens'), el('p', `Three lenses. Within each, choose which surveys this assessment includes. Included surveys collect responses while the stage is Collect (current stage: ${stage}).`, 'note'));
    const wrap = el('div', undefined, 'three lens-groups');
    for (const g of groupByLens(snapshot)) {
      const card = el('section', undefined, 'glass panel lens-group'); card.setAttribute('aria-label', g.lens);
      card.append(el('h4', g.lens), el('p', `${g.included.length} included`, 'muted'));
      const list = el('ul', undefined, 'lens-included');
      for (const s of g.included) {
        const li = el('li'); const c = counts.get(s.id);
        li.append(el('strong', s.template_name), el('span', ` · v${s.template_version} · ${s.collection_status}${c ? ` · ${c.responses} response${c.responses === 1 ? '' : 's'}` : ''}`, 'muted'));
        const row = el('div', undefined, 'row');
        row.append(button('Open', () => actions.open(s.id)));
        if (mayEdit) row.append(button('Remove from assessment', () => actions.deselect(s.id)));
        li.append(row); list.append(li);
      }
      if (!g.included.length) list.append(el('li', 'No survey included for this lens yet.', 'muted'));
      card.append(list);
      if (mayEdit && g.available.length) {
        const add = el('div', undefined, 'lens-available'); add.append(el('p', 'Available to include', 'eyebrow'));
        for (const t of g.available) { const row = el('div', undefined, 'row'); row.append(el('span', `${t.name} · v${t.version}`), button('Include', () => actions.select(t.id, t.version))); add.append(row); }
        card.append(add);
      } else if (mayEdit && !snapshot.templates.length) card.append(el('p', 'Template catalogue not loaded, so nothing can be offered here yet. Use Refresh templates.', 'muted'));
      else if (mayEdit) card.append(el('p', 'Every current survey for this lens is included.', 'muted'));
      wrap.append(card);
    }
    root.append(wrap);
    const status = el('p', message, 'note lens-status'); status.setAttribute('role', message ? 'alert' : 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
  }
  return {
    // snapshot = { aid, role, stage, surveys, templates } from the existing assessment GET + template list; counts arrive later
    set(next) { gen++; snapshot = next; counts = new Map(); message = ''; render(); const g = gen; if (next && actions.counts) actions.counts(next.surveys.filter(s => s.state === 'selected' && !s.archived_at).map(s => s.id)).then(map => { if (g !== gen) return; counts = map || new Map(); render(); }).catch(() => {}); },
    reset() { gen++; snapshot = null; counts = new Map(); message = ''; render(); },
  };
}
