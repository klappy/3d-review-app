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
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
import { resolvePrincipal } from "../src/auth";
import { sha256 } from "../src/handlers/common";
import { resetAccessKeyCache } from "../src/access";
import worker from "../src/worker";
import type { Ctx, Env, Principal } from "../src/handlers/types";

const MIGRATIONS = ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql"];

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{
    name: "self-service",
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: { DB: "self-service-db", DB2: "self-service-backfill-db" },
    kvNamespaces: { OAUTH_KV: "self-service-kv" },
  }],
}));
afterAll(() => mf.dispose());
afterEach(() => { vi.restoreAllMocks(); resetAccessKeyCache(); });

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

/**
 * Case (f) only — the REAL sign-in route. Same Access JWT stub helpers as test/access.test.ts and
 * test/mcp-oauth-hardening.test.ts:~63: one RSA keypair minted in beforeAll, its JWKS served to the
 * worker by stubbing only the /cdn-cgi/access/certs fetch. No new auth framework, no new stubs.
 */
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
let kp: CryptoKeyPair;
let jwks: any;
async function accessJwt(email: string) {
  const head = b64u(JSON.stringify({ alg: "RS256", kid: "k1" }));
  const body = b64u(JSON.stringify({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) + 60, email, sub: "s-" + email }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
const stubJwks = () => {
  const real = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) =>
    String(input?.url ?? input).includes("/cdn-cgi/access/certs") ? new Response(JSON.stringify(jwks)) : real(input, init));
};
const ORIGIN = "https://3dr.test";
const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined }) as any;
const httpCall = (path: string, init: RequestInit = {}) => worker.fetch(new Request(ORIGIN + path, { redirect: "manual", ...init }), env as any, ectx());

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of MIGRATIONS) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../migrations/0009_self_service_creation.sql"));
  env = {
    DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev",
    OAUTH_KV: await mf.getKVNamespace("OAUTH_KV"),
    ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1",
  } as unknown as Env;
  kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  jwks = { keys: [{ kid: "k1", kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" }] };
}, 60_000);

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
    // L1-23: list reads carry read-only child counts for cards (fresh entities → 0).
    expect(wl.result.workspaces[0]).toMatchObject({ project_count: expect.any(Number), assessment_count: 0, response_count: 0 });
    expect(pl.result.projects[0]).toMatchObject({ assessment_count: 0, response_count: 0 });
    // L1-30 (Bugbot carry 15:12): counts include only assessments this member can list (grants do not inherit).
    const pid = pj.result.project.id;
    await db.prepare("UPDATE project SET workspace_id = ? WHERE id = ?").bind(ws.result.workspace.id, pid).run();
    await db.prepare("INSERT INTO language (id, project_id, name, created_at) VALUES ('lang_l130', ?, 'L130', '2026-09-24T00:00:00Z')").bind(pid).run();
    await db.prepare("INSERT INTO assessment (id, project_id, language_id, name, stage, created_at) VALUES ('asm_l130_hidden', ?, 'lang_l130', 'Hidden', 'prepare', '2026-09-24T00:00:00Z')").bind(pid).run();
    const pl2: any = await call(mila.principal, "cap.project.list", {}, "read");
    expect(pl2.result.projects[0]).toMatchObject({ assessment_count: 0, response_count: 0 });
    const wl2: any = await call(mila.principal, "cap.workspace.list", {}, "read");
    expect(wl2.result.workspaces[0]).toMatchObject({ project_count: 1, assessment_count: 0, response_count: 0 });
    await db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (\'grant_l130\', ?, \'assessment\', \'asm_l130_hidden\', \'viewer\', \'2026-09-24T00:00:00Z\')').bind(mila.id).run();
    const pl3: any = await call(mila.principal, "cap.project.list", {}, "read");
    expect(pl3.result.projects[0]).toMatchObject({ assessment_count: 1 });
    const wg: any = await call(mila.principal, "cap.workspace.get", { id: ws.result.workspace.id }, "read");
    expect(wg.result.projects[0]).toMatchObject({ assessment_count: 1 });
    // L1-45 (captain 17:05): a project in the workspace without a grant is not counted on the workspace card.
    await db.prepare("INSERT INTO project (id, workspace_id, name, created_at) VALUES ('prj_l145_hidden', ?, 'Hidden project', '2026-09-24T00:00:00Z')").bind(ws.result.workspace.id).run();
    const wl3: any = await call(mila.principal, "cap.workspace.list", {}, "read");
    expect(wl3.result.workspaces[0]).toMatchObject({ project_count: 1, assessment_count: 1 });
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

  /**
   * Auditor P2 on a770d38: (a)–(e) only exercise the dev link-code path (cap.auth.request_link →
   * cap.auth.consume_link). This case proves the OTHER INSERT OR IGNORE INTO principal site — the REAL
   * production sign-in route GET /v2/auth/access in src/index.ts — also binds provisioned = 1, through the
   * real worker entry with a valid Cloudflare Access assertion. Falsifies: a fresh principal created by
   * Access landing unprovisioned (or accidentally support) while the link-code path looks correct.
   */
  it("(f) a fresh principal created through the REAL sign-in route GET /v2/auth/access is provisioned", async () => {
    const email = "access-fresh@example.invalid";
    const eh = await sha256(email);
    // genuinely fresh: no principal row for this email before the route runs
    expect(await db.prepare("SELECT id FROM principal WHERE email_hash = ?").bind(eh).first()).toBeNull();

    stubJwks();
    const res = await httpCall("/v2/auth/access", { headers: { "cf-access-jwt-assertion": await accessJwt(email) } });
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toMatch(/^\/#session=/);
    const session = location.slice("/#session=".length);
    expect(session.length).toBeGreaterThan(0);

    // the D1 row the route inserted: provisioned = 1 by the INSERT default, support untouched at 0
    const row = await db.prepare("SELECT id, provisioned, support FROM principal WHERE email_hash = ?").bind(eh).first<{ id: string; provisioned: number; support: number }>();
    expect(row).toMatchObject({ provisioned: 1, support: 0 });

    // and the session that route minted reports it on the real /v2/me route
    const me = await httpCall("/v2/me", { headers: { authorization: `Bearer ${session}` } });
    expect(me.status).toBe(200);
    const body: any = await me.json();
    expect(body.ok).toBe(true);
    expect(body.result.principal).toMatchObject({ id: row!.id, kind: "user", provisioned: true });
  });
});
