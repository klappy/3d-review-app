// S9 (B04 step c) — captain ruling 2026-09-28 15:27 ET "Add GET /v2/me/invitations + accept by invitee identity"; captain 16:03 ET
// ships it tonight. Contract: cap.me.invitations (read) + cap.grant.accept by invitation_id (no token; http_alt). Policy: the caller's
// email hash must equal the invitation's invitee_hash; every miss is the same NOT_FOUND_OR_NOT_VISIBLE (unauthorized == nonexistent).
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { invite, accept, mine, revoke_invitation, handlers } from "../src/handlers/grant";
import { handlers as all } from "../src/handlers";
import { sha256 } from "../src/handlers/common";
import { execute } from "../src/dispatch";
import { byId, capabilities } from "../src/registry";
import type { Ctx } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "s9", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "s9-test-db" } }] }));
afterAll(() => mf.dispose());

describe("S9 contract: cap.me.invitations + cap.grant.accept by invitation_id", () => {
  it("is registered as a read capability with its own GET twin; accept gains the by-id HTTP twin (POST, never GET)", () => {
    const me = byId.get("cap.me.invitations")!;
    expect(me).toMatchObject({ class: "read", tool: "read", http: { method: "GET", path: "/v2/me/invitations" }, public: false });
    expect(handlers["cap.me.invitations"]).toBe(mine); expect(all["cap.me.invitations"]).toBe(mine);
    const acc = byId.get("cap.grant.accept")!;
    expect(acc.http).toMatchObject({ method: "POST", path: "/v2/invitations/{token}/accept" }); // token path unchanged
    expect(acc.http_alt).toEqual([{ method: "POST", path: "/v2/me/invitations/{invitation_id}/accept", path_inferred: false }]);
    const contract = JSON.parse(readFileSync(new URL("../contract/capabilities.json", import.meta.url), "utf8"));
    expect(contract.counts.total).toBe(capabilities.length);
    const openapi = readFileSync(new URL("../contract/openapi.yaml", import.meta.url), "utf8");
    expect(openapi).toContain("  /v2/me/invitations:\n    get:\n      operationId: cap.me.invitations");
    expect(openapi).toContain("  /v2/me/invitations/{invitation_id}/accept:\n    post:\n      operationId: cap.grant.accept.by_invitation_id\n");
    expect(openapi).toContain("  /v2/invitations/{token}/accept:\n    post:\n      operationId: cap.grant.accept\n");
    // every HTTP twin (primary and alternate) is registered by the same loop in src/index.ts
    const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(index).toMatch(/for \(const cap of capabilities\) for \(const twin of \[cap\.http, \.\.\.\(cap\.http_alt \?\? \[\]\)\]\) \{/);
  });

  it("lists only the signed-in person's own live invitations, never the token; accepts by id with the same email check", async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    const stmts = (path: string) => sql(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
    await db.batch(stmts("../migrations/0001_init.sql"));
    await db.batch(stmts("../migrations/0002_code_escrow.sql"));
    await db.batch(stmts("../migrations/0003_language_archive.sql"));
    await db.batch(stmts("../seed/synthetic.sql"));
    const now = new Date("2026-09-28T21:00:00.000Z");
    let trace = 0;
    const mk = (principal: Ctx["principal"]): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal, traceId: `tr_s9_${++trace}`, now: () => now, log: () => {} });
    const person = async (id: string, email: string) => db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id, await sha256(email), 1, 0, now.toISOString()).run();
    await person("usr_o", "owner@example.invalid"); await person("usr_v", "viewer@example.invalid"); await person("usr_x", "stranger@example.invalid");
    const asm = "assess_tavo_collect";
    await db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?)').bind("g_o", "usr_o", "assessment", asm, "owner", now.toISOString()).run();
    const owner = mk({ kind: "user", id: "usr_o", provisioned: true }), viewer = mk({ kind: "user", id: "usr_v" }), stranger = mk({ kind: "user", id: "usr_x" });
    const scope = { scope: "assessment", id: asm };

    // Nothing yet; anonymous is asked to sign in (no list leaks to anyone signed out).
    expect((await mine(viewer, {})).result).toEqual({ invitations: [] });
    await expect(mine(mk({ kind: "anonymous", id: "anon" }), {})).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });

    // Owner invites the viewer (normalised address). The viewer never opens the link.
    const sent = await invite(owner, { ...scope, email: " Viewer@Example.invalid ", role: "viewer" });
    const invId = sent.result.invitation_id as string, token = sent.result.dev_only_link_token as string;
    const listed = (await mine(viewer, {})).result.invitations as any[];
    expect(listed).toEqual([{ id: invId, scope: { type: "assessment", id: asm }, role: "viewer", inviter_display_name: null, invited_at: now.toISOString(), expires_at: expect.any(String) }]);
    const wire = JSON.stringify(listed);
    expect(wire).not.toContain(token); expect(wire).not.toContain(await sha256(token)); expect(wire).not.toContain(await sha256("viewer@example.invalid"));
    // Someone else's invitation is simply absent for everyone else.
    expect((await mine(stranger, {})).result.invitations).toEqual([]);
    expect((await mine(owner, {})).result.invitations).toEqual([]);

    // unauthorized == nonexistent: the stranger naming the real id and anyone naming an unknown id get the SAME answer.
    const miss = async (c: Ctx, p: Record<string, unknown>) => { try { await accept(c, p); return null; } catch (e: any) { return { code: e.code, message: e.message }; } };
    const hidden = await miss(stranger, { invitation_id: invId });
    expect(hidden).toEqual({ code: "NOT_FOUND_OR_NOT_VISIBLE", message: "invitation not found or not visible" });
    expect(await miss(viewer, { invitation_id: "inv_does_not_exist" })).toEqual(hidden);
    expect(await miss(stranger, { invitation_id: "inv_does_not_exist" })).toEqual(hidden);
    expect(await db.prepare('SELECT id FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind("usr_x", asm).first()).toBeNull();
    // Survey (participant) invitations are never listed or accepted here, even if a row carried this person's hash.
    await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind("inv_survey_row", "survey", "srv_x", await sha256("viewer@example.invalid"), "th_survey", "participant", "pending", now.toISOString(), "2026-10-05T00:00:00.000Z").run();
    expect(((await mine(viewer, {})).result.invitations as any[]).map((i) => i.id)).toEqual([invId]);
    expect(await miss(viewer, { invitation_id: "inv_survey_row" })).toEqual(hidden);
    // Both names at once is a malformed request, not a lookup.
    expect(await miss(viewer, { invitation_id: invId, token })).toMatchObject({ code: "INVALID_PARAMS" });
    await expect(accept(mk({ kind: "anonymous", id: "anon" }), { invitation_id: invId })).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });

    // The invitee accepts by id through the real two-step dispatch (dry run → confirm → execute), no token anywhere.
    const dry: any = await execute(mk({ kind: "user", id: "usr_v" }), "cap.grant.accept", { invitation_id: invId }, { tool: "danger", mode: "dry_run" });
    expect(dry.ok).toBe(true); expect(dry.result.impact.affected[0]).toMatchObject({ scope: { type: "assessment", id: asm }, role: "viewer", currently: "none" });
    const done: any = await execute(mk({ kind: "user", id: "usr_v" }), "cap.grant.accept", { invitation_id: invId }, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token });
    expect(done.ok).toBe(true); expect(done.result).toMatchObject({ granted: true, role: "viewer", scope: { type: "assessment", id: asm } });
    expect(await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind("usr_v", "assessment", asm).first()).toEqual({ role: "viewer" });
    expect((await mine(viewer, {})).result.invitations).toEqual([]);
    await expect(accept(viewer, { invitation_id: invId })).rejects.toMatchObject({ code: "INVALID_PARAMS", message: "invitation_used" });

    // Token path unchanged: a second invitation, listed by id, still accepts by its link token.
    await person("usr_w", "second@example.invalid"); const second = mk({ kind: "user", id: "usr_w" });
    const s2 = await invite(owner, { ...scope, email: "second@example.invalid", role: "member" });
    expect(((await mine(second, {})).result.invitations as any[]).map((i) => i.id)).toEqual([s2.result.invitation_id]);
    expect((await accept(second, { token: s2.result.dev_only_link_token as string })).result).toMatchObject({ granted: true, role: "member" });
    expect((await mine(second, {})).result.invitations).toEqual([]);

    // Withdrawn → gone from the list and hidden on accept; expired → gone from the list, accept says expired.
    await person("usr_r", "third@example.invalid"); const third = mk({ kind: "user", id: "usr_r" });
    const s3 = await invite(owner, { ...scope, email: "third@example.invalid", role: "viewer" });
    await revoke_invitation(owner, { id: s3.result.invitation_id });
    expect((await mine(third, {})).result.invitations).toEqual([]);
    expect(await miss(third, { invitation_id: s3.result.invitation_id })).toEqual(hidden);
    await person("usr_e", "fourth@example.invalid"); const fourth = mk({ kind: "user", id: "usr_e" });
    const s4 = await invite(owner, { ...scope, email: "fourth@example.invalid", role: "viewer" });
    await db.prepare("UPDATE invitation SET expires_at = ? WHERE id = ?").bind("2026-09-01T00:00:00.000Z", s4.result.invitation_id).run();
    expect((await mine(fourth, {})).result.invitations).toEqual([]);
    await expect(accept(fourth, { invitation_id: s4.result.invitation_id })).rejects.toMatchObject({ code: "INVALID_PARAMS", message: "invitation_expired" });
  });
});
