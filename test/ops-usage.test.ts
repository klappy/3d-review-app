// cap.ops.usage — super admin app-wide totals (done-lines 2–3) and the recorded on/off step (done-line 4).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { byId } from "../src/registry";
import { buildStatements, emailHash, readStatement, receiptStatement } from "../scripts/super-admin.mjs";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "ops-usage", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "ops-usage-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

let db: D1Database;
let env: { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT: string };
let supportToken: string;
let userToken: string;
let participantToken: string;

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0007_shared_link_context.sql"]) {
    await db.batch(statements(db, `../migrations/${m}`));
  }
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-ops-usage", ENVIRONMENT: "dev" };
  await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
    .bind("person_support", "synthetic_hash_support", 1, 1, "2026-09-17T00:00:00.000Z").run();
  supportToken = await mintSession(env, "person_support", "support");
  userToken = await mintSession(env, "person_mara", "user");
  // A pseudonymous respondent (no account row), as a shared-link participant is.
  participantToken = await mintSession(env, "resp_usage_1", "participant", { participant_survey_id: "survey_tavo", respondent_id: "resp_usage_1" });
}, 60_000);

async function http(bearer?: string, query = "") {
  const res = await app.fetch(new Request(`https://t.invalid/v2/ops/usage${query}`, {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  }), env);
  return { status: res.status, json: await res.json() as any };
}
async function mcp(params: Record<string, unknown>, bearer?: string, tool = "read") {
  const res = await app.fetch(new Request("https://t.invalid/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: { capability: "cap.ops.usage", params } } }),
  }), env);
  const j: any = await res.json();
  return j.result?.structuredContent ?? j.result ?? j;
}
const count = async (sql: string) => Number((await db.prepare(sql).first<{ c: number }>())!.c);

describe("cap.ops.usage contract row", () => {
  it("is one S-only read on the existing read tool with a GET twin; no new tool", () => {
    const c = byId.get("cap.ops.usage")!;
    expect(c).toBeTruthy();
    expect([c.class, c.tool, c.roles, c.public, c.http.method, c.http.path]).toEqual(["read", "read", "S", false, "GET", "/v2/ops/usage"]);
  });
});

