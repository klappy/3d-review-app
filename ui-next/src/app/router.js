// UI Next (v4) live router. Status: provisional (playbook rule 12). Plain JS, no Svelte import, so vitest and href.js can use it.
// Normal navigation for /next/: every screen is a hash route (`/next/#/review/<aid>/collect`), the same convention the current UI
// uses at `/#project/<id>` (ui/assess/assess.js route()), so links, browser back/forward, reload and deep links all work with
// no server change (the Worker serves ./ui as static assets; a path route would 404 there). The fixture harness keeps its
// `?screen=` query form (route.js); the hash wins when both are present.
//
// Route table: [name, pattern]. `name` is the registered screen name (screens/<lane>/index.js) or a built-in view; `:x` segments are
// params. `#survey=<token>` (a production survey link opened under /next/) is the participant entry; `#session=` is left to the
// current UI. A bare `#name` (the lanes' literal "#home", "#setup", "#explore" links) resolves to the route of that name with no
// params, so the seven lanes' hand-written anchors keep working as normal links.
export const ROUTES = Object.freeze([
  ["home", "/"],
  ["landing", "/welcome"],
  ["about", "/about"],
  ["sign-in", "/signin"],
  ["sign-in-check", "/signin/check"],
  ["help", "/help"],
  ["feedback", "/feedback"],
  ["explore", "/explore"],
  ["workspaces", "/workspaces"],
  ["workspace", "/workspace/:wid"],
  ["workspace-group", "/workspace/:wid/group"],
  ["people", "/people"],
  ["people-workspace", "/workspace/:wid/people"],
  ["invitations", "/invitations"],
  ["setup", "/setup"],
  ["setup1", "/setup/1"],
  ["setup2", "/setup/2"],
  ["setup3", "/setup/3"],
  ["setup4", "/setup/4"],
  ["setup5", "/setup/5"],
  ["project", "/project/:pid"],
  ["review", "/review/:aid"],
  ["collect", "/review/:aid/collect"],
  ["qr-room", "/review/:aid/collect/qr"],
  ["close-collection", "/review/:aid/collect/close"],
  ["print-qr", "/review/:aid/collect/print"],
  ["results", "/review/:aid/results"],
  ["results-answers", "/review/:aid/results/answers"],
  ["results-gaps", "/review/:aid/results/gaps"],
  ["results-held", "/review/:aid/results/held"],
  ["report", "/review/:aid/report"],
  ["report-detailed", "/review/:aid/report/detailed"],
  ["next-step", "/review/:aid/next-step"],
  ["action-plan", "/review/:aid/action-plan"],
  ["share", "/review/:aid/share"],
  ["print", "/review/:aid/print"],
  ["paper-entry", "/review/:aid/paper"],
  ["sandbox", "/sandbox"],
  ["menu", "/menu"],
  ["p-code", "/p/code"],
  ["p-welcome", "/p/welcome"],
  ["p-passage", "/p/passage"],
  ["p-about", "/p/about"],
  ["p-question", "/p/q/:n"],
  ["p-review", "/p/review"],
  ["p-receipt", "/p/receipt"],
  ["p-problem", "/p/problem"],
]);
// Extra keys the lanes pass to href() that are route params rather than query: href("p-question", { q: 3 }) -> /p/q/3.
const EXTRA_PARAM = Object.freeze({ q: "n" });
const BY_NAME = new Map(ROUTES.map(([name, pattern]) => [name, pattern]));
const compiled = ROUTES.map(([name, pattern]) => {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return "/([^/]+)"; }) + "/?$");
  return { name, re, keys };
});

export const ENTRY = /^#survey=/;
export const SAMPLE_AID = "sample"; // #/review/sample/results|report…: the results lane on the fixture report, labelled sample data (captain 2026-10-22: show the look and feel)
export const SAMPLE_HREF = "/?demo=1#assessment/demo-assessment/results"; // the current design's sample review (ui/demo.js)

