import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { capabilities } from "../src/registry";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "fb-mcp", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "fb-mcp-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

const WRITE_KEYS = ["feedback_id", "recorded", "stripped"];

let db: D1Database;
let env: { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT: string };
let supportToken: string;
let userToken: string;
let participantToken: string;

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) {
    await db.batch(statements(db, `../migrations/${m}`));
  }
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-feedback-mcp", ENVIRONMENT: "dev" };
  await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
    .bind("person_support", "synthetic_hash_support", 1, 1, "2026-09-17T00:00:00.000Z").run();
  supportToken = await mintSession(env, "person_support", "support");
  userToken = await mintSession(env, "person_mara", "user");
  participantToken = await mintSession(env, "person_ion", "participant", { participant_survey_id: "survey_tavo", respondent_id: "person_ion" });
}, 60_000);

async function mcp(tool: string, capability: string, params: Record<string, unknown> = {}, bearer?: string) {
  const res = await app.fetch(new Request("https://t.invalid/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: tool, arguments: { capability, params } },
    }),
  }), env);
  const j: any = await res.json();
  return { status: res.status, env: j.result?.structuredContent ?? j.result ?? j };
}

async function writeFeedback(params: Record<string, unknown>, bearer?: string) {
  return mcp("write", "cap.ops.feedback", params, bearer);
}

async function readFeedback(id: string, bearer?: string) {
  return mcp("read", "cap.ops.feedback_get", { id }, bearer);
}

function writeResult(envelope: any) {
  expect(envelope.ok).toBe(true);
  expect(Object.keys(envelope.result).sort()).toEqual(WRITE_KEYS);
  expect(envelope.result.recorded).toBe(true);
  expect(envelope.result.feedback_id.startsWith("fb_")).toBe(true);
  expect(envelope.result).not.toHaveProperty("note");
  expect(envelope.result).not.toHaveProperty("text");
  expect(envelope.result).not.toHaveProperty("context");
  expect(envelope.result).not.toHaveProperty("helpful");
  expect(envelope.result).not.toHaveProperty("satisfaction");
  return envelope.result as { recorded: true; stripped: boolean; feedback_id: string };
}

async function staffRead(id: string) {
  const got = await readFeedback(id, supportToken);
  expect(got.env.ok).toBe(true);
  expect(got.env.result.id).toBe(id);
  return got.env.result as {
    id: string; actor: string; scope_type: string; scope_id: string; created_at: string;
    body: Record<string, unknown>;
  };
}

