import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { capabilities } from "../src/registry";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "fb-http", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "fb-http-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

const WRITE_KEYS = ["feedback_id", "recorded", "stripped"];
const BODY_CONTENTS = ["note", "text", "context", "helpful", "satisfaction", "confusion", "frustration", "sentiment_journey"];

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
  env = { DB: db, SESSION_SECRET: "synthetic-feedback-http", ENVIRONMENT: "dev" };
  await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
    .bind("person_support", "synthetic_hash_support", 1, 1, "2026-09-17T00:00:00.000Z").run();
  supportToken = await mintSession(env, "person_support", "support");
  userToken = await mintSession(env, "person_mara", "user");
  participantToken = await mintSession(env, "person_ion", "participant", { participant_survey_id: "survey_tavo", respondent_id: "person_ion" });
}, 60_000);

const headers = (bearer?: string, extra: Record<string, string> = {}) => ({
  "content-type": "application/json",
  ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
  ...extra,
});

async function postFeedback(body: unknown, bearer?: string) {
  const res = await app.fetch(new Request("https://t.invalid/v2/feedback", {
    method: "POST", headers: headers(bearer), body: JSON.stringify(body),
  }), env);
  return { status: res.status, json: await res.json() as any };
}

async function getFeedback(id: string, bearer?: string) {
  const res = await app.fetch(new Request(`https://t.invalid/v2/ops/feedback/${encodeURIComponent(id)}`, {
    method: "GET", headers: headers(bearer),
  }), env);
  return { status: res.status, json: await res.json() as any };
}

function writeResult(json: any) {
  expect(json.ok).toBe(true);
  expect(Object.keys(json.result).sort()).toEqual(WRITE_KEYS);
  expect(json.result.recorded).toBe(true);
  expect(typeof json.result.feedback_id).toBe("string");
  expect(json.result.feedback_id.startsWith("fb_")).toBe(true);
  const blob = JSON.stringify(json.result);
  for (const k of BODY_CONTENTS) expect(json.result).not.toHaveProperty(k);
  expect(blob).not.toContain('"note"');
  expect(blob).not.toContain('"text"');
  expect(blob).not.toContain('"context"');
  return json.result as { recorded: true; stripped: boolean; feedback_id: string };
}

async function staffRead(id: string) {
  const got = await getFeedback(id, supportToken);
  expect(got.status).toBe(200);
  expect(got.json.ok).toBe(true);
  expect(got.json.result.id).toBe(id);
  return got.json.result as {
    id: string; actor: string; scope_type: string; scope_id: string; created_at: string;
    body: Record<string, unknown>;
  };
}

