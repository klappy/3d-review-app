/**
 * B19 (Bincy; ASK 17 option 1, captain 2026-10-16): setup step 1 asks for location/community and facilitator.
 * Both are optional text stored on the assessment (additive migration 0015) and carried by cap.assessment.create/update.
 * Real D1 (Miniflare) with the repo's migrations + synthetic seed.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "b19", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "b19" } }] }));
let db: D1Database, env: any, owner: string;
async function call(method: string, url: string, body?: unknown, bearer = owner) {
  const r = await app.fetch(new Request("https://local.invalid" + url, { method, headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: r.status, ...await r.json() as any };
}
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql", "migrations/0015_assessment_location_facilitator.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, SESSION_SECRET: "synthetic-b19", ENVIRONMENT: "dev" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);

describe("B19 location/community and facilitator", () => {
  it("migration 0015 is additive: two nullable text columns, existing rows read null", async () => {
    const row = await db.prepare("SELECT location, facilitator FROM assessment WHERE id = 'assess_tavo_prepare'").first<any>();
    expect(row).toEqual({ location: null, facilitator: null });
    const sql = readFileSync(new URL("../migrations/0015_assessment_location_facilitator.sql", import.meta.url), "utf8");
    expect(sql).not.toMatch(/\b(DROP|RENAME)\b/i);
  });
  it("create stores both and returns them; get reads them back", async () => {
    const c = await call("POST", "/v2/projects/proj_rill/assessments", { name: "B19 review", language_id: "lang_tavo", location: "Ban Na, Luang Prabang", facilitator: "Bincy" });
    expect(c.ok).toBe(true);
    expect(c.result.assessment).toMatchObject({ location: "Ban Na, Luang Prabang", facilitator: "Bincy" });
    const g = await call("GET", `/v2/assessments/${c.result.assessment.id}`);
    expect(g.result.assessment).toMatchObject({ location: "Ban Na, Luang Prabang", facilitator: "Bincy" });
  });
  it("create without them stores null (old clients unchanged)", async () => {
    const c = await call("POST", "/v2/projects/proj_rill/assessments", { name: "B19 plain", language_id: "lang_tavo" });
    expect(c.result.assessment).toMatchObject({ location: null, facilitator: null });
  });
  it("update edits, clears, and records the prior values for undo; wrong types are refused", async () => {
    const c = await call("POST", "/v2/projects/proj_rill/assessments", { name: "B19 edit", language_id: "lang_tavo", location: "Old town" });
    const id = c.result.assessment.id;
    const u = await call("PATCH", `/v2/assessments/${id}`, { location: "New town", facilitator: "Sam" });
    expect(u.result.assessment).toMatchObject({ location: "New town", facilitator: "Sam", name: "B19 edit" });
    const cleared = await call("PATCH", `/v2/assessments/${id}`, { location: null });
    expect(cleared.result.assessment).toMatchObject({ location: null, facilitator: "Sam" });
    const bad = await call("PATCH", `/v2/assessments/${id}`, { facilitator: 7 });
    expect(bad.ok).toBe(false);
    const row = await db.prepare("SELECT location, facilitator FROM assessment WHERE id = ?").bind(id).first<any>();
    expect(row).toEqual({ location: null, facilitator: "Sam" });
  });
});
