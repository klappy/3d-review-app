import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
import { resolvePrincipal } from "../src/auth";
import { sha256 } from "../src/handlers/common";
import type { Ctx, Env } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "owner-fixture", modules: true,
  script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "owner-fixture-db" } }] }));
afterAll(() => mf.dispose());

describe("local synthetic owner login", () => {
  it("uses normal email-code auth to reach seeded owner grants and create a project", async () => {
    const db = await mf.getD1Database("DB");
    const statements = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
      .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n")
      .split(";").map(s => s.trim()).filter(Boolean).map(s => db.prepare(s));
    await db.batch(statements("../migrations/0001_init.sql"));
    await db.batch(statements("../seed/synthetic.sql"));
    const email = "demo.owner@example.invalid";
    const owner = await db.prepare("SELECT id, provisioned FROM principal WHERE email_hash = ?")
      .bind(await sha256(email)).first<{ id: string; provisioned: number }>();
    expect(owner).toEqual({ id: "person_mara", provisioned: 1 });
    const env: Env = { DB: db, SESSION_SECRET: "synthetic-owner-test-only", ENVIRONMENT: "dev" };
    const anonymous: Ctx = { env, db, principal: { kind: "anonymous", id: "anon" }, traceId: "tr_owner_auth",
      now: () => new Date(), log: () => {} };
    const requested = await execute(anonymous, "cap.auth.request_link", { email }, { tool: "danger" });
    expect(requested.ok).toBe(true);
    if (!requested.ok) throw new Error("local login code not issued");
    const code = requested.result.dev_only_code as string;
    expect(code).toMatch(/^\d{6}$/);
    anonymous.traceId = "tr_owner_auth_consume";
    const consumed = await execute(anonymous, "cap.auth.consume_link", { email, code }, { tool: "write" });
    expect(consumed.ok).toBe(true);
    if (!consumed.ok) throw new Error("local login code not consumed");
    const session = consumed.result.session as string;
    const principal = await resolvePrincipal(new Request("http://localhost/v2/me", { headers: { authorization: `Bearer ${session}` } }), env);
    expect(principal).toMatchObject({ kind: "user", id: "person_mara", provisioned: true });
    const signed: Ctx = { ...anonymous, principal, traceId: "tr_owner_signed" };
    const me = await execute(signed, "cap.auth.me", {}, { tool: "read" });
    expect(me).toMatchObject({ ok: true, result: { principal: { id: "person_mara", provisioned: true } } });
    signed.traceId = "tr_owner_projects";
    const projects = await execute(signed, "cap.project.list", {}, { tool: "read" });
    expect(projects).toMatchObject({ ok: true });
    if (!projects.ok) throw new Error("seed projects not visible");
    expect((projects.result.projects as { id: string }[]).map(p => p.id)).toContain("proj_rill");
    signed.traceId = "tr_owner_assessment";
    const assessment = await execute(signed, "cap.assessment.get", { id: "assess_tavo_collect" }, { tool: "read" });
    expect(assessment).toMatchObject({ ok: true, result: { assessment: { id: "assess_tavo_collect" } } });
    signed.traceId = "tr_owner_create_project";
    const created = await execute(signed, "cap.project.create", { name: "New local synthetic project" }, { tool: "write" });
    expect(created).toMatchObject({ ok: true, result: { project: { role: "owner" } } });
  });

  it("overlapping consume of one email code mints only one session", async () => {
    const db = await mf.getD1Database("DB");
    const env: Env = { DB: db, SESSION_SECRET: "synthetic-owner-test-only", ENVIRONMENT: "dev" };
    const email = "race.owner@example.invalid";
    const anonymous: Ctx = { env, db, principal: { kind: "anonymous", id: "anon" }, traceId: "tr_race_req",
      now: () => new Date(), log: () => {} };
    const requested = await execute(anonymous, "cap.auth.request_link", { email }, { tool: "danger" });
    expect(requested.ok).toBe(true);
    if (!requested.ok) throw new Error("code not issued");
    const code = requested.result.dev_only_code as string;
    const [a, b] = await Promise.all([
      execute({ ...anonymous, traceId: "tr_race_a" }, "cap.auth.consume_link", { email, code }, { tool: "write" }),
      execute({ ...anonymous, traceId: "tr_race_b" }, "cap.auth.consume_link", { email, code }, { tool: "write" }),
    ]);
    const won = [a, b].filter(r => r.ok);
    const lost = [a, b].filter(r => !r.ok);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
    const sessions = await db.prepare("SELECT COUNT(*) AS n FROM session WHERE principal_id = (SELECT id FROM principal WHERE email_hash = ?)")
      .bind(await sha256(email)).first<{ n: number }>();
    expect(Number(sessions?.n)).toBe(1);
  });
});