describe("ops feedback persist HTTP — Prefer 5732375 F1–F7 / N1–N9", () => {
  it("F1: helpful + context + note persist distinctly; F7 locator matches row", async () => {
    const posted = await postFeedback({ helpful: true, context: "docs.search", note: "ok" });
    expect(posted.status).toBe(200);
    const wr = writeResult(posted.json);
    expect(wr.stripped).toBe(false);
    const row = await db.prepare("SELECT id, body FROM feedback WHERE id = ?").bind(wr.feedback_id).first<{ id: string; body: string }>();
    expect(row?.id).toBe(wr.feedback_id);
    const read = await staffRead(wr.feedback_id);
    expect(read.id).toBe(wr.feedback_id);
    expect(read.body.helpful).toBe(true);
    expect(read.body.context).toBe("docs.search");
    expect(read.body.note).toBe("ok");
    expect(read.body.stripped).toBe(false);
    expect(read.body).not.toHaveProperty("text");
  });

  it("F2: legacy text maps to note; object context deep-equal; no invented helpful", async () => {
    const posted = await postFeedback({ text: "hello", context: { page: "x" } });
    const wr = writeResult(posted.json);
    const read = await staffRead(wr.feedback_id);
    expect(read.body.note).toBe("hello");
    expect(read.body.context).toEqual({ page: "x" });
    expect(read.body).not.toHaveProperty("helpful");
    expect(read.body).not.toHaveProperty("text");
  });

  it("F3: optional scores 1-5 and sentiment_journey round-trip", async () => {
    const posted = await postFeedback({
      satisfaction: 4, confusion: 1, frustration: 5, sentiment_journey: "smooth-then-stuck",
    });
    const wr = writeResult(posted.json);
    const read = await staffRead(wr.feedback_id);
    expect(read.body.satisfaction).toBe(4);
    expect(read.body.confusion).toBe(1);
    expect(read.body.frustration).toBe(5);
    expect(read.body.sentiment_journey).toBe("smooth-then-stuck");
  });

  it("F4: answers/responses/response strip; other fields persist; keys absent from store", async () => {
    const posted = await postFeedback({
      note: "keep-me",
      answers: { Q1: 3 },
      responses: [{ id: "r" }],
      response: { leaked: true },
    });
    const wr = writeResult(posted.json);
    expect(wr.stripped).toBe(true);
    const stored = await db.prepare("SELECT body FROM feedback WHERE id = ?").bind(wr.feedback_id).first<{ body: string }>();
    expect(stored?.body).not.toContain("answers");
    expect(stored?.body).not.toContain("responses");
    expect(stored?.body).not.toContain("Q1");
    expect(stored?.body).not.toContain("leaked");
    const read = await staffRead(wr.feedback_id);
    expect(read.body.stripped).toBe(true);
    expect(read.body.note).toBe("keep-me");
    expect(read.body).not.toHaveProperty("answers");
    expect(read.body).not.toHaveProperty("responses");
    expect(read.body).not.toHaveProperty("response");
  });

  it("F5: opaque scope_type/scope_id stored verbatim; body context independent; S sees row", async () => {
    const posted = await postFeedback({
      scope_type: "not_a_grant_scope",
      scope_id: "hint-xyz",
      context: "page.independent",
      note: "scoped",
    });
    const wr = writeResult(posted.json);
    const row = await db.prepare("SELECT scope_type, scope_id FROM feedback WHERE id = ?")
      .bind(wr.feedback_id).first<{ scope_type: string; scope_id: string }>();
    expect(row).toEqual({ scope_type: "not_a_grant_scope", scope_id: "hint-xyz" });
    const read = await staffRead(wr.feedback_id);
    expect(read.scope_type).toBe("not_a_grant_scope");
    expect(read.scope_id).toBe("hint-xyz");
    expect(read.body.context).toBe("page.independent");
  });

  it("F7: write result is exactly recorded/stripped/feedback_id and never echoes contents", async () => {
    const secret = "do-not-echo-this-note";
    const posted = await postFeedback({ note: secret, helpful: false, satisfaction: 2, context: "hidden-ctx" });
    const wr = writeResult(posted.json);
    expect(JSON.stringify(posted.json.result)).not.toContain(secret);
    expect(JSON.stringify(posted.json.result)).not.toContain("hidden-ctx");
    const read = await staffRead(wr.feedback_id);
    expect(read.body.note).toBe(secret);
  });

  it("N1: helpful true and context false both stored distinctly", async () => {
    const posted = await postFeedback({ helpful: true, context: false });
    const read = await staffRead(writeResult(posted.json).feedback_id);
    expect(read.body.helpful).toBe(true);
    expect(read.body.context).toBe(false);
  });

  it("N2: note/text conflict when values differ", async () => {
    const posted = await postFeedback({ note: "a", text: "b" });
    expect(posted.status).toBe(400);
    expect(posted.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N2 identical note/text persist once as note", async () => {
    const posted = await postFeedback({ note: "same", text: "same" });
    const read = await staffRead(writeResult(posted.json).feedback_id);
    expect(read.body.note).toBe("same");
    expect(read.body).not.toHaveProperty("text");
  });

  it("N3: unknown key rejected after answers strip", async () => {
    const posted = await postFeedback({ answers: { Q1: 1 }, scorecard_rollups: true, note: "x" });
    expect(posted.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N4: client stripped is derived-only and rejected", async () => {
    const posted = await postFeedback({ stripped: true, note: "n" });
    expect(posted.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N5: over-bound note or total params → INVALID_PARAMS", async () => {
    const overNote = await postFeedback({ note: "n".repeat(4097) });
    expect(overNote.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
    const overTotal = await postFeedback({ note: "ok", junk: "j".repeat(9000) });
    expect(overTotal.json).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  });

  it("N6: anonymous NOT_AUTHENTICATED; signed-in non-S NOT_AUTHORIZED_AT_SCOPE; S+unknown NOT_FOUND_OR_NOT_VISIBLE", async () => {
    const posted = await postFeedback({ note: "n6" });
    const id = writeResult(posted.json).feedback_id;
    const anon = await getFeedback(id);
    expect(anon.status).toBe(401);
    expect(anon.json).toMatchObject({ ok: false, error: { code: "NOT_AUTHENTICATED" } });
    const user = await getFeedback(id, userToken);
    expect(user.status).toBe(403);
    expect(user.json).toMatchObject({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE" } });
    expect(user.json.error.message).toBe("support only");
    const participant = await getFeedback(id, participantToken);
    expect(participant.status).toBe(403);
    expect(participant.json).toMatchObject({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE" } });
    const missing = await getFeedback("fb_unknown_missing_row", supportToken);
    expect(missing.status).toBe(404);
    expect(missing.json).toMatchObject({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
    expect(JSON.stringify(missing.json)).not.toMatch(/SQLITE|JSON\.parse|SyntaxError/i);
  });

  it("N7: omitted richer optionals are not invented", async () => {
    const posted = await postFeedback({ helpful: true });
    const read = await staffRead(writeResult(posted.json).feedback_id);
    expect(read.body.helpful).toBe(true);
    expect(read.body.stripped).toBe(false);
    expect(read.body).not.toHaveProperty("satisfaction");
    expect(read.body).not.toHaveProperty("confusion");
    expect(read.body).not.toHaveProperty("frustration");
    expect(read.body).not.toHaveProperty("sentiment_journey");
    expect(read.body).not.toHaveProperty("cast_id");
    expect(read.body).not.toHaveProperty("persona");
    expect(read.body).not.toHaveProperty("goal_id");
    expect(read.body).not.toHaveProperty("note");
    expect(read.body).not.toHaveProperty("context");
  });

  it("N8: no public list or aggregate capability or collection route", async () => {
    expect(capabilities.some((c) => c.id === "cap.ops.feedback_list")).toBe(false);
    expect(capabilities.some((c) => /cap\.ops\.feedback_.+/.test(c.id) && c.id !== "cap.ops.feedback_get")).toBe(false);
    expect(capabilities.filter((c) => c.id.startsWith("cap.ops.feedback")).map((c) => c.id).sort())
      .toEqual(["cap.ops.feedback", "cap.ops.feedback_get"]);
    const list = await app.fetch(new Request("https://t.invalid/v2/feedback", { method: "GET" }), env);
    expect(list.status).toBe(404);
    const collection = await app.fetch(new Request("https://t.invalid/v2/ops/feedback", { method: "GET" }), env);
    expect(collection.status).toBe(404);
  });

  it("N9: unknown scope_type value is accepted as opaque", async () => {
    const posted = await postFeedback({ scope_type: "made_up_label", scope_id: "abc", note: "n9" });
    expect(posted.json.ok).toBe(true);
    const read = await staffRead(writeResult(posted.json).feedback_id);
    expect(read.scope_type).toBe("made_up_label");
    expect(read.scope_id).toBe("abc");
  });

  it("legacy stored text maps to note; malformed body fails closed without leaking", async () => {
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_legacy_text", "anon", "platform", "-", JSON.stringify({ text: "legacy-hello", context: null, stripped: false }), "2026-09-16T00:00:00.000Z").run();
    const legacy = await staffRead("fb_legacy_text");
    expect(legacy.body.note).toBe("legacy-hello");
    expect(legacy.body).not.toHaveProperty("text");
    expect(legacy.body).not.toHaveProperty("helpful");
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_bad_json", "anon", "platform", "-", "{not-json", "2026-09-16T00:00:00.000Z").run();
    const bad = await getFeedback("fb_bad_json", supportToken);
    expect(bad.status).toBe(404);
    expect(bad.json).toMatchObject({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
    expect(JSON.stringify(bad.json.error)).not.toMatch(/not-json|SyntaxError|JSON/i);
  });

  it("object-valued legacy text is malformed-row NOT_FOUND_OR_NOT_VISIBLE", async () => {
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_object_text", "anon", "platform", "-", JSON.stringify({ text: { legacy: "value" }, stripped: false }), "2026-09-16T00:00:00.000Z").run();
    const got = await getFeedback("fb_object_text", supportToken);
    expect(got.status).toBe(404);
    expect(got.json).toMatchObject({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
    expect(JSON.stringify(got.json)).not.toContain("legacy");
    expect(got.json.result).toBeUndefined();
  });

  it("malformed stored helpful/score types are malformed-row NOT_FOUND_OR_NOT_VISIBLE", async () => {
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_bad_helpful", "anon", "platform", "-", JSON.stringify({ helpful: "yes", stripped: false }), "2026-09-16T00:00:00.000Z").run();
    await db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
      .bind("fb_bad_score", "anon", "platform", "-", JSON.stringify({ satisfaction: 1.5, stripped: false }), "2026-09-16T00:00:00.000Z").run();
    for (const id of ["fb_bad_helpful", "fb_bad_score"]) {
      const got = await getFeedback(id, supportToken);
      expect(got.status).toBe(404);
      expect(got.json).toMatchObject({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
      expect(got.json.result).toBeUndefined();
    }
  });
});
