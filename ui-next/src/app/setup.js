// UI Next (v4) setup flow (steps 1-4) on the real stores. Status: provisional (playbook rule 12).
// The current design's wizard (ui/v3/wizard.js) is the authority for which endpoint does what and in which order; this module
// reuses those contracts exactly and nothing else: POST /v2/projects/:pid/assessments (create, step 1), PATCH /v2/assessments/:id
// (changed step-1 fields; purpose + lwc on step 2; demographics_enabled on step 4), GET/POST /v2/projects/:pid/languages and
// POST /v2/languages/:id/unarchive (the language picker), GET/POST/DELETE /v2/assessments/:aid/passages (step 2 attachments),
// POST /v2/assessments/:aid/surveys (select, with the optional group context — only at select time, as the server takes it) and
// DELETE /v2/assessments/:aid/surveys/:sid (deselect), GET /v2/templates (the catalogue step 3 draws). No new route, field or store.
// Save points follow the wizard: step 1 Continue creates or patches the review (B06); step 2 Continue patches purpose / lwc; step 3
// Continue removes surveys that were unticked; step 4 Continue selects the new surveys with their context, then writes the
// demographics switch. Expected counts stay browser-local (v3:expected, ruling (a)) exactly as the wizard keeps them.
// Plain JS, no Svelte import, so vitest can drive it with a mocked fetch. The view builders return the shapes the approved
// screens/setup/Setup1-4.svelte compositions already draw (ui-next/fixtures/setup/setup.json), so the design stays fixed.
import { api, apiFull, enc } from "./api.js";
import { reconcile, refused } from "../../../ui/v3/wizard.js";
import { packPeriod, parsePeriod, periodErrors, todayIso } from "../../../ui/v3/components/active-until.js";
import { LWC_LANGUAGES, MAX_LWC } from "../../../ui/v3/lwc.js";
export const MAX_LWC_COUNT = MAX_LWC;
import { groupFields, contextValues } from "../../../ui/v3/components/context-fields.js";
import { V3_EXPECTED_KEY, v3IsComplete } from "../../../ui/assess/v3-assessment.js";
import { slug } from "../screens/setup/draft.js";

export const LENS_OF = Object.freeze({ "Translation Team": "team", Community: "community", Church: "church" });
export const GROUP_NAME = Object.freeze({ team: "Translation team", community: "Community", church: "Church" });
// The current UI's who-lines (ui/assess/scope.js PERSPECTIVE_WHO; carried here as the fixture carries them, N6: never import scope.js).
export const WHO = Object.freeze({ team: "The people doing the translation work.", community: "People who speak the language.", church: "Pastors and church leaders in the language area." });
export const FORMATS = Object.freeze(["Written", "Audio", "Video or sign"]);
export const PHONE_FORMATS = Object.freeze(["Written", "Audio", "Video", "Sign"]);
// The community survey follows the translation format (Setup3 board: "They answer the Written survey, to match the translation format").
export const COMMUNITY_TEMPLATE = Object.freeze({ Written: "tpl_written", Audio: "tpl_audio", Video: "tpl_video_sign", Sign: "tpl_video_sign" });
const formatLabel = (f, phone) => (phone ? f : f === "Video" || f === "Sign" ? "Video or sign" : f);
export const formatValue = (label) => (label === "Video or sign" ? "Sign" : label);

// A held survey's group context as the server stores it (context_json; the demographics key is the assessment switch, not a field).
export function heldContext(s) { let c = {}; try { c = typeof s.context_json === "string" ? JSON.parse(s.context_json) : s.context ?? {}; } catch { c = {}; } const out = {}; for (const [k, v] of Object.entries(c || {})) if (k !== "demographics_enabled" && v != null && String(v).trim()) out[k] = String(v); return out; }
export function freshDraft(pid = "") {
  return { name: "", project: pid, language: "", languageQuery: "", location: "", facilitator: "", format: "Written", opens: todayIso(), closes: "", purpose: "", lwc: [], groups: {}, context: {}, demographics: false };
}

