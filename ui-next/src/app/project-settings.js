// Existing project metadata only. No review creation or language mutation.
import { api, enc } from "./api.js";

export async function loadProjectSettings(id, request = api) {
  const { project, languages } = await request(`/v2/projects/${enc(id)}`);
  if (!project || project.id !== id) throw new Error("The requested project could not be read.");
  return { ...project, languages: languages ?? [] };
}

export async function saveProjectSettings(project, fields, request = api) {
  if (project.role !== "owner") throw new Error("Only a project owner can change these settings.");
  const name = String(fields.name ?? "").trim();
  const organization = String(fields.organization ?? "").trim() || null;
  if (!name) throw new Error("Enter a project name.");
  await request(`/v2/projects/${enc(project.id)}`, { method: "PATCH", body: { name, organization } });
  // A successful write response alone does not prove the persisted settings.
  const saved = await loadProjectSettings(project.id, request);
  if (saved.name !== name || (saved.organization || null) !== organization) {
    throw new Error("The saved settings could not be verified. Reload the project before trying again.");
  }
  return saved;
}
