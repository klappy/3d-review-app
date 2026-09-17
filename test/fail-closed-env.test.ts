// Fail-closed environment guard (Astra #14 c5706439170): a missing ENVIRONMENT is NOT dev.
import { describe, expect, it } from "vitest";
import app from "../src/index";
import worker from "../src/worker";
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

// fix/pr15-auth-hardening A4(8): a mis-deploy without the OAUTH_KV binding is a clean 503, not the provider's TypeError.
describe("OAuth storage absent fails closed before any storage access", () => {
  const limiter = { limit: async () => ({ success: true }) };
  const ectx = () => ({ waitUntil() {}, passThroughOnException() {} }) as any;
  for (const ENVIRONMENT of ["dev", "production"]) {
    it(`/token, /register and a provider-shaped bearer on /mcp answer 503 temporarily_unavailable (ENVIRONMENT=${ENVIRONMENT})`, async () => {
      const env = { DB: tripwireDb, SESSION_SECRET: "synthetic-only", ENVIRONMENT, RL_MCP_ANON: limiter, RL_MCP_CEILING: limiter, RL_AUTH: limiter, RL_REDEEM: limiter };
      const hit = (path: string, headers: Record<string, string>, body: string) => worker.fetch(new Request("https://t.invalid" + path, { method: "POST", headers, body }), env as any, ectx());
      for (const r of [
        await hit("/token", { "content-type": "application/x-www-form-urlencoded" }, "grant_type=authorization_code&code=a:b:c&client_id=x"),
        await hit("/register", { "content-type": "application/json" }, JSON.stringify({ redirect_uris: ["https://x.example/cb"] })),
        await hit("/mcp", { "content-type": "application/json", authorization: `Bearer usr_x:${"g".repeat(16)}:${"a".repeat(32)}` }, "{}"),
      ]) {
        expect(r.status).toBe(503);
        expect(((await r.json()) as any).error).toBe("temporarily_unavailable");
      }
    });
  }
});