// One setup state per review (or "new") for the life of the tab: Next/Back between steps keeps what was typed; a reload re-reads.
const STATES = new Map();
export const forget = (key) => STATES.delete(key ?? "new");
export const forgetAll = () => STATES.clear();

const store = () => { try { return globalThis.localStorage; } catch { return null; } };
export function expectedOf(id, st = store()) { try { const n = Number(JSON.parse(st?.getItem(V3_EXPECTED_KEY) || "{}")[id]); return Number.isInteger(n) && n > 0 ? n : null; } catch { return null; } }
export function rememberExpected(pairs, st = store()) { if (!st) return; try { const cur = JSON.parse(st.getItem(V3_EXPECTED_KEY) || "{}"); for (const [id, n] of pairs) { if (n) cur[id] = n; else delete cur[id]; } st.setItem(V3_EXPECTED_KEY, JSON.stringify(cur)); } catch { /* best effort */ } }
export const expectedValue = (raw) => { const n = Number(String(raw ?? "").trim()); return Number.isInteger(n) && n > 0 ? n : null; };

// Latest published version per template id (wizard.js latestTemplates), sorted by perspective then name.
export function latestTemplates(templates = []) {
  const best = new Map();
  for (const t of templates) { const cur = best.get(t.id); if (!cur || Number(t.version) > Number(cur.version)) best.set(t.id, t); }
  return [...best.values()].sort((a, b) => String(a.perspective).localeCompare(String(b.perspective)) || String(a.name).localeCompare(String(b.name)));
}

export const languages = async (pid) => (await api(`/v2/projects/${enc(pid)}/languages`)).languages ?? [];
export const templates = async () => latestTemplates((await api("/v2/templates")).templates ?? []);
export const passages = async (aid) => { const r = await api(`/v2/assessments/${enc(aid)}/passages`); return { passages: r.passages ?? [], fileStorage: r.file_storage !== false }; };

// Open the setup state for a review (or a new one): the draft from the server row and the surveys it holds (wizard.js draftFromSaved),
// the catalogue the steps draw from. A state already open in this tab keeps its unsaved steps; the server facts are refreshed.
export async function openSetup(aid, { pid = "" } = {}) {
  const key = aid || "new";
  const prior = STATES.get(key);
  const [ps, ts] = await Promise.all([api("/v2/projects").then((r) => (r.projects ?? []).filter((p) => !p.archived_at && (p.role === "owner" || p.role === "member"))), templates()]);
  let st;
  if (aid) {
    const [{ assessment: a, surveys }, pz] = await Promise.all([api(`/v2/assessments/${enc(aid)}`), passages(aid).catch(() => ({ passages: [], fileStorage: true }))]);
    const live = surveys.filter((s) => !s.archived_at && (!s.state || s.state === "selected"));
    const p = parsePeriod(a.period) || { starts: "", until: "" };
    const d = { ...freshDraft(a.project_id), name: a.name || "", language: a.language_id || "", purpose: a.purpose || "", location: a.location || "", facilitator: a.facilitator || "", format: a.format || "Written", opens: p.starts || "", closes: p.until || "", lwc: Array.isArray(a.lwc) ? [...a.lwc] : [], demographics: a.demographics_enabled === true };
    const pre = [];
    for (const s of live) { if (d.groups[s.template_id]) continue; d.groups[s.template_id] = { checked: true, version: String(s.template_version), expected: expectedOf(s.id) ? String(expectedOf(s.id)) : "" }; pre.push({ id: s.id, context: heldContext(s), template: s.template_id, version: Number(s.template_version), name: s.template_name || s.template_id }); }
    if (!ps.some((x) => x.id === a.project_id)) ps.push({ id: a.project_id, name: "This project" });
    st = { key, aid, undo: prior?.undo?.aid === aid && !v3IsComplete(a) ? prior.undo : null, role: v3IsComplete(a) ? "viewer" : a.role ?? "viewer", stage: a.stage, draft: prior ? { ...d, ...prior.draft, project: a.project_id, groups: { ...d.groups, ...prior.draft.groups }, context: { ...prior.draft.context } } : d, snap: { ...snapOf(d), demographics_enabled: a.demographics_enabled === true }, pre, projects: ps, templates: ts, languages: [], passages: pz.passages, fileStorage: pz.fileStorage };
    // A survey the server no longer holds is unticked here too; one it gained stays ticked (another device selected it).
    for (const tid of Object.keys(st.draft.groups)) if (prior && prior.pre.some((x) => x.template === tid) && !pre.some((x) => x.template === tid)) delete st.draft.groups[tid];
  } else {
    st = prior ?? { key, aid: null, role: "owner", stage: "prepare", draft: freshDraft(pid && ps.some((p) => p.id === pid) ? pid : ps.length === 1 ? ps[0].id : ""), snap: null, pre: [], projects: ps, templates: ts, languages: [], passages: [], fileStorage: true };
    st.projects = ps; st.templates = ts;
    // Returning from Create project explicitly selects that authorized project without replacing the unsaved draft.
    if (pid && ps.some((p) => p.id === pid) && st.draft.project !== pid) {
      st.draft.project = pid; st.draft.language = ""; st.draft.languageQuery = ""; st.languages = [];
    }
  }
  if (st.draft.project) await loadLanguages(st);
  STATES.set(key, st);
  return st;
}
export async function loadLanguages(st) { st.languages = st.draft.project ? await languages(st.draft.project) : []; return st.languages; }

