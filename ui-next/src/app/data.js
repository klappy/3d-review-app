// UI Next (v4) workspace data. Status: provisional. Reads only the /v2 routes the current UI reads (ui/assess/scope.js, views.js,
// share.js, report-build.js); builds view models in the shapes the lane screens already draw (collect/model.js, results/data.js, home.json).
import { heldContext } from "./setup.js";
import { api, classify, confirmed, enc, token } from "./api.js";
import { lensLabel } from "../../../ui/report-lenses.js";
import { v3ScoreBand, v3ExpectedFor } from "../../../ui/assess/v3-assessment.js";
import { parsePeriod, collectLine } from "../../../ui/v3/components/active-until.js";
import { LEVEL_KEY, LEVEL_WORD, levelCutoffs, useLevelMinimum, levelMinimumOf, currentLevelMin, sentLenses, snapshotTotal, footPrivacy, bandRows, lensCards, responsesFor } from "../screens/results/data.js";
import { to } from "./router.js";
import qrcode from "../../../ui/assess/vendor-qrcode.js";
import { acceptInvitationById } from "../../../ui/v3/components/invite.js";

export const LENS_KEY = Object.freeze({ "Translation Team": "team", Community: "community", Church: "church" });
export const lensKeyOf = (perspective) => LENS_KEY[perspective] ?? LENS_KEY[lensLabel(perspective) === lensLabel("Translation Team") ? "Translation Team" : lensLabel(perspective) === lensLabel("Community") ? "Community" : lensLabel(perspective) === lensLabel("Church") ? "Church" : ""] ?? null;
// The lanes' Pill stage words (results | collecting | setup | reviewed) from the server stage ids (prepare | collect | understand | improve).
export const STAGE_OF = Object.freeze({ prepare: "setup", collect: "collecting", understand: "results", improve: "results" });
// A date-only string (the period's YYYY-MM-DD, a calendar day) is read as that day, never shifted through UTC into the viewer's
// timezone (the saved Oct 22 showed as Oct 21 in America/New_York); a full timestamp is read as an instant, as before.
export const shortDate = (iso) => { const s = String(iso ?? ""); const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const ago = (iso) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return ""; const m = Math.round((Date.now() - t) / 60000); if (m < 2) return "just now"; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 36) return `${h} h ago`; return shortDate(iso); };

