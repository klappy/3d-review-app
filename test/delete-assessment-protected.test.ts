import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { del } from "../src/handlers/assessment";
import { execute } from "../src/dispatch";
import { loadProject, sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

// Delete assessment stays protected now that workspace roles inherit to grouped projects (eb72ea5): a workspace or
// project role never reaches an assessment (D9), only a DIRECT assessment owner may delete (U14), execute needs the
// dry run's confirm token, and a non-empty assessment is refused (D5). Synthetic principals and ids only.
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "w", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "del-asm-db" } }] }));
afterAll(() => mf.dispose());

describe("delete assessment stays protected under workspace inheritance", () => {
  it("only a direct assessment owner deletes, with a confirm token, and only an empty assessment", async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql("../migrations/0001_init.sql").split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    const now = new Date("2026-10-16T22:00:00.000Z"), at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_da_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["u_wsown", "u_pown", "u_amem", "u_aown"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_a", "Synthetic WS", at, "u_wsown").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_1", "ws_a", "prj_1", at, "u_wsown").run();
    await db.prepare("INSERT INTO language (id, project_id, code, name, created_at) VALUES (?,?,?,?,?)").bind("lang_1", "prj_1", "syn", "Synthetic", at).run();
    for (const id of ["asm_empty", "asm_full"]) await db.prepare("INSERT INTO assessment (id, project_id, language_id, name, stage, created_at) VALUES (?,?,?,?,?,?)").bind(id, "prj_1", "lang_1", id, "prepare", at).run();
    await db.prepare("INSERT INTO survey_template (id, version, name, perspective, items_json, scoring_json) VALUES (?,?,?,?,?,?)").bind("tpl_1", 1, "T", "community", "[]", "{}").run();
    await db.prepare("INSERT INTO assessment_survey (id, assessment_id, template_id, template_version, created_at) VALUES (?,?,?,?,?)").bind("as_1", "asm_full", "tpl_1", 1, at).run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("g1", "u_wsown", "workspace", "ws_a", "owner"); // inherited project owner of prj_1
    await grant("g2", "u_pown", "project", "prj_1", "owner"); // direct project owner
    await grant("g3", "u_amem", "assessment", "asm_empty", "member");
    await grant("g4", "u_aown", "assessment", "asm_empty", "owner");
    await grant("g5", "u_aown", "assessment", "asm_full", "owner");

    // Precondition: u_wsown holds no project grant yet is project owner of prj_1 by inheritance (max of project and grouping
    // workspace grant), the same role as the direct project owner — so the D9 refusal below is not a missing-role artifact.
    expect(await db.prepare('SELECT id FROM "grant" WHERE principal_id = ? AND scope_type = \'project\'').bind("u_wsown").first()).toBeNull();
    for (const who of ["u_wsown", "u_pown"]) expect((await loadProject(mk(who), "prj_1", "owner")).role).toBe("owner");
    // A workspace owner (inherited project owner) and a direct project owner see nothing: D9, unauthorized == nonexistent.
    for (const who of ["u_wsown", "u_pown"]) {
      await expect(del(mk(who), { id: "asm_empty" }, { dryRun: true })).rejects.toMatchObject({ code: who === "u_wsown" ? "NOT_AUTHORIZED_AT_SCOPE" : "NOT_FOUND_OR_NOT_VISIBLE" });
      const env: any = await execute(mk(who), "cap.assessment.delete", { id: "asm_empty" }, { tool: "danger", mode: "dry_run" });
      expect(env.ok).toBe(false);
      expect(JSON.stringify(env)).toContain(who === "u_wsown" ? "NOT_AUTHORIZED_AT_SCOPE" : "NOT_FOUND_OR_NOT_VISIBLE");
    }
    // An assessment member sees it but cannot delete it.
    await expect(del(mk("u_amem"), { id: "asm_empty" }, { dryRun: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });

    // The owner's execute without the dry run's token is refused; nothing is deleted.
    const own = () => mk("u_aown"); // fresh trace id per call
    const bare: any = await execute(own(), "cap.assessment.delete", { id: "asm_empty" }, { tool: "danger", mode: "execute" });
    expect(JSON.stringify(bare)).toContain("CONFIRM_REQUIRED");
    expect(await db.prepare("SELECT id FROM assessment WHERE id = ?").bind("asm_empty").first()).toBeTruthy();

    // D5: a non-empty assessment is refused even for its owner with a valid token.
    const dryFull: any = await execute(own(), "cap.assessment.delete", { id: "asm_full" }, { tool: "danger", mode: "dry_run" });
    expect(dryFull.ok).toBe(true);
    const full: any = await execute(own(), "cap.assessment.delete", { id: "asm_full" }, { tool: "danger", mode: "execute", confirm_token: dryFull.result.confirm_token });
    expect(full.ok).toBe(false);
    expect(JSON.stringify(full)).toContain("assessment is not empty");
    expect(await db.prepare("SELECT id FROM assessment WHERE id = ?").bind("asm_full").first()).toBeTruthy();

    // Positive control: the direct owner deletes the empty one with its token.
    const dry: any = await execute(own(), "cap.assessment.delete", { id: "asm_empty" }, { tool: "danger", mode: "dry_run" });
    const done: any = await execute(own(), "cap.assessment.delete", { id: "asm_empty" }, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token });
    expect(done.ok).toBe(true);
    expect(await db.prepare("SELECT id FROM assessment WHERE id = ?").bind("asm_empty").first()).toBeNull();
  });
});
