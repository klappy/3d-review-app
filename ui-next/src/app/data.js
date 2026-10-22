// UI Next (v4) workspace data. Status: provisional. Reads only the /v2 routes the current UI reads (ui/assess/scope.js, views.js,
// share.js, report-build.js); builds view models in the shapes the lane screens already draw (collect/model.js, results/data.js, home.json).
import { api, confirmed, enc } from "./api.js";
import { lensLabel } from "../../../ui/report-lenses.js";
import { to } from "./router.js";
import qrcode from "../../../ui/assess/vendor-qrcode.js";

export const LENS_KEY = Object.freeze({ "Translation Team": "team", Community: "community", Church: "church" });
export const lensKeyOf = (perspective) => LENS_KEY[perspective] ?? LENS_KEY[lensLabel(perspective) === lensLabel("Translation Team") ? "Translation Team" : lensLabel(perspective) === lensLabel("Community") ? "Community" : lensLabel(perspective) === lensLabel("Church") ? "Church" : ""] ?? null;
// The lanes' Pill stage words (results | collecting | setup | reviewed) from the server stage ids (prepare | collect | understand | improve).
export const STAGE_OF = Object.freeze({ prepare: "setup", collect: "collecting", understand: "results", improve: "results" });
const shortDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const ago = (iso) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return ""; const m = Math.round((Date.now() - t) / 60000); if (m < 2) return "just now"; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 36) return `${h} h ago`; return shortDate(iso); };

export const workspaces = async () => (await api("/v2/workspaces")).workspaces ?? [];
export const projects = async () => (await api("/v2/projects")).projects ?? [];
export const project = async (pid) => (await api(`/v2/projects/${enc(pid)}`)).project ?? (await api(`/v2/projects/${enc(pid)}`));
export const assessmentsOf = async (pid) => (await api(`/v2/projects/${enc(pid)}/assessments`)).assessments ?? [];
export const assessment = async (aid) => api(`/v2/assessments/${enc(aid)}`); // { assessment, surveys }
export const surveyCounts = async (aid, sid) => api(`/v2/assessments/${enc(aid)}/surveys/${enc(sid)}`); // { survey, counts, expected_count? }
export const setStage = async (aid, stage) => api(`/v2/assessments/${enc(aid)}/stage`, { method: "POST", body: { stage } });
export const results = async (aid) => api(`/v2/assessments/${enc(aid)}/results`);
export const reports = async (aid) => api(`/v2/assessments/${enc(aid)}/reports`);
export const report = async (id) => (await api(`/v2/reports/${enc(id)}`)).report;
export const buildReport = (aid) => confirmed(`/v2/assessments/${enc(aid)}/reports`);
export const issueLink = (aid, sid) => confirmed(`/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`, { params: {} });

