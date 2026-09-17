import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { redact } from "../src/receipt";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "fb-priv", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "fb-priv-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

let db: D1Database;
let env: { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT: string };

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) {
    await db.batch(statements(db, `../migrations/${m}`));
  }
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-feedback-privacy", ENVIRONMENT: "dev" };
  await mintSession(env, "person_mara", "user");
}, 60_000);

describe("A4 feedback privacy — prove-or-extend REDACT_KEYS (C2b-coherent)", () => {
  it("redact() matches note, text, context, and sentiment* keys", () => {
    const out = redact({
      note: "secret-note",
      text: "secret-text",
      context: "secret-context",
      sentiment_journey: "secret-sentiment",
      sentiment: "also-secret",
      answers: { Q1: 1 },
      response: "secret-response",
      ok: true,
    });
    expect(out.note).toBe("[redacted]");
    expect(out.text).toBe("[redacted]");
    expect(out.context).toBe("[redacted]");
    expect(out.sentiment_journey).toBe("[redacted]");
    expect(out.sentiment).toBe("[redacted]");
    expect(out.answers).toBe("[redacted]");
    expect(out.response).toBe("[redacted]");
    expect(out.ok).toBe(true);
  });

  it("F6: persisted traces and receipts do not carry feedback note/text/context/sentiment_journey", async () => {
    const secret = "privacy-note-should-never-span";
    const journey = "privacy-sentiment-journey";
    const ctx = "privacy-context-value";
    const res = await app.fetch(new Request("https://t.invalid/v2/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: secret, text: secret, context: ctx, sentiment_journey: journey, helpful: true }),
    }), env);
    const json: any = await res.json();
    expect(json.ok).toBe(true);
    const feedbackId = json.result.feedback_id as string;
    const traces = (await db.prepare("SELECT spans_json FROM trace WHERE trace_id = ?").bind(json.trace_id).all<{ spans_json: string }>()).results;
    const blob = traces.map((t) => t.spans_json).join("\n");
    expect(blob).not.toContain(secret);
    expect(blob).not.toContain(journey);
    expect(blob).not.toContain(ctx);
    const receipts = (await db.prepare("SELECT prior_state_json, capability FROM receipt WHERE capability = ?")
      .bind("cap.ops.feedback").all<{ prior_state_json: string; capability: string }>()).results;
    const receiptBlob = JSON.stringify(receipts);
    expect(receiptBlob).not.toContain(secret);
    expect(receiptBlob).not.toContain(journey);
    expect(receiptBlob).not.toContain(ctx);
    const mine = receipts[receipts.length - 1];
    const prior = JSON.parse(mine.prior_state_json);
    expect(prior.params).toEqual({});
    expect(prior.result_ids).toEqual({ feedback_id: feedbackId });
  });
});