// What the saved row holds for step 1 (wizard.js detailsOf / detailsPatch): the PATCH sends only the changed fields.
const lwcText = (d) => (d.lwc || []).slice().sort().join(",") || null;
export function snapOf(d) { return { name: d.name.trim(), period: packPeriod(d.opens, d.closes) || null, format: d.format || null, location: (d.location || "").trim() || null, facilitator: (d.facilitator || "").trim() || null, language_id: d.language || null, purpose: (d.purpose || "").trim() || null, lwc: lwcText(d) }; }
export function detailsPatch(snap, d, keys = ["name", "period", "format", "location", "facilitator", "language_id"]) {
  const now = snapOf(d), out = {};
  for (const k of keys) if ((now[k] ?? null) !== (snap?.[k] ?? null) && !(k === "language_id" && !now[k])) out[k] = now[k];
  return Object.keys(out).length ? out : null;
}

// Step 1 rules (wizard.js validateStep "details"): name, project, language, and the period (Active until required, not past).
export function validateDetails(d, today = todayIso()) {
  const errs = [];
  if (!d.name.trim()) errs.push("Give the review a name.");
  if (!d.project) errs.push("Choose a project.");
  else if (!d.language) errs.push("Choose a language.");
  errs.push(...periodErrors(d.opens, d.closes, today));
  return errs;
}
// Step 1 Continue: the first save creates the review exactly as cap.assessment.create takes it (B06); later ones PATCH what changed.
export async function saveDetails(st) {
  if (st.role === "viewer") throw new Error("This review is read-only.");
  const d = st.draft;
  if (!st.aid) {
    const b = { name: d.name.trim(), language_id: d.language };
    const period = packPeriod(d.opens, d.closes); if (period) b.period = period;
    if (d.format) b.format = d.format;
    if ((d.location || "").trim()) b.location = d.location.trim();
    if ((d.facilitator || "").trim()) b.facilitator = d.facilitator.trim();
    // An uncertain earlier create (the response was lost) is read back first, exactly as the wizard does (reconcile, cap.assessment.create):
    // a matching review of ours created since that attempt is adopted; only when none exists is the POST sent again.
    let r = null;
    if (st.pendingCreate) { const found = await reconcile({ cap: "cap.assessment.create" }, { pid: d.project, lid: d.language || null, pending: { at: st.pendingCreate } }, { name: d.name }, api); if (found) r = found; }
    if (!r) { const at = Date.now(); st.pendingCreate = at; try { r = await api(`/v2/projects/${enc(d.project)}/assessments`, { method: "POST", body: b }); } catch (e) { if (refused(e)) st.pendingCreate = null; throw e; } } // only a definite 4xx refusal clears the pending mark; 5xx / lost response stay uncertain (wizard.js refused)
    st.pendingCreate = null;
    st.aid = r.assessment.id; st.role = "owner"; st.stage = r.assessment.stage ?? "prepare"; st.snap = { ...snapOf(d), purpose: null, lwc: null };
    STATES.delete("new"); st.key = st.aid; STATES.set(st.aid, st);
    return st.aid;
  }
  const body = detailsPatch(st.snap, d);
  if (body) {
    st.undo = null;
    const aid = st.aid, path = `/v2/assessments/${enc(aid)}`;
    const before = (await api(path)).assessment;
    if (before?.id !== aid || v3IsComplete(before) || !["owner", "member"].includes(before.role)) throw new Error("This review cannot be edited here. Reload its current state.");
    const fields = Object.keys(body);
    // The existing backend receipt restores these metadata fields as a group, even when this PATCH changed only one.
    // Guard the full receipt footprint so Undo cannot erase a later purpose/date/language edit from another step or device.
    const undoFields = [...new Set(["name", "purpose", "period", "language_id", "format", ...fields])];
    const prior = Object.freeze(Object.fromEntries(undoFields.map(k => [k, before[k] ?? null])));
    const envelope = await apiFull(path, { method: "PATCH", body });
    const saved = (await api(path)).assessment;
    if (st.aid !== aid || saved?.id !== aid || !fields.every(k => (saved[k] ?? null) === (body[k] ?? null))) throw new Error("The saved review details could not be verified. Reload before trying again.");
    st.snap = { ...st.snap, ...body };
    const receipt = envelope.receipt;
    if (envelope.capability === "cap.assessment.update" && receipt?.scope?.type === "assessment" && receipt.scope.id === aid && typeof receipt.actor === "string" && receipt.actor && !receipt.noop && receipt.inverse !== "none" && typeof receipt.undo_token === "string" && receipt.undo_token) {
      st.undo = Object.freeze({ aid, actor: receipt.actor, token: receipt.undo_token, prior, saved: Object.freeze(Object.fromEntries(undoFields.map(k => [k, saved[k] ?? null]))), fields: Object.freeze(undoFields) });
    }
  }
  return st.aid;
}
// The receipt is one-use and retained only in this tab's matching setup state. No inverse PATCH is synthesized.
export async function undoDetails(st) {
  const undo = st.undo;
  if (!undo || undo.aid !== st.aid) throw new Error("There is no undo receipt for this review.");
  st.undo = null; // Consume locally before any await; uncertain writes and double clicks cannot replay it.
  const me = await api("/v2/me");
  if (me?.principal?.id !== undo.actor) throw new Error("This undo belongs to another signed-in account.");
  const path = `/v2/assessments/${enc(undo.aid)}`;
  const before = (await api(path)).assessment;
  if (st.aid !== undo.aid || before?.id !== undo.aid || v3IsComplete(before) || !["owner", "member"].includes(before.role) || !undo.fields.every(k => (before[k] ?? null) === (undo.saved[k] ?? null))) throw new Error("The review changed after this save. Reload before changing it again.");
  const result = await api(`/v2/undo/${enc(undo.token)}`, { method: "POST" });
  if (result.undone !== "cap.assessment.update") throw new Error("The undo could not be confirmed. Reload before trying again.");
  const restored = (await api(path)).assessment;
  if (st.aid !== undo.aid || restored?.id !== undo.aid || !undo.fields.every(k => (restored[k] ?? null) === (undo.prior[k] ?? null))) throw new Error("The restored review details could not be verified. Reload before trying again.");
  // Discard stale drafts so the caller's next openSetup reads the restored metadata.
  STATES.delete(undo.aid);
  return restored;
}
// Step 2 Continue: the passage name rides `purpose` and the answer languages `lwc` (the Prepare form's PATCH shape).
export async function savePassage(st) {
  const d = st.draft, body = {};
  const now = snapOf(d);
  if ((now.purpose ?? null) !== (st.snap?.purpose ?? null)) body.purpose = now.purpose ?? "";
  if ((now.lwc ?? null) !== (st.snap?.lwc ?? null)) body.lwc = now.lwc;
  if (Object.keys(body).length) { await api(`/v2/assessments/${enc(st.aid)}`, { method: "PATCH", body }); st.snap = { ...st.snap, purpose: now.purpose, lwc: now.lwc }; }
}
// Passages (src/passages.ts): JSON {url,title?,reference?} adds a link; a file is the raw body with ?name=; DELETE removes.
export async function addPassage(st, { url = "", title = "", reference = "" } = {}) {
  if (st.role === "viewer") throw new Error("This review is read-only.");
  if (!st.aid) throw new Error("Save the review before adding a passage.");
  const body = {};
  if (String(url).trim()) body.url = String(url).trim();
  if (String(title).trim()) body.title = String(title).trim();
  if (String(reference).trim()) body.reference = String(reference).trim();
  if (!body.url && !body.reference) throw new Error("Name a passage reference or give a https:// link.");
  await api(`/v2/assessments/${enc(st.aid)}/passages`, { method: "POST", body });
  st.passages = (await passages(st.aid)).passages;
}
export const addPassageLink = (st, url, title = "", reference = "") => addPassage(st, { url, title, reference });
export async function addPassageFile(st, file, fetchImpl = globalThis.fetch) {
  const headers = { accept: "application/json", "content-type": file.type || "application/octet-stream" };
  let t = null; try { t = sessionStorage.getItem("facilitatorToken"); } catch { /* none */ }
  if (t) headers.authorization = `Bearer ${t}`;
  let r; try { r = await fetchImpl(`/v2/assessments/${enc(st.aid)}/passages?name=${enc(file.name)}`, { method: "POST", headers, body: file, credentials: "same-origin" }); } catch { throw new Error("Could not reach the server. Check the connection and try again."); }
  let j = null; try { j = await r.json(); } catch { /* unreadable */ }
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `Upload failed (${r.status})`);
  st.passages = (await passages(st.aid)).passages;
}
export async function removePassage(st, id) { await api(`/v2/assessments/${enc(st.aid)}/passages/${enc(id)}`, { method: "DELETE" }); st.passages = st.passages.filter((p) => p.id !== id); }

