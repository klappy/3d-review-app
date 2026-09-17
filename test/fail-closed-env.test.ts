// Fail-closed environment guard (Astra #14 c5706439170): a missing ENVIRONMENT is NOT dev.
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { authRequestLink } from "../src/handlers/platform";
import type { Ctx } from "../src/handlers/types";

const seed = (env: any) => app.fetch(new Request("https://t.invalid/v2/ops/seed/synthetic", { method: "POST" }), env);
// A DB that throws on any use proves the guard returns before touching storage.
const tripwireDb = new Proxy({}, { get() { throw new Error("DB touched before the environment guard"); } }) as unknown as D1Database;

describe("dev bootstrap + dev sign-in fail closed on environment", () => {
  for (const [label, ENVIRONMENT] of [["missing", undefined], ["production", "production"], ["empty", ""], ["Dev (case)", "Dev"], ["staging", "staging"]] as const) {
    it(`seed route refuses when ENVIRONMENT is ${label}`, async () => {
      const r = await seed({ DB: tripwireDb, SESSION_SECRET: "synthetic-only", ...(ENVIRONMENT === undefined ? {} : { ENVIRONMENT }) });
      expect(r.status).toBe(403);
      const j: any = await r.json();
      expect(j.ok).toBe(false);
      expect(j.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
      expect(JSON.stringify(j)).not.toContain("cap.ops.health");
    });
    it(`auth.request_link issues no code when ENVIRONMENT is ${label}`, async () => {
      const ctx = { env: { DB: tripwireDb, SESSION_SECRET: "synthetic-only", ...(ENVIRONMENT === undefined ? {} : { ENVIRONMENT }) }, db: tripwireDb,
        principal: { kind: "anonymous" }, traceId: "tr_test", now: () => new Date(), log: () => {} } as unknown as Ctx;
      await expect(authRequestLink(ctx, { email: "demo.owner@example.invalid" })).rejects.toMatchObject({ code: "RESERVED_NOT_BUILT" });
    });
  }
});
