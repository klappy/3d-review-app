import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { accept, update_role, mine, list as grantList, revoke as grantRevoke, invite } from "../src/handlers/grant";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

// 0.35.22 — cookbook work/active/2026-10-15-3d-workspace-permissions/ASK-f4-finding4.md default 1 ("your own direct role, every
// time"): an invitation of any kind is accepted only while its inviter still holds a direct role (member or above) at its scope,
// and a role change at a project needs a direct project owner. Synthetic principals and ids only; no real addresses.
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "w", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "f4-direct-role-db" } }] }));
afterAll(() => mf.dispose());

describe("ASK-f4-finding4 default 1: your own direct role, every time (0.35.22)", () => {
  it("finding 4 + F4: removed inviters' workspace/assessment invitations refuse; inherited owners cannot change project roles", async () => {
    const db = await mf.getD1Database("DB");
    const sql = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    const now = new Date("2026-10-19T03:00:00.000Z"); const at = now.toISOString();
    let trace = 0;
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id, provisioned: true } as any, traceId: `tr_f4_${++trace}`, now: () => now, log: () => {} });
    for (const id of ["f_wo", "f_wm", "f_am", "f_po", "f_pm", "f_x", "f_y", "f_z"])
      await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, 0, at).run();
    await db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)").bind("ws_f", "F WS", at, "f_wo").run();
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)").bind("prj_f", "ws_f", "prj_f", at, "f_po").run();
    await db.prepare("INSERT INTO language (id, project_id, code, name, created_at) VALUES (?,?,?,?,?)").bind("lang_f", "prj_f", "syn", "Synthetic", at).run();
    await db.prepare("INSERT INTO assessment (id, project_id, language_id, name, stage, created_at) VALUES (?,?,?,?,?,?)").bind("asm_f", "prj_f", "lang_f", "AF", "prepare", at).run();
    const grant = (id: string, p: string, t: string, s: string, r: string) => db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind(id, p, t, s, r, at).run();
    await grant("fg_wo", "f_wo", "workspace", "ws_f", "owner");
    await grant("fg_wm", "f_wm", "workspace", "ws_f", "member");
    await grant("fg_am", "f_am", "assessment", "asm_f", "member");
    await grant("fg_po", "f_po", "project", "prj_f", "owner");
    await grant("fg_pm", "f_pm", "project", "prj_f", "member");
    const row = async (id: string, to: string, t: string, s: string, by: string) => { await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, t, s, await sha256(to + "@example.invalid"), await sha256("tok_" + id), "member", "sent", by, at, "2026-10-25T00:00:00.000Z").run(); };
    const direct = async (p: string, t: string, s: string) => (await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind(p, t, s).first<{ role: string }>())?.role ?? null;
    const ids = (r: any) => (r.result.invitations ?? r.result.pending_invitations).map((i: any) => i.id).sort();

    await row("inv_f_ws", "f_x", "workspace", "ws_f", "f_wm");
    await row("inv_f_asm", "f_y", "assessment", "asm_f", "f_am");
    await row("inv_f_ws_ok", "f_z", "workspace", "ws_f", "f_wo");
    expect(ids(await mine(mk("f_x"), {}))).toEqual(["inv_f_ws"]);

    // finding 4: the inviters lose their direct grants (removed out of band, so the accept check itself is what refuses)
    await db.prepare('DELETE FROM "grant" WHERE id IN (?, ?)').bind("fg_wm", "fg_am").run();
    await expect(accept(mk("f_x"), { invitation_id: "inv_f_ws" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(accept(mk("f_y"), { invitation_id: "inv_f_asm" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("f_x", "workspace", "ws_f")).toBeNull();
    expect(await direct("f_y", "assessment", "asm_f")).toBeNull();
    // dead rows are not listed to the invitee nor in the roster's pending invitations
    expect(ids(await mine(mk("f_x"), {}))).toEqual([]);
    expect(ids(await grantList(mk("f_wo"), { scope: "workspace", id: "ws_f" }))).toEqual(["inv_f_ws_ok"]);
    // control: an invitation whose inviter still holds a direct role is accepted
    await expect(accept(mk("f_z"), { invitation_id: "inv_f_ws_ok" })).resolves.toMatchObject({ result: { granted: true, role: "member" } });
    expect(await direct("f_z", "workspace", "ws_f")).toBe("member");

    // removing a workspace grant through cap.grant.revoke also revokes that holder's open workspace invitations (the sweep)
    await grant("fg_wm2", "f_wm", "workspace", "ws_f", "member");
    const sent: any = await invite(mk("f_wm"), { scope: "workspace", id: "ws_f", email: "f_x@example.invalid", role: "member" });
    await expect(grantRevoke(mk("f_wo"), { scope: "workspace", id: "ws_f", gid: "fg_wm2" })).resolves.toMatchObject({ result: { revoked: true, revoked_invitations: 1 } });
    expect((await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(sent.result.invitation_id).first<{ status: string }>())?.status).toBe("revoked");

    // F4: an owner through the workspace cannot change a direct project member's role, even below owner
    await expect(update_role(mk("f_wo"), { scope: "project", id: "prj_f", gid: "fg_pm", role: "viewer" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(update_role(mk("f_wo"), { scope: "project", id: "prj_f", gid: "fg_pm", role: "viewer" }, { dryRun: true } as any)).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    expect(await direct("f_pm", "project", "prj_f")).toBe("member");
    // a direct project owner still can
    await expect(update_role(mk("f_po"), { scope: "project", id: "prj_f", gid: "fg_pm", role: "viewer" })).resolves.toMatchObject({ result: { role: "viewer" } });
    expect(await direct("f_pm", "project", "prj_f")).toBe("viewer");
    // and a workspace owner still changes roles at the workspace itself
    await expect(update_role(mk("f_wo"), { scope: "workspace", id: "ws_f", gid: (await db.prepare('SELECT id FROM "grant" WHERE principal_id = ? AND scope_type = ?').bind("f_z", "workspace").first<{ id: string }>())!.id, role: "viewer" })).resolves.toMatchObject({ result: { role: "viewer" } });
  });
});
