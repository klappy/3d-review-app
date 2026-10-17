// Malformed secrets are refused by the handlers before any lookup (Bugbot 4291079028, PR 489 low). These cases used to
// live in workshop-same-ip.test.ts beside the rate-limiter checks; the limiter was removed (captain 2026-10-16), the
// handler rule stays.
import { describe, expect, it } from "vitest";
import { CapError } from "../src/handlers/types";
import { authConsumeLink, authRequestLink } from "../src/handlers/platform";
import { open_link, redeem_code } from "../src/handlers/participant";

const refusal = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e as CapError; } };

describe("handlers refuse malformed secrets before any lookup", () => {
  it("auth: a numeric code, whitespace-only code/email or non-string email is INVALID_PARAMS with no database access", async () => {
    const touched: string[] = [];
    const db = { prepare: (sql: string) => { touched.push(sql); throw new Error("handler reached the database"); } };
    const shapes: [string, Record<string, unknown>][] = [
      ["cap.auth.consume_link", { email: "a@example.invalid", code: 123456 }], // numeric code: the bypass Bugbot found
      ["cap.auth.consume_link", { email: "a@example.invalid", code: "   " }],
      ["cap.auth.consume_link", { email: 7, code: "123456" }],
      ["cap.auth.request_link", { email: "   " }],
    ];
    for (const [cap, params] of shapes) {
      const handler = cap === "cap.auth.consume_link" ? authConsumeLink : authRequestLink;
      const e = await refusal(handler({ env: { ENVIRONMENT: "dev" }, db, log: () => {} } as any, params, undefined as any));
      expect(e?.code, `${cap} ${JSON.stringify(params)}`).toBe("INVALID_PARAMS");
    }
    expect(touched).toEqual([]);
  });
  it("participant: a whitespace-only code or token is INVALID_PARAMS with no database access", async () => {
    const touched: string[] = [];
    const db = { prepare: (sql: string) => { touched.push(sql); throw new Error("handler reached the database"); } };
    const shapes: [string, Record<string, unknown>][] = [
      ["cap.participant.redeem_code", { code: "   " }],
      ["cap.participant.redeem_code", { code: "\t\n" }],
      ["cap.participant.open_link", { token: "   " }],
      ["cap.participant.open_link", { token: " \t" }],
    ];
    for (const [cap, params] of shapes) {
      const handler = cap === "cap.participant.redeem_code" ? redeem_code : open_link;
      const e = await refusal(handler({ env: { ENVIRONMENT: "dev" }, db, log: () => {}, now: () => new Date(0) } as any, params, undefined as any));
      expect(e?.code, `${cap} ${JSON.stringify(params)}`).toBe("INVALID_PARAMS");
    }
    expect(touched).toEqual([]);
  });
});
