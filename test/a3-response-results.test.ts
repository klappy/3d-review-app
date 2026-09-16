import { describe, expect, it } from "vitest";
import { summary } from "../src/handlers/results";
import { form } from "../src/handlers/response";
import type { Ctx } from "../src/handlers/types";

function ctx(rows: (sql: string) => unknown, principal: Ctx["principal"]): Ctx {
  const db = { prepare(sql: string) { return { bind() { return this; }, async first() { return rows(sql); } }; } } as unknown as D1Database;
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
    expect(result.result).toMatchObject({ suppressed: true, status: "held", summary: null, policy_version: "D7-held" });
    expect(JSON.stringify(result.result)).not.toMatch(/"score"|"average"/);
  });

  it("rejects a participant token without exact survey scope", async () => {
    const c = ctx(() => null, { kind: "participant", id: "rsp_synthetic", respondentId: "rsp_synthetic" });
    await expect(form(c, {})).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
});
