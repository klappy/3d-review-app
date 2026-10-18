import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { get as projectGet, list as projectList, update as projectUpdate } from "../src/handlers/project";
import { list as workspaceList, add_project, remove_project } from "../src/handlers/workspace";
import { list as grantList, invite, transfer_owner, accept, update_role, revoke_invitation } from "../src/handlers/grant";
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
});
