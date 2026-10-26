import { describe, expect, it } from "vitest";
import { summary } from "../src/handlers/results";
import { authMe } from "../src/handlers/platform";
import { perspectiveLevelMinimum, LEVEL_MINIMUM, DEV_LEVEL_MINIMUM, participantReportMinimum } from "../src/report-admission";
import { V3_BAND_CUTOFFS } from "../ui/assess/v3-assessment.js";
import { form } from "../src/handlers/response";
import type { Ctx } from "../src/handlers/types";

function ctx(rows: (sql: string) => unknown, principal: Ctx["principal"]): Ctx {
  const db = { prepare(sql: string) { return { bind() { return this; }, async first() { return rows(sql); }, async all() { return { results: [] }; } }; } } as unknown as D1Database;
  return { env: { DB: db, SESSION_SECRET: "synthetic-test" }, db, principal,
    traceId: "tr_synthetic", now: () => new Date("2026-09-16T20:00:00Z"), log: () => {} };
}

describe("A-3 disclosure boundaries", () => {
  it("requires a direct assessment grant even when an assessment exists", async () => {
    const c = ctx((sql) => sql.includes("FROM assessment WHERE") ? { id: "asm_synthetic", stage: "understand" } : null,
      { kind: "user", id: "prn_synthetic" });
    await expect(summary(c, { aid: "asm_synthetic" })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  });

  it("returns a typed suppressed success state, never invented numeric scores", async () => {
    const c = ctx((sql) => sql.includes("FROM assessment WHERE") ? { id: "asm_synthetic", stage: "understand" } : { role: "owner" },
      { kind: "user", id: "prn_synthetic" });
    const result = await summary(c, { aid: "asm_synthetic" });
    expect(result.result).toMatchObject({ suppressed: true, status: "held", summary: null, policy_version: "D7-held", demographics_enabled: false });
    expect(result.result).not.toHaveProperty("demographic_fields");
    expect(JSON.stringify(result.result)).not.toMatch(/"score"|"average"/);
  });

  it("serves the per-perspective level minimum by environment: DEV 1, production and unknown 3; the overall floor is unchanged", async () => {
    expect([perspectiveLevelMinimum({ ENVIRONMENT: "dev" }), perspectiveLevelMinimum({ ENVIRONMENT: "production" }), perspectiveLevelMinimum({ ENVIRONMENT: "staging" }), perspectiveLevelMinimum({}), perspectiveLevelMinimum()]).toEqual([1, 3, 3, 3, 3]);
    expect([DEV_LEVEL_MINIMUM, LEVEL_MINIMUM, V3_BAND_CUTOFFS.minResponses]).toEqual([1, 3, 3]);
    expect([participantReportMinimum({ ENVIRONMENT: "production" }), participantReportMinimum({})]).toEqual([5, 5]);
    const c = ctx((sql) => sql.includes("FROM assessment WHERE") ? { id: "asm_synthetic", stage: "understand" } : { role: "owner", n: 0 },
      { kind: "user", id: "prn_synthetic" });
    expect((await summary(c, { aid: "asm_synthetic" })).result).toMatchObject({ level_minimum_responses: 3 }); // no ENVIRONMENT: 3
    const dev = { ...c, env: { ...c.env, ENVIRONMENT: "dev" } } as Ctx;
    expect((await summary(dev, { aid: "asm_synthetic" })).result).toMatchObject({ level_minimum_responses: 1 });
  });

  it("/v2/me carries the same level minimum (DEV 1, otherwise 3), so a page with no review in hand words levels as the server does", async () => {
    const c = ctx(() => null, { kind: "user", id: "prn_synthetic" });
    expect((await authMe(c, {})).result).toMatchObject({ level_minimum_responses: 3 });
    expect((await authMe({ ...c, env: { ...c.env, ENVIRONMENT: "dev" } } as Ctx, {})).result).toMatchObject({ level_minimum_responses: 1 });
  });

  it("rejects a participant token without exact survey scope", async () => {
    const c = ctx(() => null, { kind: "participant", id: "rsp_synthetic", respondentId: "rsp_synthetic" });
    await expect(form(c, {})).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
});