export const workspaces = async () => (await api("/v2/workspaces")).workspaces ?? [];
export const projects = async () => (await api("/v2/projects")).projects ?? [];
export const project = async (pid) => (await api(`/v2/projects/${enc(pid)}`)).project ?? (await api(`/v2/projects/${enc(pid)}`));
export const assessmentsOf = async (pid) => (await api(`/v2/projects/${enc(pid)}/assessments`)).assessments ?? [];
export const assessment = async (aid) => api(`/v2/assessments/${enc(aid)}`); // { assessment, surveys }
export const surveyCounts = async (aid, sid) => api(`/v2/assessments/${enc(aid)}/surveys/${enc(sid)}`); // { survey, counts, expected_count? }
export const setStage = async (aid, stage) => api(`/v2/assessments/${enc(aid)}/stage`, { method: "POST", body: { stage } });
export const results = async (aid) => api(`/v2/assessments/${enc(aid)}/results`);
// The server's per-perspective level minimum (results level_minimum_responses; src/report-admission.ts). Each read below records
// the strictest value its reviews serve; a failed or absent read is undefined, which useLevelMinimum turns into the session's /v2/me value, else the safe 3.
const servedMinimum = (aid) => results(aid).then((r) => r?.level_minimum_responses).catch(() => undefined);
// No review to read leaves the value in force (the /v2/me read or the safe 3); any unread or unknown value among them gives the safe 3.
const useStrictest = (served) => (served.length ? useLevelMinimum(served.every((v) => levelMinimumOf(v) === v) ? Math.max(...served) : undefined) : currentLevelMin());
// Answer-by-answer rows: the server answers with a typed suppression for everyone (src/handlers/response.ts list: D7 disclosure
// policy unresolved, no row-level disclosure even to owners). The screen shows that real state, never sample rows.
export const responsesList = async (aid) => api(`/v2/assessments/${enc(aid)}/responses`);
// The list pages (src/handlers/report.ts list: five per page, ordered by id, next_cursor until exhausted): every page is read so the
// newest by created_at is chosen from the whole list, never from the first five ids (Codex 112a0f6e P1).
export const reports = async (aid) => {
  const out = { reports: [] };
  for (let cursor = null, n = 0; n < 200; n++) {
    const r = await api(`/v2/assessments/${enc(aid)}/reports${cursor ? `?cursor=${enc(cursor)}` : ""}`);
    Object.assign(out, r, { reports: out.reports.concat(Array.isArray(r?.reports) ? r.reports : []) });
    cursor = typeof r?.next_cursor === "string" && r.next_cursor ? r.next_cursor : null;
    if (!cursor) break;
  }
  return out;
};
// The newest report of a list by created_at (the list's order is by id, not time).
export const newestReport = (list) => (Array.isArray(list) ? list : []).filter((x) => x?.id).slice().sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")))[0] ?? null;
// A review's language, as collectModel resolves it: language_name, else language_id through the project's languages.
export async function languageOf(a) {
  if (a.language_name) return a.language_name;
  if (!a.language_id) return "";
  const langs = await api(`/v2/projects/${enc(a.project_id)}/languages`).then((r) => r?.languages ?? []).catch(() => []);
  return langs.find((l) => l.id === a.language_id)?.name || "";
}
// The report build's two steps, apart (ui/assess/report-build.js: preview → the person confirms with the response count → execute):
// previewBuild is the dry run; executeBuild spends its confirm_token. buildReport (confirmed) stays the one-shot pair for callers that
// have already confirmed.
export const previewBuild = async (aid) => { const p = await api(`/v2/assessments/${enc(aid)}/reports`, { method: "POST", body: { mode: "dry_run" } }); if (p?.suppressed === true || p?.status === "held") return { held: true, preview: p }; if (typeof p?.confirm_token !== "string" || !p.confirm_token) throw new Error("Invalid preview"); return { held: false, preview: p, token: p.confirm_token, expires: Date.now() + (Number.isFinite(p.expires_in) ? p.expires_in * 1000 : 0) }; };
export const executeBuild = async (aid, confirm_token) => { const r = await api(`/v2/assessments/${enc(aid)}/reports`, { method: "POST", body: { mode: "execute", confirm_token } }); if (r?.suppressed === true) return { held: true, preview: r }; if (!r?.report?.id) throw new Error("Unconfirmed report"); return { held: false, result: r }; };
export const report = async (id) => (await api(`/v2/reports/${enc(id)}`)).report;
export const buildReport = (aid) => confirmed(`/v2/assessments/${enc(aid)}/reports`);
export const issueLink = (aid, sid) => confirmed(`/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`, { params: {} });
// People and workspaces: the same routes the current UI reads and writes (ui/assess/permissions.js header, ui/workspace-manager.js).
export const SCOPE_SEG = Object.freeze({ workspace: "workspace", project: "project", assessment: "assessment" }); // singular: the grant routes are /v2/{scope}/{id}/… (src/handlers/common.ts reqScope)
export const workspace = async (wid) => api(`/v2/workspaces/${enc(wid)}`); // { workspace, projects[] with assessment_count / response_count }
export const grantsAt = async (scope) => api(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/grants`); // { grants, pending_invitations }; member+ only
export const myInvitations = async () => (await api("/v2/me/invitations")).invitations ?? [];
// Invitations are a danger twin (cap.grant.invite, write.effect): the dry run is previewed and the person confirms the recipient, role and
// scope before execute — the current design's two steps (ui/assess/permissions.js preview → Confirm; workspace-permissions TICKET DoD 2).
export const previewInvite = (scope, { email, role }) => api(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/invitations`, { method: "POST", body: { email, role, mode: "dry_run" } });
export const executeInvite = (scope, { email, role }, confirm_token) => api(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/invitations`, { method: "POST", body: { email, role, mode: "execute", confirm_token } });
/** The two steps as one call for the shell: preview, then `ask(sentence)` (the person's explicit Confirm; false = cancel, nothing is sent),
 *  then execute with the preview's token. Returns { sent: false } on cancel; throws on a hold or an unreadable preview. */
export async function inviteWithConfirm(scope, { email, role }, ask, sentence = `${email} will be able to open this ${scope?.type ?? "item"} as ${role} once they accept. An email is sent when you confirm.`) {
  const p = await previewInvite(scope, { email, role });
  if (p?.suppressed === true || p?.status === "held") throw new Error("the server held the invitation");
  if (typeof p?.confirm_token !== "string" || !p.confirm_token) throw new Error("the preview could not be read");
  if (!(await ask(`${sentence}${p.impact?.irreversible ? " This cannot be undone from here." : ""}`))) return { sent: false };
  return { sent: true, result: await executeInvite(scope, { email, role }, p.confirm_token) };
}
export const invite = (scope, { email, role }) => confirmed(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/invitations`, { email, role });
export const previewRole = async (scope, gid, role) => api(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/grants/${enc(gid)}`, { method: "PATCH", body: { role, mode: "dry_run" } });
export const executeRole = async (scope, gid, role, confirm_token) => api(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/grants/${enc(gid)}`, { method: "PATCH", body: { role, mode: "execute", confirm_token } });
export const setRole = (scope, gid, role) => confirmed(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/grants/${enc(gid)}`, { role }, { method: "PATCH" });
export const revokeGrant = (scope, gid) => api(`/v2/${SCOPE_SEG[scope.type]}/${enc(scope.id)}/grants/${enc(gid)}`, { method: "DELETE" });
export const revokeInvitation = (id) => api(`/v2/invitations/${enc(id)}`, { method: "DELETE" });
export const acceptInvitation = (id) => acceptInvitationById(api, id);
export const addProject = (wid, pid) => api(`/v2/workspaces/${enc(wid)}/projects/${enc(pid)}`, { method: "POST" });

// Home: fixtures/home.json's shape from the account's real projects and reviews, so the approved screens/Home.svelte composition draws
// it unchanged: groups by stage (results | collecting | setup), completed (stage improve), the account, the first workspace. No invitation
// store is read tonight (invitations: null draws no invitation card; parity-loop row).
const fmt = (a) => (a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "");
export async function homeModel(me) {
  const [ps, ws] = await Promise.all([projects(), workspaces().catch(() => [])]);
  // A project's reviews failing to load is an error the shell shows (retryable), never an empty list that would draw a first-review
  // welcome to an established account.
  const lists = await Promise.all(ps.filter((p) => !p.archived_at).map((p) => assessmentsOf(p.id).then((as) => as.map((a) => ({ a, p })))));
  // A review the account holds a direct grant on (invited to one review, not its project): /v2/projects lists no parent for it, so
  // the grant itself is read (as the current design does); a failed read is the shell's error. Codex round 5 P1 on e546ccca.
  const listed = new Set(lists.flat().map(({ a }) => a.id));
  const direct = (me?.grants ?? []).filter((g) => g.scope_type === "assessment" && !listed.has(g.scope_id)).map((g) => g.scope_id);
  const extra = await Promise.all([...new Set(direct)].map(async (aid) => { const { assessment: a } = await api(`/v2/assessments/${enc(aid)}`); return { a, p: ps.find((p) => p.id === a.project_id) ?? { id: a.project_id, name: a.project_name || "Shared review" } }; }));
  const rowsAll = lists.flat().concat(extra).filter(({ a }) => !a.archived_at);
  const langCache = new Map(); // one languages read per project (Codex round 5 P2: list rows carry language_id, not language_name)
  await Promise.all(rowsAll.map(async ({ a }) => { if (a.language_name || !a.language_id || !a.project_id) return; if (!langCache.has(a.project_id)) langCache.set(a.project_id, api(`/v2/projects/${enc(a.project_id)}/languages`).then((r) => r?.languages ?? []).catch(() => [])); a.language_name = (await langCache.get(a.project_id)).find((l) => l.id === a.language_id)?.name || ""; }));
  const all = rowsAll.sort((x, y) => String(y.a.created_at).localeCompare(String(x.a.created_at)));
  const n = (a) => Number(a.response_count ?? 0);
  const row = ({ a, p }) => {
    const stage = STAGE_OF[a.stage] ?? "setup";
    const base = { id: a.id, project: p.name, language: a.language_name || "", title: a.name };
    if (stage === "results") return { ...base, meta: `${n(a)} response${n(a) === 1 ? "" : "s"}`, tag: a.stage === "understand" ? "Not yet reviewed" : undefined, action: "Read the results", href: to("results", { aid: a.id }) };
    if (stage === "collecting") return { ...base, meta: `${n(a)} response${n(a) === 1 ? "" : "s"} so far`, phoneMeta: `${n(a)} response${n(a) === 1 ? "" : "s"} so far`, until: "", action: "Share the survey", href: to("collect", { aid: a.id }) };
    return { ...base, meta: `Setup not finished · started ${shortDate(a.created_at)}`, phoneMeta: "Setup not finished", action: "Continue setup", href: to("review", { aid: a.id }) };
  };
  const HEAD = { results: ["Results ready", "read and plan the next step"], collecting: ["Collecting", "share the link or QR, watch the counts"], setup: ["Setting up", "pick up where you left off"] };
  const groups = ["results", "collecting", "setup"].map((stage) => ({ stage, heading: HEAD[stage][0], help: HEAD[stage][1], reviews: all.filter(({ a }) => (STAGE_OF[a.stage] ?? "setup") === stage && a.stage !== "improve").map(row) })).filter((g) => g.reviews.length);
  const completed = all.filter(({ a }) => a.stage === "improve").map(({ a, p }) => ({ title: a.name, meta: `${p.name} · reviewed`, href: to("results", { aid: a.id }) }));
  const first = String(me?.principal?.display_name || "").trim().split(/\s+/)[0] || "You";
  const initials = (String(me?.principal?.display_name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")) || "";
  return { user: { first, name: me?.principal?.display_name || "", initials }, workspace: ws[0]?.name ?? "Your workspace", workspaces: ws, projects: ps, invitation: null, phoneOrder: ["collecting", "setup", "results"], groups, completed, empty: !all.length, start: to("setup1"), rows: all };
}

// Project: fixtures/setup/project.json's shape for screens/setup/Project.svelte (desktop two tracks, phone list). Levels per review come
// from each review's newest built report when there is one (results/data.js levelOf on payload.lenses); the trend aside draws the
// reviews that have levels, newest last.
export async function projectModel(pid) {
  const [p, as, ws] = await Promise.all([project(pid), assessmentsOf(pid), workspaces().catch(() => [])]);
  const live = as.filter((a) => !a.archived_at).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  // A project outside any workspace (workspace_id null) is said so, never shown under the first workspace in the list.
  const w = (p.workspace_id && ws.find((x) => x.id === p.workspace_id)) ?? (p.workspace_id ? { name: "Your workspace" } : { name: "No workspace" });
  useStrictest(await Promise.all(live.filter((a) => ["understand", "improve"].includes(a.stage)).map((a) => servedMinimum(a.id))));
  // A review's report list or counts failing to read is the shell's retryable error (never a review silently shown without levels).
  const lvl = await Promise.all(live.map(async (a) => {
    if (!["understand", "improve"].includes(a.stage)) return null;
    const r = await reports(a.id); const newest = newestReport(r.reports); if (!newest) return null; const rep = newest.payload ? newest : await report(newest.id);
    const { counts, sent } = await lensSurvey(a.id), levels = levelsOf(rep.payload, counts, sent);
    return levels ? { levels, ns: respondentsOf(rep.payload, counts, sent) } : null;
  }));
  const month = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
  const reviews = live.map((a, i) => {
    const stage = a.stage === "improve" ? "done" : (STAGE_OF[a.stage] ?? "setup");
    const toKey = stage === "done" ? "nextStep" : stage === "results" ? "results" : "collect";
    return { id: a.id, when: month(a.created_at), title: a.name, stage, to: toKey, href: to(stage === "done" || stage === "results" ? "results" : stage === "collecting" ? "collect" : "review", { aid: a.id }), note: stage === "setup" ? "Setup not finished" : "No results yet", levels: lvl[i] ? Object.entries(lvl[i].levels).filter(([, l]) => l).map(([k, l]) => [k, l, lvl[i].ns[k] ?? null]) : undefined, overall: lvl[i]?.levels?.overall }; // [lens, level, respondents]: the count travels with the level (Coverage beside it)
  });
  const withLevels = reviews.filter((r) => r.levels).reverse().slice(-4); // the board's trend is four points wide (Project.svelte X(i) = 70 + 110 i in a 420 box): the newest four
  const lines = {};
  // A review that never surveyed a perspective leaves a gap (null) in that line, never a "More input needed" point it did not earn.
  for (const lens of ["team", "community", "church"]) { const col = withLevels.map((r) => Object.fromEntries(r.levels)[lens]).filter(Boolean); if (col.length) lines[lens] = withLevels.map((r) => Object.fromEntries(r.levels)[lens] ?? null); }
  const count = live.length;
  const since = live.length ? month(live[live.length - 1].created_at) : "";
  const meta = [p.organization ? `lead organisation ${p.organization}` : "", `${count} review${count === 1 ? "" : "s"}${since ? ` since ${since}` : ""}`].filter(Boolean).join(" · ");
  return {
    workspace: { name: w.name, short: w.name },
    project: { id: p.id, name: p.name, meta, phoneMeta: meta, stage: reviews[0]?.stage ?? "setup" },
    reviews,
    trend: { heading: "Over time", help: "Each perspective's overall level, review by review. The direction is what matters, not the exact point.", months: withLevels.map((r) => r.when.split(" ")[0]), rows: ["Strong", "Growing", "Support", "Urgent", "—"], lines, read: withLevels.length ? `${withLevels.length} review${withLevels.length === 1 ? "" : "s"} with results so far.` : "No review has results yet; the lines appear once a report is built." },
  };
}
// Lens levels of a built report's payload (results/data.js lensCards does the banding; here the lens word only).
// Respondents per perspective for a review (the survey counts the Results page bands with): v3ScoreBand (levelCutoffs()) holds a
// perspective under the served level minimum at "More input needed"; at or over it a low count shows beside the coverage drops.
export async function lensCounts(aid) { return (await lensSurvey(aid)).counts; }
/** { counts, sent }: lensCounts' respondents per perspective plus the perspectives the review sent out (results/data.js sentLenses). */
export async function lensSurvey(aid) {
  const { surveys } = await assessment(aid);
  const live = surveys.filter((s) => !s.archived_at);
  const per = await Promise.all(live.map((s) => surveyCounts(aid, s.id))); // a failed count is the caller's error, never a zero that holds a band
  const counts = { team: 0, community: 0, church: 0 };
  live.forEach((s, i) => { const k = lensKeyOf(s.perspective); if (k) counts[k] += Number(per[i]?.counts?.respondents ?? 0); });
  return { counts, sent: sentLenses(live) };
}
// Respondents behind each perspective's level in a built report, snapshot first (results/data.js responsesFor): the payload's own
// evidence n, else the live survey count (`counts`) where the payload carries none, else null. { team: 6, community: 2, … }.
// Perspective keys in the results lane's order (team, community, church), anything else after, so an added perspective keeps its place.
const inLensOrder = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (["team", "community", "church"].indexOf(a) + 1 || 9) - (["team", "community", "church"].indexOf(b) + 1 || 9)));
// sent (lensSurvey): a perspective sent out but absent from the payload had 0 responses when the report was built: n 0, More input needed.
export function respondentsOf(payload, counts = null, sent = []) {
  const responses = responsesFor(payload, counts), out = {};
  for (const l of payload?.lenses ?? []) { const k = lensKeyOf(l.lens) ?? l.lens; out[k] = responses(k); }
  for (const k of sent ?? []) if (!(k in out)) out[k] = 0;
  return out;
}
export function levelsOf(payload, counts = null, sent = []) {
  const out = {}, ns = respondentsOf(payload, counts, sent);
  // v3ScoreBand (levelCutoffs()) holds a perspective under the served level minimum at "More input needed": the count is the report's own (respondentsOf,
  // snapshot first); without a count anywhere the band is held (never shown as a level on a guess).
  for (const l of payload?.lenses ?? []) { const k = lensKeyOf(l.lens) ?? l.lens; const n = Number(ns[k] ?? NaN); const w = v3ScoreBand(Number(l.score), Number.isFinite(n) ? n : 0, levelCutoffs()); out[k] = LEVEL_KEY[w] ?? "more"; }
  for (const k of sent ?? []) if (!(k in out)) out[k] = "more"; // sent out, no response at build time: never a score
  return Object.keys(out).length ? inLensOrder(out) : null;
}

// Collect: the shape collect/model.js collectModel() reads (groups[].surveys[] with code/answered/expected/qr, review meta, room).
export async function collectModel(aid, origin = globalThis.location?.origin ?? "") {
  const { assessment: a, surveys } = await assessment(aid);
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const live = surveys.filter((s) => !s.archived_at);
  // The same stores the current UI reads (ui/assess/assess.js): the project's languages resolve language_id when the assessment
  // carries no language_name; passages name what to read first; the expected count per survey is browser-local (v3:expected,
  // never an API field) — a facilitator sees the number they typed on this browser, as today.
  const [counts, language, passages] = await Promise.all([
    Promise.all(live.map((s) => surveyCounts(aid, s.id).catch(() => null))),
    languageOf(a),
    api(`/v2/assessments/${enc(aid)}/passages`).then((r) => r?.passages ?? []).catch(() => []),
    servedMinimum(aid).then((v) => useLevelMinimum(v)), // CloseCollection's readiness line: the served minimum, else the safe 3
  ]);
  const passage = [...new Set(passages.map((x) => String(x?.reference || x?.title || "").trim()).filter(Boolean))].join(" · ") || String(a.purpose || "").trim(); // step 2's name when no attachment names one
  const period = parsePeriod(a.period);
  const closes = period ? shortDate(period.until) : "";
  const daysLeft = period ? Math.max(0, Math.ceil((new Date(`${period.until}T00:00:00`).getTime() - Date.now()) / 86400000)) : null;
  let store = null; try { store = globalThis.localStorage; } catch { store = null; }
  const byLens = new Map();
  live.forEach((s, i) => {
    const key = lensKeyOf(s.perspective) ?? "team";
    const c = counts[i];
    const answered = c ? Number(c.counts?.responses ?? 0) : null; // null = the count could not be read (never shown as a real zero)
    const expected = v3ExpectedFor(s.id, store); // null = no expected count set on this browser (model.js draws no bar)
    // code: the row's identity (the board's short 3dreview.app/s/CODE has no backend: RESULTS-collect debt); link/qr arrive from attachLinks.
    const row = { id: s.id, name: s.template_name || s.template_id, room: s.template_name || s.template_id, code: s.id, answered, expected, open: s.collection_status === "open", qr: null, link: null };
    if (!byLens.has(key)) byLens.set(key, []);
    row.fullLink = null;
    byLens.get(key).push(row);
  });
  const groups = [...byLens].map(([lens, rows]) => ({ lens, surveys: rows }));
  const stage = STAGE_OF[a.stage] ?? "setup";
  return {
    aid, projectId: a.project_id, origin, role: a.role ?? "viewer",
    // Print paper surveys (app/print.js preparePapers): the review's and the project's participant languages (ui/assess/print-lang.js
    // printLanguages reads both) and the passage line the paper names, as ui/assess/assess.js passageLine draws it.
    lwc: { assessment: Array.isArray(a.lwc) ? a.lwc : [], project: Array.isArray(p.lwc) ? p.lwc : [] },
    passageLine: passage ? `Before you answer, read or listen to: ${passage}` : "",
    user: { first: "", initials: "" }, workspace: "",
    project: { name: p.name, href: to("project", { pid: a.project_id }) },
    review: { id: a.id, title: a.name, stage, language, canClose: ["owner", "member"].includes(a.role), modality: a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "", updated: ago(a.created_at), passage, opens: period?.starts ? shortDate(period.starts) : shortDate(a.created_at), closes, activeLine: collectLine(a.period), daysLeft, serverStage: a.stage },
    // No room telemetry: the room-health counter is retired (cookbook PR 198; RULING-2026-10-16-scrap-app-ratelimit) and no capability
    // reports opens per minute or refusals, so nothing is invented here (root plan @6cd4cd8 step 4).
    groups, linkHost: `${origin}/next/#survey=`, hasAccessCodes: false, // no short-code backend (RESULTS-collect debt 7): the sheet prints the link only
    // PrintQR's choices (every survey ticked, the three layouts the board draws) and QRRoomPhone's default survey.
    printQr: { checked: live.map((s) => s.id), layouts: [{ title: "One page per survey", help: "A full-page code to pin up or hold up.", per: "survey" }, { title: "Hand-out cards", help: "Six cards per page, cut along the lines, one survey per sheet.", per: "sheet", cards: 6 }, { title: "All on one page", help: "Every selected code on one sheet, for the table.", per: "one" }], languages: ["English"], papers: ["A4", "Letter"], pageLanguages: language || "English" },
    qrRoomPhone: { survey: 2 }, // "Survey 3 of N", as the QRRoomPhone board draws
  };
}
// Resolve every open survey's real link into a collect model (memory only; the token never touches storage): fullLink carries the
// documented opt-in (route.js flagOn) so a participant's phone needs no stored flag; qr = the encoder's cells for that exact string;
// link = what the screen prints under the code (the host for the room, the full link for print). A survey whose link cannot be
// issued keeps linkError and no qr. Collect, QR room and Print QR all read this one shape.
export async function attachLinks(m, { full = false } = {}) {
  const open = m.groups.flatMap((g) => g.surveys).filter((s) => s.open);
  await Promise.all(open.map(async (s) => {
    try { const l = await linkFor(m.aid, s.id); s.fullLink = `${m.origin}/next/?ui_next=on${l.fragment}`; s.qr = qrModules(s.fullLink).cells; s.link = full ? s.fullLink : `${new URL(m.origin).host}/next`; }
    catch (e) { s.linkError = e.message; }
  }));
  return m;
}
// Issue (or reuse this tab's) survey link for a survey and attach its QR modules: the raw token lives only in this tab's memory.
// Keyed by the signed-in identity too (the tab's bearer): a link issued under one account is never handed to another in the
// same tab (the server's issue_link needs member access; the cache must not bypass it).
const LINKS = new Map();
// Every authentication transition empties the cache (Live: sign-in, sign-out): on a cookie session token() is "", so the key
// alone cannot tell identities apart (SECURITY-575-8583e170 finding 1). The epoch guards the in-flight case (root + independent
// read 2026-10-22 at 87f5bb2e): an issueLink started before the transition must neither repopulate the cache nor hand its
// credential to the identity that signed in after it — the promise is cut off, not stored.
let LINK_EPOCH = 0;
export function clearLinks() { LINKS.clear(); LINK_EPOCH++; }
export async function linkFor(aid, sid) {
  const k = `${token() ?? ""}|${aid}/${sid}`;
  if (LINKS.has(k)) return LINKS.get(k);
  const epoch = LINK_EPOCH;
  const out = await issueLink(aid, sid);
  if (epoch !== LINK_EPOCH) throw new Error("The sign-in changed while the link was being issued. Reload to issue it again."); // never cached, never returned
  if (out.held) throw new Error("This survey is not collecting right now.");
  const r = out.result;
  const fragment = r.entry_fragment || `#survey=${encodeURIComponent(r.link_token)}`;
  const link = { fragment, token: r.link_token, expires_at: r.expires_at };
  LINKS.set(k, link);
  return link;
}
// The one encoder call (design-system §8.7 QR module grid): ui/assess/vendor-qrcode.js, typeNumber 0 = auto, error correction M —
// the same call scripts/ui-next-acceptance/qr-cells.mjs uses to give the boards their cells, so board and screen match for a URL.
export function qrModules(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount();
  let cells = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells += q.isDark(r, c) ? "1" : "0";
  return { n, cells };
}