describe("cap.ops.usage refusals (done-line 3)", () => {
  it("anonymous gets the sign-in refusal on both faces", async () => {
    const h = await http();
    expect(h.json.ok).toBe(false);
    expect(h.json.error.code).toBe("NOT_AUTHENTICATED");
    expect((await mcp({})).error?.code ?? (await mcp({})).ok).toBe("NOT_AUTHENTICATED");
  });
  it("a signed-in non-support user gets the same refusal as any other support-only row", async () => {
    const h = await http(userToken);
    expect(h.json.ok).toBe(false);
    expect(h.json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const other = await app.fetch(new Request("https://t.invalid/v2/ops/feedback/fb_x", { headers: { authorization: `Bearer ${userToken}` } }), env);
    expect((await other.json() as any).error.code).toBe(h.json.error.code);
    expect((await mcp({}, userToken)).error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
  });
  it("a participant is refused too", async () => {
    expect((await http(participantToken)).json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
  });
  it("the write tool is the wrong tool for this read", async () => {
    expect((await mcp({}, supportToken, "write")).error.code).toBe("WRONG_TOOL_FOR_CLASS");
  });
});

describe("cap.ops.usage for a support caller (done-line 2)", () => {
  it("returns counts that match direct database counts, and no names or ids", async () => {
    // A little traffic first: anonymous, signed-in, participant.
    await app.fetch(new Request("https://t.invalid/v2/health"), env);
    await http(userToken);
    await http(participantToken);
    const h = await http(supportToken);
    expect(h.status).toBe(200);
    expect(h.json.ok).toBe(true);
    const r = h.json.result;
    expect(r.accounts).toEqual({ total: await count("SELECT COUNT(*) c FROM principal"), super_admin: await count("SELECT COUNT(*) c FROM principal WHERE support = 1") });
    expect(r.projects).toBe(await count("SELECT COUNT(*) c FROM project"));
    expect(r.workspaces).toBe(await count("SELECT COUNT(*) c FROM workspace"));
    expect(r.languages).toBe(await count("SELECT COUNT(*) c FROM language"));
    expect(r.assessments.total).toBe(await count("SELECT COUNT(*) c FROM assessment"));
    expect(r.assessments.by_stage.collect).toBe(await count("SELECT COUNT(*) c FROM assessment WHERE stage = 'collect'"));
    expect(r.surveys.selected).toBe(await count("SELECT COUNT(*) c FROM assessment_survey WHERE state = 'selected'"));
    expect(r.surveys.open).toBe(await count("SELECT COUNT(*) c FROM assessment_survey WHERE state = 'selected' AND collection_status = 'open'"));
    expect(r.survey_links.issued).toBe(await count("SELECT COUNT(*) c FROM invitation WHERE scope_type = 'survey'"));
    expect(r.participant_sessions).toBe(await count("SELECT COUNT(*) c FROM participant_session"));
    expect(r.responses).toBe(await count("SELECT COUNT(*) c FROM response"));
    const today = new Date().toISOString().slice(0, 10);
    const row = r.requests_per_day.find((d: any) => d.day === today);
    expect(row.total).toBe(row.signed_in + row.not_signed_in + row.participant);
    expect(row.not_signed_in).toBeGreaterThanOrEqual(1);
    expect(row.signed_in).toBeGreaterThanOrEqual(1);
    expect(row.participant).toBeGreaterThanOrEqual(1);
    expect(r.range.to).toBe(today);
    const blob = JSON.stringify(r);
    for (const leak of ["Rill", "Aster", "Cedar", "Invented Field Lab", "person_", "proj_", "assess_", "survey_tavo", "resp_", "@"]) expect(blob).not.toContain(leak);
    // MCP face returns the same shape.
    const m = await mcp({}, supportToken);
    expect(m.ok).toBe(true);
    expect(m.result.projects).toBe(r.projects);
  });
  it("takes an optional from/to range and refuses a malformed one", async () => {
    const h = await http(supportToken, "?from=2020-01-01&to=2020-01-02");
    expect(h.json.ok).toBe(true);
    expect(h.json.result.range).toEqual({ from: "2020-01-01", to: "2020-01-02" });
    expect(h.json.result.requests_per_day).toEqual([]);
    expect((await http(supportToken, "?from=yesterday")).json.error.code).toBe("INVALID_PARAMS");
    expect((await http(supportToken, "?from=2026-10-02&to=2026-10-01")).json.error.code).toBe("INVALID_PARAMS");
    expect((await mcp({ project: "x" }, supportToken)).error.code).toBe("INVALID_PARAMS");
  });
});

describe("super admin on/off step (done-line 4)", () => {
  const run = async (action: "on" | "off", targetEmail: string, operatorEmail: string, n: number) => {
    const receiptId = `rc_sa_test${n}`;
    const sql = buildStatements({ action, targetHash: emailHash(targetEmail), operatorHash: emailHash(operatorEmail), receiptId, traceId: `script_test${n}`, at: `2026-10-02T12:00:0${n}.000Z` });
    await db.batch(sql.map((s: string) => db.prepare(s)));
    return {
      state: await db.prepare(readStatement(emailHash(targetEmail))).first<{ id: string; support: number }>(),
      receipt: await db.prepare(receiptStatement(receiptId)).first<any>(),
    };
  };
  it("switches on with a receipt naming operator and account, is idempotent, and switches back off", async () => {
    await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
      .bind("person_core", emailHash("Core.Member@team.invalid"), 1, 0, "2026-10-02T00:00:00.000Z").run();
    await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
      .bind("person_operator", emailHash("operator@team.invalid"), 1, 0, "2026-10-02T00:00:00.000Z").run();
    const before = await mintSession(env, "person_core", "user"); // signed in before the switch
    expect((await http(before)).json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const on = await run("on", "  core.member@TEAM.invalid ", "operator@team.invalid", 1);
    expect(on.state!.support).toBe(1);
    expect(on.receipt).toMatchObject({ actor: "person_operator", capability: "script.super_admin.on", scope_type: "principal", scope_id: "person_core" });
    expect(JSON.parse(on.receipt.prior_state_json)).toEqual({ support: 0, support_sessions: 0 });
    // on: no session upgrade needed — auth reads principal.support live, so the earlier session acts as support at once.
    expect((await http(before)).json.ok).toBe(true);
    // A session minted while on carries kind 'support' (as magic link / Access / login code mint it).
    const during = await mintSession(env, "person_core", "support");
    expect((await http(during)).json.ok).toBe(true);
    const again = await run("on", "core.member@team.invalid", "operator@team.invalid", 2);
    expect(again.state!.support).toBe(1);
    expect(again.receipt).toBeNull(); // no change, no receipt
    const off = await run("off", "core.member@team.invalid", "someone-else@team.invalid", 3);
    expect(off.state!.support).toBe(0);
    expect(off.receipt.actor).toBe(`operator:${emailHash("someone-else@team.invalid").slice(0, 12)}`);
    expect(JSON.parse(off.receipt.prior_state_json)).toEqual({ support: 1, support_sessions: 1 });
    expect((off.state as any).support_sessions).toBe(0);
    // off: both pre-existing sessions are refused the support-only read; the holder stays signed in as a user.
    expect((await http(during)).json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    expect((await http(before)).json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const me = await app.fetch(new Request("https://t.invalid/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${during}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read", arguments: { capability: "cap.auth.me", params: {} } } }) }), env);
    expect(JSON.stringify(await me.json())).not.toContain("NOT_AUTHENTICATED");
  });
  it("off also downgrades stray support sessions when the switch is already off, with a receipt", async () => {
    const stray = await mintSession(env, "person_core", "support");
    expect((await http(stray)).json.ok).toBe(true); // kind 'support' alone is honoured — the hazard off must close
    const off = await run("off", "core.member@team.invalid", "operator@team.invalid", 4);
    expect(off.receipt).toMatchObject({ capability: "script.super_admin.off", scope_id: "person_core" });
    expect(JSON.parse(off.receipt.prior_state_json)).toEqual({ support: 0, support_sessions: 1 });
    expect((await http(stray)).json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
  });
  it("refuses anything that is not a hash or a safe id", () => {
    expect(() => buildStatements({ action: "on", targetHash: "x' OR 1=1 --", operatorHash: emailHash("a@b.invalid"), receiptId: "r", traceId: "t", at: "a" })).toThrow();
    expect(() => buildStatements({ action: "maybe", targetHash: emailHash("a@b.invalid"), operatorHash: emailHash("a@b.invalid"), receiptId: "r", traceId: "t", at: "a" })).toThrow();
    expect(() => buildStatements({ action: "on", targetHash: emailHash("a@b.invalid"), operatorHash: emailHash("a@b.invalid"), receiptId: "r'; DROP", traceId: "t", at: "a" })).toThrow();
    expect(() => receiptStatement("x' OR '1'='1")).toThrow();
  });
});