// Home: every review the account can see, newest first, grouped by stage the way home.json draws them.
export async function homeModel(me) {
  const [ps, ws] = await Promise.all([projects(), workspaces().catch(() => [])]);
  const lists = await Promise.all(ps.filter((p) => !p.archived_at).map((p) => assessmentsOf(p.id).then((as) => as.map((a) => ({ a, p }))).catch(() => [])));
  const reviews = lists.flat().filter(({ a }) => !a.archived_at).sort((x, y) => String(y.a.created_at).localeCompare(String(x.a.created_at)));
  const row = ({ a, p }) => {
    const stage = STAGE_OF[a.stage] ?? "setup";
    const n = Number(a.response_count ?? 0);
    return {
      id: a.id, project: p.name, projectId: p.id, title: a.name, stage,
      href: to(stage === "setup" ? "review" : stage === "collecting" ? "collect" : "results", { aid: a.id }),
      meta: [a.language_name || "", a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "", `${n} response${n === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
      action: stage === "setup" ? "Continue setup" : stage === "collecting" ? "Open collection" : "See results",
    };
  };
  const groups = ["results", "collecting", "setup"].map((stage) => ({ stage, reviews: reviews.map(row).filter((r) => r.stage === stage) })).filter((g) => g.reviews.length);
  return { user: me?.principal ?? null, workspace: ws[0]?.name ?? "Your workspace", workspaces: ws, projects: ps, reviews: reviews.map(row), groups, empty: !reviews.length };
}

// Collect: the shape collect/model.js collectModel() reads (groups[].surveys[] with code/answered/expected/qr, review meta, room).
export async function collectModel(aid, origin = globalThis.location?.origin ?? "") {
  const { assessment: a, surveys } = await assessment(aid);
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const live = surveys.filter((s) => !s.archived_at);
  const counts = await Promise.all(live.map((s) => surveyCounts(aid, s.id).catch(() => null)));
  const byLens = new Map();
  live.forEach((s, i) => {
    const key = lensKeyOf(s.perspective) ?? "team";
    const c = counts[i];
    const answered = Number(c?.counts?.responses ?? 0);
    const expected = Number(c?.expected_count ?? c?.survey?.expected_count ?? s.expected_count ?? 0) || Math.max(answered, 1);
    const row = { id: s.id, name: s.template_name || s.template_id, room: s.template_name || s.template_id, code: "", answered, expected, open: s.collection_status === "open", qr: null, link: null };
    if (!byLens.has(key)) byLens.set(key, []);
    byLens.get(key).push(row);
  });
  const groups = [...byLens].map(([lens, rows]) => ({ lens, surveys: rows }));
  const stage = STAGE_OF[a.stage] ?? "setup";
  return {
    aid, projectId: a.project_id, origin,
    user: { first: "", initials: "" }, workspace: "",
    project: { name: p.name, href: to("project", { pid: a.project_id }) },
    review: { id: a.id, title: a.name, stage, language: a.language_name || "", modality: a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "", updated: ago(a.created_at), passage: "", opens: shortDate(a.created_at), closes: "", daysLeft: null, serverStage: a.stage },
    room: { opened: counts.reduce((n, c) => n + Number(c?.counts?.respondents ?? 0), 0), refused: 0 },
    groups, linkHost: `${origin}/next/#survey=`,
  };
}
// Issue (or reuse this tab's) survey link for a survey and attach its QR modules: the raw token lives only in this tab's memory.
const LINKS = new Map();
export async function linkFor(aid, sid) {
  const k = `${aid}/${sid}`;
  if (LINKS.has(k)) return LINKS.get(k);
  const out = await issueLink(aid, sid);
  if (out.held) throw new Error("This survey is not collecting right now.");
  const r = out.result;
  const fragment = r.entry_fragment || `#survey=${encodeURIComponent(r.link_token)}`;
  const link = { fragment, token: r.link_token, expires_at: r.expires_at };
  LINKS.set(k, link);
  return link;
}
export function qrModules(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount();
  let cells = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells += q.isDark(r, c) ? "1" : "0";
  return { n, cells };
}

// Results: the newest built report (or build one) in the shape results/data.js reads: { review, counts, payload } plus a held reason.
export async function resultsModel(aid, { build = false } = {}) {
  const [{ assessment: a, surveys }, res, rep] = await Promise.all([assessment(aid), results(aid).catch((e) => ({ error: e })), reports(aid).catch((e) => ({ error: e }))]);
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const live = surveys.filter((s) => !s.archived_at);
  const counts = { team: 0, community: 0, church: 0 };
  const per = await Promise.all(live.map((s) => surveyCounts(aid, s.id).catch(() => null)));
  live.forEach((s, i) => { const k = lensKeyOf(s.perspective); if (k) counts[k] += Number(per[i]?.counts?.respondents ?? 0); });
  const responses = per.reduce((n, c) => n + Number(c?.counts?.responses ?? 0), 0);
  let list = Array.isArray(rep?.reports) ? rep.reports.filter((x) => x?.id) : [];
  let built = null, held = null;
  if (!list.length && build) {
    const out = await buildReport(aid);
    if (out.held) held = out.preview; else list = [out.result?.report].filter(Boolean);
  }
  const newest = list.sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")))[0];
  if (newest) built = newest.payload ? newest : await report(newest.id);
  const review = { id: a.id, project: p.name, projectId: a.project_id, language: a.language_name || "", modality: a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "", title: a.name, stage: STAGE_OF[a.stage] ?? "setup", closed: "", closedLong: "", builtOn: built ? shortDate(built.created_at) : "", responses };
  return { aid, review, counts, payload: built?.payload ?? null, reportId: built?.id ?? null, held: held ?? (res?.status === "held" ? res : null), results: res, serverStage: a.stage };
}

// Gap names for ResultsGaps/Report (results/data.js bandRows reads the payload's cross-perspective areas by construct name):
// biggest = the three widest agreement ranges, agree = the narrowest one; radar = every multi-perspective area.
const areasOf = (payload) => (Array.isArray(payload?.cross_lens_multi) ? payload.cross_lens_multi.filter((a) => a?.construct_name) : []);
export function gapsOf(payload) {
  const a = areasOf(payload).slice().sort((x, y) => Number(y.agreement_range ?? 0) - Number(x.agreement_range ?? 0));
  return { biggest: a.slice(0, 3).map((x) => x.construct_name), agree: a.length > 3 ? [a[a.length - 1].construct_name] : [] };
}
export const radarOf = (payload) => areasOf(payload).map((a) => a.construct_name).slice(0, 8);