// The results summary is an admission hold only when it carries the low-count fields (src/handlers/results.ts minimumHold:
// responses_in / responses_needed); its standing status "held" (D7) alone is not one, so an eligible unbuilt review reads Not built yet. A real hold applies to every
// role (Codex P2 4382607192): a member below the floor is never offered a Build that can only fail; an eligible member always is.
export const admissionHold = (res) => !!res && typeof res.responses_needed === "number" && typeof res.responses_in === "number";
// Results: the newest built report (or build one) in the shape results/data.js reads: { review, counts, payload } plus a held reason.
export async function resultsModel(aid, { build = false } = {}) {
  // The report list and every survey count must load: a failed read is the shell's retryable error, never an empty list (which
  // would offer a build beside an existing report) nor a zero (which would band a perspective as held and understate the total).
  const [{ assessment: a, surveys }, res, rep] = await Promise.all([assessment(aid), results(aid).catch((e) => ({ error: e })), reports(aid)]);
  useLevelMinimum(res?.level_minimum_responses); // the server decides (DEV 1, else 3); a failed or absent read keeps the session's /v2/me value, else the safe 3
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const live = surveys.filter((s) => !s.archived_at);
  const counts = { team: 0, community: 0, church: 0 };
  const per = await Promise.all(live.map((s) => surveyCounts(aid, s.id)));
  live.forEach((s, i) => { const k = lensKeyOf(s.perspective); if (k) counts[k] += Number(per[i]?.counts?.respondents ?? 0); });
  const liveResponses = per.reduce((n, c) => n + Number(c?.counts?.responses ?? 0), 0); // the live survey total: the newer-responses notice and a new build only
  let list = Array.isArray(rep?.reports) ? rep.reports.filter((x) => x?.id) : [];
  let built = null, held = null;
  // Loading a route never writes: a missing report is reported as not built (the screen offers an explicit "Build the report",
  // which runs the existing confirmed dry-run → execute pair). `build` is kept for that explicit action only.
  if (!list.length && build) {
    const out = await buildReport(aid);
    if (out.held) held = out.preview; else list = [out.result?.report].filter(Boolean);
  }
  const newest = newestReport(list);
  if (newest) built = newest.payload ? newest : await report(newest.id);
  // A built report's total comes from its own evidence snapshot (the sum of the counts its cards show), never the live survey total.
  const responses = built ? snapshotTotal(lensCards(built.payload, counts, { sent: sentLenses(live) })) : liveResponses;
  const member = ["owner", "member"].includes(a.role);
  // No closure timestamp exists on the contract (created_at is when the review was made, not when collection closed): the date is
  // left out rather than mislabelled. Language resolves as Collect does (language_name, else language_id via the project's languages).
  const review = { id: a.id, project: p.name, projectId: a.project_id, language: await languageOf(a), modality: a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "", title: a.name, stage: a.stage === "collect" ? "collecting" : built ? "results" : "closed", closed: "", closedLong: "", builtOn: built ? shortDate(built.created_at) : "", responses, liveResponses, canReadResponses: member, canReopen: member }; // results lane StagePill: the review's real state — collecting | closed (no report yet) | results
  // Role flags (src/handlers: report build, stage and the response list need owner/member; viewers read results and reports only).
  return { aid, review, counts, sent: sentLenses(live), payload: built?.payload ?? null, reportId: built?.id ?? null, held: held ?? (admissionHold(res) && !built ? res : null), results: res, serverStage: a.stage, canBuild: member, canReadResponses: member, canReopen: member }; // D7: /results is held for everyone until a report exists; a member's first Build must not be hidden behind it (Codex P1 on 26a86937)
}

