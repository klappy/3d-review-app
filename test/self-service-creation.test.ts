/**
 * Self-service creation — captain ruling 2026-09-17: "everyone should have permission to create their own things".
 *
 * Every normal authenticated principal (existing AND new) may create its OWN workspaces/projects with no manual
 * provisioning gate. The two INSERT OR IGNORE INTO principal sites (src/index.ts Cloudflare Access route,
 * src/handlers/platform.ts cap.auth.request_link) now bind provisioned = 1; migration
 * 0009_self_service_creation.sql backfills the existing normal users.
 *
 * What this test FALSIFIES, if the ruling is over-applied: that the new default leaks anyone else's data. A second
 * fresh principal must still see nothing of the first's workspace/project (existence-hiding, exact-scope grants),
 * and the support row's provisioned value must be untouched by the backfill.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
import { resolvePrincipal } from "../src/auth";
import { sha256 } from "../src/handlers/common";
import type { Ctx, Env, Principal } from "../src/handlers/types";

const MIGRATIONS = ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql"];

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{
    name: "self-service",
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: { DB: "self-service-db", DB2: "self-service-backfill-db" },
  }],
}));
afterAll(() => mf.dispose());

const sqlOf = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
const statements = (db: any, path: string) => sqlOf(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));

let db: any;
let env: Env;
let trace = 0;
const now = new Date("2026-09-17T12:00:00.000Z");
const ctxFor = (principal: Principal): Ctx =>
  ({ env, db, principal, traceId: `tr_ss_${++trace}`, now: () => now, log: () => {} }) as unknown as Ctx;
/** One capability call = one fresh ctx: a reused ctx would collide on trace.trace_id (PRIMARY KEY). */
const call = (principal: Principal, capability: string, params: Record<string, unknown>, tool: "read" | "write" | "danger") =>
  execute(ctxFor(principal), capability, params, { tool }) as Promise<any>;

/** Sign a brand-new person in through the real dev sign-in path (cap.auth.request_link → cap.auth.consume_link). */
async function signUp(email: string) {
  const principal0: Principal = { kind: "anonymous", id: "anon" };
  // 04 §A: the sign-in submit IS the intent-bound confirm for cap.auth.request_link — danger tool, no mode.
  const asked: any = await call(principal0, "cap.auth.request_link", { email }, "danger");
  expect(asked.ok).toBe(true);
  const code = asked.result.dev_only_code as string;
  expect(code).toMatch(/^\d{6}$/);
  const consumed: any = await call(principal0, "cap.auth.consume_link", { email, code }, "write");
  expect(consumed.ok).toBe(true);
  const token = consumed.result.session as string;
  const principal = await resolvePrincipal(new Request("https://x/v2/me", { headers: { authorization: `Bearer ${token}` } }), env);
  return { id: consumed.result.principal_id as string, token, principal };
}

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of MIGRATIONS) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../migrations/0009_self_service_creation.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as unknown as Env;
});

