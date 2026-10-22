// UI Next (v4) workspace data. Status: provisional. Reads only the /v2 routes the current UI reads (ui/assess/scope.js, views.js,
// share.js, report-build.js); builds view models in the shapes the lane screens already draw (collect/model.js, results/data.js, home.json).
import { api, confirmed, enc, token } from "./api.js";
import { lensLabel } from "../../../ui/report-lenses.js";
import { v3ScoreBand, v3ExpectedFor } from "../../../ui/assess/v3-assessment.js";
import { parsePeriod, collectLine } from "../../../ui/v3/components/active-until.js";
import { LEVEL_KEY, LEVEL_WORD, bandRows, lensCards } from "../screens/results/data.js";
import { to } from "./router.js";
import qrcode from "../../../ui/assess/vendor-qrcode.js";

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
// Answer-by-answer rows: the server answers with a typed suppression for everyone (src/handlers/response.ts list: D7 disclosure
// policy unresolved, no row-level disclosure even to owners). The screen shows that real state, never sample rows.
export const responsesList = async (aid) => api(`/v2/assessments/${enc(aid)}/responses`);
export const reports = async (aid) => api(`/v2/assessments/${enc(aid)}/reports`);
export const report = async (id) => (await api(`/v2/reports/${enc(id)}`)).report;
export const buildReport = (aid) => confirmed(`/v2/assessments/${enc(aid)}/reports`);
export const issueLink = (aid, sid) => confirmed(`/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`, { params: {} });

// Home: fixtures/home.json's shape from the account's real projects and reviews, so the approved screens/Home.svelte composition draws
// it unchanged: groups by stage (results | collecting | setup), completed (stage improve), the account, the first workspace. No invitation
// store is read tonight (invitations: null draws no invitation card; parity-loop row).
const fmt = (a) => (a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "");
export async function homeModel(me) {
  const [ps, ws] = await Promise.all([projects(), workspaces().catch(() => [])]);
  // A project's reviews failing to load is an error the shell shows (retryable), never an empty list that would draw a first-review
  // welcome to an established account.
  const lists = await Promise.all(ps.filter((p) => !p.archived_at).map((p) => assessmentsOf(p.id).then((as) => as.map((a) => ({ a, p })))));
  const all = lists.flat().filter(({ a }) => !a.archived_at).sort((x, y) => String(y.a.created_at).localeCompare(String(x.a.created_at)));
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
  return { user: { first, name: me?.principal?.display_name || "", initials }, workspace: ws[0]?.name ?? "Your workspace", workspaces: ws, projects: ps, invitation: null, phoneOrder: ["collecting", "setup", "results"], groups, completed, empty: !all.length, start: "/#new" };
}

