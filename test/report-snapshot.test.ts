import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import type { Ctx } from "../src/handlers/types";
import { buildReportSnapshot, getReportSnapshot, listReportSnapshots, PINNED_SOURCE } from "../src/report-snapshot";
import { scoreSourceItem, type SourceItem } from "../src/source-item-score";
import model from "../src/pinned-report-model.json";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "report-snapshot",
  modules: true, script: "export default { fetch() { return new Response('ok') } }",
  d1Databases: { DB: "report-snapshot-test" } }] }));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8");
  if (path.endsWith("0004_pinned_instruments.sql"))
    return sql.split("\n").filter(line => line.startsWith("INSERT INTO survey_template ")).map(line => db.prepare(line));
  return sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n")
    .split(";").map(s => s.trim()).filter(Boolean).map(s => db.prepare(s));
}

describe("internal immutable report snapshots (not public results)", () => {
  it("binds exact v2 inputs, excludes v1, deduplicates and enforces explicit assessment grant", async () => {
    const db = await mf.getD1Database("DB");
    for (const path of ["../migrations/0001_init.sql", "../migrations/0002_code_escrow.sql",
      "../migrations/0003_language_archive.sql", "../seed/synthetic.sql",
      "../migrations/0004_pinned_instruments.sql", "../migrations/0005_report_snapshot.sql"]) {
      if (path.endsWith("0005_report_snapshot.sql")) {
        const sql = readFileSync(new URL(path, import.meta.url), "utf8");
        const triggers = sql.match(/CREATE TRIGGER[\s\S]*? END;/g) ?? [];
        const ddl = sql.replace(/CREATE TRIGGER[\s\S]*? END;/g, "")
          .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n")
          .split(";").map(s => s.trim()).filter(Boolean);
        await db.batch(ddl.map(s => db.prepare(s)));
        for (const trigger of triggers) await db.prepare(trigger).run();
      } else await db.batch(statements(db, path));
    }
    const validationTemplate = await db.prepare("SELECT items_json FROM survey_template WHERE id = 'tpl_validation' AND version = 2")
      .first<{ items_json: string }>();
    const validationItems = JSON.parse(validationTemplate!.items_json) as SourceItem[];
    const trQ14 = validationItems.find(item => item.id === "TR-Q14")!;
    expect(scoreSourceItem(trQ14, ["paratext"]).score).toBe(50);
    expect(scoreSourceItem(trQ14, ["paratext", "other"]).score).toBe(50);
    const midTemplate = await db.prepare("SELECT items_json FROM survey_template WHERE id = 'tpl_mid_level' AND version = 2")
      .first<{ items_json: string }>();
    const midItems = JSON.parse(midTemplate!.items_json) as SourceItem[];
    expect(scoreSourceItem(midItems.find(item => item.id === "ML-Q10")!, ["consult-trained"]))
      .toMatchObject({ status: "scored", score: 40, standalone_indicator: true });
    const writtenTemplate = await db.prepare("SELECT items_json FROM survey_template WHERE id = 'tpl_written' AND version = 2")
      .first<{ items_json: string }>();
    const writtenItems = JSON.parse(writtenTemplate!.items_json) as SourceItem[];
    expect(scoreSourceItem(writtenItems.find(item => item.id === "CW-Q2")!, ["other"]))
      .toMatchObject({ status: "scored", score: 75 });
    const allTemplates = await db.prepare("SELECT items_json FROM survey_template WHERE version = 2")
      .all<{ items_json: string }>();
    const allItemIds = new Set((allTemplates.results ?? []).flatMap(row =>
      (JSON.parse(row.items_json) as SourceItem[]).map(item => item.id)));
    expect(allItemIds.size).toBe(111);
    for (const construct of model.constructs)
      for (const itemId of construct.item_ids) expect(allItemIds.has(itemId)).toBe(true);
    const ctx = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "test" }, db,
      principal: { kind: "user", id }, traceId: "tr_test", now: () => new Date("2026-09-16T20:00:00Z"), log: () => {} });

    const empty = await buildReportSnapshot(ctx("person_mara"), "assess_tavo_collect");
    expect(empty.state).toBe("insufficient");
    expect(JSON.parse(empty.evidence_json).response_ids).toEqual([]);
    await db.prepare(`INSERT INTO assessment_survey
      (id, assessment_id, template_id, template_version, state, collection_status, created_at)
      VALUES ('survey_v2', 'assess_tavo_collect', 'tpl_validation', 2, 'selected', 'closed', '2026-09-16T20:00:00Z')`).run();
    await db.prepare(`INSERT INTO response
      (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version,
       provenance_json, source, submitted_at)
      VALUES ('resp_v2_1', 'survey_v2', 'respondent_1', 'idem_1', ?, 'tpl_validation', 2,
       '{}', 'participant', '2026-09-16T20:00:01Z')`).bind('{"TR-Q1":"documented"}').run();
    const first = await buildReportSnapshot(ctx("person_mara"), "assess_tavo_collect");
    const [repeat, concurrent] = await Promise.all([
      buildReportSnapshot(ctx("person_mara"), "assess_tavo_collect"),
      buildReportSnapshot(ctx("person_mara"), "assess_tavo_collect"),
    ]);
    expect(first.state).toBe("held");
    expect(repeat.id).toBe(first.id);
    expect(concurrent.id).toBe(first.id);
    expect(first.input_hash).not.toBe(empty.input_hash);
    expect(first.evidence_json).not.toContain("documented");
    expect(JSON.parse(first.evidence_json)).toMatchObject({ response_ids: ["resp_v2_1"],
      templates: ["tpl_validation@2"] });
    expect(first.evidence_json).toContain(PINNED_SOURCE);
    await expect(db.prepare("UPDATE report_snapshot SET state = 'held' WHERE id = ?").bind(first.id).run())
      .rejects.toThrow(/immutable/);
    await expect(db.prepare("DELETE FROM report_snapshot WHERE id = ?").bind(first.id).run())
      .rejects.toThrow(/immutable/);
    await db.prepare(`INSERT INTO response
      (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version,
       provenance_json, source, submitted_at)
      VALUES ('resp_v2_2', 'survey_v2', 'respondent_2', 'idem_2', ?, 'tpl_validation', 2,
       '{}', 'participant', '2026-09-16T20:00:02Z')`).bind('{"TR-Q1":"informal"}').run();
    const second = await buildReportSnapshot(ctx("person_mara"), "assess_tavo_collect");
    expect(second.id).not.toBe(first.id);
    expect((await listReportSnapshots(ctx("person_mara"), "assess_tavo_collect")).map(r => r.id))
      .toEqual(expect.arrayContaining([empty.id, first.id, second.id]));
    expect((await getReportSnapshot(ctx("person_ion"), first.id)).id).toBe(first.id); // direct assessment viewer
    await expect(buildReportSnapshot(ctx("person_ion"), "assess_tavo_collect"))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(getReportSnapshot(ctx("person_mara"), "missing"))
      .rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await expect(listReportSnapshots(ctx("person_mara"), "assess_tavo_prepare"))
      .rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" }); // project ownership does not inherit

    // An old one-question placeholder response is never pooled as v2 evidence.
    await db.prepare(`INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at)
      VALUES ('grant_mara_melo', 'person_mara', 'assessment', 'assess_melo_understand', 'owner', '2026-09-16T20:00:00Z')`).run();
    const legacy = await buildReportSnapshot(ctx("person_mara"), "assess_melo_understand");
    expect(legacy.state).toBe("incompatible");
    expect(JSON.parse(legacy.evidence_json).templates).toEqual(["tpl_written@1"]);
    await db.prepare(`INSERT INTO response
      (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version,
       provenance_json, source, submitted_at)
      VALUES ('resp_v1_mixed', 'survey_tavo', 'respondent_old', 'idem_old', '{"Q1":4}',
       'tpl_validation', 1, '{}', 'participant', '2026-09-16T20:00:03Z')`).run();
    const mixed = await buildReportSnapshot(ctx("person_mara"), "assess_tavo_collect");
    expect(mixed.state).toBe("incompatible");
    expect(JSON.parse(mixed.evidence_json).templates).toEqual(["tpl_validation@1", "tpl_validation@2"]);
  }, 30000);
});
