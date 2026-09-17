// Phase A sweep (cookbook prd/18-I §4, TEST-REQ-001): contract-derived negatives over ALL capabilities on BOTH faces.
// It pins the exact set of reserved rows — building one forces its assertion to flip in the same PR — and proves that
// an asserted 501 is reported as "reserved", never as passing behavior. Runs in the deploy gate.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { capabilities, type Capability } from "../src/registry";
import { handlers } from "../src/handlers";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "sweep", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "sweep-db" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
/** The rows that answer an honest 501 today. v2.1-oct rows are reserved by slice; the v2.0 rows here are OPEN product debt. */
const RESERVED = ["cap.import.batch", "cap.recommendation.propose", "cap.recommendation.review", "cap.report.build", "cap.report.get", "cap.report.list", "cap.rollup.project", "cap.rollup.workspace", "cap.support.acts_as"];
/** Anonymous entry points: reachable without a session by design, so a bogus payload is INVALID_PARAMS, not NOT_AUTHENTICATED. */
const ANON_ENTRY = ["cap.auth.request_link", "cap.auth.consume_link", "cap.participant.redeem_code", "cap.participant.open_link"];

let env: any; let owner: string; let stranger: string; let real: Record<string, string>;
const nope: Record<string, string> = { id: "ws_nope", pid: "prj_nope", aid: "asm_nope", sid: "srv_nope", gid: "g_nope", scope: "workspace", ver: "1", token: "t", trace_id: "tr_nope" };
const fill = (c: Capability, ids: Record<string, string>) => ({
  path: c.http.path.replace(/\{(\w+)\}/g, (_, k) => ids[k] ?? "x"),
  params: Object.fromEntries([...c.http.path.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], ids[m[1]] ?? "x"])),
});
async function http(c: Capability, ids: Record<string, string>, bearer?: string) {
  const { path, params } = fill(c, ids);
  const r = await app.fetch(new Request("https://t.invalid" + path, { method: c.http.method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: c.http.method === "GET" ? undefined : JSON.stringify({ params, ...(c.tool === "danger" ? { mode: "dry_run" } : {}) }) }), env);
  const j: any = await r.json().catch(() => ({})); return { status: r.status, code: j.ok ? "ok" : j.error?.code as string };
}
async function mcp(c: Capability, ids: Record<string, string>, bearer?: string, tool: string = c.tool) {
  const { params } = fill(c, ids);
  const r = await app.fetch(new Request("https://t.invalid/mcp", { method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: { capability: c.id, params, ...(tool === "danger" ? { mode: "dry_run" } : {}) } } }) }), env);
  const j: any = await r.json().catch(() => ({})); const e = j.result?.structuredContent; return { status: r.status, code: e?.ok ? "ok" : e?.error?.code as string };
}

beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-sweep", ENVIRONMENT: "dev" };
  owner = await mintSession(env, "person_mara", "user");
  await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES ('usr_stranger','h_stranger',1,0,'2026-09-16T00:00:00Z')").run();
  stranger = await mintSession(env, "usr_stranger", "user");
  const one = async (sql: string) => Object.values((await db.prepare(sql).first()) ?? {})[0] as string;
  const aid = await one(`SELECT g.scope_id FROM "grant" g JOIN assessment_survey s ON s.assessment_id = g.scope_id JOIN "grant" gp ON gp.principal_id = g.principal_id AND gp.scope_type = 'project' AND gp.scope_id = (SELECT project_id FROM assessment WHERE id = g.scope_id) WHERE g.principal_id = 'person_mara' AND g.scope_type = 'assessment' LIMIT 1`);
  real = { id: await one("SELECT id FROM workspace LIMIT 1"), pid: await one(`SELECT project_id FROM assessment WHERE id='${aid}'`), aid, sid: (await one(`SELECT id FROM assessment_survey WHERE assessment_id='${aid}' LIMIT 1`)) ?? "srv_nope", gid: await one('SELECT id FROM "grant" LIMIT 1'), scope: "workspace", ver: "1", token: "t", trace_id: "tr_nope" };
}, 60_000);

