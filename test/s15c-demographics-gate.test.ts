// S15c: demographic fields (age range, gender) reach results, the responses listing, reports and exports only when the
// facilitator turned demographics on for the assessment. Respondent values already stored in response.context_json
// (rows stored before the switch went off) must never surface while it is off. Report build and every export carry no
// demographic fields in any mode today; those guards make sure a later change cannot add them without a gate.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({workers:[{name:"s15c",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"s15c"}}]}));
let db: D1Database, env: any, owner: string, sid: string;
const aid = "assess_syn_earning-trust-2026-01";
// Values that cannot appear anywhere by coincidence; stored directly, as rows written while demographics were on.
const AGE = "zz_age_marker", GENDER = "zz_gender_marker";
const LEAK = /zz_age_marker|zz_gender_marker|age_range|"gender"|demographic/i;
async function call(method: string, url: string, body?: unknown, bearer = owner) {
  const r = await app.fetch(new Request("https://local.invalid" + url, {method, headers: {"content-type": "application/json", authorization: `Bearer ${bearer}`}, body: body === undefined ? undefined : JSON.stringify(body)}), env);
  return {status: r.status, ...await r.json() as any};
}
const setDemographics = (on: boolean) => call("PATCH", `/v2/assessments/${aid}`, {demographics_enabled: on});
const dangerous = async (method: string, url: string, params: unknown) => {
  const dry = await call(method, url, {params, mode: "dry_run"});
  expect(dry.ok, JSON.stringify(dry)).toBe(true);
  return call(method, url, {params, mode: "execute", confirm_token: dry.result.confirm_token});
};
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql","migrations/0002_code_escrow.sql","migrations/0003_language_archive.sql","migrations/0004_pinned_instruments.sql","migrations/0006_oauth_code_redemption.sql","migrations/0007_shared_link_context.sql","migrations/0008_synthetic_report.sql","seed/synthetic.sql","seed/synthetic-responses.sql","migrations/0011_context.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter(l => !l.trimStart().startsWith("--")).join("\n");
    const statements = sql.split(";\n").map(x => x.trim()).filter(Boolean);
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50).map(x => db.prepare(x)));
  }
  env = {DB: db, SESSION_SECRET: "synthetic-s15c", ENVIRONMENT: "dev", CODE_ESCROW_SECRET: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA"};
  owner = await mintSession(env, "person_mara", "user");
  sid = (await db.prepare("SELECT id FROM assessment_survey WHERE assessment_id = ? AND state = 'selected' LIMIT 1").bind(aid).first<any>()).id;
  // Rows stored earlier, carrying respondent demographics in response.context_json.
  await db.prepare("UPDATE response SET context_json = ? WHERE assessment_survey_id IN (SELECT id FROM assessment_survey WHERE assessment_id = ?)")
    .bind(JSON.stringify({age_range: AGE, gender: GENDER}), aid).run();
}, 120000);
afterAll(() => mf.dispose());

describe("S15c stored response.context_json never surfaces while demographics are off", () => {
  it("fixture: stored rows really hold demographic values", async () => {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id WHERE s.assessment_id = ? AND r.context_json LIKE ?").bind(aid, `%${AGE}%`).first<any>();
    expect(n.n).toBeGreaterThan(0);
  });

  it("OFF: results summary and response list carry no demographic key or stored value", async () => {
    expect((await setDemographics(false)).ok).toBe(true);
    for (const r of [await call("GET", `/v2/assessments/${aid}/responses`), await call("GET", `/v2/assessments/${aid}/results`)]) {
      expect(r.ok).toBe(true);
      expect(r.result.demographics_enabled).toBe(false);
      expect(r.result.demographic_fields).toBeUndefined();
      expect(Object.keys(r.result).filter(k => /age|gender|demographic_/.test(k))).toEqual([]);
      expect(JSON.stringify(r.result)).not.toMatch(/zz_age_marker|zz_gender_marker|age_range|"gender"|demographic_fields/);
    }
  });

  it("OFF: report build, get and list carry no demographic fields", async () => {
    expect((await setDemographics(false)).ok).toBe(true);
    const built = await dangerous("POST", `/v2/assessments/${aid}/reports`, {});
    expect(built.ok, JSON.stringify(built)).toBe(true);
    const id = built.result.report.id;
    const got = await call("GET", `/v2/reports/${id}`), listed = await call("GET", `/v2/assessments/${aid}/reports`);
    expect(got.ok && listed.ok).toBe(true);
    for (const r of [built, got, listed]) expect(JSON.stringify(r.result)).not.toMatch(LEAK);
  });

  it("OFF: exports (access codes, blank printable form) carry no demographic fields", async () => {
    expect((await setDemographics(false)).ok).toBe(true);
    const issued = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes`, {params: {count: 2}, mode: "execute"});
    expect(issued.ok, JSON.stringify(issued)).toBe(true);
    const exported = await dangerous("POST", `/v2/assessments/${aid}/surveys/${sid}/codes/export`, {ids: issued.result.ids});
    expect(exported.ok, JSON.stringify(exported)).toBe(true);
    expect(exported.result.codes).toHaveLength(2);
    const printed = await call("GET", `/v2/assessments/${aid}/surveys/${sid}/print`);
    expect(printed.ok).toBe(true);expect(printed.result.blank).toBe(true);
    for (const r of [issued, exported, printed]) expect(JSON.stringify(r.result)).not.toMatch(LEAK);
  });

  it("ON: results summary and response list carry the demographic fields (definitions only, no stored values); report and exports still carry none", async () => {
    expect((await setDemographics(true)).ok).toBe(true);
    for (const r of [await call("GET", `/v2/assessments/${aid}/responses`), await call("GET", `/v2/assessments/${aid}/results`)]) {
      expect(r.ok).toBe(true);
      expect(r.result.demographics_enabled).toBe(true);
      expect(r.result.demographic_fields.map((f: any) => f.key)).toEqual(["age_range", "gender"]);
      expect(r.result.suppressed).toBe(true);expect(r.result.status).toBe("held");
      expect(JSON.stringify(r.result)).not.toMatch(/zz_age_marker|zz_gender_marker/);
    }
    const built = await dangerous("POST", `/v2/assessments/${aid}/reports`, {});
    expect(built.ok, JSON.stringify(built)).toBe(true);
    expect(JSON.stringify(built.result)).not.toMatch(LEAK);
    const issued = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes`, {params: {count: 1}, mode: "execute"});
    const exported = await dangerous("POST", `/v2/assessments/${aid}/surveys/${sid}/codes/export`, {ids: issued.result.ids});
    const printed = await call("GET", `/v2/assessments/${aid}/surveys/${sid}/print`);
    for (const r of [exported, printed]) { expect(r.ok).toBe(true);expect(JSON.stringify(r.result)).not.toMatch(LEAK); }
    expect((await setDemographics(false)).ok).toBe(true);
  });

  it("turning it back off removes the fields again from results and the response list", async () => {
    expect((await setDemographics(true)).ok).toBe(true);
    expect((await setDemographics(false)).ok).toBe(true);
    for (const r of [await call("GET", `/v2/assessments/${aid}/responses`), await call("GET", `/v2/assessments/${aid}/results`)]) {
      expect(r.result.demographics_enabled).toBe(false);expect(r.result.demographic_fields).toBeUndefined();
    }
  });
});
