import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { list as projectList } from "../src/handlers/project";
import type { Ctx, Principal } from "../src/handlers/types";

// Read-handler qualification only: isolated native D1 rows and raw synthetic principals.
// No sign-in sessions, bearer tokens, hosted writes, or real participant data.
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: "project-response-count-fixture", modules: true,
  script: "export default { fetch() { return new Response('isolated count fixture') } }",
  d1Databases: { DB: "project-response-count-db" },
}] }));
afterAll(() => mf.dispose());

type CountedProject = { id: string; role: string; assessment_count: number; response_count: number };
const at = "2026-10-31T04:00:00.000Z";
let db: Awaited<ReturnType<typeof mf.getD1Database>>;
let trace = 0;
const context = (id: string, kind: Principal["kind"] = "user"): Ctx => ({
  env: { DB: db, SESSION_SECRET: "synthetic-count-fixture-only", ENVIRONMENT: "dev" } as Ctx["env"],
  db,
  principal: { id, kind, provisioned: true, ...(kind === "support" ? { accessMode: "global" as const } : {}) },
  traceId: `tr_response_counts_${++trace}`, now: () => new Date(at), log: () => {},
});
const projectsFor = async (id: string, kind: Principal["kind"] = "user") =>
  (await projectList(context(id, kind), {})).result.projects as CountedProject[];

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  const schema = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")
    .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
  await db.batch(schema.split(";").map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  for (const id of ["full-owner", "partial-viewer", "project-only", "archived-member", "workspace-viewer", "outsider", "global-reader"])
    await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?, ?, 1, ?, ?)")
      .bind(id, `synthetic-count-${id}`, id === "global-reader" ? 1 : 0, at).run();
  await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?, ?, ?, ?)")
    .bind("counts-workspace", "Synthetic count workspace", at, "full-owner").run();
  await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?, ?, ?, ?, ?)")
    .bind("counts-project", "counts-workspace", "Synthetic count project", at, "full-owner").run();
  await db.prepare("INSERT INTO language (id, project_id, name, created_at) VALUES (?, ?, ?, ?)")
    .bind("counts-language", "counts-project", "Synthetic", at).run();
  for (const [id, archived] of [["active-review", null], ["archived-review", at]] as const)
    await db.prepare("INSERT INTO assessment (id, project_id, language_id, name, stage, archived_at, created_at) VALUES (?, ?, ?, ?, 'collect', ?, ?)")
      .bind(id, "counts-project", "counts-language", id, archived, at).run();
  for (const [survey, assessment, count, archived] of [
    ["active-survey-a", "active-review", 2, false],
    ["active-survey-b", "active-review", 1, false],
    ["archived-survey", "archived-review", 5, true],
  ] as const) {
    const template = `template-${survey}`;
    await db.prepare("INSERT INTO survey_template (id, version, name, perspective, items_json, scoring_json) VALUES (?, 1, ?, 'synthetic', '[]', '{}')")
      .bind(template, template).run();
    await db.prepare("INSERT INTO assessment_survey (id, assessment_id, template_id, template_version, state, archived_at, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)")
      .bind(survey, assessment, template, archived ? "archived" : "selected", archived ? at : null, at).run();
    for (let n = 0; n < count; n++)
      await db.prepare("INSERT INTO response (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version, submitted_at) VALUES (?, ?, ?, ?, '[]', ?, 1, ?)")
        .bind(`response-${survey}-${n}`, survey, `synthetic-respondent-${n}`, `key-${survey}-${n}`, template, at).run();
  }
  const grants = [
    ["full-owner", "project", "counts-project", "owner"],
    ["full-owner", "assessment", "active-review", "owner"],
    ["full-owner", "assessment", "archived-review", "owner"],
    ["partial-viewer", "project", "counts-project", "viewer"],
    ["partial-viewer", "assessment", "active-review", "viewer"],
    ["project-only", "project", "counts-project", "owner"],
    ["archived-member", "project", "counts-project", "member"],
    ["archived-member", "assessment", "archived-review", "member"],
    ["workspace-viewer", "workspace", "counts-workspace", "viewer"],
  ];
  for (const [n, [principal, scope, scopeId, role]] of grants.entries())
    await db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(`count-grant-${n}`, principal, scope, scopeId, role, at).run();
});

describe("project.list response aggregates preserve assessment visibility", () => {
  it("a direct owner with all assessment grants sees active and archived submitted responses", async () => {
    expect(await projectsFor("full-owner")).toMatchObject([
      { id: "counts-project", role: "owner", assessment_count: 2, response_count: 8 },
    ]);
  });

  it("a partial viewer counts only the assessment they can read, without leaking the archived assessment's five responses", async () => {
    expect(await projectsFor("partial-viewer")).toMatchObject([
      { id: "counts-project", role: "viewer", assessment_count: 1, response_count: 3 },
    ]);
  });

  it("a direct project owner alone sees legitimate zero counts rather than inherited assessment access", async () => {
    expect(await projectsFor("project-only")).toMatchObject([
      { id: "counts-project", role: "owner", assessment_count: 0, response_count: 0 },
    ]);
  });

  it("a member with only the archived assessment grant still counts its archived survey responses", async () => {
    expect(await projectsFor("archived-member")).toMatchObject([
      { id: "counts-project", role: "member", assessment_count: 1, response_count: 5 },
    ]);
  });

  it("a grouping-workspace viewer inherits read access to all contained assessment counts", async () => {
    expect(await projectsFor("workspace-viewer")).toMatchObject([
      { id: "counts-project", role: "viewer", assessment_count: 2, response_count: 8 },
    ]);
  });

  it("Global read mode supplies complete counts with viewer fallback, without requiring project grants", async () => {
    expect(await projectsFor("global-reader")).toEqual([]);
    expect(await projectsFor("global-reader", "support")).toMatchObject([
      { id: "counts-project", role: "viewer", assessment_count: 2, response_count: 8 },
    ]);
  });

  it("the same project-only actor receives different authorized aggregates when entering and leaving Global mode", async () => {
    expect((await projectsFor("project-only"))[0].response_count).toBe(0);
    expect((await projectsFor("project-only", "support"))[0]).toMatchObject({ role: "owner", assessment_count: 2, response_count: 8 });
    expect((await projectsFor("project-only"))[0].response_count).toBe(0);
  });

  it("counts submitted response rows, not unique people across multiple surveys", async () => {
    const fixture = await db.prepare("SELECT COUNT(*) AS responses, COUNT(DISTINCT respondent_id) AS respondents FROM response").first<{ responses: number; respondents: number }>();
    expect(fixture).toEqual({ responses: 8, respondents: 5 });
    expect((await projectsFor("full-owner"))[0].response_count).toBe(fixture!.responses);
  });

  it("an unrelated signed-in actor sees no project or response aggregate", async () => {
    expect(await projectsFor("outsider")).toEqual([]);
  });

  it.each(["anonymous", "participant"] as const)("%s cannot read facilitator project aggregates", async kind => {
    await expect(projectsFor("outsider", kind)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
});
