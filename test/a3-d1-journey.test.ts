import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { redeem_code } from "../src/handlers/participant";
import { form, receipt, submit } from "../src/handlers/response";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "a3", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "a3-test-db" } }] }));
afterAll(() => mf.dispose());

describe("A-3 restored-schema D1 journey", () => {
  it("redeems a synthetic code, submits once, and reopens its receipt", async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
      .split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    const statements = (path: string) => sql(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
    await db.batch(statements("../migrations/0001_init.sql"));
    await db.batch(statements("../migrations/0002_code_escrow.sql"));
    await db.batch(statements("../seed/synthetic.sql"));
    const code = "A3-TEST-CODE";
    await db.prepare("INSERT INTO access_code (id, assessment_survey_id, code_hash, created_at) VALUES (?, ?, ?, ?)")
      .bind("code_a3_test", "survey_tavo", await sha256(code), "2026-09-16T20:00:00.000Z").run();
    const base: Ctx = { env: { DB: db, SESSION_SECRET: "synthetic-only" }, db,
      principal: { kind: "anonymous", id: "anon" }, traceId: "tr_a3_test",
      now: () => new Date("2026-09-16T20:00:00.000Z"), log: () => {} };
    const entry = await redeem_code(base, { code });
    expect(entry.result).toMatchObject({ survey_id: "survey_tavo" });
    const token = entry.result.participant_token as string;
    const stored = await db.prepare("SELECT assessment_survey_id, respondent_id FROM participant_session WHERE token_hash = ?")
      .bind(await sha256(token)).first<{ assessment_survey_id: string; respondent_id: string }>();
    expect(stored?.assessment_survey_id).toBe("survey_tavo");
    const participant: Ctx = { ...base, principal: { kind: "participant", id: stored!.respondent_id,
      participantSurveyId: stored!.assessment_survey_id, respondentId: stored!.respondent_id } };
    const presented = await form(participant, {});
    expect(presented.result).toMatchObject({ survey_id: "survey_tavo" });
    const first = await submit(participant, { idempotency_key: "a3-test-idem", answers: { Q1: 4 } });
    const retry = await submit(participant, { idempotency_key: "a3-test-idem", answers: { Q1: 4 } });
    expect(retry.result).toMatchObject({ duplicate: true, response_id: first.result.response_id });
    expect((await receipt(participant, {})).result).toMatchObject({ submitted: true, response_id: first.result.response_id });
    const codeRow = await db.prepare("SELECT redeemed_at FROM access_code WHERE id = ?").bind("code_a3_test").first<{ redeemed_at: string | null }>();
    expect(codeRow?.redeemed_at).toBeTruthy();
  });
});