// parse(hash) -> { name, params, query: URLSearchParams }. Unknown -> home (ruling 12:53 in the current UI: never a page that shows sign-in).
export function parse(hash = "") {
  const h = String(hash || "");
  if (ENTRY.test(h)) return { name: "p-entry", params: {}, query: new URLSearchParams() };
  let body = h.replace(/^#/, "");
  let query = new URLSearchParams();
  // An in-page anchor rides after a second "#" (`#/review/<aid>/collect#offline`: the lanes' literal "collect#offline" links);
  // it names an element id on the screen, never a route.
  let anchor = "";
  const ai = body.indexOf("#");
  if (ai >= 0) { anchor = body.slice(ai + 1); body = body.slice(0, ai); }
  const qi = body.indexOf("?");
  if (qi >= 0) { query = new URLSearchParams(body.slice(qi + 1)); body = body.slice(0, qi); }
  if (!body) return { name: "home", params: {}, query, anchor };
  if (!body.startsWith("/")) {
    // "#results" is the lanes' "Try the sample review": the sample lives in the current design (ui/demo.js, in-memory demo data at
    // /?demo=1#assessment/demo-assessment), so the live app hands the visitor there rather than looping Home → Landing.
    if (body === "results") return { name: "results", params: { aid: SAMPLE_AID }, query, anchor }; // the sample review, in this design, labelled sample
    const bare = { workspace: "workspaces", project: "home", review: "home", signin: "sign-in", "survey-code": "p-code", survey: "p-code", video: "help", main: "home", practice: "sandbox", "next-step": "home", "help-h7": "help", tour: "about" }[body] ?? body;
    return { name: BY_NAME.has(bare) && !BY_NAME.get(bare).includes(":") ? bare : "home", params: {}, query, anchor };
  }
  for (const { name, re, keys } of compiled) {
    const m = re.exec(body);
    if (!m) continue;
    const params = {};
    keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
    return { name, params, query, anchor };
  }
  return { name: "home", params: {}, query, anchor };
}

// to(name, params, query) -> "#/..." ; a missing param throws (a link to nowhere is a bug, not a 404).
export function to(name, params = {}, query = {}) {
  const pattern = BY_NAME.get(name);
  if (!pattern) throw new Error(`router: unknown route "${name}"`);
  const path = pattern.replace(/:(\w+)/g, (_, k) => {
    const v = params[k] ?? params[Object.keys(EXTRA_PARAM).find((e) => EXTRA_PARAM[e] === k)];
    if (v == null || v === "") throw new Error(`router: route "${name}" needs :${k}`);
    return encodeURIComponent(String(v));
  });
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v != null && v !== false && v !== "") q.set(k, String(v));
  const s = q.toString();
  return `#${path}${s ? `?${s}` : ""}`;
}
export const needs = (name) => (BY_NAME.get(name)?.match(/:(\w+)/g) ?? []).map((s) => s.slice(1));
export const isRoute = (name) => BY_NAME.has(name);
// Split href() extras into route params and query for a live link.
export function linkFor(name, extra = {}, ctx = {}) {
  const params = { ...ctx };
  const query = {};
  for (const [k, v] of Object.entries(extra)) {
    if (k === "w" || k === "theme") continue; // presentation is the live shell's, not the link's
    if (EXTRA_PARAM[k]) params[EXTRA_PARAM[k]] = v; else query[k] = v;
  }
  // A setup screen reached from a review (the stage tabs' "Prepare", a review-page link) carries that review in the query — the
  // setup routes have no :aid (they are the new-review wizard too) — so the live app can show the review's own read-only data.
  // The review's People page ("people", no :aid: the route is the one the lanes link by name) carries its review the same way.
  if ((name.startsWith("setup") || name === "people") && ctx.aid && !(BY_NAME.get(name) ?? "").includes(":aid")) query.review = ctx.aid;
  // A lane link to a review-scoped screen from a page with no review in context (Home's "#setup") lands on Home, never nowhere.
  try { return to(name, params, query); } catch { return to("home"); }
}
