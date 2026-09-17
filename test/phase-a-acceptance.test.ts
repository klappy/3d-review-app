// Phase A — partial static assertions against selected proposed 04-ACCEPTANCE observables; not full acceptance.
// Fresh local D1 fixtures exercise the app. Missing positives, negatives, HTTP/MCP twins and source tensions are
// recorded in docs/phase-a-coverage.md. DIVERGENCE assertions pin current behavior, not accepted requirements.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "acc", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "acc-db" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
let env: any, db: D1Database, O: string, VW: string, NEW: string, UNPROV: string;
type R = { status: number; ok: boolean; code?: string; result?: any; receipt?: any; error?: any; raw: any };
async function call(method: string, path: string, body?: unknown, bearer?: string): Promise<R> {
  const r = await app.fetch(new Request("https://t.invalid" + path, { method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, ok: j.ok === true, code: j.error?.code, result: j.result, receipt: j.receipt, error: j.error, raw: j };
}
async function mcp(tool: string, capability: string, params: Record<string, unknown> = {}, bearer?: string, extra: Record<string, unknown> = {}): Promise<R> {
  const r = await app.fetch(new Request("https://t.invalid/mcp", { method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: { capability, params, ...extra } } }) }), env);
  const j: any = (await r.json().catch(() => ({}))).result?.structuredContent ?? {};
  return { status: r.status, ok: j.ok === true, code: j.error?.code, result: j.result, receipt: j.receipt, error: j.error, raw: j };
}
const observed: string[] = [];
const note = (row: string, what: string) => observed.push(`${row} ${what}`);

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-acceptance", ENVIRONMENT: "dev" };
  O = await mintSession(env, "person_mara", "user"); VW = await mintSession(env, "person_ion", "user");
  await db.prepare("INSERT INTO principal (id,email_hash,provisioned,support,created_at) VALUES ('usr_new','h_new',1,0,'2026-09-16T00:00:00Z'),('usr_unprov','h_unprov',0,0,'2026-09-16T00:00:00Z')").run();
  NEW = await mintSession(env, "usr_new", "user"); UNPROV = await mintSession(env, "usr_unprov", "user");
}, 60_000);
afterAll(() => { if (observed.length) console.log("PHASE-A OBSERVED\n" + observed.join("\n")); });

describe("04-ACCEPTANCE rows 1–2, 32–33 — public entry", () => {
  it("1 entry.intents: six intents, identical signed in", async () => {
    const a = await call("GET", "/v2/entry"), b = await call("GET", "/v2/entry", undefined, O);
    expect(a.status).toBe(200); expect(a.result.intents.map((i: any) => i.id)).toEqual(["what", "how", "example", "take survey", "manage", "view results"]);
    expect(b.result.intents).toEqual(a.result.intents);
  });
  it("2 entry.example: fixture, survey and summary; owner mutation attempts return a 4xx status", async () => {
    const a = await call("GET", "/v2/example"); expect(a.ok).toBe(true); expect(a.result.fixture).toBe(true);
    expect(a.result.assessment.surveys.length).toBeGreaterThan(0); expect(a.result.assessment.summary).toBeTruthy();
    for (const m of ["POST", "PATCH", "DELETE"]) expect([404, 405, 400]).toContain((await call(m, "/v2/example", {}, O)).status);
  });
  it("32 ops.health: D1-only dependency and truthy contract; selected sensitive strings absent", async () => {
    const h = await call("GET", "/v2/health"); expect(h.status).toBe(200); expect(h.result.deps.d1).toBe("ok"); expect(h.result.contract).toBeTruthy();
    expect(JSON.stringify(h.raw)).not.toMatch(/secret|api_key|workers\.dev|cloudflareaccess/i);
    expect(Object.keys(h.result.deps)).toEqual(["d1"]); // DIVERGENCE as observed: line asks for D1, KV, email sender (Fable's to add after #15/#16)
    note("32", `health deps reported: ${Object.keys(h.result.deps).join(",")} (line asks for D1, KV, email sender)`);
  });
  it("33 ops.feedback: accepted without a session, receipt", async () => {
    const f = await call("POST", "/v2/feedback", { helpful: true, capability: "cap.entry.intents", page: "/" });
    note("33", `feedback → ${f.status} ${f.ok ? "ok receipt=" + !!f.receipt : f.code}`);
    const stripped = await call("POST", "/v2/feedback", { helpful: false, answers: { Q1: "x" } });
    note("33", `feedback with answers field → ${stripped.status} ${stripped.ok ? JSON.stringify(stripped.result).slice(0, 120) : stripped.code}`);
    expect(f.ok).toBe(true); expect(f.receipt).toBeTruthy();
    expect(stripped.ok).toBe(true); expect(stripped.result.stripped).toBe(true);
    const lastFeedback = await db.prepare("SELECT * FROM feedback ORDER BY rowid DESC LIMIT 1").first(); expect(lastFeedback).toBeTruthy();
    expect(JSON.stringify(lastFeedback)).not.toContain('"Q1"');
  });
});