describe("self-service creation: provisioned defaults true for every normal user", () => {
  it("(a) a fresh principal is provisioned on sign-in and /v2/me says so", async () => {
    const tavo = await signUp("tavo@example.invalid");
    const row = await db.prepare("SELECT provisioned, support FROM principal WHERE email_hash = ?").bind(await sha256("tavo@example.invalid")).first<{ provisioned: number; support: number }>();
    expect(row).toEqual({ provisioned: 1, support: 0 }); // the INSERT default, not a later grant
    expect(tavo.principal).toMatchObject({ kind: "user", id: tavo.id, provisioned: true });
    const me: any = await call(tavo.principal, "cap.auth.me", {}, "read");
    expect(me.ok).toBe(true);
    expect(me.result.principal).toMatchObject({ id: tavo.id, kind: "user", provisioned: true });
  });

  it("(b) that fresh principal creates its OWN workspace and project and is the owner", async () => {
    const mila = await signUp("mila@example.invalid");
    const ws: any = await call(mila.principal, "cap.workspace.create", { name: "Mila team" }, "write");
    expect(ws.ok).toBe(true);
    expect(ws.result.workspace).toMatchObject({ name: "Mila team", role: "owner" });
    const pj: any = await call(mila.principal, "cap.project.create", { name: "Mila project" }, "write");
    expect(pj.ok).toBe(true);
    expect(pj.result.project).toMatchObject({ name: "Mila project", role: "owner", workspace_id: null });
    const grants = await db.prepare('SELECT scope_type, scope_id, role FROM "grant" WHERE principal_id = ? ORDER BY scope_type').bind(mila.id).all<{ scope_type: string; scope_id: string; role: string }>();
    expect(grants.results).toEqual([
      { scope_type: "project", scope_id: pj.result.project.id, role: "owner" },
      { scope_type: "workspace", scope_id: ws.result.workspace.id, role: "owner" },
    ]);
    // own lists show exactly its own two things
    const wl: any = await call(mila.principal, "cap.workspace.list", {}, "read");
    expect((wl.result.workspaces as any[]).map((w) => w.id)).toEqual([ws.result.workspace.id]);
    const pl: any = await call(mila.principal, "cap.project.list", {}, "read");
    expect((pl.result.projects as any[]).map((p) => p.id)).toEqual([pj.result.project.id]);
  });

  it("(c) a second fresh principal still sees nothing of the first's workspace or project", async () => {
    const owner = await signUp("owner@example.invalid");
    const ws: any = await call(owner.principal, "cap.workspace.create", { name: "Owner workspace" }, "write");
    const pj: any = await call(owner.principal, "cap.project.create", { name: "Owner project" }, "write");
    const stranger = await signUp("stranger@example.invalid");
    expect(stranger.principal).toMatchObject({ provisioned: true }); // also provisioned — and still sees nothing
    const wget: any = await call(stranger.principal, "cap.workspace.get", { id: ws.result.workspace.id }, "read");
    expect(wget.ok).toBe(false);
    expect(wget.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    const pget: any = await call(stranger.principal, "cap.project.get", { id: pj.result.project.id }, "read");
    expect(pget.ok).toBe(false);
    expect(pget.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    // indistinguishable from a name that never existed
    const nope: any = await call(stranger.principal, "cap.workspace.get", { id: "ws_does_not_exist" }, "read");
    expect(nope.error.code).toBe(wget.error.code);
    const wl: any = await call(stranger.principal, "cap.workspace.list", {}, "read");
    expect(wl.result.workspaces).toEqual([]);
    const pl: any = await call(stranger.principal, "cap.project.list", {}, "read");
    expect(pl.result.projects).toEqual([]);
  });

  it("(d) support principals are unchanged: provisioned stays 0 in D1 and creation is still refused", async () => {
    await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
      .bind("usr_support_ss", await sha256("support-ss@example.invalid"), 0, 1, now.toISOString()).run();
    const row = await db.prepare("SELECT provisioned, support FROM principal WHERE id = ?").bind("usr_support_ss").first<{ provisioned: number; support: number }>();
    expect(row).toEqual({ provisioned: 0, support: 1 });
    const support: Principal = { kind: "support", id: "usr_support_ss", provisioned: true } as Principal;
    // policy lets the support kind through; the handler's own D1 provisioning check still refuses (unchanged)
    const ws: any = await call(support, "cap.workspace.create", { name: "support attempt" }, "write");
    expect(ws.ok).toBe(false);
    expect(ws.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const pj: any = await call(support, "cap.project.create", { name: "support attempt" }, "write");
    expect(pj.ok).toBe(false);
    expect(pj.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
  });

  it("(e) migration 0009 backfills existing normal users and leaves support rows alone", async () => {
    const back = await mf.getD1Database("DB2");
    for (const m of MIGRATIONS) await back.batch(statements(back, `../migrations/${m}`));
    // an existing user from before the ruling, plus a support row
    await back.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
      .bind("usr_legacy", await sha256("legacy@example.invalid"), 0, 0, now.toISOString()).run();
    await back.prepare("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
      .bind("usr_support_legacy", await sha256("support-legacy@example.invalid"), 0, 1, now.toISOString()).run();
    expect(await back.prepare("SELECT provisioned FROM principal WHERE id = ?").bind("usr_legacy").first<{ provisioned: number }>()).toEqual({ provisioned: 0 });
    await back.batch(statements(back, "../migrations/0009_self_service_creation.sql"));
    expect(await back.prepare("SELECT provisioned FROM principal WHERE id = ?").bind("usr_legacy").first<{ provisioned: number }>()).toEqual({ provisioned: 1 });
    expect(await back.prepare("SELECT provisioned FROM principal WHERE id = ?").bind("usr_support_legacy").first<{ provisioned: number }>()).toEqual({ provisioned: 0 });
  });
});