// Languages (step 1): the project's, searched by name or code; an archived one is restored on pick; a new one is created by name.
export const matchLanguages = (list, q) => { const s = String(q ?? "").trim().toLowerCase(); return s ? list.filter((l) => String(l.name).toLowerCase().includes(s) || String(l.code ?? "").toLowerCase().includes(s)) : []; };
export async function pickLanguage(st, id) {
  const l = st.languages.find((x) => x.id === id); if (!l) return;
  if (l.archived_at) { const r = await api(`/v2/languages/${enc(id)}/unarchive`, { method: "POST", body: {} }); st.languages = st.languages.map((x) => (x.id === id ? r.language : x)); }
  st.draft.language = id; st.draft.languageQuery = "";
}
export async function addLanguage(st, name, code = "") {
  const n = String(name ?? "").trim(); if (!n) throw new Error("Type the language's name in the search box, then Add language.");
  const body = code.trim() ? { name: n, code: code.trim().toLowerCase() } : { name: n };
  const r = await api(`/v2/projects/${enc(st.draft.project)}/languages`, { method: "POST", body });
  st.languages = [...st.languages, r.language]; st.draft.language = r.language.id; st.draft.languageQuery = "";
}

// Step 3: the catalogue as the board's three groups (team and church with their templates as roles; community as one survey chosen
// by the translation format), ticks and counts from the draft.
export function groupsOf(st, phone = false) {
  const ts = st.templates, d = st.draft;
  const byLens = (lens) => ts.filter((t) => LENS_OF[t.perspective] === lens);
  const role = (t) => { const g = d.groups[t.id]; return { tid: t.id, version: String(t.version), name: t.name, note: "own survey", checked: g?.checked === true, expected: g?.expected ? Number(g.expected) : undefined, pre: st.pre.some((x) => x.template === t.id) }; };
  const roles = (lens) => byLens(lens).map(role);
  const community = byLens("community");
  const ctid = COMMUNITY_TEMPLATE[d.format] ?? community[0]?.id;
  const ct = community.find((t) => t.id === ctid) ?? community[0];
  const cg = ct ? d.groups[ct.id] : null;
  const out = [];
  const team = roles("team");
  if (team.length) out.push({ lens: "team", perspective: "Translation Team", name: GROUP_NAME.team, who: WHO.team, checked: team.some((r) => r.checked), phoneNote: team.map((r) => r.name).join(" · "), rolesLabel: "Who from the team? · how many of each", roles: team });
  if (ct) out.push({ lens: "community", perspective: "Community", name: GROUP_NAME.community, who: WHO.community, checked: cg?.checked === true, phoneNote: `${ct.name} survey`, expected: cg?.expected ? Number(cg.expected) : 0, format: ct.name, tid: ct.id, version: String(ct.version), pre: st.pre.some((x) => x.template === ct.id) });
  const church = roles("church");
  if (church.length) out.push({ lens: "church", perspective: "Church", name: GROUP_NAME.church, who: WHO.church, checked: church.some((r) => r.checked), phoneNote: church.filter((r) => r.checked).map((r) => r.name).join(" · ") || "Choose roles next", rolesLabel: "Who from the church? · how many of each", roles: church });
  void phone;
  return out;
}
export const chosenTids = (d) => Object.entries(d.groups).filter(([, g]) => g.checked).map(([tid]) => tid);
export function setGroup(st, tid, version, checked) { const g = st.draft.groups[tid] ?? { version, expected: "" }; st.draft.groups[tid] = { ...g, version, checked }; }
export function setExpected(st, tid, raw) { const g = st.draft.groups[tid]; if (g) g.expected = String(raw ?? "").trim(); }
export function setContext(st, tid, field, value) { const c = { ...(st.draft.context[tid] ?? {}) }; const v = String(value ?? "").trim(); if (v) c[field] = v; else delete c[field]; st.draft.context[tid] = c; }
export const validateGroups = (d) => (chosenTids(d).length ? [] : ["Choose at least one group."]);
// Step 3 Continue: a survey the review held and was unticked is removed now (cap.survey.deselect); new ticks wait for step 4.
export async function saveGroups(st, { confirmRemoval } = {}) {
  if (st.role === "viewer") throw new Error("This review is read-only.");
  const removing = st.pre.filter((x) => !st.draft.groups[x.template]?.checked);
  // Launched-survey removal may close collection and archive responses/codes/invitations. Require an explicit preview/cancel.
  if (st.stage !== "prepare" && removing.length) {
    if (!confirmRemoval) throw new Error("Confirm which surveys will be removed before changing a launched review.");
    if (!(await confirmRemoval(removing))) return { saved: false, cancelled: true };
  }
  for (const x of [...st.pre]) {
    if (st.draft.groups[x.template]?.checked) continue;
    await api(`/v2/assessments/${enc(st.aid)}/surveys/${enc(x.id)}`, { method: "DELETE" });
    st.pre = st.pre.filter((y) => y.id !== x.id); delete st.draft.groups[x.template]; delete st.draft.context[x.template];
  }
  return { saved: true };
}
// Step 4 Continue: each new survey is selected with its context (sent only when something was entered, as the wizard does), the
// expected counts are kept on this browser per survey id, then the demographics switch is written as the Prepare form writes it.
export async function saveContext(st) {
  if (st.role === "viewer") throw new Error("This review is read-only.");
  const d = st.draft, remembered = [];
  for (const tid of chosenTids(d)) {
    if (st.pre.some((x) => x.template === tid)) { const s = st.pre.find((x) => x.template === tid); remembered.push([s.id, expectedValue(d.groups[tid].expected)]); continue; }
    const t = st.templates.find((x) => x.id === tid);
    const context = contextValues(groupFields(t?.perspective), (k) => d.context[tid]?.[k]);
    const body = { template_id: tid, version: Number(d.groups[tid].version) };
    if (Object.keys(context).length) body.context = context;
    const r = await api(`/v2/assessments/${enc(st.aid)}/surveys`, { method: "POST", body });
    st.pre.push({ id: r.survey.id, template: tid, version: Number(r.survey.template_version), name: t?.name ?? tid });
    remembered.push([r.survey.id, expectedValue(d.groups[tid].expected)]);
    delete d.context[tid];
  }
  rememberExpected(remembered);
  if (d.demographics === true || st.snap?.demographics_enabled !== undefined) await api(`/v2/assessments/${enc(st.aid)}`, { method: "PATCH", body: { demographics_enabled: d.demographics === true } });
  st.snap = { ...st.snap, demographics_enabled: d.demographics === true };
}

