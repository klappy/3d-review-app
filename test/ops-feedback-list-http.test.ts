import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

// cap.ops.feedback_list — S-only list-since read for the hourly triage (GET /v2/ops/feedback?since=&limit=).
const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "fb-list", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "fb-list-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

const ROW_KEYS = ["actor", "body", "created_at", "id", "provenance", "scope_id", "scope_type"];

let db: D1Database;
let env: { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT: string };
let supportToken: string;
let userToken: string;
let participantToken: string;
const ids: string[] = [];
const stamps: string[] = [];

const headers = (bearer?: string) => ({ "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) });

async function list(query: string, bearer?: string) {
  const res = await app.fetch(new Request(`https://t.invalid/v2/ops/feedback${query}`, { method: "GET", headers: headers(bearer) }), env);
  return { status: res.status, json: await res.json() as any };
}

async function getOne(id: string) {
  const res = await app.fetch(new Request(`https://t.invalid/v2/ops/feedback/${encodeURIComponent(id)}`, { method: "GET", headers: headers(supportToken) }), env);
  return await res.json() as any;
}

async function mcpList(params: Record<string, unknown>, bearer?: string) {
  const res = await app.fetch(new Request("https://t.invalid/mcp", {
    method: "POST", headers: headers(bearer),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read", arguments: { capability: "cap.ops.feedback_list", params } } }),
  }), env);
  const j: any = await res.json();
  return j.result?.structuredContent ?? j.result ?? j;
}

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) {
    await db.batch(statements(db, `../migrations/${m}`));
  }
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-feedback-list", ENVIRONMENT: "dev" };
  await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
    .bind("person_support", "synthetic_hash_support", 1, 1, "2026-09-17T00:00:00.000Z").run();
  supportToken = await mintSession(env, "person_support", "support");
  userToken = await mintSession(env, "person_mara", "user");
  participantToken = await mintSession(env, "person_ion", "participant", { participant_survey_id: "survey_tavo", respondent_id: "person_ion" });
  for (const note of ["list-a", "list-b", "list-c"]) {
    const res = await app.fetch(new Request("https://t.invalid/v2/feedback", { method: "POST", headers: headers(userToken), body: JSON.stringify({ note }) }), env);
    const j = await res.json() as any;
    expect(j.ok).toBe(true);
    ids.push(j.result.feedback_id);
    await new Promise((r) => setTimeout(r, 5)); // distinct created_at per row
  }
  for (const id of ids) stamps.push((await getOne(id)).result.created_at);
}, 60_000);

describe("cap.ops.feedback_list (S-only list-since)", () => {
  it("happy path: oldest first, each row is exactly the cap.ops.feedback_get projection, default limit 50", async () => {
    const got = await list("?since=2000-01-01T00:00:00Z", supportToken);
    expect(got.status).toBe(200);
    expect(got.json.ok).toBe(true);
    expect(got.json.result.limit).toBe(50);
    expect(got.json.result.since).toBe("2000-01-01T00:00:00.000Z");
    const rows = got.json.result.rows as any[];
    expect(rows.map((r) => r.id)).toEqual(ids);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(ROW_KEYS);
      expect(r).toEqual((await getOne(r.id)).result);
    }
    expect(rows.map((r) => r.body.note)).toEqual(["list-a", "list-b", "list-c"]);
  });

  it("since filter: strictly after since; a later since returns nothing", async () => {
    const after = await list(`?since=${encodeURIComponent(stamps[0])}`, supportToken);
    expect(after.status).toBe(200);
    expect(after.json.result.rows.map((r: any) => r.id)).toEqual(ids.slice(1));
    const offset = await list(`?since=${encodeURIComponent("2000-01-01T02:00:00+02:00")}`, supportToken);
    expect(offset.json.result.since).toBe("2000-01-01T00:00:00.000Z");
    const none = await list(`?since=${encodeURIComponent(stamps[2])}`, supportToken);
    expect(none.json.result.rows).toEqual([]);
  });

  it("limit caps the page; next page uses the last row's created_at; bounds 1..200", async () => {
    const page1 = await list("?since=2000-01-01T00:00:00Z&limit=2", supportToken);
    expect(page1.status).toBe(200);
    expect(page1.json.result.rows.map((r: any) => r.id)).toEqual(ids.slice(0, 2));
    const page2 = await list(`?since=${encodeURIComponent(page1.json.result.rows[1].created_at)}&limit=2`, supportToken);
    expect(page2.json.result.rows.map((r: any) => r.id)).toEqual(ids.slice(2));
    expect((await list("?since=2000-01-01T00:00:00Z&limit=200", supportToken)).status).toBe(200);
    for (const bad of ["0", "201", "-1", "2.5", "x"]) {
      const r = await list(`?since=2000-01-01T00:00:00Z&limit=${bad}`, supportToken);
      expect(r.status).toBe(400);
      expect(r.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
    }
    const viaMcp = await mcpList({ since: "2000-01-01T00:00:00Z", limit: 1 }, supportToken);
    expect(viaMcp.ok).toBe(true);
    expect(viaMcp.result.rows.map((r: any) => r.id)).toEqual(ids.slice(0, 1));
  });

  it("missing or invalid since → 400 INVALID_PARAMS", async () => {
    for (const q of ["", "?since=", "?since=yesterday", "?since=2026-10-01", "?since=2026-13-45T00:00:00Z", "?limit=5"]) {
      const r = await list(q, supportToken);
      expect(r.status).toBe(400);
      expect(r.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
      expect(r.json.result).toBeUndefined();
    }
  });

  it("role refusal: anonymous NOT_AUTHENTICATED; user and participant NOT_AUTHORIZED_AT_SCOPE; no rows leak", async () => {
    const anon = await list("?since=2000-01-01T00:00:00Z");
    expect(anon.status).toBe(401);
    expect(anon.json).toMatchObject({ ok: false, error: { code: "NOT_AUTHENTICATED" } });
    for (const t of [userToken, participantToken]) {
      const r = await list("?since=2000-01-01T00:00:00Z", t);
      expect(r.status).toBe(403);
      expect(r.json).toMatchObject({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE", message: "support only" } });
      expect(JSON.stringify(r.json)).not.toContain("list-a");
    }
    expect(await mcpList({ since: "2000-01-01T00:00:00Z" }, userToken)).toMatchObject({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE" } });
  });

  it("a malformed stored row is skipped (existence-hidden), never returned or leaked", async () => {
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_list_malformed", "person_mara", "platform", "-", "{not json", "2099-01-01T00:00:00.000Z").run();
    const r = await list(`?since=${encodeURIComponent(stamps[2])}`, supportToken);
    expect(r.status).toBe(200);
    expect(r.json.result.rows).toEqual([]);
    expect(JSON.stringify(r.json)).not.toMatch(/fb_list_malformed|SQLITE|SyntaxError/);
  });
});