describe("ops feedback persist MCP twins — Prefer 5732375 F1–F7 / N1–N9", () => {
  it("F1 + F7: write {helpful, context, note} then S read projection; feedback_id matches row", async () => {
    const posted = await writeFeedback({ helpful: true, context: "docs.search", note: "ok" });
    const wr = writeResult(posted.env);
    expect(wr.stripped).toBe(false);
    const row = await db.prepare("SELECT id FROM feedback WHERE id = ?").bind(wr.feedback_id).first<{ id: string }>();
    expect(row?.id).toBe(wr.feedback_id);
    const read = await staffRead(wr.feedback_id);
    expect(read.body.helpful).toBe(true);
    expect(read.body.context).toBe("docs.search");
    expect(read.body.note).toBe("ok");
  });

  it("F2: legacy text → note; context object preserved; no invented helpful", async () => {
    const wr = writeResult((await writeFeedback({ text: "hello", context: { page: "x" } })).env);
    const read = await staffRead(wr.feedback_id);
    expect(read.body.note).toBe("hello");
    expect(read.body.context).toEqual({ page: "x" });
    expect(read.body).not.toHaveProperty("helpful");
  });

  it("F3: richer scores and sentiment_journey", async () => {
    const wr = writeResult((await writeFeedback({
      satisfaction: 2, confusion: 3, frustration: 1, sentiment_journey: "mcp-journey",
    })).env);
    const read = await staffRead(wr.feedback_id);
    expect(read.body).toMatchObject({ satisfaction: 2, confusion: 3, frustration: 1, sentiment_journey: "mcp-journey" });
  });

  it("F4: strip answers/responses/response on MCP write", async () => {
    const wr = writeResult((await writeFeedback({
      note: "keep", answers: { Q1: 9 }, responses: { a: 1 }, response: "nope",
    })).env);
    expect(wr.stripped).toBe(true);
    const stored = await db.prepare("SELECT body FROM feedback WHERE id = ?").bind(wr.feedback_id).first<{ body: string }>();
    expect(stored?.body).not.toContain("Q1");
    expect(stored?.body).not.toContain("nope");
    const read = await staffRead(wr.feedback_id);
    expect(read.body.stripped).toBe(true);
    expect(read.body.note).toBe("keep");
  });

  it("F5: opaque scopes on MCP write/read; no grant filter", async () => {
    const wr = writeResult((await writeFeedback({
      scope_type: "opaque_mcp", scope_id: "sid-1", context: "ctx", note: "n",
    })).env);
    const read = await staffRead(wr.feedback_id);
    expect(read.scope_type).toBe("opaque_mcp");
    expect(read.scope_id).toBe("sid-1");
    expect(read.body.context).toBe("ctx");
  });

  it("F7: MCP write result never includes body contents", async () => {
    const secret = "mcp-secret-note";
    const posted = await writeFeedback({ note: secret, context: "mcp-ctx", satisfaction: 5 });
    const blob = JSON.stringify(posted.env.result);
    expect(blob).not.toContain(secret);
    expect(blob).not.toContain("mcp-ctx");
    writeResult(posted.env);
  });

  it("N1: helpful/context both present and distinct", async () => {
    const read = await staffRead(writeResult((await writeFeedback({ helpful: true, context: false })).env).feedback_id);
    expect(read.body.helpful).toBe(true);
    expect(read.body.context).toBe(false);
  });

  it("N2: conflicting note/text → INVALID_PARAMS", async () => {
    const posted = await writeFeedback({ note: "a", text: "b" });
    expect(posted.env).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N3: unknown key after strip → INVALID_PARAMS", async () => {
    const posted = await writeFeedback({ answers: {}, scorecard_rollups: [] });
    expect(posted.env).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N4: client stripped rejected", async () => {
    const posted = await writeFeedback({ stripped: true });
    expect(posted.env).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N5: over-bound note and total params", async () => {
    expect((await writeFeedback({ note: "x".repeat(4097) })).env.error.code).toBe("INVALID_PARAMS");
    expect((await writeFeedback({ note: "ok", junk: "z".repeat(9000) })).env.error.code).toBe("INVALID_PARAMS");
  });

  it("N6 three-way on MCP read", async () => {
    const id = writeResult((await writeFeedback({ note: "n6-mcp" })).env).feedback_id;
    expect((await readFeedback(id)).env.error.code).toBe("NOT_AUTHENTICATED");
    const user = await readFeedback(id, userToken);
    expect(user.env.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    expect(user.env.error.message).toBe("support only");
    expect((await readFeedback(id, participantToken)).env.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    expect((await readFeedback("fb_no_such", supportToken)).env.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
  });

  it("N7: omit richer optionals — no invented scores/NLX ids", async () => {
    const read = await staffRead(writeResult((await writeFeedback({ note: "only-note" })).env).feedback_id);
    expect(read.body.note).toBe("only-note");
    expect(read.body).not.toHaveProperty("satisfaction");
    expect(read.body).not.toHaveProperty("cast_id");
    expect(read.body).not.toHaveProperty("persona");
    expect(read.body).not.toHaveProperty("goal_id");
    expect(read.body).not.toHaveProperty("helpful");
  });

  it("N8: no public list/aggregate on MCP contract", async () => {
    expect(capabilities.map((c) => c.id).filter((id) => id.includes("feedback")).sort())
      .toEqual(["cap.ops.feedback", "cap.ops.feedback_get"]);
    const listed = await mcp("read", "cap.ops.feedback_list", {});
    expect(listed.env).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N9: unknown scope_type accepted", async () => {
    const read = await staffRead(writeResult((await writeFeedback({ scope_type: "zzz", note: "n9" })).env).feedback_id);
    expect(read.scope_type).toBe("zzz");
  });

  it("wrong tool for class on each twin", async () => {
    expect((await mcp("read", "cap.ops.feedback", { note: "x" })).env.error.code).toBe("WRONG_TOOL_FOR_CLASS");
    expect((await mcp("write", "cap.ops.feedback_get", { id: "fb_x" }, supportToken)).env.error.code).toBe("WRONG_TOOL_FOR_CLASS");
  });

  it("ordinary legacy string text maps to note on MCP read", async () => {
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_legacy_mcp", "anon", "platform", "-", JSON.stringify({ text: "legacy-mcp", context: { page: "x" }, stripped: false }), "2026-09-16T00:00:00.000Z").run();
    const read = await staffRead("fb_legacy_mcp");
    expect(read.body.note).toBe("legacy-mcp");
    expect(read.body.context).toEqual({ page: "x" });
    expect(read.body).not.toHaveProperty("text");
    expect(read.body).not.toHaveProperty("helpful");
  });

  it("object-valued legacy text and malformed helpful/score types refuse on MCP read", async () => {
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_object_text_mcp", "anon", "platform", "-", JSON.stringify({ text: { legacy: "value" }, stripped: false }), "2026-09-16T00:00:00.000Z").run();
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_bad_helpful_mcp", "anon", "platform", "-", JSON.stringify({ helpful: "yes", stripped: false }), "2026-09-16T00:00:00.000Z").run();
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_bad_score_mcp", "anon", "platform", "-", JSON.stringify({ confusion: 1.5, stripped: false }), "2026-09-16T00:00:00.000Z").run();
    for (const id of ["fb_object_text_mcp", "fb_bad_helpful_mcp", "fb_bad_score_mcp"]) {
      const got = await readFeedback(id, supportToken);
      expect(got.env).toMatchObject({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
      expect(got.env.result).toBeUndefined();
      expect(JSON.stringify(got.env)).not.toContain("legacy");
    }
  });
});