// Gap names for ResultsGaps/Report (results/data.js bandRows reads the payload's cross-perspective areas by construct name):
// biggest = the three widest agreement ranges, agree = the narrowest one; radar = every multi-perspective area.
const areasOf = (payload) => (Array.isArray(payload?.cross_lens_multi) ? payload.cross_lens_multi.filter((a) => a?.construct_name) : []);
export function gapsOf(payload) {
  const a = areasOf(payload).slice().sort((x, y) => Number(y.agreement_range ?? 0) - Number(x.agreement_range ?? 0));
  return { biggest: a.slice(0, 3).map((x) => x.construct_name), agree: a.length > 3 ? [a[a.length - 1].construct_name] : [] };
}
export const radarOf = (payload) => areasOf(payload).map((a) => a.construct_name).slice(0, 8);

// Setup step 5 ("Ready to launch") for a review still in preparation: fixtures/setup/setup.json's summary/phoneSummary/groups/context from
// the real review and its selected surveys, so screens/setup/Setup5.svelte draws it unchanged. Fields the API does not hold (passage file,
// answer languages, dates) read "Not set"; rows kept so the composition is the board's.
export async function setupModel(aid) {
  const { assessment: a, surveys } = await assessment(aid);
  const p = await project(a.project_id).catch(() => ({ name: "Project" }));
  const live = surveys.filter((s) => !s.archived_at);
  // The same resolved facts Collect shows (collectModel: language via the project's languages, passages, the period, the
  // browser-local expected count per survey), so Setup 5 never says "Not set" for what the review has.
  const cm = await collectModel(aid).catch(() => null);
  const language = cm?.review.language || a.language_name || "";
  const passage = cm?.review.passage || a.purpose || "";
  const period = cm?.review.activeLine || a.period || "";
  const expectedOf = (sid) => cm?.groups.flatMap((g) => g.surveys).find((x) => x.id === sid)?.expected ?? null;
  const groups = ["team", "community", "church"].map((lens) => {
    const mine = live.filter((s) => lensKeyOf(s.perspective) === lens);
    const name = { team: "Translation team", community: "Community", church: "Church" }[lens];
    return { lens, perspective: { team: "Translation Team", community: "Community", church: "Church" }[lens], name, who: "", checked: mine.length > 0, phoneNote: mine.map((s) => s.template_name || s.template_id).join(" · ") || "No survey", rolesLabel: "", tid: mine[0]?.template_id, roles: mine.map((s) => ({ name: s.template_name || s.template_id, note: "own survey", checked: true, expected: expectedOf(s.id) ?? 0, tid: s.template_id })) };
  });
  const sub = [p.name, language, fmt(a)].filter(Boolean).join(" · ");
  const summary = [
    { label: "Review", main: a.name, strong: true, sub, step: 1 },
    { label: "People respond to", main: passage, sub: "", step: 2 },
    { label: "Answer languages", main: ["English", ...(Array.isArray(a.lwc) ? a.lwc : [])].join(", "), step: 2 }, // lwc_json [] = English only (the reviewed language is the passage's, not the survey's)
    { label: "Location or community", main: a.location || "", step: 1 },
    { label: "Facilitator", main: a.facilitator || "", step: 1 },
    { label: "Survey open", main: period, step: 1 },
    { label: "Who will participate", step: 3, derive: "who" },
    { label: "About each group", sub: a.demographics_enabled ? "Participants asked age range and gender (skippable)" : "Participants are not asked about themselves", step: 4, derive: "about" },
  ];
  const phoneSummary = [{ label: "Review", value: a.name, step: 1 }, { label: "Respond to", value: passage, step: 2 }, { label: "Who", step: 3, derive: "who" }, { label: "Open", value: period, step: 1 }];
  const canLaunch = a.stage === "prepare" && live.length > 0 && ["owner", "member"].includes(a.role); // launch only while preparing (TICKET 4: Setup is read-only otherwise)
  // While preparing, a launch that cannot happen says why beside a disabled primary (Setup5 next.blocked), never a live link to Collect.
  const launchBlocked = canLaunch || a.stage !== "prepare" ? "" : !["owner", "member"].includes(a.role) ? "Only an owner or member of the review can launch it." : "Pick at least one survey before launching.";
  const values = {}; // what step 4 wrote, keyed by template id (Setup5 aboutLine reads the survey's tid first)
  for (const s of live) { const c = heldContext(s); if (Object.keys(c).length) values[s.template_id] = c; }
  return { aid: a.id, stage: a.stage, summary, phoneSummary, groups, context: { open: null, values, unreadable: true, demographics: !!a.demographics_enabled }, steps: null, canLaunch, launchBlocked }; // unreadable: no API read for group context
}