describe("rows 3–4 — session", () => {
  it("3 auth.consume_link: single-use code issues a session; reuse and expiry refuse with a reason", async () => {
    const email = "acc.owner@example.invalid";
    const link = await call("POST", "/v2/auth/link", { email }); const code = link.result.dev_only_code;
    const s = await call("POST", "/v2/auth/session", { email, code }); expect(s.ok).toBe(true);
    expect((await call("GET", "/v2/me", undefined, s.result.session)).result.principal.kind).toBe("user");
    const again = await call("POST", "/v2/auth/session", { email, code }); expect(again.code).toBe("INVALID_PARAMS"); expect(again.error.message).toBe("code_used");
    const l2 = await call("POST", "/v2/auth/link", { email }); await db.prepare("UPDATE login_code SET expires_at = 1").run();
    const exp = await call("POST", "/v2/auth/session", { email, code: l2.result.dev_only_code }); expect(exp.code).toBe("INVALID_PARAMS"); expect(exp.error.message).toBe("code_expired");
  });
  it("4 auth.logout: credential dies; DIVERGENCE — logout with no session is NOT_AUTHENTICATED, not the idempotent 200 the line asks for", async () => {
    const t = await mintSession(env, "person_mara", "user");
    const out = await call("DELETE", "/v2/auth/session", undefined, t); expect(out.status).toBe(200); expect(out.receipt).toBeTruthy();
    expect((await call("GET", "/v2/me", undefined, t)).code).toBe("NOT_AUTHENTICATED");
    const none = await call("DELETE", "/v2/auth/session"); expect(none.code).toBe("NOT_AUTHENTICATED"); // ruled by Astra 5706310753: never signed_out:true without a live session
  });
});

