import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { get as projectGet, list as projectList, update as projectUpdate } from "../src/handlers/project";
import { list as workspaceList, add_project, remove_project } from "../src/handlers/workspace";
import { list as grantList, invite } from "../src/handlers/grant";
import { get as assessmentGet } from "../src/handlers/assessment";
import { execute } from "../src/dispatch";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

// Workspace roles inherit to every grouped project (cookbook work/active/2026-10-15-3d-workspace-permissions).
// Synthetic principals and ids only; no real addresses.
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "w", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "ws-inherit-db" } }] }));
afterAll(() => mf.dispose());

describe("workspace → project role inheritance", () => {
  it("member/viewer/owner of a workspace reach grouped projects; nothing leaks outside it", async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    const stmts = (path: string) => sql(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
    await db.batch(stmts("../migrations/0001_init.sql"));
    const now = new Date("2026-10-15T21:00:00.000Z");
    const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_wi_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["u_own", "u_mem", "u_view", "u_out", "u_pown"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_a", "Synthetic WS", at, "u_own").run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_b", "Other WS", at, "u_out").run();
    for (const [id, ws] of [["prj_1", "ws_a"], ["prj_2", "ws_a"], ["prj_out", null], ["prj_b", "ws_b"]] as const)
      await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind(id, ws, id, at, "u_own").run();
    await db.prepare("INSERT INTO language (id, project_id, code, name, created_at) VALUES (?,?,?,?,?)").bind("lang_1", "prj_1", "syn", "Synthetic", at).run();
    await db.prepare("INSERT INTO assessment (id, project_id, language_id, name, stage, created_at) VALUES (?,?,?,?,?,?)").bind("asm_1", "prj_1", "lang_1", "A1", "prepare", at).run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("g1", "u_own", "workspace", "ws_a", "owner");
    await grant("g2", "u_mem", "workspace", "ws_a", "member");
    await grant("g3", "u_view", "workspace", "ws_a", "viewer");
    await grant("g4", "u_view", "project", "prj_out", "owner"); // a direct grant elsewhere stays exact
    await grant("g5", "u_out", "workspace", "ws_b", "owner");
    const own = mk("u_own"), mem = mk("u_mem"), view = mk("u_view"), out = mk("u_out");

    // member opens BOTH grouped projects without a per-project invite
    for (const pid of ["prj_1", "prj_2"]) expect((await projectGet(mem, { id: pid })).result.project.role).toBe("member");
    expect((await projectList(mem, {})).result.projects.map((p: any) => [p.id, p.role])).toEqual([["prj_1", "member"], ["prj_2", "member"]]);
    // dispatch path (policy.authorize) agrees
    const viaDispatch: any = await execute(mem, "cap.project.get", { id: "prj_2" }, { tool: "read" });
    expect(JSON.stringify(viaDispatch)).not.toContain("NOT_FOUND_OR_NOT_VISIBLE");
    // project settings are owner-only: workspace owner edits through inheritance, member does not
    await expect(projectUpdate(own, { id: "prj_1", name: "renamed" })).resolves.toBeTruthy();
    await expect(projectUpdate(mem, { id: "prj_1", name: "nope" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });

    // viewer opens but cannot edit — NEGATIVE
    expect((await projectGet(view, { id: "prj_1" })).result.project.role).toBe("viewer");
    await expect(projectUpdate(view, { id: "prj_1", name: "nope" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    const denied: any = await execute(view, "cap.project.update", { id: "prj_1", name: "nope" }, { tool: "write" });
    expect(JSON.stringify(denied)).toContain("NOT_AUTHORIZED_AT_SCOPE");
    await expect(invite(view, { scope: "project", id: "prj_1", email: "x@example.invalid", role: "viewer" }, { dryRun: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // viewer's direct owner grant on an ungrouped project is untouched; list shows the max per project
    expect((await projectList(view, {})).result.projects.map((p: any) => [p.id, p.role]).sort()).toEqual([["prj_1", "viewer"], ["prj_2", "viewer"], ["prj_out", "owner"]]);

    // NO LEAKAGE: outsider (owner of another workspace) sees none of ws_a's projects; ws_a members see none of ws_b's
    for (const pid of ["prj_1", "prj_2", "prj_out"]) await expect(projectGet(out, { id: pid })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    expect((await projectList(out, {})).result.projects.map((p: any) => p.id)).toEqual(["prj_b"]);
    await expect(projectGet(mem, { id: "prj_b" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await expect(projectGet(mem, { id: "prj_out" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    expect((await projectList(mem, {})).result.projects.map((p: any) => p.id)).not.toContain("prj_out");
    const hidden: any = await execute(out, "cap.project.get", { id: "prj_1" }, { tool: "read" });
    expect(JSON.stringify(hidden)).toContain("NOT_FOUND_OR_NOT_VISIBLE");
    await expect(grantList(out, { scope: "project", id: "prj_1" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });

    // assessments still need their own grant (D9 unchanged): workspace owner does not open asm_1
    await expect(assessmentGet(own, { id: "asm_1" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });

    // workspace owner manages grouped-project grants through inheritance
    await expect(grantList(own, { scope: "project", id: "prj_2" })).resolves.toBeTruthy();
    // workspace card count reflects every grouped project
    expect((await workspaceList(mem, {})).result.workspaces[0]).toMatchObject({ id: "ws_a", role: "member", project_count: 2 });

    // ungrouping ends inheritance at once
    await remove_project(own, { id: "ws_a", pid: "prj_2" });
    await expect(projectGet(mem, { id: "prj_2" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await expect(add_project(mem, { id: "ws_a", pid: "prj_out" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  });
});