// Project: fixtures/setup/project.json's shape for screens/setup/Project.svelte (desktop two tracks, phone list). Levels per review come
// from each review's newest built report when there is one (results/data.js levelOf on payload.lenses); the trend aside draws the
// reviews that have levels, newest last.
export async function projectModel(pid) {
  const [p, as, ws] = await Promise.all([project(pid), assessmentsOf(pid), workspaces().catch(() => [])]);
  const live = as.filter((a) => !a.archived_at).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  const w = ws.find((x) => x.id === p.workspace_id) ?? ws[0] ?? { name: "Your workspace" };
  const lvl = await Promise.all(live.map(async (a) => {
    if (!["understand", "improve"].includes(a.stage)) return null;
    try { const r = await reports(a.id); const newest = (r.reports ?? []).filter((x) => x?.id).sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")))[0]; if (!newest) return null; const rep = newest.payload ? newest : await report(newest.id); return levelsOf(rep.payload, await lensCounts(a.id)); } catch { return null; }
  }));
  const month = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
  const reviews = live.map((a, i) => {
    const stage = a.stage === "improve" ? "done" : (STAGE_OF[a.stage] ?? "setup");
    const toKey = stage === "done" ? "nextStep" : stage === "results" ? "results" : "collect";
    return { id: a.id, when: month(a.created_at), title: a.name, stage, to: toKey, href: to(stage === "done" || stage === "results" ? "results" : stage === "collecting" ? "collect" : "review", { aid: a.id }), note: stage === "setup" ? "Setup not finished" : "No results yet", levels: lvl[i] ? Object.entries(lvl[i]).filter(([, l]) => l) : undefined, overall: lvl[i]?.overall };
  });
  const withLevels = reviews.filter((r) => r.levels).reverse().slice(-4); // the board's trend is four points wide (Project.svelte X(i) = 70 + 110 i in a 420 box): the newest four
  const lines = {};
  for (const lens of ["team", "community", "church"]) { const col = withLevels.map((r) => Object.fromEntries(r.levels)[lens]).filter(Boolean); if (col.length) lines[lens] = withLevels.map((r) => Object.fromEntries(r.levels)[lens] ?? "more"); }
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
// Respondents per perspective for a review (the survey counts the Results page bands with): v3ScoreBand holds a perspective at
// "More input needed" under three, so a trend never shows a level from one or two people.
export async function lensCounts(aid) {
  const { surveys } = await assessment(aid);
  const live = surveys.filter((s) => !s.archived_at);
  const per = await Promise.all(live.map((s) => surveyCounts(aid, s.id).catch(() => null)));
  const counts = { team: 0, community: 0, church: 0 };
  live.forEach((s, i) => { const k = lensKeyOf(s.perspective); if (k) counts[k] += Number(per[i]?.counts?.respondents ?? 0); });
  return counts;
}
export function levelsOf(payload, counts = null) {
  const out = {};
  // v3ScoreBand holds a perspective at "More input needed" under three responses: the count comes from the payload's own evidence
  // (n_responses / respondents per lens) when it carries one; without a count the band is held (never shown as a level on a guess).
  for (const l of payload?.lenses ?? []) { const k = lensKeyOf(l.lens) ?? l.lens; const n = Number(counts?.[k] ?? NaN); const w = v3ScoreBand(Number(l.score), Number.isFinite(n) ? n : 0); out[k] = LEVEL_KEY[w] ?? "more"; }
  return Object.keys(out).length ? out : null;
}

// Collect: the shape collect/model.js collectModel() reads (groups[].surveys[] with code/answered/expected/qr, review meta, room).
export async function collectModel(aid, origin = globalThis.location?.origin ?? "") {
  const { assessment: a, surveys } = await assessment(aid);
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const live = surveys.filter((s) => !s.archived_at);
  // The same stores the current UI reads (ui/assess/assess.js): the project's languages resolve language_id when the assessment
  // carries no language_name; passages name what to read first; the expected count per survey is browser-local (v3:expected,
  // never an API field) — a facilitator sees the number they typed on this browser, as today.
  const [counts, langs, passages] = await Promise.all([
    Promise.all(live.map((s) => surveyCounts(aid, s.id).catch(() => null))),
    a.language_name || !a.language_id ? Promise.resolve([]) : api(`/v2/projects/${enc(a.project_id)}/languages`).then((r) => r?.languages ?? []).catch(() => []),
    api(`/v2/assessments/${enc(aid)}/passages`).then((r) => r?.passages ?? []).catch(() => []),
  ]);
  const language = a.language_name || langs.find((l) => l.id === a.language_id)?.name || "";
  const passage = [...new Set(passages.map((x) => String(x?.reference || x?.title || "").trim()).filter(Boolean))].join(" · ");
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
    printQr: { checked: live.map((s) => s.id), layouts: [{ title: "One page per survey", help: "A full-page code to pin up or hold up.", per: "survey" }, { title: "Hand-out cards", help: "Six cards per page, cut along the lines, one survey per sheet.", per: "sheet", cards: 6 }, { title: "All on one page", help: "Every selected code on one sheet, for the table.", per: "one" }], languages: [language || "English"], papers: ["A4", "Letter"], pageLanguages: language || "English" },
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
// alone cannot tell identities apart (SECURITY-575-8583e170 finding 1).
export function clearLinks() { LINKS.clear(); }
export async function linkFor(aid, sid) {
  const k = `${token() ?? ""}|${aid}/${sid}`;
  if (LINKS.has(k)) return LINKS.get(k);
  const out = await issueLink(aid, sid);
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

// Results: the newest built report (or build one) in the shape results/data.js reads: { review, counts, payload } plus a held reason.
export async function resultsModel(aid, { build = false } = {}) {
  // The report list and every survey count must load: a failed read is the shell's retryable error, never an empty list (which
  // would offer a build beside an existing report) nor a zero (which would band a perspective as held and understate the total).
  const [{ assessment: a, surveys }, res, rep] = await Promise.all([assessment(aid), results(aid).catch((e) => ({ error: e })), reports(aid)]);
  const p = await project(a.project_id).catch(() => ({ name: "Project", id: a.project_id }));
  const live = surveys.filter((s) => !s.archived_at);
  const counts = { team: 0, community: 0, church: 0 };
  const per = await Promise.all(live.map((s) => surveyCounts(aid, s.id)));
  live.forEach((s, i) => { const k = lensKeyOf(s.perspective); if (k) counts[k] += Number(per[i]?.counts?.respondents ?? 0); });
  const responses = per.reduce((n, c) => n + Number(c?.counts?.responses ?? 0), 0);
  let list = Array.isArray(rep?.reports) ? rep.reports.filter((x) => x?.id) : [];
  let built = null, held = null;
  // Loading a route never writes: a missing report is reported as not built (the screen offers an explicit "Build the report",
  // which runs the existing confirmed dry-run → execute pair). `build` is kept for that explicit action only.
  if (!list.length && build) {
    const out = await buildReport(aid);
    if (out.held) held = out.preview; else list = [out.result?.report].filter(Boolean);
  }
  const newest = list.sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")))[0];
  if (newest) built = newest.payload ? newest : await report(newest.id);
  const review = { id: a.id, project: p.name, projectId: a.project_id, language: a.language_name || "", modality: a.format ? a.format[0].toUpperCase() + a.format.slice(1) : "", title: a.name, stage: a.stage === "collect" ? "collecting" : built ? "results" : "closed", closed: a.stage === "collect" ? "" : shortDate(a.updated_at || a.created_at), closedLong: "", builtOn: built ? shortDate(built.created_at) : "", responses }; // results lane StagePill: the review's real state — collecting | closed (no report yet) | results
  return { aid, review, counts, payload: built?.payload ?? null, reportId: built?.id ?? null, held: held ?? (res?.status === "held" ? res : null), results: res, serverStage: a.stage, canBuild: ["owner", "member"].includes(a.role) };
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
    return { lens, perspective: { team: "Translation Team", community: "Community", church: "Church" }[lens], name, who: "", checked: mine.length > 0, phoneNote: mine.map((s) => s.template_name || s.template_id).join(" · ") || "No survey", rolesLabel: "", roles: mine.map((s) => ({ name: s.template_name || s.template_id, note: "own survey", checked: true, expected: expectedOf(s.id) ?? 0 })) };
  });
  const sub = [p.name, language, fmt(a)].filter(Boolean).join(" · ");
  const summary = [
    { label: "Review", main: a.name, strong: true, sub, step: 1 },
    { label: "People respond to", main: passage, sub: "", step: 2 },
    { label: "Answer languages", main: language, step: 2 },
    { label: "Location or community", main: a.location || "", step: 1 },
    { label: "Facilitator", main: a.facilitator || "", step: 1 },
    { label: "Survey open", main: period, step: 1 },
    { label: "Who will participate", step: 3, derive: "who" },
    { label: "About each group", sub: a.demographics_enabled ? "Participants asked age range and gender (skippable)" : "Participants are not asked about themselves", step: 4, derive: "about" },
  ];
  const phoneSummary = [{ label: "Review", value: a.name, step: 1 }, { label: "Respond to", value: passage, step: 2 }, { label: "Who", step: 3, derive: "who" }, { label: "Open", value: period, step: 1 }];
  return { aid: a.id, stage: a.stage, summary, phoneSummary, groups, context: { open: null, values: {}, demographics: !!a.demographics_enabled }, steps: null, canLaunch: a.stage === "prepare" && live.length > 0 && ["owner", "member"].includes(a.role) }; // launch only while preparing (TICKET 4: Setup is read-only otherwise)
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
    review: { title: m.review.title, language: m.review.language, modality: m.review.modality, updated: m.review.updated },
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
  const cards = lensCards(payload, m.counts);
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
    foot: `Built from ${m.review.responses} response${m.review.responses === 1 ? "" : "s"}${m.review.builtOn ? ` on ${m.review.builtOn}` : ""} · levels are bands, not scores · nothing here identifies a person`,
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