describe("rows 5–12 — workspaces, projects, languages", () => {
  let ws: string, pid: string;
  it("5/6/7/8/9 workspace create → list → get → update(+inverse) → archive/unarchive; negatives", async () => {
    const c = await call("POST", "/v2/workspaces", { name: "Acceptance WS" }, NEW); expect(c.ok).toBe(true); expect(c.receipt).toBeTruthy(); ws = c.result.workspace.id;
    expect(c.status).toBe(200); // DIVERGENCE as observed: line says 201; every create in this API answers 200 with a receipt
    note("5", `create status ${c.status} (line says 201)`);
    const un = await call("POST", "/v2/workspaces", { name: "nope" }, UNPROV); expect(un.code).toBe("NOT_AUTHORIZED_AT_SCOPE"); expect(JSON.stringify(un.error)).toContain("cap.request.create");
    const list = await call("GET", "/v2/workspaces", undefined, NEW); expect(list.result.workspaces.map((w: any) => w.id)).toEqual([ws]); expect(list.result.workspaces[0].role).toBe("owner");
    const empty = await call("GET", "/v2/workspaces", undefined, UNPROV); expect(empty.status).toBe(200); expect(empty.result.workspaces).toEqual([]);
    expect((await call("GET", `/v2/workspaces/${ws}`, undefined, NEW)).ok).toBe(true);
    expect((await call("GET", `/v2/workspaces/${ws}`, undefined, O)).code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    const up = await call("PATCH", `/v2/workspaces/${ws}`, { name: "Renamed WS" }, NEW); expect(up.ok).toBe(true); expect(up.receipt.undo_token).toBeTruthy();
    const bad = await call("PATCH", `/v2/workspaces/${ws}`, { owner: "x" }, NEW); expect(bad.code).toBe("INVALID_PARAMS");
    const undo = await mcp("write", "", {}, NEW, { undo: up.receipt.undo_token }); expect(undo.ok).toBe(true);
    expect((await call("GET", `/v2/workspaces/${ws}`, undefined, NEW)).result.workspace.name).toBe("Acceptance WS");
    const ar = await call("POST", `/v2/workspaces/${ws}/archive`, {}, NEW); expect(ar.ok).toBe(true);
    const listed = (await call("GET", "/v2/workspaces", undefined, NEW)).result.workspaces.find((w: any) => w.id === ws);
    note("9", `archived workspace in list → ${listed ? "still listed, archived_at=" + listed.archived_at : "hidden"} (line implies hidden until unarchive)`);
    expect(listed, "DIVERGENCE as observed: an archived workspace stays listed, flagged").toBeTruthy(); expect(listed.archived_at).toBeTruthy();
    { const un1 = await call("POST", `/v2/workspaces/${ws}/unarchive`, {}, NEW); expect(un1.ok).toBe(true);
      const un2 = await call("POST", `/v2/workspaces/${ws}/unarchive`, {}, NEW); note("9", `second unarchive → ${un2.ok ? "ok (idempotent) receipt=" + !!un2.receipt : un2.code}`); expect(un2.ok).toBe(true);
      expect((await call("GET", "/v2/workspaces", undefined, NEW)).result.workspaces.find((w: any) => w.id === ws).archived_at).toBeNull(); }
  });
  it("10/10a/10b/11 project create, language create/list and update; row12 archive/unarchive omitted", async () => {
    const ownWs = (await call("POST", "/v2/workspaces", { name: "Acceptance WS for projects" }, NEW)).result.workspace.id; // stands alone (review #17-5)
    const c = await call("POST", "/v2/projects", { name: "Acceptance Project", workspace_id: ownWs }, NEW); expect(c.ok).toBe(true); pid = c.result.project.id;
    // DIVERGENCE (row 10 negative, Lane A handler): `workspace_id` is silently IGNORED — the project is created outside any
    // workspace instead of refusing a workspace the caller does not own. Not an escalation (nothing lands in ws_cedar), but
    // a caller is told "ok" for a placement that did not happen. Asserted as observed so a fix flips this line.
    const foreign = await call("POST", "/v2/projects", { name: "x", workspace_id: "ws_cedar" }, NEW);
    expect(foreign.ok).toBe(true); expect(foreign.result.project.workspace_id).toBeNull();
    expect((await call("GET", "/v2/workspaces/ws_cedar", undefined, O)).result.projects?.map?.((p: any) => p.name) ?? []).not.toContain("x");
    note("10", "DIVERGENCE: project.create ignores workspace_id (created with workspace_id=null, ok:true) — line asks NOT_AUTHORIZED_AT_SCOPE for a foreign workspace");
    expect(JSON.stringify((await call("POST", "/v2/projects", { name: "x" }, UNPROV)).error)).toContain("cap.request.create");
    const l = await call("POST", `/v2/projects/${pid}/languages`, { code: "qaa", name: "Invented" }, NEW); expect(l.ok).toBe(true); expect(l.receipt).toBeTruthy();
    expect((await call("POST", `/v2/projects/${pid}/languages`, { code: "qaa", name: "Dup" }, NEW)).code).toBe("INVALID_PARAMS");
    expect((await call("GET", `/v2/projects/${pid}/languages`, undefined, NEW)).result.languages.length).toBe(1);
    expect((await call("GET", `/v2/projects/${pid}/languages`, undefined, O)).code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    expect((await mcp("write", "cap.language.list", { pid }, NEW)).code).toBe("WRONG_TOOL_FOR_CLASS");
    const before = JSON.stringify((await call("GET", `/v2/projects/${pid}/assessments`, undefined, NEW)).result);
    const up = await call("PATCH", `/v2/projects/${pid}`, { name: "Renamed Project" }, NEW); expect(up.ok).toBe(true); expect(up.receipt.undo_token).toBeTruthy();
    expect(JSON.stringify((await call("GET", `/v2/projects/${pid}/assessments`, undefined, NEW)).result)).toBe(before);
    expect((await call("PATCH", `/v2/projects/${pid}`, { stage: "collect" }, NEW)).code).toBe("INVALID_PARAMS");
  });
});

describe("rows 13–17 — assessments", () => {
  it("13/14 assessment-scoped project list refused; one grant in auth.me; direct get and refusal assertions", async () => {
    const mine = await call("GET", "/v2/projects/proj_rill/assessments", undefined, VW);
    note("13", `assessment-scoped viewer listing the project → ${mine.ok ? mine.result.assessments.map((a: any) => a.id).join(",") : mine.code}`);
    // DIVERGENCE (row 13, Lane A): no inheritance hides the PROJECT from an assessment-only grantee, and the only list
    // route is project-scoped — so that person cannot list the one assessment they hold; they find it via auth.me grants.
    // Siblings never leak (the line's negative holds); the positive does not. Asserted as observed.
    expect(mine.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    expect((await call("GET", "/v2/me", undefined, VW)).result.grants.map((g: any) => g.scope_id)).toEqual(["assess_tavo_collect"]);
    const g = await call("GET", "/v2/assessments/assess_tavo_collect", undefined, VW); expect(g.ok).toBe(true); expect(g.result.assessment.role).toBe("viewer");
    for (const k of ["name", "purpose", "stage", "language_id"]) expect(g.result.assessment).toHaveProperty(k);
    expect((await call("GET", "/v2/assessments/assess_tavo_prepare", undefined, VW)).code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    expect((await call("GET", "/v2/assessments/assess_tavo_collect")).code).toBe("NOT_AUTHENTICATED");
  });
  it("15/16/17 purpose and notes updates; stage jump and viewer refused; stage success/undo/counts omitted", async () => {
    const A = "/v2/assessments/assess_tavo_collect";
    expect((await call("PATCH", A, { name: "x" }, VW)).code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const up = await call("PATCH", A, { purpose: "Acceptance purpose" }, O); expect(up.ok).toBe(true); expect(up.receipt.undo_token).toBeTruthy();
    expect((await call("PATCH", A, { stage: "improve" }, O)).code).toBe("INVALID_PARAMS");
    const jump = await call("POST", `${A}/stage`, { stage: "improve" }, O); expect(jump.code).toBe("STAGE_CONFLICT"); /* DIVERGENCE as observed: line says INVALID_PARAMS(stage_not_adjacent) */ note("16", `non-adjacent jump collect→improve → ${jump.code} "${jump.error?.message}"`);
    expect((await call("POST", `${A}/stage`, { stage: "understand" }, VW)).code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const n = await call("PATCH", `${A}/notes`, { notes_reflection: "Acceptance reflection", notes_next_steps: "none" }, O); expect(n.ok).toBe(true); expect(n.receipt.undo_token).toBeTruthy(); note("17", `notes.update → ${n.ok ? "ok undo=" + !!n.receipt?.undo_token : n.code + " " + n.error?.message}`);
    expect((await call("PATCH", `${A}/notes`, { notes_reflection: "x" }, VW)).code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const res = await call("GET", `${A}/results`, undefined, O); expect(res.ok, "results must answer for the owner, or the exclusion check is vacuous").toBe(true);
    expect(JSON.stringify(res.raw)).not.toContain("Acceptance reflection");
    expect(JSON.stringify((await call("GET", A, undefined, VW)).raw)).toContain("Acceptance reflection"); // …while Vw+ does see notes on the assessment itself
  });
});

describe("rows 18–21 — templates", () => {
  it("18/19/20 list (signed-in only), get is versioned + byte-stable, render is public and hides scoring", async () => {
    expect((await call("GET", "/v2/templates")).code).toBe("NOT_AUTHENTICATED");
    const l = await call("GET", "/v2/templates", undefined, O); expect(l.ok).toBe(true);
    const v2 = l.result.templates.filter((t: any) => t.version === 2); expect(v2.length).toBe(9);
    const a = await call("GET", "/v2/templates/tpl_validation@2", undefined, O), b = await call("GET", "/v2/templates/tpl_validation@2", undefined, O);
    expect(a.ok).toBe(true); expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
    expect((await call("GET", "/v2/templates/tpl_validation@99", undefined, O)).code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    expect((await call("GET", "/v2/templates/tpl_validation", undefined, O)).ok).toBe(false);
    const r = await call("GET", "/v2/templates/tpl_validation@2/render?lang=en"); expect(r.ok).toBe(true);
    expect(JSON.stringify(r.result)).not.toMatch(/"weight"|"score"|standalone_indicator/);
    const bad = await call("GET", "/v2/templates/tpl_validation@2/render?lang=zz"); note("20", `render unsupported lang → ${bad.ok ? "ok (falls back)" : bad.code}`);
    expect(bad.ok).toBe(true); // DIVERGENCE as observed: line asks INVALID_PARAMS + the supported set; the app falls back silently
  });
  it("21 (negatives only — support positive still owed) template.publish_version: wrong tool refused; an owner is not support", async () => {
    expect((await mcp("write", "cap.template.publish_version", { id: "tpl_validation" }, O)).code).toBe("WRONG_TOOL_FOR_CLASS");
    const o = await mcp("danger", "cap.template.publish_version", { id: "tpl_validation" }, O, { mode: "dry_run" }); expect(o.code).toBe("NOT_AUTHORIZED_AT_SCOPE"); note("21", `owner dry_run → ${o.code}`);
  });
});

describe("rows 22–26 — surveys, requests, participation", () => {
  it("23 survey.get_status: success and answers-string exclusion; outsider hidden; count shape/value omitted", async () => {
    const s = await call("GET", "/v2/assessments/assess_tavo_collect/surveys/survey_tavo", undefined, VW); expect(s.ok).toBe(true);
    expect(JSON.stringify(s.result)).not.toMatch(/answers/); expect((await call("GET", "/v2/assessments/assess_tavo_collect/surveys/survey_tavo", undefined, NEW)).code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
  });
  it("24 request.create: any signed-in caller; idempotent on the same target; anonymous refused", async () => {
    const a = await call("POST", "/v2/requests", { kind: "workspace", target: "Acceptance Org" }, UNPROV); expect(a.ok).toBe(true); expect(a.receipt).toBeTruthy();
    const b = await call("POST", "/v2/requests", { kind: "workspace", target: "Acceptance Org" }, UNPROV);
    note("24", `duplicate request → ${b.ok ? (b.result.request_id === a.result.request_id ? "same id (idempotent)" : "NEW id (not idempotent)") : b.code}`);
    expect(b.ok).toBe(true); expect(b.result.request_id).toBe(a.result.request_id);
    expect((await call("POST", "/v2/requests", { kind: "workspace", target: "x" })).code).toBe("NOT_AUTHENTICATED");
  });
  it("25/26 (negatives only — positives still owed) participant form and assisted_next refuse callers without a participant token", async () => {
    expect((await call("GET", "/v2/participate/form")).code).toBe("NOT_AUTHENTICATED");
    expect((await call("GET", "/v2/participate/form", undefined, O)).ok, "a facilitator session is not a participant token").toBe(false);
    const n = await call("POST", "/v2/participate/next", {}); note("26", `assisted_next without participant token → ${n.code}`); expect(n.code).toBe("NOT_AUTHENTICATED");
  });
});

describe("rows 27–31 — reserved rows give zero functional credit", () => {
  it("27/29/30/31 reserved refusals on both faces and MCP docs pointer; row28 covered by contract sweep", async () => {
    for (const [cap, method, path] of [["cap.recommendation.propose", "POST", "/v2/assessments/assess_tavo_collect/recommendations"], ["cap.rollup.project", "GET", "/v2/projects/proj_rill/rollup"], ["cap.rollup.workspace", "GET", "/v2/workspaces/ws_cedar/rollup"], ["cap.import.batch", "POST", "/v2/imports"]] as const) {
      const h = await call(method, path, method === "GET" ? undefined : {}, O); const m = await mcp(cap.includes("rollup") ? "read" : "write", cap, {}, O);
      note("27-31", `${cap} http ${h.status} ${h.code} · mcp ${m.code} · docs=${h.error?.docs ?? m.error?.docs}`);
      expect(h.status).toBe(501); expect(h.code).toBe("RESERVED_NOT_BUILT"); expect(m.code).toBe("RESERVED_NOT_BUILT"); expect(m.error.docs).toBe(cap);
    }
  });
});
