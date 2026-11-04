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

// Browser preferences only: never persist report rows, participant data, credentials or inferred grants.
export function viewPreferenceKey(viewKey, origin = globalThis.location?.origin) {
  return typeof viewKey === "string" && viewKey && typeof origin === "string" && origin
    ? `3d:explore-view:v1:${encodeURIComponent(origin)}:${encodeURIComponent(viewKey)}` : null;
}
export function validateView(value, projects = [], defaultView = "table") {
  const p = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    search: typeof p.search === "string" ? p.search.slice(0, 300) : "",
    project: typeof p.project === "string" && projects.some(x => x.id === p.project) ? p.project : "",
    stage: ["prepare", "collect", "understand", "improve"].includes(p.stage) ? p.stage : "",
    sort: p.sort === "title" ? "title" : "updated",
    view: ["table", "cards"].includes(p.view) ? p.view : defaultView,
    group: ["project", "stage", "language"].includes(p.group) ? p.group : "none",
  };
}
export function saveView(storage, key, value, projects) {
  if (!key || !storage) return false;
  try { storage.setItem(key, JSON.stringify(validateView(value, projects))); return true; } catch { return false; }
}
export function loadView(storage, key, projects, defaultView = "table") {
  if (!key || !storage) return null;
  try { const raw = storage.getItem(key); return raw ? validateView(JSON.parse(raw), projects, defaultView) : null; } catch { return null; }
}
export function deleteView(storage, key) {
  if (!key || !storage) return false;
  try { storage.removeItem(key); return true; } catch { return false; }
}
export function groupReviews(rows, group = "none") {
  if (!["project", "stage", "language"].includes(group)) return [{ id: "none", label: "", rows }];
  const stages = { prepare: "Setting up", collect: "Collecting", understand: "Results ready", improve: "Reviewed" };
  const groups = new Map();
  for (const r of rows) {
    const id = group === "project" ? projectKey(r) : String(r[group] || "");
    if (!groups.has(id)) groups.set(id, { id, label: group === "project" ? r.project || "No project" : group === "stage" ? stages[r.stage] || r.stage : r.language || "No language", rows: [] });
    groups.get(id).rows.push(r);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
