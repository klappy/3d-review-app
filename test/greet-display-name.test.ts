// Greet by name (captain ruling a1, 2026-10-02): an optional display_name on the account (migration 0015), set or cleared by
// PATCH /v2/me (cap.auth.me_update, undoable), returned by GET /v2/me (cap.auth.me) as principal.display_name; null = email greeting.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { authMe, authMeUpdate, cleanDisplayName } from "../src/handlers/platform";
import { handlers } from "../src/handlers";
import { execute } from "../src/dispatch";
import { byId } from "../src/registry";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "greet", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "greet-db", OLD: "greet-old-db" } }] }));
afterAll(() => mf.dispose());
const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
const now = new Date("2026-10-02T23:00:00.000Z");
let trace = 0;
const mk = (db: any, principal: Ctx["principal"]): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal, traceId: `tr_greet_${++trace}`, now: () => now, log: () => {} });
async function setup(name: "DB" | "OLD", migrate: boolean) {
  const db = await mf.getD1Database(name);
  const stmts = (path: string) => sql(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
  await db.batch(stmts("../migrations/0001_init.sql"));
  if (migrate) await db.batch(stmts("../migrations/0015_display_name.sql"));
  await db.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind("usr_ana", await sha256("ana@example.invalid"), 1, 0, now.toISOString()).run();
  return db;
}

describe("greet by display name (captain a1)", () => {
  it("cleans names: trim, collapse whitespace, 80-char cap, no markup or control characters, empty clears", () => {
    expect(cleanDisplayName("  Ana   Ruiz ")).toBe("Ana Ruiz");
    expect(cleanDisplayName("")).toBeNull(); expect(cleanDisplayName("   ")).toBeNull(); expect(cleanDisplayName(null)).toBeNull();
    expect(cleanDisplayName("é".repeat(80))).toBe("é".repeat(80));
    for (const bad of ["x".repeat(81), "<b>Ana</b>", "Ana>", "Ana\u0000", 42, {}, ["Ana"]]) expect(() => cleanDisplayName(bad)).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
  });

  it("is a reversible write on PATCH /v2/me with a true self:restore-prior inverse, and GET /v2/me is unchanged otherwise", () => {
    expect(byId.get("cap.auth.me_update")).toMatchObject({ class: "write.reversible", tool: "write", http: { method: "PATCH", path: "/v2/me" }, inverse: { kind: "true", via: "self:restore-prior" }, public: false });
    expect(byId.get("cap.auth.me")).toMatchObject({ class: "read", http: { method: "GET", path: "/v2/me" } });
    expect(handlers["cap.auth.me_update"]).toBe(authMeUpdate);
  });

  it("set, read back on /v2/me, undo restores the prior name, clear returns null; participants and anonymous refused", async () => {
    const db = await setup("DB", true);
    const ana = () => mk(db, { kind: "user", id: "usr_ana", provisioned: true });
    expect((await authMe(ana(), {})).result.principal.display_name).toBeNull(); // nothing set: the email greeting stands
    const set: any = await execute(ana(), "cap.auth.me_update", { display_name: "  Ana  Ruiz " }, { tool: "write" });
    expect(set.ok).toBe(true); expect(set.result.principal).toEqual({ id: "usr_ana", display_name: "Ana Ruiz" });
    expect((await authMe(ana(), {})).result.principal.display_name).toBe("Ana Ruiz");
    const renamed: any = await execute(ana(), "cap.auth.me_update", { display_name: "Ana R." }, { tool: "write" });
    const token = renamed.receipt?.undo_token ?? renamed.result?.receipt?.undo_token;
    expect(typeof token).toBe("string");
    const undone: any = await execute(ana(), "cap.ops.undo", { token }, { tool: "write" });
    expect(undone.ok).toBe(true);
    expect((await authMe(ana(), {})).result.principal.display_name).toBe("Ana Ruiz");
    await authMeUpdate(ana(), { display_name: "" });
    expect((await authMe(ana(), {})).result.principal.display_name).toBeNull();
    await expect(authMeUpdate(ana(), { display_name: "<script>" })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    await expect(authMeUpdate(ana(), {})).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    await expect(authMeUpdate(mk(db, { kind: "participant", id: "rsp_1" } as any), { display_name: "P" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await expect(authMeUpdate(mk(db, { kind: "anonymous", id: "anon" }), { display_name: "A" })).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect((await authMe(mk(db, { kind: "participant", id: "rsp_1" } as any), {})).result.principal.display_name).toBeNull();
  });

  it("rev461 B1: support redeeming another account's undo token is refused and renames nobody; the owner's undo still works", async () => {
    const db = await mf.getD1Database("DB");
    await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind("usr_sup", await sha256("sup@example.invalid"), 1, 1, now.toISOString()).run();
    const ana = () => mk(db, { kind: "user", id: "usr_ana", provisioned: true }), sup = () => mk(db, { kind: "support", id: "usr_sup", provisioned: true });
    await authMeUpdate(ana(), { display_name: "Ana" }); await authMeUpdate(sup(), { display_name: "Sam Support" });
    const renamed: any = await execute(ana(), "cap.auth.me_update", { display_name: "Ana Two" }, { tool: "write" });
    const token = renamed.receipt?.undo_token ?? renamed.result?.receipt?.undo_token;
    expect(typeof token).toBe("string");
    const hijack: any = await execute(sup(), "cap.ops.undo", { token }, { tool: "write" }).catch((e: any) => ({ ok: false, error: { code: e.code } }));
    expect(hijack.ok).toBe(false); expect(hijack.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    expect((await authMe(sup(), {})).result.principal.display_name).toBe("Sam Support"); // support was not renamed to Ana's prior name
    expect((await authMe(ana(), {})).result.principal.display_name).toBe("Ana Two");
    // A direct PATCH naming another account is refused the same way; naming one's own id is fine.
    await expect(authMeUpdate(sup(), { id: "usr_ana", display_name: "X" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_AT_SCOPE" });
    await authMeUpdate(ana(), { id: "usr_ana", display_name: "Ana Two" });
    const own: any = await execute(ana(), "cap.ops.undo", { token }, { tool: "write" });
    expect(own.ok).toBe(true);
    expect((await authMe(ana(), {})).result.principal.display_name).toBe("Ana");
  });

  it("before migration 0015 is applied, GET /v2/me still answers with display_name null (production promotes the migration as step 0)", async () => {
    const db = await setup("OLD", false);
    expect((await authMe(mk(db, { kind: "user", id: "usr_ana" }), {})).result.principal).toMatchObject({ id: "usr_ana", display_name: null });
  });
});
