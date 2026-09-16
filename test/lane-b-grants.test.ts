import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { invite, accept, revoke, update_role, transfer_owner, list } from "../src/handlers/grant";
import { create as requestCreate } from "../src/handlers/request";
import { unlock_participant } from "../src/handlers/support";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "b", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "b-test-db" } }] }));
afterAll(() => mf.dispose());
const code = (e: any) => e?.code ?? e?.message;

describe("Lane B: grant / request / support.unlock (D3, no inheritance, existence hidden)", () => {
  it("runs the D3 rules end to end on a fresh D1", async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    const stmts = (path: string) => sql(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
    await db.batch(stmts("../migrations/0001_init.sql"));
    await db.batch(stmts("../seed/synthetic.sql"));
    const now = new Date("2026-09-16T21:00:00.000Z");
    const mk = (principal: Ctx["principal"]): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" }, db, principal, traceId: "tr_b", now: () => now, log: () => {} });
    for (const id of ["usr_o", "usr_m", "usr_x", "usr_s"]) await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(id + "@example.invalid"), 1, id === "usr_s" ? 1 : 0, now.toISOString()).run();
    const asm = (await db.prepare("SELECT id FROM assessment LIMIT 1").first<{ id: string }>())!.id;
    await db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind("g_o", "usr_o", "assessment", asm, "owner", now.toISOString()).run();
    await db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind("g_m", "usr_m", "assessment", asm, "member", now.toISOString()).run();
    const owner = mk({ kind: "user", id: "usr_o", provisioned: true }); const member = mk({ kind: "user", id: "usr_m" }); const stranger = mk({ kind: "user", id: "usr_x" }); const support = mk({ kind: "support", id: "usr_s" });
    const scope = { scope: "assessment", id: asm };

    // member invites above own level → D3
    await expect(invite(member, { ...scope, email: "lee@example.invalid", role: "owner" }, { dryRun: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // stranger sees nothing
    await expect(list(stranger, scope)).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    await expect(list(stranger, { scope: "assessment", id: "asm_nope" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    // owner invites a member: dry_run impact then execute; accept releases the grant
    const dry = await invite(owner, { ...scope, email: "rina@example.invalid", role: "member" }, { dryRun: true });
    expect(dry.impact?.effect).toBe("external");
    const sent = await invite(owner, { ...scope, email: "rina@example.invalid", role: "member" });
    const token = sent.result.dev_only_link_token as string; expect(token).toBeTruthy();
    await expect(accept(mk({ kind: "anonymous", id: "anon" }), { token })).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    // wrong identity (usr_x is not rina@) → hidden, no grant
    await expect(accept(stranger, { token })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
    expect(await db.prepare('SELECT id FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind("usr_x", asm).first()).toBeNull();
    await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind("usr_rina", await sha256("rina@example.invalid"), 0, 0, now.toISOString()).run();
    const rina = mk({ kind: "user", id: "usr_rina" });
    const acc = await accept(rina, { token });
    expect(acc.result).toMatchObject({ granted: true, role: "member" });
    await expect(accept(rina, { token })).rejects.toMatchObject({ code: "INVALID_PARAMS" }); // invitation_used
    // owners never removed/demoted
    await expect(revoke(member, { ...scope, gid: "g_o" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(update_role(owner, { ...scope, gid: "g_o", role: "member" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    // member may revoke ≤ member; owner elevates
    const l = await list(owner, scope); const rinaGrant = (l.result.grants as any[]).find((g) => g.principal_id === "usr_rina");
    const up = await update_role(owner, { ...scope, gid: rinaGrant.id, role: "owner" }); expect(up.priorState).toEqual({ role: "member" });
    await expect(revoke(member, { ...scope, gid: rinaGrant.id })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" }); // now an owner
    // transfer: support without consent refused; owner transfers and steps down, an owner remains
    await expect(transfer_owner(support, { ...scope, to: "usr_m" }, { dryRun: true })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(transfer_owner(owner, { ...scope, to: "usr_o", step_down: true })).rejects.toMatchObject({ code: "INVALID_PARAMS" }); // self-transfer refused
    const t = await transfer_owner(owner, { ...scope, to: "usr_m", step_down: true });
    expect(t.result).toMatchObject({ transferred: true, new_owner: "usr_m", caller_role: "member" });
    const owners = await db.prepare('SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ? AND role = ?').bind("assessment", asm, "owner").first<{ n: number }>();
    expect(owners!.n).toBe(2);
    // request.create is idempotent while pending
    const r1 = await requestCreate(stranger, { kind: "workspace", target: "Tamsi team" }); const r2 = await requestCreate(stranger, { kind: "workspace", target: "Tamsi team" });
    expect(r2.result).toMatchObject({ request_id: r1.result.request_id, idempotent: true });
    await expect(requestCreate(stranger, { kind: "bogus", target: "x" })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    // support.unlock: reissues, never returns the value, writes an audit row
    const sid = (await db.prepare("SELECT id FROM assessment_survey LIMIT 1").first<{ id: string }>())!.id;
    await db.prepare("INSERT INTO access_code (id, assessment_survey_id, code_hash, created_at) VALUES (?,?,?,?)").bind("code_old", sid, await sha256("OLD-CODE"), now.toISOString()).run();
    const { handlers: supportHandlers } = await import("../src/handlers/support");
    expect(supportHandlers["cap.support.unlock_participant"]).toBeUndefined(); // HELD until escrow (Astra c5704769544)
    await expect(unlock_participant(owner, { code_id: "code_old", reason: "lost" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    const u = await unlock_participant(support, { code_id: "code_old", reason: "participant lost the sheet" });
    expect(u.result.old_revoked).toBe(true); expect(JSON.stringify(u.result)).not.toMatch(/\b[A-Z2-9]{4}-[A-Z2-9]{4}\b/);
    expect(await db.prepare("SELECT id FROM access_code WHERE id = ?").bind("code_old").first()).toBeNull();
    expect((await db.prepare("SELECT COUNT(*) AS n FROM receipt WHERE class = 'audit' AND capability = ?").bind("cap.support.unlock_participant").first<{ n: number }>())!.n).toBe(1);
    void code;
  });
});
