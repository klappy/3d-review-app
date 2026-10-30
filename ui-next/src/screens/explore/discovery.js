// Client-only cross-sections of the already-authorized list. No extra grants or API reads.
export const projectKey = (r) => r.projectId || r.project_id || r.project || "";
export function projectOptions(projects = [], reviews = []) {
  const found = new Map();
  for (const p of projects) if (p.id && !p.archived_at) found.set(p.id, { id: p.id, name: p.name, href: p.href || `#/project/${encodeURIComponent(p.id)}` });
  for (const r of reviews) { const id = projectKey(r); if (id && !found.has(id)) found.set(id, { id, name: r.project, href: r.projectHref || (r.projectId ? `#/project/${encodeURIComponent(r.projectId)}` : null) }); }
  return [...found.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id));
}
export function selectReviews(reviews, { search = "", project = "", stage = "", sort = "updated" } = {}) {
  const q = search.trim().toLocaleLowerCase();
  return reviews.filter(r => (!project || projectKey(r) === project) && (!stage || r.stage === stage) && (!q || [r.title, r.project, r.language, r.region, r.orgs].some(v => String(v || "").toLocaleLowerCase().includes(q)))).slice().sort((a, b) => {
    if (sort === "updated") { const delta = (Date.parse(b.updatedAt || b.updated_at || "") || 0) - (Date.parse(a.updatedAt || a.updated_at || "") || 0); if (delta) return delta; }
    return String(a.title).localeCompare(String(b.title)) || String(a.id || "").localeCompare(String(b.id || ""));
  });
}
export function reviewCsv(rows) {
  const cell = v => '"' + String(v ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  return [["Review", "Project", "Language", "Stage", "Updated"], ...rows.map(r => [r.title, r.project, r.language, r.stage, r.updatedAt || r.updated])].map(r => r.map(cell).join(",")).join("\r\n");
}