// ---------- views: the fixture shapes screens/setup/Setup1-4.svelte draw ----------
export function detailsView(st, phone = false) {
  const d = st.draft, names = st.projects.map((p) => p.name);
  const lang = st.languages.find((l) => l.id === d.language);
  const matches = matchLanguages(st.languages.filter((l) => l.id !== d.language), d.languageQuery).map((l) => ({ id: l.id, name: l.archived_at ? `${l.name} (archived)` : l.name, code: l.code || "—" }));
  return { name: d.name, projects: names, project: st.projects.find((p) => p.id === d.project)?.name ?? "", phoneProject: st.projects.find((p) => p.id === d.project)?.name ?? "", languageQuery: d.languageQuery, language: lang ? { name: lang.name, code: lang.code || "—" } : null, matches, location: d.location, facilitator: d.facilitator, formats: [...FORMATS], phoneFormats: [...PHONE_FORMATS], format: formatLabel(d.format, phone), opens: d.opens, closes: d.closes, saved: !!st.aid };
}
const size = (n) => (n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export function passageView(st) {
  const d = st.draft;
  const shown = st.passages.filter((p) => !p.archived_at);
  const files = shown.map((p) => ({ id: p.id, kind: p.kind, reference: p.reference || "", name: p.title || p.filename || p.reference || p.url || "Attachment", note: p.kind === "reference" ? "Passage reference" : p.media === "text" ? (p.pdf_key || p.pdf ? "Typeset · PDF" : "Text file") : p.media === "link" || p.media === "video" ? "Link" : (p.media || "").toUpperCase(), shows: p.kind === "reference" ? p.reference : [p.reference, p.kind === "link" ? p.url : `Participants open ${p.title || p.filename} from the survey.`].filter(Boolean).join(" · "), size: size(p.size), href: p.kind === "reference" ? "" : p.href || p.url || "" }));
  const chips = d.lwc.map((code) => { const l = LWC_LANGUAGES.find((x) => x.code === code); return [l ? `${l.name} · ${l.code}` : code, l?.name ?? code, code]; });
  return { name: d.purpose, files, languages: [["English", "English", ""], ...chips], signNote: d.lwc.some((c) => LWC_LANGUAGES.find((x) => x.code === c)?.mt === false) ? "A sign language has no written survey — add an interpreter note in the next step instead." : "", fileStorage: st.fileStorage, max: MAX_LWC };
}
export const lwcMatch = (q) => { const s = String(q ?? "").trim().toLowerCase(); return s ? LWC_LANGUAGES.find((l) => l.code.toLowerCase() === s || l.name.toLowerCase() === s || l.endonym.toLowerCase() === s) ?? LWC_LANGUAGES.find((l) => l.name.toLowerCase().startsWith(s)) ?? null : null; };
export function contextView(st) {
  const values = {};
  for (const [tid, c] of Object.entries(st.draft.context)) if (Object.keys(c).length) values[tid] = { ...c };
  for (const x of st.pre) if (x.context && Object.keys(x.context).length && !values[x.template]) values[x.template] = { ...x.context }; // what the server holds for a survey already selected
  return { open: null, values, demographics: st.draft.demographics === true };
}
export const tidOfKey = (st, key) => (st.templates.some((t) => t.id === key) ? key : st.templates.find((t) => slug(t.name) === key)?.id ?? null);