// Share: the shape actions/Share.svelte reads (fixtures/actions/review.json + share.json) from the real collect model with every open
// survey's real link resolved (attachLinks, full). code = the full link, host = "" so `${host}${code}` is the link the board's row shows;
// no row is pre-copied (the board's copied badge is a state, not data); the access-codes disclosure names what is not wired yet.
export async function shareModel(aid, me) {
  const m = await attachLinks(await collectModel(aid), { full: true });
  const open = m.groups.flatMap((g) => g.surveys.map((s) => ({ ...s, lens: g.lens }))).filter((s) => s.fullLink);
  const first = String(me?.principal?.display_name || "").trim().split(/\s+/)[0] || "";
  const initials = (String(me?.principal?.display_name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")) || "";
  const { assessment: a } = await assessment(aid);
  const total = m.groups.flatMap((g) => g.surveys).reduce((n, s) => n + (s.answered || 0), 0);
  const review = {
    user: { first, initials }, workspace: "", project: m.project.name, projectId: a.project_id, role: a.role ?? "viewer",
    review: { title: m.review.title, language: m.review.language, modality: m.review.modality, updated: m.review.updated, stage: { prepare: "setup", collect: "collecting", understand: "results", improve: "done" }[a.stage] ?? "collecting" }, // the header says the real stage (StagePill words)
    host: "", shortHost: "",
    // ReviewHead's menu draws "Delete this review" refused with its reason (R11). UI Next wires no delete, so the reason is always
    // true: the response count when there are responses, else that deleting still happens in the current design.
    deleteRefused: total ? `Reviews with responses can't be deleted. This one has ${total}.` : "Deleting a review is done from the current design's review page; this screen does not delete yet.",
    surveys: open.map((s) => ({ lens: s.lens, name: s.name, code: s.fullLink, n: s.answered, of: s.expected ?? "—", pages: 0 })),
    noLinks: open.length ? "" : "No survey is collecting yet, so there is no link to share. Open collection on the review page first.",
  };
  const share = { copied: -1, lead: "Each perspective — and each role inside it — has its own survey link. People answer without an account. One link can be used by everyone who answers that survey.", phoneLead: "Each survey has its own link. Send it, show the QR, or hand the phone over.", codes: { code: "", line: "", unused: "Access codes are issued from the current design's Share panel; this screen does not issue them yet" } };
  return { review, share };
}

// Print paper surveys (actions/Print.svelte, live): the collect model with every open survey's real link (the QR on the paper) and
// the fixture's row shapes (groups[].surveys as indexes into one surveys list), plus the review's print languages
// (ui/assess/print-lang.js rules through screens/actions/legacy.js printLanguages). Who may print: ui/stage-screens.js PRINT_ROLES.
export async function printPageModel(aid, me) {
  const m = await attachLinks(await collectModel(aid), { full: true });
  const rows = m.groups.flatMap((g) => g.surveys.map((s) => ({ ...s, lens: g.lens })));
  const NAME = { team: "Translation team", community: "Community", church: "Church" };
  const groups = m.groups.map((g) => {
    const idx = g.surveys.map((s) => rows.findIndex((r) => r.id === s.id));
    const answered = g.surveys.reduce((n, s) => n + (s.answered ?? 0), 0), expected = g.surveys.reduce((n, s) => n + (s.expected ?? 0), 0);
    return { lens: g.lens, name: NAME[g.lens] ?? g.lens, count: `${g.surveys.length} survey${g.surveys.length === 1 ? "" : "s"}`, expected: expected ? `${answered} of ${expected} expected` : `${answered} answered`, surveys: idx };
  });
  const first = String(me?.principal?.display_name || "").trim().split(/\s+/)[0] || "";
  const initials = (String(me?.principal?.display_name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")) || "";
  return {
    aid: m.aid, projectId: m.projectId, role: m.role, lwc: m.lwc, passageLine: m.passageLine, origin: m.origin,
    user: { first, initials }, workspace: "", project: m.project.name, projectHref: m.project.href,
    review: { title: m.review.title, language: m.review.language, modality: m.review.modality, updated: m.review.updated, stage: m.review.serverStage },
    deleteRefused: "Deleting a review is done from the current design's review page; this screen does not delete yet.",
    groups, host: "",
    // code: the full link (the row's identity on the paper: no short-code backend); pages: unknown until the form is read (preparePapers).
    surveys: rows.map((s) => ({ id: s.id, lens: s.lens, name: s.name, code: s.fullLink ?? "", n: s.answered ?? 0, of: s.expected ?? "—", pages: null, open: s.open, qr: s.qr, linkError: s.linkError ?? "" })),
    checked: rows.map((_, i) => i),
  };
}

// Next step / Action plan (actions/NextStep.svelte, ActionPlan.svelte, live): what the built report says, through the results lane's own
// banding (screens/results/data.js bandRows, lensCards): the widest gaps (the three rows with the most bands apart), the weakest areas
// (urgent, then needs support) and each perspective's level. Notes, follow-up dates and recommendations have no store yet
// (cap.recommendation.propose / review are RESERVED_NOT_BUILT in /v2/capabilities.json), so the model says so and carries none.
export const RECS_UNAVAILABLE = "Recommendations are not available yet: the server's recommendation capabilities (POST /v2/assessments/{aid}/recommendations) are reserved, not built.";
export const NOTES_UNAVAILABLE = "Notes, follow-up dates and the plan are not saved yet: there is no plan store in the API, so this screen reads the results only.";
export function nextStepModel(m) {
  const payload = m.payload;
  if (!payload) throw new Error("next step: no built report to read");
  const report = { payload };
  const names = radarOf(payload);
  const rows = bandRows(report, m.counts, names).filter((r) => r.dots.length >= 2)
    .sort((x, y) => y.apart - x.apart || Number(y.spread ?? 0) - Number(x.spread ?? 0));
  const apartText = (r) => (r.apart === 0 ? "same band" : `${r.apart} band${r.apart === 1 ? "" : "s"} apart`);
  const gaps = rows.slice(0, 3).map((r) => {
    const xs = r.dots.map((d) => d.x);
    return { area: r.name, checked: r.apart >= 2, apart: apartText(r), span: r.span ? [r.span.from, r.span.to] : [Math.min(...xs), Math.max(...xs)], wide: r.apart >= 2, pts: r.dots.map((d) => [d.lens, d.x, LEVEL_WORD[d.level]]), dots: r.dots };
  });
  const cards = lensCards(payload, m.counts, { sent: m.sent });
  const NAME = { team: "Translation team", community: "Community", church: "Church" };
  const weak = cards.flatMap((c) => c.rows.filter((r) => r.level === "urgent" || r.level === "support").map((r) => ({ lens: c.lens, label: `${NAME[c.lens]} · ${r.name}`, level: r.level, checked: r.level === "urgent" })))
    .sort((x, y) => (x.level === "urgent" ? 0 : 1) - (y.level === "urgent" ? 0 : 1));
  const glance = cards.map((c) => [c.lens, c.level]);
  const talk = [...gaps.map((g) => [`${g.area} — ${g.dots.map((d) => `${d.lens} ${LEVEL_WORD[d.level]}`).join(" · ")}`, g.apart]), ...weak.map((w) => [w.label, LEVEL_WORD[w.level]])];
  const stage = m.serverStage === "improve" ? "reviewed" : "results";
  return {
    review: m.review, stage, gaps, weak, glance, talk, recs: [], recsNote: RECS_UNAVAILABLE, notesNote: NOTES_UNAVAILABLE,
    phone: { title: m.review.title, stage, lead: gaps.length ? "Where the perspectives pull apart, from the built report." : "The built report shows no area two perspectives both scored.", items: gaps.map((g) => ({ kind: "Tension", title: g.area, text: `${g.dots.map((d) => `${NAME[d.lens]} ${LEVEL_WORD[d.level]}`).join(" · ")} — ${g.apart}.`, inPlan: false })) },
    doc: `Next steps · 1 page · ${m.review.title}`,
    meta: [m.review.project, m.review.language, "3D Review next steps", m.review.closed ? `closed ${m.review.closed}` : "", `${m.review.responses} response${m.review.responses === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
    foot: `Built from ${m.review.responses} response${m.review.responses === 1 ? "" : "s"}${m.review.builtOn ? ` on ${m.review.builtOn}` : ""} · levels are bands, not scores · ${footPrivacy()}`,
  };
}

// The phone account menu sheet (actions/MenuSheet.svelte, live): HomePhone's list from the home model, the signed-in account and the
// sheet's seven rows; no invitation store is read (the invitation card is not drawn), no workspace switch (one workspace tonight).
export function menuModel(me, home, { onSignOut } = {}) {
  const name = me?.principal?.display_name || "Signed in";
  const who = [name, me?.principal?.email].filter(Boolean).join(" · ");
  const reviews = home.groups.flatMap((g) => g.reviews.map((r) => ({ project: r.project, title: r.title, stage: g.stage, meta: r.phoneMeta ?? r.meta, action: r.action, href: r.href })));
  return {
    who, initials: home.user.initials, invitation: null, chips: [home.workspace, "Mine"], reviews, completed: home.completed.length,
    items: [
      ["people", `${home.workspace} — your workspace`, to("workspaces")], ["mail", "Invitations", to("invitations")], ["help", "Help and FAQ", to("help")],
      ["sparkle", "Why 3D Review exists", to("about")], ["pen", "Send app feedback", to("feedback")], ["people", "Use another account", null, onSignOut], ["out", "Sign out", null, onSignOut],
    ],
  };
}
// ---- Workspace, People, Invitations, Explore (cookbook work/active/2026-10-21-ui-next-demo-wiring: the people and explore lanes' screens
// read the live stores; the fixtures stay for the harness). Status: provisional.
const userOf = (me) => { const name = String(me?.principal?.display_name || "").trim(); return { first: name.split(/\s+/)[0] || "You", initials: name ? name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") : "Y", name }; };
const PILL_OF = Object.freeze({ prepare: "setup", collect: "collecting", understand: "results", improve: "done" }); // the Workspace board's Stage pill words (Pill.svelte STAGE_LABELS)
export const ROLES = Object.freeze({ owner: "Owner", member: "Member", viewer: "Viewer" });
// The boards' words for what each role can do (fixtures/people/people.json); the server's gating is ui/scope-invitations.js, through people-data.js.
export const CAN = Object.freeze({
  assessment: { owner: "Can change everything, invite people and delete", member: "Can run the review and read results", viewer: "Can read results only" },
  workspace: { owner: "Everything in the workspace, including deleting projects", member: "Can create projects and run reviews in all of them", viewer: "Can read results across all projects" },
});
export const INVITE_LABELS = Object.freeze({ viewer: "Viewer — reads results", member: "Member — runs reviews", owner: "Owner — everything" });
const PHONE_INVITE_LABELS = Object.freeze({ member: "Member — can run reviews", viewer: "Viewer — can read results" });
const FOOTNOTE = "Roles flow down, never up: a workspace member can run every review in it; a review viewer sees only that review. Participants never appear here — they answer through links and codes, without accounts.";
// The service stores another person's email as a hash and holds no display name for them (ui/v3/components/member-list.js contract):
// the signed-in account reads by its own name, everyone else "Member N" (the current UI's label), a pending invitation by its date only.
export const OTHER_PERSON = "Member";
export const PENDING_PERSON = "Invitation sent";
export function rosterOf(r, me) {
  const myId = me?.principal?.id ?? null, u = userOf(me);
  let n = 0;
  const grants = (r?.grants ?? []).map((g) => {
    const you = !!myId && g.principal_id === myId;
    if (!you) n += 1;
    return { id: g.id, principal_id: g.principal_id, role: g.role, name: you ? (u.name ? `${u.name} (you)` : "You") : `${OTHER_PERSON} ${n}`, initials: you ? u.initials : `${OTHER_PERSON[0]}${n}` };
  });
  const pending_invitations = (r?.pending_invitations ?? []).map((i) => ({ id: i.id, role: i.role, status: i.status, email: PENDING_PERSON, initials: "?", invited: shortDate(i.created_at), expires: i.expires_at ? shortDate(i.expires_at) : "" }));
  return { grants, pending_invitations };
}
// People at one scope (fixtures/people/people.json's shape for screens/people/People.svelte): the roster is GET /v2/{scope}/{id}/grants,
// which the server answers for members and owners only; a viewer's refusal is reported (refused: true), never shown as nobody.
// actions names the row actions this app performs for real (Remove = DELETE grant, Withdraw = DELETE invitation); the boards' Transfer
// ownership and Resend stay with the current design (no resend route; transfer is its own confirmed flow there).
export const PEOPLE_ACTIONS = Object.freeze(["Remove", "Withdraw"]);
export async function peopleModel(scope, me) {
  const myId = me?.principal?.id ?? null;
  let roster = null, refused = false;
  try { roster = rosterOf(await grantsAt(scope), me); } catch (e) { if (classify(e) !== "refused") throw e; refused = true; }
  const base = { scope, refused, user: { ...userOf(me), workspace: "" }, inviteLabels: INVITE_LABELS, phone: { me: myId, inviteLabels: PHONE_INVITE_LABELS, roster }, roles: ROLES, footnote: FOOTNOTE, actions: PEOPLE_ACTIONS };
  if (scope.type === "workspace") {
    const { workspace: w } = await workspace(scope.id);
    return { ...base, user: { ...base.user, workspace: w.name }, review: null, workspace: { id: w.id, name: w.name, short: w.name, heading: "People in this workspace", phoneTitle: "People in this workspace", me: myId, can: CAN.workspace, roster, role: w.role } };
  }
  const { assessment: a } = await assessment(scope.id);
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const total = Number(a.response_count ?? 0);
  const review = {
    id: a.id, projectId: a.project_id, title: a.name, project: p.name, stage: STAGE_OF[a.stage] ?? "setup", meta: [p.name, a.language_name || "", fmt(a)].filter(Boolean).join(" · "), updated: `Updated ${ago(a.updated_at || a.created_at)}`,
    heading: "People with access to this review", phoneTitle: "People with access", me: myId, can: CAN.assessment, roster, role: a.role ?? "viewer",
    deleteRefused: total ? `Reviews with responses can't be deleted. This one has ${total}.` : "Deleting a review is done from the current design's review page; this screen does not delete yet.",
  };
  return { ...base, user: { ...base.user, workspace: "" }, review, workspace: null };
}

// A review's newest built report as { team: { score, responses }, … } (the Explore lane's levelOf input; levelWords for the Workspace
// card). null when no report is built; a failed report read is null too, as projectModel's trend reads it (a level beside a review is
// decoration; the review list itself is the shell's error when it fails).
export async function reviewLenses(a) {
  if (!["understand", "improve"].includes(a.stage)) return null;
  try {
    const r = await reports(a.id);
    const newest = (r.reports ?? []).filter((x) => x?.id).sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")))[0];
    if (!newest) return null;
    const rep = newest.payload ? newest : await report(newest.id);
    const { counts, sent } = await lensSurvey(a.id), ns = respondentsOf(rep.payload, counts, sent); // snapshot first: the report's own evidence n, else the live count; sent-but-absent perspectives at 0
    const out = {};
    for (const l of rep.payload?.lenses ?? []) { const k = lensKeyOf(l.lens) ?? l.lens; out[k] = { score: Number(l.score), responses: Number(ns[k] ?? 0) }; }
    for (const k of sent) if (!(k in out)) out[k] = { score: null, responses: 0 }; // sent out, no response at build time: More input needed, no score
    return Object.keys(out).length ? inLensOrder(out) : null;
  } catch { return null; }
}
export const levelWords = (lenses) => Object.fromEntries(Object.entries(lenses ?? {}).map(([k, v]) => [k, LEVEL_KEY[v3ScoreBand(Number(v.score), Number(v.responses), levelCutoffs())] ?? "more"]));
/** [lens, level, respondents] for the summary cards (Workspace): the count travels with each level so a low-evidence level is never bare. */
export const levelTriples = (lenses) => Object.entries(levelWords(lenses)).map(([k, l]) => [k, l, Number.isFinite(Number(lenses[k]?.responses)) ? Number(lenses[k].responses) : null]);
const monthOf = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
const formatIconOf = (formats) => (formats.some((f) => /audio|oral/i.test(f)) ? "mic" : formats.some((f) => /video|sign/i.test(f)) ? "video" : "list");

// Workspace (fixtures/people/workspace.json's shape for screens/people/Workspace.svelte): GET /v2/workspaces/{id} names the grouped
// projects with their counts; each project's reviews give its stage, languages, formats, activity and (from the newest review with
// a built report) its levels. The group dialog's candidates are the account's own ungrouped projects with their direct role (GET
// /v2/projects direct_role: ui/workspace-manager.js mayGroup decides, through people-data.js groupRows).
export async function workspaceModel(wid, me) {
  const [{ workspace: w, projects: wps }, mine] = await Promise.all([workspace(wid), projects()]);
  const live = (wps ?? []).filter((p) => !p.archived_at);
  const lists = await Promise.all(live.map((p) => assessmentsOf(p.id).then((as) => as.filter((a) => !a.archived_at).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))))));
  const all = lists.flat();
  useStrictest(await Promise.all(lists.map((as) => as.find((a) => ["understand", "improve"].includes(a.stage))).filter(Boolean).map((a) => servedMinimum(a.id))));
  const cards = await Promise.all(live.map(async (p, i) => {
    const as = lists[i];
    const langs = [...new Set(as.map((a) => a.language_name).filter(Boolean))];
    const formats = [...new Set(as.map(fmt).filter(Boolean))];
    const reported = as.find((a) => ["understand", "improve"].includes(a.stage));
    const lenses = reported ? await reviewLenses(reported) : null;
    return {
      id: p.id, title: p.name, href: to("project", { pid: p.id }), stage: as[0] ? PILL_OF[as[0].stage] ?? "setup" : "setup",
      language: langs.join(" · ") || "Language not set", format: formats.join(" · ") || "Format not set", formatIcon: formatIconOf(formats),
      orgs: p.organization ? [[p.organization, false]] : [], reviews: Number(p.assessment_count ?? as.length), responses: Number(p.response_count ?? 0),
      activity: as[0] ? ago(as[0].updated_at || as[0].created_at) : "no review yet", levels: lenses ? levelTriples(lenses) : null,
      phone: [langs[0], formats[0]].filter(Boolean).join(" · ") || "No review yet",
    };
  }));
  const year = String(new Date().getFullYear());
  const stats = [["Projects", live.length], ["Languages", new Set(all.map((a) => a.language_name).filter(Boolean)).size], ["Reviews collecting", all.filter((a) => a.stage === "collect").length], ["Results ready", all.filter((a) => a.stage === "understand").length], ["Completed this year", all.filter((a) => a.stage === "improve" && String(a.updated_at || a.created_at).startsWith(year)).length]];
  const candidates = (mine ?? []).filter((p) => !p.archived_at && !p.workspace_id).map((p) => ({ id: p.id, title: p.name, directRole: p.direct_role ?? null }));
  return {
    id: w.id, role: w.role, user: userOf(me), name: w.name, short: w.name,
    lead: "Projects this organisation runs or has been given access to. Partners never see each other's workspaces.",
    stats, views: ["Active", "All", "Archived"], projects: cards, group: { workspaceRole: w.role, candidates },
  };
}

// Invitations (fixtures/people/invitations.json's shape for screens/people/Invitations.svelte): GET /v2/me/invitations, the signed-in
// person's own live invitations with their scope names (src/handlers/grant.ts mine). The server sends no inviter name yet
// (inviter_display_name null) and no history of accepted ones (earlier: []), so neither is drawn.
export const INVITATION_KINDS = Object.freeze({ workspace: "workspace", project: "project", assessment: "review" });
export async function invitationsModel(me) {
  const list = await myInvitations();
  const rows = list.map((i) => ({ id: i.id, scope: i.scope, role: i.role, from: i.inviter_display_name || "", expires: i.expires_at ? shortDate(i.expires_at) : "", when: ago(i.invited_at) }));
  return {
    user: { ...userOf(me), workspace: "" }, desktop: { invitations: rows }, phone: { invitations: rows, earlier: [] },
    kinds: INVITATION_KINDS, can: { owner: "you can change everything", member: "you can start and run reviews", viewer: "you can read results" },
    phoneCan: { owner: "change everything", member: "facilitate reviews", viewer: "read results" }, roles: ROLES,
  };
}

// Explore (fixtures/explore/explore.json's shape for screens/explore/Explore.svelte): every review the account can see, from Home's real
// projects and reviews (a failed read is the shell's error), with each review's real response count and, where a report is built, its
// per-perspective score and count (explore-data.js levelOf bands them). No filter, grouping or saved view is wired (the server has
// no list/roll-up capability for them), so none is claimed: the chips, group-by options and add-filter rows are empty.
export async function exploreModel(me) {
  const home = await homeModel(me);
  // Explore bands with the results lane's cut-off (explore-data.js levelOf): the strictest level minimum its reported reviews serve.
  const levelMinimum = useStrictest(await Promise.all(home.rows.filter(({ a }) => ["understand", "improve"].includes(a.stage)).map(({ a }) => servedMinimum(a.id))));
  const rows = await Promise.all(home.rows.map(async ({ a, p }) => ({
    id: a.id, title: a.name, project: p.name, language: a.language_name || "", region: "", orgs: p.organization || "",
    stage: Object.hasOwn(PILL_OF, a.stage) ? a.stage : "prepare", responses: { n: Number(a.response_count ?? 0) }, lenses: await reviewLenses(a),
    updated: ago(a.updated_at || a.created_at), href: to(a.stage === "prepare" ? "review" : a.stage === "collect" ? "collect" : "results", { aid: a.id }),
  })));
  const phone = rows.map((r) => ({ title: r.title, href: r.href, meta: [r.project, monthOf(home.rows.find((x) => x.a.id === r.id)?.a.created_at)].filter(Boolean).join(" · "), team: r.lenses?.team ?? null }));
  return { levelMinimum, user: home.user, workspace: home.workspace, visible: rows.length, filters: [], groupBy: { options: ["None"], selected: "None" }, addFilter: [], reviews: rows, phone: { chips: [], rows: phone, sheet: [] } };
}