describe("Phase A — contract sweep over all capabilities, both faces", () => {
  it("the reserved set is exactly what the code leaves unbuilt, and each answers 501 RESERVED_NOT_BUILT on HTTP and MCP — signed in or not", async () => {
    const unbuilt = capabilities.filter((c) => c.slice === "v2.1-oct" || !handlers[c.id]).map((c) => c.id).sort();
    expect(unbuilt).toEqual([...RESERVED].sort());
    for (const c of capabilities.filter((x) => RESERVED.includes(x.id))) for (const bearer of [undefined, owner]) {
      expect(await http(c, nope, bearer), `${c.id} http`).toEqual({ status: 501, code: "RESERVED_NOT_BUILT" });
      expect((await mcp(c, nope, bearer)).code, `${c.id} mcp`).toBe("RESERVED_NOT_BUILT");
    }
    // honesty ≠ completion: the v2.0 rows among them stay open product debt and are named, not hidden
    expect(capabilities.filter((c) => RESERVED.includes(c.id) && c.slice === "v2.0-bcs").map((c) => c.id).sort()).toEqual(["cap.support.acts_as"]);
  }, 120_000);

  it("no built, non-public capability answers an anonymous caller — identical refusal on both faces", async () => {
    for (const c of capabilities.filter((x) => !x.public && !RESERVED.includes(x.id))) {
      const h = await http(c, nope), m = await mcp(c, nope);
      if (ANON_ENTRY.includes(c.id)) { expect(h.code, c.id).toBe("INVALID_PARAMS"); expect(m.code, c.id).toBe("INVALID_PARAMS"); continue; }
      expect(h, `${c.id} http`).toEqual({ status: 401, code: "NOT_AUTHENTICATED" });
      expect(m.code, `${c.id} mcp`).toBe("NOT_AUTHENTICATED");
    }
  }, 120_000);

  it("every capability refuses the wrong MCP tool before anything else happens", async () => {
    const other = (t: string) => (t === "read" ? "write" : "read");
    for (const c of capabilities) expect((await mcp(c, nope, owner, other(c.tool))).code, c.id).toBe("WRONG_TOOL_FOR_CLASS");
  }, 120_000);

  it("unauthorized == nonexistent: a signed-in stranger aimed at REAL ids never gets a success or a different refusal than for ids that do not exist", async () => {
    const scoped = capabilities.filter((c) => !c.public && !RESERVED.includes(c.id) && /\{(pid|aid|sid|gid)\}/.test(c.http.path));
    expect(scoped.length).toBeGreaterThanOrEqual(20);
    expect(real.sid, "seed must provide a real survey id").not.toBe("srv_nope");
    const codes = new Map<string, number>(); let ownerOk = 0;
    for (const c of scoped) {
      if (c.class === "read" && (await http(c, real, owner)).code === "ok") ownerOk++; // non-vacuous: the same ids DO open for the owner
      const onReal = await http(c, real, stranger), onNope = await http(c, nope, stranger);
      expect(onReal.code, `${c.id} real`).not.toBe("ok");
      expect(onReal, `${c.id} leaks existence`).toEqual(onNope);
      expect((await mcp(c, real, stranger)).code, `${c.id} mcp`).toBe(onReal.code);
      codes.set(onReal.code, (codes.get(onReal.code) ?? 0) + 1);
    }
    console.log("stranger refusals", Object.fromEntries(codes), "owner reads ok on the same ids:", ownerOk);
    expect(ownerOk).toBeGreaterThanOrEqual(5);
    expect(codes.get("NOT_FOUND_OR_NOT_VISIBLE") ?? 0).toBeGreaterThanOrEqual(15);
  }, 180_000);

  it("no danger capability has a GET twin", () => {
    expect(capabilities.filter((c) => c.tool === "danger" && c.http.method.toUpperCase() === "GET")).toEqual([]);
  });
});
