import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { get as projectGet, list as projectList, update as projectUpdate } from "../src/handlers/project";
import { list as workspaceList, add_project, remove_project } from "../src/handlers/workspace";
import { list as grantList, invite, transfer_owner, accept, update_role, revoke_invitation, mine, revoke as grantRevoke } from "../src/handlers/grant";
import { authorize } from "../src/policy";
import { byId } from "../src/registry";
import { get as assessmentGet } from "../src/handlers/assessment";
import { execute } from "../src/dispatch";
import { handlers } from "../src/handlers";
import { opsUsage } from "../src/handlers/usage";
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
    // NEGATIVE: an inherited (workspace) owner cannot transfer ownership or step down — no direct project owner grant
    await expect(transfer_owner(own, { scope: "project", id: "prj_2", to: "u_mem", step_down: true }, { dryRun: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(transfer_owner(own, { scope: "project", id: "prj_2", to: "u_mem", step_down: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    const viaDispatchTransfer: any = await execute(own, "cap.grant.transfer_owner", { scope: "project", id: "prj_2", to: "u_mem", step_down: true }, { tool: "danger", mode: "dry_run" });
    expect(JSON.stringify(viaDispatchTransfer)).toContain("NOT_AUTHORIZED_AT_SCOPE");
    expect((await db.prepare('SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("project", "prj_2").first<{ n: number }>())!.n).toBe(0);
    // a DIRECT project owner still transfers
    await grant("g6", "u_pown", "project", "prj_1", "owner");
    await expect(transfer_owner(mk("u_pown"), { scope: "project", id: "prj_1", to: "u_mem" })).resolves.toMatchObject({ result: { transferred: true } });
    // workspace card count reflects every grouped project
    expect((await workspaceList(mem, {})).result.workspaces[0]).toMatchObject({ id: "ws_a", role: "member", project_count: 2 });

    // ungrouping ends inheritance at once
    await remove_project(own, { id: "ws_a", pid: "prj_2" });
    await expect(projectGet(mem, { id: "prj_2" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await expect(add_project(mem, { id: "ws_a", pid: "prj_out" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  });
});

// HOLD #483 c6204382554: grouping hands the project's roles to every workspace grantee, so add_project needs a
// DIRECT project owner grant. A project member must not become owner via a self-service workspace.
const mf2 = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "w2", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "ws-escalation-db" } }] }));
afterAll(() => mf2.dispose());

describe("workspace grouping cannot mint project ownership", () => {
  it("member → self-service workspace → add_project is refused; direct owner still groups", async () => {
    const db = await mf2.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql("../migrations/0001_init.sql").split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    const now = new Date("2026-10-15T23:00:00.000Z");
    const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_esc_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["u_m", "u_po", "u_wo"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    for (const id of ["prj_x", "prj_y"]) await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind(id, null, id, at, "u_po").run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_po", "Owner WS", at, "u_po").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("e1", "u_m", "project", "prj_x", "member");
    await grant("e2", "u_po", "project", "prj_x", "owner");
    await grant("e3", "u_po", "project", "prj_y", "owner");
    await grant("e4", "u_po", "workspace", "ws_po", "owner");
    await grant("e5", "u_wo", "workspace", "ws_po", "owner");
    const m = mk("u_m"), po = mk("u_po"), wo = mk("u_wo");

    // u_m (direct project member) creates a workspace — self-service, becomes its owner
    const created: any = await execute(mk("u_m"), "cap.workspace.create", { name: "Mine" }, { tool: "write" });
    expect(JSON.stringify(created)).not.toContain("NOT_AUTHORIZED");
    const wsM = (await db.prepare('SELECT scope_id FROM "grant" WHERE principal_id = ? AND scope_type = ?').bind("u_m", "workspace").first<{ scope_id: string }>())!.scope_id;

    // NEGATIVE: grouping prj_x is refused on both faces; the project stays ungrouped and u_m stays member
    await expect(add_project(m, { id: wsM, pid: "prj_x" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    const viaDispatch: any = await execute(mk("u_m"), "cap.workspace.add_project", { id: wsM, pid: "prj_x" }, { tool: "write" });
    expect(JSON.stringify(viaDispatch)).toContain("NOT_AUTHORIZED_AT_SCOPE");
    expect((await db.prepare("SELECT workspace_id FROM project WHERE id = ?").bind("prj_x").first<{ workspace_id: string | null }>())!.workspace_id).toBeNull();
    expect((await projectGet(m, { id: "prj_x" })).result.project.role).toBe("member");
    await expect(projectUpdate(m, { id: "prj_x", name: "hijacked" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });

    // A direct project owner groups prj_y into their workspace; inherited ownership does not let another
    // workspace owner re-home it, nor let a project's inherited owner group a different project.
    await expect(add_project(po, { id: "ws_po", pid: "prj_y" })).resolves.toMatchObject({ result: { grouped: true } });
    expect((await projectGet(wo, { id: "prj_y" })).result.project.role).toBe("owner"); // intended: owner shared it
    await expect(add_project(wo, { id: wsM, pid: "prj_y" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" }); // wo has no grant on wsM
    // inherited owner (wo) cannot use add_project as an authority source on its own workspace either
    await grant("e6", "u_wo", "project", "prj_x", "member");
    await expect(add_project(wo, { id: "ws_po", pid: "prj_x" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });

    // ungrouping only narrows access: a workspace owner may remove a grouped project
    await expect(remove_project(wo, { id: "ws_po", pid: "prj_y" })).resolves.toMatchObject({ result: { grouped: false } });
    await expect(projectGet(wo, { id: "prj_y" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  });
  // HOLD #483 c6204865181 #1/#2: an inherited workspace role must never be laundered into a direct project grant.
  it("inherited roles cannot self-invite, accept their own invitation, or mint project owners", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-16T00:30:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_wl_${++trace}`, now: () => now, log: () => {} });
    const ids = ["l_wo", "l_wm", "l_po", "l_pm", "l_new"];
    for (const id of ids) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_l", "Launder WS", at, "l_wo").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_l", "ws_l", "prj_l", at, "l_po").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("l1", "l_wo", "workspace", "ws_l", "owner");
    await grant("l2", "l_wm", "workspace", "ws_l", "member");
    await grant("l3", "l_po", "project", "prj_l", "owner");
    await grant("l4", "l_pm", "project", "prj_l", "member");
    const direct = async (pid: string) => (await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind(pid, "project", "prj_l").first<{ role: string }>())?.role ?? null;
    const wo = mk("l_wo"), wm = mk("l_wm"), po = mk("l_po");

    // #1 NEGATIVE: inherited owner self-invites as owner (old code: OK, then accept → permanent direct owner)
    await expect(invite(wo, { scope: "project", id: "prj_l", email: "l_wo@example.invalid", role: "owner" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // inherited owner / member may not self-invite at member either (access would outlive ungrouping); since ASK L1 default 1
    // an inherited role cannot invite at the project at all, so the refusal comes from the direct-grant check first
    await expect(invite(wo, { scope: "project", id: "prj_l", email: "l_wo@example.invalid", role: "member" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(invite(wm, { scope: "project", id: "prj_l", email: "l_wm@example.invalid", role: "member" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // nor invite anyone else who already holds a role there (inherited or direct)
    await expect(invite(po, { scope: "project", id: "prj_l", email: "l_wm@example.invalid", role: "member" })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    await expect(invite(po, { scope: "project", id: "prj_l", email: "l_pm@example.invalid", role: "owner" })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    // a self-invitation minted before this check cannot be accepted by its creator
    await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind("inv_legacy", "project", "prj_l", await sha256("l_wo@example.invalid"), await sha256("il_legacy"), "owner", "sent", "l_wo", at, "2026-10-20T00:00:00.000Z").run();
    await expect(accept(wo, { token: "il_legacy" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(accept(wo, { invitation_id: "inv_legacy" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("l_wo")).toBeNull();
    expect(await direct("l_wm")).toBeNull();
    // a legacy owner invitation from an inherited owner to someone else is not honoured either
    await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind("inv_legacy2", "project", "prj_l", await sha256("l_new@example.invalid"), await sha256("il_legacy2"), "owner", "sent", "l_wo", at, "2026-10-20T00:00:00.000Z").run();
    await expect(accept(mk("l_new"), { invitation_id: "inv_legacy2" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("l_new")).toBeNull();
    await db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind("inv_legacy2").run(); // clear the dedupe window

    // #2 NEGATIVE: inherited owner promotes a direct member to owner (old code: OK, undemotable owner)
    await expect(update_role(wo, { scope: "project", id: "prj_l", gid: "l4", role: "owner" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("l_pm")).toBe("member");

    // POSITIVE: a direct owner still invites a new owner, the invitee accepts, and a direct owner still promotes
    const inv: any = await invite(po, { scope: "project", id: "prj_l", email: "l_new@example.invalid", role: "owner" });
    await expect(accept(mk("l_new"), { invitation_id: inv.result.invitation_id })).resolves.toMatchObject({ result: { granted: true, role: "owner" } });
    expect(await direct("l_new")).toBe("owner");
    await expect(update_role(po, { scope: "project", id: "prj_l", gid: "l4", role: "owner" })).resolves.toMatchObject({ result: { role: "owner" } });
  });
  // ASK L1 default 1 (cookbook work/active/2026-10-15-3d-workspace-permissions/ASK.md, SECURITY-REVIEW-eb72ea5-1841.md § L1):
  // project-scope invite and revoke_invitation need the caller's own DIRECT project grant; an inherited workspace role is not enough.
  it("project-scope invite/revoke_invitation need a direct project grant; workspace invite is unchanged", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-17T23:50:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_l1_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["d_wo", "d_wm", "d_po", "d_pm", "d_pv", "d_out"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_d", "Direct WS", at, "d_wo").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_d", "ws_d", "prj_d", at, "d_po").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("d1", "d_wo", "workspace", "ws_d", "owner");
    await grant("d2", "d_wm", "workspace", "ws_d", "member");
    await grant("d3", "d_po", "project", "prj_d", "owner");
    await grant("d4", "d_pm", "project", "prj_d", "member");
    await grant("d5", "d_pv", "project", "prj_d", "viewer");
    await grant("d6", "d_pv", "workspace", "ws_d", "member"); // direct viewer + inherited member: effective member, direct viewer
    const wo = mk("d_wo"), wm = mk("d_wm"), pm = mk("d_pm"), pv = mk("d_pv"), out = mk("d_out");
    const P = { scope: "project", id: "prj_d" } as const;

    // NEGATIVE: the L1 path — an inherited workspace member invites a second address straight onto the project
    const refused = invite(wm, { ...P, email: "d_alt@example.invalid", role: "member" });
    await expect(refused).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(refused).rejects.toHaveProperty("hint", expect.stringContaining("invite them at the workspace instead"));
    await expect(invite(wm, { ...P, email: "d_alt@example.invalid", role: "viewer" }, { dryRun: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // an inherited workspace OWNER is refused at the project too, and so is a direct viewer whose member role is inherited
    await expect(invite(wo, { ...P, email: "d_alt@example.invalid", role: "member" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(invite(pv, { ...P, email: "d_alt@example.invalid", role: "viewer" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // no existence leak: a caller with no role at all still sees NOT_FOUND_OR_NOT_VISIBLE
    await expect(invite(out, { ...P, email: "d_alt@example.invalid", role: "viewer" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    expect((await db.prepare("SELECT COUNT(*) AS n FROM invitation WHERE scope_id = ?").bind("prj_d").first<{ n: number }>())?.n).toBe(0);

    // POSITIVE: a direct project member still invites (D3: up to member)
    const ok: any = await invite(pm, { ...P, email: "d_alt@example.invalid", role: "member" });
    expect(ok.result.invitation_id).toMatch(/^inv/);
    // revoke_invitation at the project: inherited roles refused, outsider hidden, the direct member may revoke
    await expect(revoke_invitation(wm, { id: ok.result.invitation_id })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(revoke_invitation(wo, { id: ok.result.invitation_id })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(revoke_invitation(out, { id: ok.result.invitation_id })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await expect(revoke_invitation(pm, { id: ok.result.invitation_id })).resolves.toMatchObject({ result: { status: "revoked" } });

    // UNCHANGED: a workspace member invites at the workspace, and may revoke that workspace invitation
    const w: any = await invite(wm, { scope: "workspace", id: "ws_d", email: "d_alt@example.invalid", role: "member" });
    expect(w.result.invitation_id).toMatch(/^inv/);
    await expect(revoke_invitation(wm, { id: w.result.invitation_id })).resolves.toMatchObject({ result: { status: "revoked" } });
  });
  // ASK L1 follow-up F3: accept re-checks a non-owner project invitation's inviter — honoured only while the inviter still
  // holds a DIRECT project grant (member or above). Legacy rows minted from an inherited role stop being acceptable.
  it("project invitation from an inviter without a direct project grant is not honoured at accept; workspace invitations unchanged", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T01:00:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_f3_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["f3_wm", "f3_pm", "f3_a", "f3_b", "f3_c", "f3_d"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_f3", "F3 WS", at, "f3_wm").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_f3", "ws_f3", "prj_f3", at, "f3_pm").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("f3g1", "f3_wm", "workspace", "ws_f3", "member");
    await grant("f3g2", "f3_pm", "project", "prj_f3", "member");
    const row = async (id: string, to: string, scopeType: string, scopeId: string, by: string) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, scopeType, scopeId, await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", by, at, "2026-10-24T00:00:00.000Z").run(); };
    const direct = async (pid: string, t = "project", s = "prj_f3") => (await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind(pid, t, s).first<{ role: string }>())?.role ?? null;

    // NEGATIVE: a member invitation minted at the project by an inherited workspace member (before #526) is refused, by id and by token
    await row("inv_f3_inh", "f3_a", "project", "prj_f3", "f3_wm");
    await expect(accept(mk("f3_a"), { invitation_id: "inv_f3_inh" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(accept(mk("f3_a"), { token: "tok_inv_f3_inh" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("f3_a")).toBeNull();
    // NEGATIVE: a direct project member's invitation stops being honoured once that member's project grant is gone
    await row("inv_f3_gone", "f3_b", "project", "prj_f3", "f3_pm");
    await db.prepare('DELETE FROM "grant" WHERE id = ?').bind("f3g2").run();
    await expect(accept(mk("f3_b"), { invitation_id: "inv_f3_gone" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("f3_b")).toBeNull();
    // POSITIVE: a direct project member's invitation is accepted
    await grant("f3g3", "f3_pm", "project", "prj_f3", "member");
    await row("inv_f3_ok", "f3_c", "project", "prj_f3", "f3_pm");
    await expect(accept(mk("f3_c"), { invitation_id: "inv_f3_ok" })).resolves.toMatchObject({ result: { granted: true, role: "member" } });
    expect(await direct("f3_c")).toBe("member");
    // UNCHANGED: a workspace invitation from the workspace member is still accepted
    await row("inv_f3_ws", "f3_d", "workspace", "ws_f3", "f3_wm");
    await expect(accept(mk("f3_d"), { invitation_id: "inv_f3_ws" })).resolves.toMatchObject({ result: { granted: true, role: "member" } });
    expect(await direct("f3_d", "workspace", "ws_f3")).toBe("member");
  });
  // Dead invitations (cookbook work/active/2026-10-17-3d-dead-invitations DoD 2, 3): rows whose inviter no longer stands
  // behind them (no direct member+ project grant; owner invitation without a direct owner inviter) are refused at accept,
  // not listed and not counted by invite de-dup; a re-invite revokes the dead row it supersedes (cookbook
  // work/active/2026-10-18-3d-invite-followups DoD (a)). An own invitation is refused at accept and left out of
  // cap.me.invitations, but the roster still lists it. Workspace invitations below owner are unchanged (finding 4 is a named hold).
  it("dead invitations are not listed (cap.me.invitations, roster pending) and a re-invite sends a fresh one", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T02:00:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_dd_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["dd_wm", "dd_pm", "dd_a", "dd_b", "dd_c"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_dd", "DD WS", at, "dd_wm").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_dd", "ws_dd", "prj_dd", at, "dd_pm").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("ddg1", "dd_wm", "workspace", "ws_dd", "member");
    await grant("ddg2", "dd_pm", "project", "prj_dd", "member");
    const row = async (id: string, to: string, scopeType: string, scopeId: string, by: string, role = "member") => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, scopeType, scopeId, await sha256(to + "@example.invalid"), await sha256("tok_" + id), role, "sent", by, at, "2026-10-24T00:00:00.000Z").run(); };
    await row("inv_dd_dead", "dd_a", "project", "prj_dd", "dd_wm");             // inherited inviter → accept refuses
    await row("inv_dd_live", "dd_b", "project", "prj_dd", "dd_pm");             // direct project member → live
    await row("inv_dd_owner", "dd_c", "workspace", "ws_dd", "dd_wm", "owner");   // owner invitation, inviter not a direct owner → dead
    await row("inv_dd_ws", "dd_c", "workspace", "ws_dd", "dd_wm");              // workspace member invitation → unchanged, live
    await row("inv_dd_self", "dd_c", "workspace", "ws_dd", "dd_c");             // own invitation → accept refuses
    const ids = (r: any) => (r.result.invitations ?? r.result.pending_invitations).map((i: any) => i.id).sort();

    // (2) cap.me.invitations: dead rows absent; live rows (and the unchanged workspace row) present
    expect(ids(await mine(mk("dd_a"), {}))).toEqual([]);
    expect(ids(await mine(mk("dd_b"), {}))).toEqual(["inv_dd_live"]);
    expect(ids(await mine(mk("dd_c"), {}))).toEqual(["inv_dd_ws"]);
    // every listed row is one accept honours; every hidden row is one accept refuses
    await expect(accept(mk("dd_a"), { invitation_id: "inv_dd_dead" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(accept(mk("dd_c"), { invitation_id: "inv_dd_owner" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(accept(mk("dd_c"), { invitation_id: "inv_dd_self" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(accept(mk("dd_b"), { invitation_id: "inv_dd_live" }, { dryRun: true } as any)).resolves.toMatchObject({ result: {} });
    // (2) roster pending_invitations: same rule
    expect(ids(await grantList(mk("dd_pm"), { scope: "project", id: "prj_dd" }))).toEqual(["inv_dd_live"]);
    expect(ids(await grantList(mk("dd_wm"), { scope: "workspace", id: "ws_dd" }))).toEqual(["inv_dd_self", "inv_dd_ws"].sort());

    // (3) de-dup ignores the dead row: a direct member re-inviting dd_a gets a fresh invitation, not "nothing was sent again"
    const fresh = await invite(mk("dd_pm"), { scope: "project", id: "prj_dd", email: "dd_a@example.invalid", role: "member" });
    expect(fresh.result.invitation_id).not.toBe("inv_dd_dead");
    expect(fresh.result.delivery.reason).not.toBe("duplicate_recent");
    expect(ids(await mine(mk("dd_a"), {}))).toEqual([fresh.result.invitation_id]);
    // control: a LIVE row inside the cooldown still de-duplicates
    const twin = await invite(mk("dd_pm"), { scope: "project", id: "prj_dd", email: "dd_b@example.invalid", role: "member" });
    expect(twin.result).toMatchObject({ invitation_id: "inv_dd_live", delivery: { reason: "duplicate_recent" } });
    // the re-invite revoked the dead row it superseded, so it stays dead when its inviter gains a direct project grant:
    // one live row for dd_a at prj_dd, never two
    const status = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    expect(await status("inv_dd_dead")).toBe("revoked");
    expect(await status("inv_dd_live")).toBe("sent"); // the de-duplicated twin revoked nothing
    await grant("ddg3", "dd_wm", "project", "prj_dd", "member");
    expect(ids(await grantList(mk("dd_pm"), { scope: "project", id: "prj_dd" }))).toEqual(["inv_dd_live", fresh.result.invitation_id].sort());
    expect(ids(await mine(mk("dd_a"), {}))).toEqual([fresh.result.invitation_id]);
    await expect(accept(mk("dd_a"), { invitation_id: "inv_dd_dead" })).rejects.toBeTruthy();
  });
  // Follow-ups DoD (a), the other way: a re-invite revokes ONLY a dead row for the same invitee at the same scope. A live
  // row outside the de-dup cooldown, a dead row for another invitee, and a dead row at another scope are left as they were;
  // a de-duplicated or rate-limited invite (no INSERT) revokes nothing.
  it("a re-invite revokes only the superseded dead row (same invitee, same scope)", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T03:00:00.000Z"); const at = now.toISOString(); const old = "2026-10-17T03:00:00.000Z";
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_sd_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["sd_wm", "sd_pm", "sd_a", "sd_b", "sd_c"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_sd", "SD WS", at, "sd_wm").run();
    for (const pid of ["prj_sd", "prj_sd2"]) await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind(pid, "ws_sd", pid, at, "sd_pm").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("sdg1", "sd_wm", "workspace", "ws_sd", "member");
    await grant("sdg2", "sd_pm", "project", "prj_sd", "member");
    await grant("sdg3", "sd_pm", "project", "prj_sd2", "member");
    const row = async (id: string, to: string, scopeId: string, by: string, created = at) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", scopeId, await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", by, created, "2026-10-24T00:00:00.000Z").run(); };
    await row("inv_sd_old_live", "sd_a", "prj_sd", "sd_pm", old);   // live, outside the cooldown → not a de-dup twin, not dead
    await row("inv_sd_dead_a", "sd_a", "prj_sd", "sd_wm");          // dead, same invitee + scope → superseded
    await row("inv_sd_dead_b", "sd_b", "prj_sd", "sd_wm");          // dead, other invitee → untouched
    await row("inv_sd_dead_a2", "sd_a", "prj_sd2", "sd_wm");        // dead, same invitee, other scope → untouched
    await row("inv_sd_live_c", "sd_c", "prj_sd", "sd_pm");          // live twin inside the cooldown for sd_c
    await row("inv_sd_dead_c", "sd_c", "prj_sd", "sd_wm");          // dead, but the sd_c re-invite de-duplicates (no INSERT)
    const status = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;

    const fresh = await invite(mk("sd_pm"), { scope: "project", id: "prj_sd", email: "sd_a@example.invalid", role: "member" });
    expect(fresh.result.delivery.reason).not.toBe("duplicate_recent");
    expect(await status("inv_sd_dead_a")).toBe("revoked");
    expect(await status("inv_sd_old_live")).toBe("sent");
    expect(await status("inv_sd_dead_b")).toBe("sent");
    expect(await status("inv_sd_dead_a2")).toBe("sent");
    const twin = await invite(mk("sd_pm"), { scope: "project", id: "prj_sd", email: "sd_c@example.invalid", role: "member" });
    expect(twin.result).toMatchObject({ invitation_id: "inv_sd_live_c", delivery: { reason: "duplicate_recent" } });
    expect(await status("inv_sd_dead_c")).toBe("sent");
  });
  // Follow-ups 2 (cookbook work/active/2026-10-18-3d-invite-followups-2 DoD (a)-(d)): the re-invite's revoke never goes past the
  // owner ceiling (a dead owner row is revoked only by an owner re-invite), leaves expired rows as they were, revokes nothing
  // when the invite is rate-limited, and reports how many superseded rows it revoked in `impact` (dry-run too) and the log.
  it("a re-invite's revoke respects the owner ceiling, skips expired rows, is reported, and a rate-limited invite revokes nothing", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T05:00:00.000Z"); const at = now.toISOString(); const past = "2026-10-18T04:00:00.000Z";
    let trace = 0; const logs: [string, any][] = [];
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_f2_${++trace}`, now: () => now, log: (e: string, d: any) => { logs.push([e, d]); } } as any);
    for (const id of ["f2_wm", "f2_pm", "f2_po", "f2_x", "f2_y", "f2_z", "f2_r"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_f2", "F2 WS", at, "f2_wm").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_f2", "ws_f2", "prj_f2", at, "f2_po").run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("f2g1", "f2_wm", "workspace", "ws_f2", "member");
    await grant("f2g2", "f2_pm", "project", "prj_f2", "member");
    await grant("f2g3", "f2_po", "project", "prj_f2", "owner");
    const row = async (id: string, to: string, role: string, expires = "2026-10-24T00:00:00.000Z") => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", "prj_f2", await sha256(to + "@example.invalid"), await sha256("tok_" + id), role, "sent", "f2_wm", at, expires).run(); };
    const status = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    // all of these are dead: f2_wm holds no direct project grant
    await row("inv_f2_x_owner", "f2_x", "owner");          // (a) dead OWNER row: a member re-invite must not revoke it
    await row("inv_f2_x_member", "f2_x", "member");        // dead member row: superseded
    await row("inv_f2_x_expired", "f2_x", "member", past); // (b) expired dead row: left as it was
    await row("inv_f2_y_owner", "f2_y", "owner");          // (a) other way: an owner re-invite as owner revokes it
    await row("inv_f2_r_dead", "f2_r", "member");          // (c) the rate-limited re-invite must leave it alone

    // (d) dry-run reports what the re-invite would revoke, and revokes nothing
    const dry = await invite(mk("f2_pm"), { scope: "project", id: "prj_f2", email: "f2_x@example.invalid", role: "member" }, { dryRun: true } as any);
    expect(dry.impact.revoked_superseded).toBe(1);
    expect(await status("inv_f2_x_member")).toBe("sent");
    // (a) a member re-invite as member revokes the dead member row only; (b) the expired row stays 'sent'; (d) reported
    logs.length = 0;
    const x = await invite(mk("f2_pm"), { scope: "project", id: "prj_f2", email: "f2_x@example.invalid", role: "member" });
    expect(x.result.delivery.reason).not.toBe("duplicate_recent");
    expect(await status("inv_f2_x_member")).toBe("revoked");
    expect(await status("inv_f2_x_owner")).toBe("sent");
    expect(await status("inv_f2_x_expired")).toBe("sent");
    expect(x.impact.revoked_superseded).toBe(1);
    expect(logs.find(([e]) => e === "grant.invite.mail")?.[1]).toMatchObject({ revoked_superseded: 1 });
    // a de-duplicated re-invite reports 0
    const twin = await invite(mk("f2_pm"), { scope: "project", id: "prj_f2", email: "f2_x@example.invalid", role: "member" });
    expect(twin.result.delivery.reason).toBe("duplicate_recent");
    expect(twin.impact.revoked_superseded).toBe(0);
    // (a) the other way: an owner re-invite as owner revokes the dead owner row
    const yDry = await invite(mk("f2_po"), { scope: "project", id: "prj_f2", email: "f2_y@example.invalid", role: "owner" }, { dryRun: true } as any);
    expect(yDry.impact.revoked_superseded).toBe(1);
    const y = await invite(mk("f2_po"), { scope: "project", id: "prj_f2", email: "f2_y@example.invalid", role: "owner" });
    expect(await status("inv_f2_y_owner")).toBe("revoked");
    expect(y.impact.revoked_superseded).toBe(1);
    // (c) a rate-limited re-invite inserts nothing and revokes nothing
    for (let i = 0; i < 30; i++) await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(`inv_f2_rl_${i}`, "project", "prj_f2", await sha256(`rl${i}@example.invalid`), await sha256(`tok_rl_${i}`), "member", "revoked", "f2_pm", at, "2026-10-24T00:00:00.000Z").run();
    await expect(invite(mk("f2_pm"), { scope: "project", id: "prj_f2", email: "f2_r@example.invalid", role: "member" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(await status("inv_f2_r_dead")).toBe("sent");
  });
  // 0.35.8 (cookbook work/active/2026-10-18-3d-invite-revoke-on-grant-removal DoD (a)-(c)): removing a grant, downgrading it,
  // or stepping down from owner revokes the open, unexpired invitations its holder could no longer issue, in the same batch;
  // the count is reported (impact incl. dry-run, or the result where the call has no dry-run, and the log); and a regained
  // grant cannot revive them: the old link is refused by accept.
  it("grant removal or downgrade revokes the holder's orphaned invitations, is reported, and a regained grant cannot revive them", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T07:00:00.000Z"); const at = now.toISOString(); const past = "2026-10-18T06:00:00.000Z";
    let trace = 0; const logs: [string, any][] = [];
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_rv_${++trace}`, now: () => now, log: (e: string, d: any) => { logs.push([e, d]); } } as any);
    for (const id of ["rv_po", "rv_po2", "rv_pm", "rv_pm2", "rv_x", "rv_y", "rv_z", "rv_w"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_rv", "RV WS", at, "rv_po").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_rv", "ws_rv", "prj_rv", at, "rv_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_rv", r, at).run();
    await grant("rvg_po", "rv_po", "owner"); await grant("rvg_po2", "rv_po2", "owner");
    await grant("rvg_pm", "rv_pm", "member"); await grant("rvg_pm2", "rv_pm2", "member");
    const row = async (id: string, by: string, to: string, role: string, status = "sent", expires = "2026-10-24T00:00:00.000Z") => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", "prj_rv", await sha256(to + "@example.invalid"), await sha256("tok_" + id), role, status, by, at, expires).run(); };
    const status = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    const own = mk("rv_po");

    // (a) removal: rv_pm's fresh invitation is revoked with the grant; its expired row and another inviter's row are untouched
    const sent = await invite(mk("rv_pm"), { scope: "project", id: "prj_rv", email: "rv_x@example.invalid", role: "member" });
    const xToken = sent.result.dev_only_link_token as string;
    await expect(accept(mk("rv_x"), { token: xToken }, { dryRun: true })).resolves.toBeTruthy(); // the link works before the removal
    await row("inv_rv_pm_expired", "rv_pm", "rv_w", "member", "sent", past);
    await row("inv_rv_po_live", "rv_po", "rv_w", "member");
    logs.length = 0;
    const removed = await grantRevoke(own, { scope: "project", id: "prj_rv", gid: "rvg_pm" });
    expect(removed.result).toMatchObject({ revoked: true, revoked_invitations: 1 }); // (c) no dry-run here: the result carries it
    expect(logs.find(([e]) => e === "grant.revoke")?.[1]).toMatchObject({ revoked_invitations: 1 });
    expect(await status(sent.result.invitation_id)).toBe("revoked");
    expect(await status("inv_rv_pm_expired")).toBe("sent");
    expect(await status("inv_rv_po_live")).toBe("sent");
    // (b) remove -> re-grant: the old link is refused
    await grant("rvg_pm_again", "rv_pm", "member");
    await expect(accept(mk("rv_x"), { token: xToken })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });

    // (a) downgrade member -> viewer: an 'unconfirmed' row is open too; (c) dry-run counts it and revokes nothing
    await row("inv_rv_pm2_y", "rv_pm2", "rv_y", "member", "unconfirmed");
    const dDry = await update_role(own, { scope: "project", id: "prj_rv", gid: "rvg_pm2", role: "viewer" }, { dryRun: true });
    expect(dDry.impact!.revoked_invitations).toBe(1);
    expect(await status("inv_rv_pm2_y")).toBe("unconfirmed");
    logs.length = 0;
    const down = await update_role(own, { scope: "project", id: "prj_rv", gid: "rvg_pm2", role: "viewer" });
    expect(down.impact!.revoked_invitations).toBe(1);
    expect(logs.find(([e]) => e === "grant.update_role")?.[1]).toMatchObject({ downgrade: true, revoked_invitations: 1 });
    expect(await status("inv_rv_pm2_y")).toBe("revoked");
    // (b) raise back: revokes nothing, revives nothing
    const up = await update_role(own, { scope: "project", id: "prj_rv", gid: "rvg_pm2", role: "member" });
    expect(up.impact!.revoked_invitations).toBe(0);
    await expect(accept(mk("rv_y"), { token: "tok_inv_rv_pm2_y" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });

    // (a) owner steps down (owner -> member): the owner invitation goes, the member one stays (a member may still issue it)
    await row("inv_rv_po2_z_owner", "rv_po2", "rv_z", "owner");
    await row("inv_rv_po2_w_member", "rv_po2", "rv_w", "member");
    const tDry = await transfer_owner(mk("rv_po2"), { scope: "project", id: "prj_rv", to: "rv_po", step_down: true }, { dryRun: true });
    expect(tDry.impact!.revoked_invitations).toBe(1);
    expect(await status("inv_rv_po2_z_owner")).toBe("sent");
    logs.length = 0;
    const t = await transfer_owner(mk("rv_po2"), { scope: "project", id: "prj_rv", to: "rv_po", step_down: true });
    expect(t.impact!.revoked_invitations).toBe(1);
    expect(logs.find(([e]) => e === "grant.transfer_owner")?.[1]).toMatchObject({ step_down: true, revoked_invitations: 1 });
    expect(await status("inv_rv_po2_z_owner")).toBe("revoked");
    expect(await status("inv_rv_po2_w_member")).toBe("sent");
    // a member re-invite of the same person leaves no dead owner row behind to revive (531 not-blocking 1) ...
    const re = await invite(mk("rv_po2"), { scope: "project", id: "prj_rv", email: "rv_z@example.invalid", role: "member" });
    expect(re.impact.revoked_superseded).toBe(0);
    // ... and (b) the regained direct owner grant cannot revive the old owner link
    await update_role(own, { scope: "project", id: "prj_rv", gid: "rvg_po2", role: "owner" });
    await expect(accept(mk("rv_z"), { token: "tok_inv_rv_po2_z_owner" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  });
  // 0.35.9 (cookbook work/active/2026-10-18-3d-invite-guard-race DoD (a)): invite re-checks the inviter's standing inside its
  // INSERT, so a grant removed or lowered between the handler's checks and the write leaves no fresh row. The race is simulated
  // by a db whose batch() first applies the grant change, i.e. after every check has already passed.
  it("a grant removed or lowered between invite's checks and its INSERT leaves no fresh invitation and revokes nothing", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T08:00:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => { await db.prepare(change).run(); return db.batch(st); } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_gr_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["gr_po", "gr_po2", "gr_pm", "gr_pm2", "gr_gone", "gr_x", "gr_y", "gr_z"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_gr", "GR WS", at, "gr_po").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_gr", "ws_gr", "prj_gr", at, "gr_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_gr", r, at).run();
    await grant("grg_po", "gr_po", "owner"); await grant("grg_po2", "gr_po2", "owner");
    await grant("grg_pm", "gr_pm", "member"); await grant("grg_pm2", "gr_pm2", "member");
    const rowsFor = async (to: string) => (await db.prepare("SELECT id, status FROM invitation WHERE scope_id = 'prj_gr' AND invitee_hash = ?").bind(await sha256(to + "@example.invalid")).all<{ id: string; status: string }>()).results;
    // a dead row for gr_x (its inviter holds no grant) that a LANDED invite would supersede and revoke
    await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind("inv_gr_dead", "project", "prj_gr", await sha256("gr_x@example.invalid"), await sha256("tok_inv_gr_dead"), "member", "sent", "gr_gone", at, "2026-10-24T00:00:00.000Z").run();

    // removal lands in the window: refused as a role change, no row, and the dead row is not revoked (the batch revoke is gated on the INSERT)
    await expect(invite(mk("gr_pm", racing(`DELETE FROM "grant" WHERE id = 'grg_pm'`)), { scope: "project", id: "prj_gr", email: "gr_x@example.invalid", role: "member" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE", message: expect.stringContaining("changed while the invitation was being written") });
    expect(await rowsFor("gr_x")).toEqual([{ id: "inv_gr_dead", status: "sent" }]);
    // downgrade member -> viewer lands in the window: no row
    await expect(invite(mk("gr_pm2", racing(`UPDATE "grant" SET role = 'viewer' WHERE id = 'grg_pm2'`)), { scope: "project", id: "prj_gr", email: "gr_y@example.invalid", role: "member" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await rowsFor("gr_y")).toEqual([]);
    // an owner steps down to member in the window: no owner row
    await expect(invite(mk("gr_po2", racing(`UPDATE "grant" SET role = 'member' WHERE id = 'grg_po2'`)), { scope: "project", id: "prj_gr", email: "gr_z@example.invalid", role: "owner" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await rowsFor("gr_z")).toEqual([]);
    // ... while a member invitation from that same (now member) holder still lands: the guard is the inviterStands rule, no stricter
    const ok = await invite(mk("gr_po2"), { scope: "project", id: "prj_gr", email: "gr_z@example.invalid", role: "member" });
    expect((await rowsFor("gr_z")).map((r) => r.id)).toEqual([ok.result.invitation_id]);
    // control: with standing intact the same invite lands and supersedes the dead row in the same batch
    const landed = await invite(mk("gr_po"), { scope: "project", id: "prj_gr", email: "gr_x@example.invalid", role: "member" });
    expect(landed.impact.revoked_superseded).toBe(1);
    expect(Object.fromEntries((await rowsFor("gr_x")).map((r) => [r.id, r.status]))).toEqual({ inv_gr_dead: "revoked", [landed.result.invitation_id]: "pending" });
  });
  // 0.35.9 (cookbook work/active/2026-10-18-3d-invite-guard-race DoD (b)): ONE expiry boundary. A row is live while
  // expires_at > now; at expires_at == now it is expired for accept AND for the grant-removal sweep (which leaves it as it was).
  it("expiry boundary: at expires_at == now accept refuses and the revoke sweep skips; one millisecond later both treat it as live", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T09:00:00.000Z"); const at = now.toISOString(); const later = new Date(now.getTime() + 1).toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_eb_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["eb_po", "eb_pm", "eb_x", "eb_y"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_eb", "EB WS", at, "eb_po").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_eb", "ws_eb", "prj_eb", at, "eb_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_eb", r, at).run();
    await grant("ebg_po", "eb_po", "owner"); await grant("ebg_pm", "eb_pm", "member");
    const row = async (id: string, to: string, expires: string) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", "prj_eb", await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", "eb_pm", at, expires).run(); };
    const status = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    await row("inv_eb_edge", "eb_x", at); // expires_at == now
    await row("inv_eb_live", "eb_y", later); // expires_at == now + 1 ms
    await expect(accept(mk("eb_x"), { token: "tok_inv_eb_edge" }, { dryRun: true })).rejects.toMatchObject({ code: "INVALID_PARAMS", message: "invitation_expired" });
    await expect(accept(mk("eb_y"), { token: "tok_inv_eb_live" }, { dryRun: true })).resolves.toBeTruthy();
    const removed = await grantRevoke(mk("eb_po"), { scope: "project", id: "prj_eb", gid: "ebg_pm" });
    expect(removed.result).toMatchObject({ revoked_invitations: 1 });
    expect(await status("inv_eb_edge")).toBe("sent"); // expired: left as it was, same as accept saw it
    expect(await status("inv_eb_live")).toBe("revoked"); // live: swept, same as accept saw it
  });
  // 0.35.10 (cookbook work/active/2026-10-18-3d-invite-accept-race DoD (a), (b)): accept re-checks the invitation inside its
  // write batch. The race is simulated as in 0.35.9: a db whose batch() first applies the change, after every check passed.
  it("a revoke or inviter grant removal between accept's checks and its batch mints no grant and keeps the refusal typed", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T09:30:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => { await db.prepare(change).run(); return db.batch(st); } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_ar_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["ar_po", "ar_pm", "ar_x", "ar_y", "ar_z"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_ar", "AR WS", at, "ar_po").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_ar", "ws_ar", "prj_ar", at, "ar_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_ar", r, at).run();
    await grant("arg_po", "ar_po", "owner"); await grant("arg_pm", "ar_pm", "member");
    const row = async (id: string, to: string, by: string) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", "prj_ar", await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", by, at, "2026-10-24T00:00:00.000Z").run(); };
    const status = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    const grantsOf = async (p: string) => (await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind(p, "prj_ar").all<{ role: string }>()).results;
    await row("inv_ar_x", "ar_x", "ar_po"); await row("inv_ar_y", "ar_y", "ar_pm"); await row("inv_ar_z", "ar_z", "ar_po");

    // revoke lands in the window: no grant, the row stays 'revoked', and the refusal is the dead-link NOT_FOUND_OR_NOT_VISIBLE
    await expect(accept(mk("ar_x", racing("UPDATE invitation SET status = 'revoked' WHERE id = 'inv_ar_x'")), { token: "tok_inv_ar_x" }))
      .rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    expect(await grantsOf("ar_x")).toEqual([]);
    expect(await status("inv_ar_x")).toBe("revoked");
    // the inviter's direct project grant is removed in the window: no grant, row untouched, refused as accept refuses a fallen inviter
    await expect(accept(mk("ar_y", racing(`DELETE FROM "grant" WHERE id = 'arg_pm'`)), { invitation_id: "inv_ar_y" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE", message: expect.stringContaining("not issued by a direct member") });
    expect(await grantsOf("ar_y")).toEqual([]);
    expect(await status("inv_ar_y")).toBe("sent");
    // control: nothing lands in the window, the same accept grants and marks the row accepted
    const ok = await accept(mk("ar_z", racing("SELECT 1")), { token: "tok_inv_ar_z" });
    expect(ok.result).toMatchObject({ granted: true, role: "member" });
    expect(await grantsOf("ar_z")).toEqual([{ role: "member" }]);
    expect(await status("inv_ar_z")).toBe("accepted");
  });
  // 0.35.10 DoD (c): accept's upsert keeps the higher role. A raise that lands between accept's role read and its batch is not
  // overwritten downward, and the result reports the role actually held.
  it("accept's ON CONFLICT never lowers a higher existing role", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T09:40:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => { await db.prepare(change).run(); return db.batch(st); } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_ac_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["ac_po", "ac_v", "ac_w"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_ac", null, "prj_ac", at, "ac_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_ac", r, at).run();
    await grant("acg_po", "ac_po", "owner"); await grant("acg_v", "ac_v", "viewer"); await grant("acg_w", "ac_w", "viewer");
    const row = async (id: string, to: string) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", "prj_ac", await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", "ac_po", at, "2026-10-24T00:00:00.000Z").run(); };
    const roleOf = async (p: string) => (await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind(p, "prj_ac").first<{ role: string }>())?.role;
    await row("inv_ac_v", "ac_v"); await row("inv_ac_w", "ac_w");
    // viewer -> owner lands in the window; accepting a member invitation keeps owner
    const kept = await accept(mk("ac_v", racing(`UPDATE "grant" SET role = 'owner' WHERE id = 'acg_v'`)), { token: "tok_inv_ac_v" });
    expect(await roleOf("ac_v")).toBe("owner");
    expect(kept.result).toMatchObject({ granted: true, role: "owner" });
    // control: an existing lower role is still raised to the invitation's role
    const raised = await accept(mk("ac_w"), { token: "tok_inv_ac_w" });
    expect(await roleOf("ac_w")).toBe("member");
    expect(raised.result).toMatchObject({ granted: true, role: "member" });
  });
  // 0.35.11 (cookbook work/active/2026-10-18-3d-invite-accept-stale-role DoD (a)-(b)): accept binds the offered role and the
  // SQL keeps the max against the row at batch time, so a grant lowered or removed after accept's role read is not re-raised.
  it("a demotion or removal between accept's role read and its batch is not re-raised by the upsert", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T10:50:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => { await db.prepare(change).run(); return db.batch(st); } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_sr_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["sr_po", "sr_d", "sr_r", "sr_k"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_sr", null, "prj_sr", at, "sr_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_sr", r, at).run();
    await grant("srg_po", "sr_po", "owner"); await grant("srg_d", "sr_d", "owner"); await grant("srg_r", "sr_r", "owner"); await grant("srg_k", "sr_k", "owner");
    const row = async (id: string, to: string) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, "project", "prj_sr", await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", "sr_po", at, "2026-10-24T00:00:00.000Z").run(); };
    const rolesOf = async (p: string) => (await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind(p, "prj_sr").all<{ role: string }>()).results;
    await row("inv_sr_d", "sr_d"); await row("inv_sr_r", "sr_r"); await row("inv_sr_k", "sr_k");
    // owner demoted to viewer in the window; accepting a member invitation gives member, not owner again
    const demoted = await accept(mk("sr_d", racing(`UPDATE "grant" SET role = 'viewer' WHERE id = 'srg_d'`)), { token: "tok_inv_sr_d" });
    expect(await rolesOf("sr_d")).toEqual([{ role: "member" }]);
    expect(demoted.result).toMatchObject({ granted: true, role: "member" });
    // owner grant removed in the window; the accept mints the offered member role, not the stale owner
    const removed = await accept(mk("sr_r", racing(`DELETE FROM "grant" WHERE id = 'srg_r'`)), { invitation_id: "inv_sr_r" });
    expect(await rolesOf("sr_r")).toEqual([{ role: "member" }]);
    expect(removed.result).toMatchObject({ granted: true, role: "member" });
    // control: nothing lands in the window, an existing owner keeps owner and the result reports it
    const kept = await accept(mk("sr_k", racing("SELECT 1")), { token: "tok_inv_sr_k" });
    expect(await rolesOf("sr_k")).toEqual([{ role: "owner" }]);
    expect(kept.result).toMatchObject({ granted: true, role: "owner" });
  });
  // 0.35.12 (cookbook work/active/2026-10-18-3d-grant-owner-guard-race DoD (a)-(b)): update_role and revoke re-check the owner
  // guard inside their write, so a target raised to owner after the handler's read is neither demoted nor removed (D3).
  it("a target raised to owner between update_role's or revoke's read and its batch is not demoted or removed", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T12:20:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => { await db.prepare(change).run(); return db.batch(st); } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_og_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["og_po", "og_d", "og_r", "og_c"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_og", null, "prj_og", at, "og_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_og", r, at).run();
    await grant("ogg_po", "og_po", "owner"); await grant("ogg_d", "og_d", "member"); await grant("ogg_r", "og_r", "member"); await grant("ogg_c", "og_c", "member");
    // each target issued one open member invitation here: a refused write must not revoke it either
    for (const by of ["og_d", "og_r"]) await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(`inv_og_${by}`, "project", "prj_og", await sha256(`x_${by}@example.invalid`), await sha256(`tok_og_${by}`), "member", "sent", by, at, "2026-10-24T00:00:00.000Z").run();
    const roleOf = async (gid: string) => (await db.prepare('SELECT role FROM "grant" WHERE id = ?').bind(gid).first<{ role: string }>())?.role ?? null;
    const statusOf = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    // update_role: the member read as member is raised to owner in the window; the demotion to viewer is refused with D3
    await expect(update_role(mk("og_po", racing(`UPDATE "grant" SET role = 'owner' WHERE id = 'ogg_d'`)), { scope: "project", id: "prj_og", gid: "ogg_d", role: "viewer" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE", message: "owners cannot be demoted" });
    expect(await roleOf("ogg_d")).toBe("owner");
    expect(await statusOf("inv_og_og_d")).toBe("sent");
    // revoke: the member read as member is raised to owner in the window; the removal is refused with D3
    await expect(grantRevoke(mk("og_po", racing(`UPDATE "grant" SET role = 'owner' WHERE id = 'ogg_r'`)), { scope: "project", id: "prj_og", gid: "ogg_r" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE", message: "owners cannot be removed" });
    expect(await roleOf("ogg_r")).toBe("owner");
    expect(await statusOf("inv_og_og_r")).toBe("sent");
    // control: nothing lands in the window, the member is demoted, then removed
    await expect(update_role(mk("og_po", racing("SELECT 1")), { scope: "project", id: "prj_og", gid: "ogg_c", role: "viewer" })).resolves.toMatchObject({ result: { grant: "ogg_c", role: "viewer" } });
    expect(await roleOf("ogg_c")).toBe("viewer");
    await expect(grantRevoke(mk("og_po", racing("SELECT 1")), { scope: "project", id: "prj_og", gid: "ogg_c" })).resolves.toMatchObject({ result: { grant: "ogg_c", revoked: true } });
    expect(await roleOf("ogg_c")).toBe(null);
  });
  // 0.35.13 (cookbook work/active/2026-10-18-3d-grant-update-role-write-guard DoD (a)-(c)): update_role writes only against the
  // role it read, and update_role and revoke re-check the caller's own authority inside their write.
  it("update_role refuses a target role changed after its read; a caller demoted after the read changes no grant", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T13:20:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => { await db.prepare(change).run(); return db.batch(st); } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_wg_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["wg_po", "wg_o2", "wg_m", "wg_t", "wg_u", "wg_v"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_wg", null, "prj_wg", at, "wg_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_wg", r, at).run();
    await grant("wgg_po", "wg_po", "owner"); await grant("wgg_o2", "wg_o2", "owner"); await grant("wgg_m", "wg_m", "member");
    await grant("wgg_t", "wg_t", "viewer"); await grant("wgg_u", "wg_u", "member"); await grant("wgg_v", "wg_v", "viewer");
    const roleOf = async (gid: string) => (await db.prepare('SELECT role FROM "grant" WHERE id = ?').bind(gid).first<{ role: string }>())?.role ?? null;
    const at_ = { scope: "project", id: "prj_wg" };
    // (a) read as viewer, raised to member by someone else in the window: setting "viewer" must not silently undo that raise
    await expect(update_role(mk("wg_po", racing(`UPDATE "grant" SET role = 'member' WHERE id = 'wgg_t'`)), { ...at_, gid: "wgg_t", role: "viewer" }))
      .rejects.toMatchObject({ code: "STAGE_CONFLICT" });
    expect(await roleOf("wgg_t")).toBe("member");
    // (a) the target is revoked in the window: not found, never the D3 owner refusal (DoD (d))
    await expect(update_role(mk("wg_po", racing(`DELETE FROM "grant" WHERE id = 'wgg_v'`)), { ...at_, gid: "wgg_v", role: "member" }))
      .rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await grant("wgg_v", "wg_v", "viewer");
    // (b) update_role: the calling owner is demoted to member in the window; the raise is refused as the read-time check would
    await expect(update_role(mk("wg_o2", racing(`UPDATE "grant" SET role = 'member' WHERE id = 'wgg_o2'`)), { ...at_, gid: "wgg_v", role: "member" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE", message: "owner role required at this project" });
    expect(await roleOf("wgg_v")).toBe("viewer");
    // (b) revoke: the calling member is demoted to viewer in the window; the removal is refused, the target keeps their grant
    await expect(grantRevoke(mk("wg_m", racing(`UPDATE "grant" SET role = 'viewer' WHERE id = 'wgg_m'`)), { ...at_, gid: "wgg_u" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE", message: "member role required at this project" });
    expect(await roleOf("wgg_u")).toBe("member");
    // (b) revoke: the caller's own grant is removed in the window: not visible, the target keeps their grant
    await db.prepare(`UPDATE "grant" SET role = 'member' WHERE id = 'wgg_m'`).run();
    await expect(grantRevoke(mk("wg_m", racing(`DELETE FROM "grant" WHERE id = 'wgg_m'`)), { ...at_, gid: "wgg_u" }))
      .rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    expect(await roleOf("wgg_u")).toBe("member");
    // control: nothing lands in the window — the owner sets the role, and the remaining owner removes the grant
    await expect(update_role(mk("wg_po", racing("SELECT 1")), { ...at_, gid: "wgg_v", role: "member" })).resolves.toMatchObject({ result: { grant: "wgg_v", role: "member" } });
    expect(await roleOf("wgg_v")).toBe("member");
    await expect(grantRevoke(mk("wg_po", racing("SELECT 1")), { ...at_, gid: "wgg_u" })).resolves.toMatchObject({ result: { grant: "wgg_u", revoked: true } });
    expect(await roleOf("wgg_u")).toBe(null);
  });
  // 0.35.14 (cookbook work/active/2026-10-18-3d-grant-write-guard-followups DoD (a), (b), (d)).
  it("a refused grant write sweeps no invitation, refuses an inherited-only owner raising to owner, and reports a still-visible grant as a conflict", async () => {
    const db = await mf.getD1Database("DB");
    const now = new Date("2026-10-18T14:20:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const racing = (change: string, after?: string) => ({ prepare: (q: string) => db.prepare(q), batch: async (st: any[]) => {
      await db.prepare(change).run(); const r = await db.batch(st); if (after) await db.prepare(after).run(); return r; } });
    const mk = (id: string, d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_fu_${++trace}`, now: () => now, log: () => {} } as any);
    for (const id of ["fu_po", "fu_wo", "fu_m", "fu_h", "fu_k", "fu_t"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_fu", "ws_fu", at, "fu_wo").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_fu", "ws_fu", "prj_fu", at, "fu_po").run();
    const grant = (id: string, p: string, r: string, t = "project", s = "prj_fu") => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("fug_po", "fu_po", "owner"); await grant("fug_wo_ws", "fu_wo", "owner", "workspace", "ws_fu"); await grant("fug_wo", "fu_wo", "owner");
    await grant("fug_m", "fu_m", "member"); await grant("fug_h", "fu_h", "member"); await grant("fug_k", "fu_k", "viewer"); await grant("fug_t", "fu_t", "viewer");
    const roleOf = async (gid: string) => (await db.prepare('SELECT role FROM "grant" WHERE id = ?').bind(gid).first<{ role: string }>())?.role ?? null;
    const invite_ = async (id: string, by: string) => db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(id, "project", "prj_fu", await sha256(id + "@example.invalid"), await sha256("tok_" + id), "member", "sent", by, at, "2026-10-24T00:00:00.000Z").run();
    const statusOf = async (id: string) => (await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(id).first<{ status: string }>())?.status;
    const at_ = { scope: "project", id: "prj_fu" };
    // (a) update_role: fu_h (member) holds a live member invitation; demoted to viewer by someone else in the window, the
    // owner's member→viewer UPDATE changes no row, its batch sweeps nothing — the invitation is untouched.
    await invite_("fui_h", "fu_h");
    await expect(update_role(mk("fu_po", racing(`UPDATE "grant" SET role = 'viewer' WHERE id = 'fug_h'`)), { ...at_, gid: "fug_h", role: "viewer" }))
      .resolves.toMatchObject({ result: { grant: "fug_h", role: "viewer" } }); // (d) target already holds the requested role: no conflict
    expect(await statusOf("fui_h")).toBe("sent");
    // (a) revoke: fu_k (viewer) holds an orphaned member invitation; the calling member is demoted in the window, the removal
    // is refused, and the refused batch sweeps nothing.
    await invite_("fui_k", "fu_k");
    await expect(grantRevoke(mk("fu_m", racing(`UPDATE "grant" SET role = 'viewer' WHERE id = 'fug_m'`)), { ...at_, gid: "fug_k" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await roleOf("fug_k")).toBe("viewer");
    expect(await statusOf("fui_k")).toBe("sent");
    await db.prepare(`UPDATE "grant" SET role = 'member' WHERE id = 'fug_m'`).run();
    // (b) grant.ts direct-owner clause: fu_wo keeps the inherited workspace owner role but loses the direct project owner grant
    // in the window; raising fu_t to owner is refused (directRoleAt), fu_t stays viewer.
    await expect(update_role(mk("fu_wo", racing(`UPDATE "grant" SET role = 'member' WHERE id = 'fug_wo'`)), { ...at_, gid: "fug_t", role: "owner" }))
      .rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await roleOf("fug_t")).toBe("viewer");
    expect(await roleOf("fug_wo_ws")).toBe("owner");
    await db.prepare(`UPDATE "grant" SET role = 'owner' WHERE id = 'fug_wo'`).run();
    // (d) the caller is demoted for the write and restored before the re-read: nothing on re-read explains the refusal, the
    // grant is still visible → STAGE_CONFLICT (0.35.13 said not found), for update_role and for revoke.
    const blip = (gid: string, r: string, back: string) => racing(`UPDATE "grant" SET role = '${r}' WHERE id = '${gid}'`, `UPDATE "grant" SET role = '${back}' WHERE id = '${gid}'`);
    await expect(update_role(mk("fu_po", blip("fug_po", "member", "owner")), { ...at_, gid: "fug_t", role: "member" }))
      .rejects.toMatchObject({ code: "STAGE_CONFLICT" });
    expect(await roleOf("fug_t")).toBe("viewer");
    await expect(grantRevoke(mk("fu_m", blip("fug_m", "viewer", "member")), { ...at_, gid: "fug_t" }))
      .rejects.toMatchObject({ code: "STAGE_CONFLICT" });
    expect(await roleOf("fug_t")).toBe("viewer");
    // (d) control: target raised by someone else to a role other than the one requested is still STAGE_CONFLICT
    await expect(update_role(mk("fu_po", racing(`UPDATE "grant" SET role = 'member' WHERE id = 'fug_t'`)), { ...at_, gid: "fug_t", role: "viewer" }))
      .rejects.toMatchObject({ code: "STAGE_CONFLICT" });
  });
  // Dead invitations DoD (8): policy answers a participant session on the invitation link before the handler runs. That is
  // "sign in as the invited person" (retryable, the UI keeps the token), not the invitation's durable refusal.
  it("a participant session opening an invitation link gets NOT_AUTHENTICATED (retryable), not NOT_AUTHORIZED_AT_SCOPE", async () => {
    const db = await mf.getD1Database("DB");
    const participant = { env: { DB: db } as any, db, principal: { kind: "participant", id: "rsp_dd", respondentId: "rsp_dd" } as any, traceId: "tr_dd_p", now: () => new Date(), log: () => {} } as Ctx;
    await expect(authorize(participant, byId.get("cap.grant.accept")!, { token: "tok_inv_dd_live" })).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    // other non-public rows still refuse a participant as before
    await expect(authorize(participant, byId.get("cap.me.invitations")!, {})).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
  });
});

// 0.35.15 (cookbook work/active/2026-10-18-3d-grant-noop-receipt-followups DoD (a)) and 0.35.16 (cookbook
// work/active/2026-10-18-3d-grant-noop-dispatch-receipt DoD (a)-(e)): an update_role that changes nothing is a no-op end to
// end, through dispatch: the reply, the impact, the log line and the receipt. Synthetic principals and ids only.
describe("update_role no-op through dispatch", () => {
  const now = new Date("2026-10-18T16:20:00.000Z"); const at = now.toISOString();
  const at_ = { scope: "project", id: "prj_nd" };
  let trace = 0;
  // `change` runs once, just before the first batch in the call: another writer landing between update_role's read and its write.
  const racing = (db: any, change: string) => { let fired = false; return { prepare: (q: string) => db.prepare(q),
    batch: async (st: any[]) => { if (!fired) { fired = true; await db.prepare(change).run(); } return db.batch(st); } }; };
  const mk = (db: any, id: string, logs: [string, any][], d: any = db): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db: d,
    principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_nd_${++trace}`, now: () => now, log: (s: string, x?: any) => logs.push([s, x]) } as any);
  const setup = async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    // the file's earlier describes may already have applied the schema to this shared database
    if (!(await db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'principal'").first()))
      await db.batch(sql("../migrations/0001_init.sql").split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    // cap.ops.usage (0.35.17 DoD (e)) reads participant_session.invitation_id (migration 0007)
    if (!(await db.prepare("SELECT 1 FROM pragma_table_info('participant_session') WHERE name = 'invitation_id'").first()))
      await db.batch(sql("../migrations/0007_shared_link_context.sql").split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    for (const id of ["nd_po", "nd_t", "nd_u", "nd_d", "nd_s", "nd_a", "nd_e", "nd_f", "nd_c"]) await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_nd", null, "prj_nd", at, "nd_po").run();
    const grant = (id: string, p: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, "project", "prj_nd", r, at).run();
    await grant("ndg_po", "nd_po", "owner"); await grant("ndg_t", "nd_t", "viewer"); await grant("ndg_u", "nd_u", "member");
    await grant("ndg_d", "nd_d", "member"); await grant("ndg_s", "nd_s", "member");
    await grant("ndg_a", "nd_a", "member"); await grant("ndg_e", "nd_e", "member"); await grant("ndg_f", "nd_f", "member"); await grant("ndg_c", "nd_c", "member");
    return db;
  };
  let db: any;
  // 0.35.17 (cookbook work/active/2026-10-18-3d-grant-noop-followups-2 DoD (f)): set up once for the describe, so each test
  // also passes when run alone (-t); every test uses its own grant.
  beforeAll(async () => { db = await setup(); });
  const run = async (actor: Ctx, params: Record<string, unknown>, d: any = db) => {
    const dry: any = await execute(actor, "cap.grant.update_role", params, { tool: "danger", mode: "dry_run" });
    expect(dry.ok).toBe(true);
    const ctx = { ...actor, db: d, traceId: `tr_nd_${++trace}` } as Ctx;
    const env: any = await execute(ctx, "cap.grant.update_role", params, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token });
    const stored = await db.prepare("SELECT actor, undo_token, prior_state_json FROM receipt WHERE id = ?").bind(env.receipt?.id ?? "").first();
    return { dry, env, stored: stored && { ...stored, prior: JSON.parse(stored.prior_state_json) } };
  };

  it("a target raised to the requested role by another writer in the window: the receipt is marked no-op and credits no change (DoD (a), (c))", async () => {
    const logs: [string, any][] = [];
    const { env, stored } = await run(mk(db, "nd_po", logs), { ...at_, gid: "ndg_t", role: "member" }, racing(db, `UPDATE "grant" SET role = 'member' WHERE id = 'ndg_t'`));
    expect(env.ok).toBe(true);
    expect(env.result).toEqual({ grant: "ndg_t", role: "member", noop: true });
    expect(env.receipt).toMatchObject({ actor: "nd_po", inverse: "none", noop: true });
    expect(env.receipt).not.toHaveProperty("compensating_control");
    expect(env.receipt).not.toHaveProperty("undo_token");
    expect(stored.prior).toMatchObject({ prior: { role: "member" }, noop: true });
    expect(logs.find(([s]) => s === "grant.update_role")?.[1]).toMatchObject({ noop: true, downgrade: false, revoked_invitations: 0 });
  });

  it("the no-op handler impact names no disclosure and no compensating control; the log keeps the requested downgrade (DoD (c))", async () => {
    const logs: [string, any][] = [];
    // member → viewer requested (a downgrade); another writer lowers the target to viewer first
    const r = await update_role(mk(db, "nd_po", logs, racing(db, `UPDATE "grant" SET role = 'viewer' WHERE id = 'ndg_d'`)), { ...at_, gid: "ndg_d", role: "viewer" });
    expect(r.result).toEqual({ grant: "ndg_d", role: "viewer", noop: true });
    expect(r.priorState).toEqual({ role: "viewer" });
    expect(r.impact).toEqual({ affected: [{ grant: "ndg_d", from: "viewer", to: "viewer" }], irreversible: false, revoked_invitations: 0, noop: true });
    expect(logs.find(([s]) => s === "grant.update_role")?.[1]).toEqual({ noop: true, downgrade: true, revoked_invitations: 0 });
  });

  it("a target already at the requested role when first read carries the same noop flag, in dry_run and execute (DoD (b))", async () => {
    const logs: [string, any][] = [];
    const { dry, env, stored } = await run(mk(db, "nd_po", logs), { ...at_, gid: "ndg_s", role: "member" });
    expect(dry.result).toMatchObject({ noop: true, impact: { affected: [{ grant: "ndg_s", from: "member", to: "member" }], irreversible: false, noop: true } });
    expect(dry.result.impact).not.toHaveProperty("effect");
    expect(dry.result.impact).not.toHaveProperty("compensating_control");
    expect(env.result).toEqual({ grant: "ndg_s", role: "member", noop: true });
    expect(env.receipt).toMatchObject({ noop: true });
    expect(stored.prior).toMatchObject({ prior: { role: "member" }, noop: true });
    expect(logs.find(([s]) => s === "grant.update_role")?.[1]).toMatchObject({ noop: true, downgrade: false });
  });

  it("control: a change this caller made keeps its receipt (prior role, compensating control) and no noop flag", async () => {
    const logs: [string, any][] = [];
    const { dry, env, stored } = await run(mk(db, "nd_po", logs), { ...at_, gid: "ndg_u", role: "viewer" });
    expect(dry.result).not.toHaveProperty("noop");
    expect(dry.result.impact).toMatchObject({ effect: "disclosure", compensating_control: expect.any(String) });
    expect(env.result).toEqual({ grant: "ndg_u", role: "viewer" });
    expect(env.receipt).not.toHaveProperty("noop");
    expect(env.receipt.compensating_control).toEqual(expect.any(String));
    expect(stored.prior).toEqual({ prior: { role: "member" }, params: expect.anything(), result_ids: expect.anything() });
    expect(logs.find(([s]) => s === "grant.update_role")?.[1]).not.toHaveProperty("noop");
  });
  // 0.35.17 (cookbook work/active/2026-10-18-3d-grant-noop-followups-2): the 540 review follow-ups.
  it("a no-op preview cannot execute as an elevation after the target is lowered: execute asks for a new dry_run (0.35.17 DoD (a))", async () => {
    const owner = mk(db, "nd_po", []);
    const params = { ...at_, gid: "ndg_a", role: "member" };
    const dry: any = await execute(owner, "cap.grant.update_role", params, { tool: "danger", mode: "dry_run" });
    expect(dry.result).toMatchObject({ noop: true });
    await db.prepare(`UPDATE "grant" SET role = 'viewer' WHERE id = 'ndg_a'`).run(); // another owner lowers the target after the preview
    const env: any = await execute({ ...owner, traceId: `tr_nd_${++trace}` } as Ctx, "cap.grant.update_role", params, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token });
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe("CONFIRM_REQUIRED");
    expect((await db.prepare(`SELECT role FROM "grant" WHERE id = 'ndg_a'`).first()).role).toBe("viewer");
    // a new dry_run previews the elevation it would be, and that preview executes
    const again = await run(mk(db, "nd_po", []), params);
    expect(again.dry.result).not.toHaveProperty("noop");
    expect(again.dry.result.impact).toMatchObject({ affected: [{ grant: "ndg_a", from: "viewer", to: "member" }], effect: "disclosure" });
    expect(again.env.ok).toBe(true);
    expect(again.env.receipt).not.toHaveProperty("noop");
  });

  it("the receipt's noop comes from HandlerResult.noop, not from the user-facing result (0.35.17 DoD (c))", async () => {
    const real = handlers["cap.grant.update_role"];
    try {
      handlers["cap.grant.update_role"] = async (_c, _p, o) => o?.dryRun ? { result: {}, impact: { affected: [], irreversible: false, effect: "disclosure" } }
        : { result: { grant: "ndg_c", noop: true } };
      const shown = await run(mk(db, "nd_po", []), { ...at_, gid: "ndg_c", role: "viewer" });
      expect(shown.env.receipt).not.toHaveProperty("noop");
      handlers["cap.grant.update_role"] = async (_c, _p, o) => o?.dryRun ? { result: {}, impact: { affected: [], irreversible: false, noop: true } }
        : { result: { grant: "ndg_c" }, noop: true };
      const marked = await run(mk(db, "nd_po", []), { ...at_, gid: "ndg_c", role: "viewer" });
      expect(marked.env.receipt).toMatchObject({ noop: true });
      expect(marked.env.result).toEqual({ grant: "ndg_c" });
    } finally { handlers["cap.grant.update_role"] = real; }
  });

  it("usage writes_by_capability does not count a no-op update_role; a real change still counts (0.35.17 DoD (e))", async () => {
    const support = { ...mk(db, "nd_po", []), principal: { kind: "user", id: "nd_po", provisioned: true, support: true } } as any;
    const writes = async () => ((await opsUsage(support, { from: "2026-10-18", to: "2026-10-18" })).result.writes_by_capability as any[])
      .find((w) => w.capability === "cap.grant.update_role")?.count ?? 0;
    const before = await writes();
    const noop = await run(mk(db, "nd_po", []), { ...at_, gid: "ndg_e", role: "member" });
    expect(noop.env.receipt).toMatchObject({ noop: true });
    expect(await writes()).toBe(before);
    const real = await run(mk(db, "nd_po", []), { ...at_, gid: "ndg_f", role: "viewer" });
    expect(real.env.receipt).not.toHaveProperty("noop");
    expect(await writes()).toBe(before + 1);
  });
});
