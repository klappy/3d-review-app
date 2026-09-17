import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import type { Ctx } from "../src/handlers/types";
import { projectReferenceAssessment } from "../src/reference-projection";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "reference-seed-integration",
  modules: true, script: "export default { fetch() { return new Response('ok') } }",
  d1Databases: { DB: "reference-seed-integration-db" } }] }));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8");
  if (path.endsWith("0005_report_snapshot.sql")) {
    const triggers = sql.match(/CREATE TRIGGER[\s\S]*? END;/g) ?? [];
    const ddl = sql.replace(/CREATE TRIGGER[\s\S]*? END;/g, "")
      .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n")
      .split(";").map(s => s.trim()).filter(Boolean);
    return { ddl: ddl.map(s => db.prepare(s)), triggers };
  }
  const ddl = sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n")
    .split(";\n").map(s => s.trim()).filter(Boolean);
  return { ddl: ddl.map(s => db.prepare(s)), triggers: [] };
}

describe("pinned reference projection on Fable synthetic seed", () => {
  it("projects every seeded assessment without admitting v1 or leaking raw answers in snapshot", async () => {
    const db = await mf.getD1Database("DB");
    for (const path of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql",
      "0004_pinned_instruments.sql", "0005_report_snapshot.sql"]) {
      const { ddl, triggers } = statements(db, `../migrations/${path}`);
      for (let i = 0; i < ddl.length; i += 100) await db.batch(ddl.slice(i, i + 100));
      for (const trigger of triggers) await db.prepare(trigger).run();
    }
    for (const path of ["synthetic.sql", "synthetic-responses.sql"]) {
      const { ddl } = statements(db, `../seed/${path}`);
      for (let i = 0; i < ddl.length; i += 100) await db.batch(ddl.slice(i, i + 100));
    }
    const ctx: Ctx = { env: { DB: db, SESSION_SECRET: "test" }, db,
      principal: { kind: "user", id: "person_mara" }, traceId: "tr_test",
      now: () => new Date("2026-09-16T20:00:00Z"), log: () => {} };
    const rows = (await db.prepare("SELECT id FROM assessment WHERE id LIKE 'assess_syn_%' ORDER BY id")
      .all<{ id: string }>()).results ?? [];
    expect(rows).toHaveLength(34);
    let projectedItems = 0;
    for (const row of rows) {
      const result = await projectReferenceAssessment(ctx, row.id);
      expect(result.status).toBe("reference_unpublished");
      expect(result.source_commit).toBe("f042cde553761a6a7f24132cef7802f956378ee0");
      expect(result.item_scores.length).toBeGreaterThan(0);
      projectedItems += result.item_scores.length;
    }
    expect(projectedItems).toBeGreaterThan(4000);
    const snapshots = (await db.prepare("SELECT state, evidence_json FROM report_snapshot WHERE assessment_id LIKE 'assess_syn_%'")
      .all<{ state: string; evidence_json: string }>()).results ?? [];
    expect(snapshots).toHaveLength(34);
    expect(snapshots.every(row => row.state === "held")).toBe(true);
    expect(snapshots.every(row => !row.evidence_json.includes("answers_json"))).toBe(true);
  }, 60_000);
});
