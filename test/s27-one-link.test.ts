/**
 * S27 (0.24.1 persona A, agent track): taking a survey's link again through the API minted a second live link. The API
 * now hands back the survey's one active link, as Collect does (#395); revoke or a different expiry makes a new one.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { sha256 } from "../src/handlers/common";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "s27-link", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "s27-link" } }] }));
let db: D1Database, env: any, owner: string;
const base = "/v2/assessments/assess_tavo_collect/surveys/survey_tavo/links";
async function call(method: string, url: string, body?: unknown, bearer?: string, e = env) {
  const r = await app.fetch(new Request("https://local.invalid" + url, { method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), e);
  return { status: r.status, ...await r.json() as any };
}
async function issue(params: Record<string, unknown> = {}, e = env) {
  const dry = await call("POST", base, { params, mode: "dry_run" }, owner, e); expect(dry.ok).toBe(true);
  const run = await call("POST", base, { params, mode: "execute", confirm_token: dry.result.confirm_token }, owner, e); expect(run.ok).toBe(true);
  return { dry: dry.result, link: run.result };
}
const live = async () => Number((await db.prepare("SELECT COUNT(*) AS n FROM invitation WHERE assessment_survey_id = 'survey_tavo' AND status IN ('pending','accepted')").first<{ n: number }>())!.n);
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, SESSION_SECRET: "synthetic-s27-link", ENVIRONMENT: "dev" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);
afterAll(() => mf.dispose());

describe("one link per survey on re-issue (API path)", () => {
  it("taking the link twice returns the same live link and stores one row; the dry run names the link it reuses", async () => {
    const first = await issue();
    expect(first.dry.reuses).toBeUndefined();
    expect(first.link.reused).toBeUndefined();
    expect(first.link.link_token).toMatch(/^link_[A-Za-z0-9_-]{32}$/);
    const n = await live();
    const again = await issue();
    expect(again.dry.reuses).toBe(first.link.link_id);
    expect(again.link).toMatchObject({ link_id: first.link.link_id, link_token: first.link.link_token, entry_fragment: first.link.entry_fragment, expires_at: null, reused: true });
    expect(await live()).toBe(n);
    const row = await db.prepare("SELECT token_hash FROM invitation WHERE id = ?").bind(first.link.link_id).first<{ token_hash: string }>();
    expect(row!.token_hash).toBe(await sha256(first.link.link_token)); // still only the hash is stored
    const opened = await call("POST", "/v2/participate/link", { token: again.link.link_token });
    expect(opened.ok).toBe(true);
  });
  it("after revoke, the next take mints a new link; a different expiry is its own link", async () => {
    const { link } = await issue();
    expect((await call("DELETE", `${base}/${link.link_id}`, {}, owner)).ok).toBe(true);
    const fresh = await issue();
    expect(fresh.link.link_id).not.toBe(link.link_id);
    expect(fresh.link.reused).toBeUndefined();
    const dated = await issue({ expires_at: new Date(Date.now() + 86400e3).toISOString() });
    expect(dated.link.link_id).not.toBe(fresh.link.link_id);
    expect((await issue()).link.link_id).toBe(fresh.link.link_id);
  });
  it("a link minted before this change (random token) is not re-derivable: one new link, then that one is reused", async () => {
    await db.prepare("UPDATE invitation SET status = 'revoked' WHERE assessment_survey_id = 'survey_tavo'").run();
    await db.prepare("INSERT INTO invitation (id,scope_type,scope_id,assessment_survey_id,role,token_hash,status,created_by,created_at,expires_at) VALUES ('invite_legacy','survey','survey_tavo','survey_tavo','participant',?, 'pending','person_mara','2026-09-29T00:00:00.000Z',NULL)").bind(await sha256("link_legacyrandomtokenlegacyrandomtok")).run();
    const a = await issue(), b = await issue();
    expect(a.link.link_id).not.toBe("invite_legacy");
    expect(b.link.link_id).toBe(a.link.link_id);
  });
});
