import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { create, get, set_stage } from "../src/handlers/assessment";
import { select } from "../src/handlers/survey";
import { redeem_code } from "../src/handlers/participant";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "collection-gate", modules: true,
  script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "collection-gate-db" } }] }));
afterAll(() => mf.dispose());

describe("explicit Collect stage gates selected surveys", () => {
  it("opens only this assessment on entry and closes it on exit", async () => {
    const db = await mf.getD1Database("DB");
    const statements = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
      .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n")
      .split(";").map(s => s.trim()).filter(Boolean).map(s => db.prepare(s));
    await db.batch(statements("../migrations/0001_init.sql"));
    await db.batch(statements("../migrations/0002_code_escrow.sql"));
    await db.batch(statements("../migrations/0003_language_archive.sql"));
    await db.batch(statements("../seed/synthetic.sql"));
    const ctx: Ctx = { env: { DB: db, SESSION_SECRET: "synthetic-only" }, db,
      principal: { kind: "user", id: "person_mara" }, traceId: "tr_collection_gate",
      now: () => new Date("2026-09-16T20:00:00.000Z"), log: () => {} };
    const created = await create(ctx, { pid: "proj_rill", language_id: "lang_tavo", name: "New synthetic assessment" });
    const aid = created.result.assessment.id as string;
    const first = await select(ctx, { aid, template_id: "tpl_validation" });
    const sid = first.result.survey.id as string;
    expect(first.result.survey.collection_status).toBe("closed");
    await get(ctx, { id: aid }); // browsing does not change the collection gate
    expect((await db.prepare("SELECT collection_status FROM assessment_survey WHERE id = ?").bind(sid)
      .first<{collection_status: string}>())?.collection_status).toBe("closed");

    const code = "GATE-TEST-CODE";
    await db.prepare("INSERT INTO access_code (id, assessment_survey_id, code_hash, created_at) VALUES (?, ?, ?, ?)")
      .bind("code_gate", sid, await sha256(code), "2026-09-16T20:00:00.000Z").run();
    await expect(redeem_code(ctx, { code })).rejects.toMatchObject({ code: "STAGE_CONFLICT" });

    await set_stage(ctx, { id: aid, stage: "collect" });
    expect((await db.prepare("SELECT collection_status FROM assessment_survey WHERE id = ?").bind(sid)
      .first<{collection_status: string}>())?.collection_status).toBe("open");
    const second = await select(ctx, { aid, template_id: "tpl_written" });
    expect(second.result.survey.collection_status).toBe("open");
    expect((await db.prepare("SELECT collection_status FROM assessment_survey WHERE id = 'survey_melo'")
      .first<{collection_status: string}>())?.collection_status).toBe("closed");
    expect((await redeem_code(ctx, { code })).result).toMatchObject({ survey_id: sid });

    await set_stage(ctx, { id: aid, stage: "understand" });
    const statuses = await db.prepare("SELECT collection_status FROM assessment_survey WHERE assessment_id = ?")
      .bind(aid).all<{collection_status: string}>();
    expect(statuses.results.map(r => r.collection_status)).toEqual(["closed", "closed"]);
    await set_stage(ctx, { id: aid, stage: "collect" });
    const reopened = await db.prepare("SELECT collection_status FROM assessment_survey WHERE assessment_id = ?")
      .bind(aid).all<{collection_status: string}>();
    expect(reopened.results.map(r => r.collection_status)).toEqual(["open", "open"]);
  });
});
