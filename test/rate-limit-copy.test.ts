// Only the one-minute limiters get the one-minute copy (Bugbot 4290591302). The hourly invite cap and the 900 s mail
// cap keep the server's message, hint and retry time, so a facilitator is not told to retry in a minute and fail again.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain browser module, no types
import { RATE_LIMIT_COPY, SERVER_MINUTE_MESSAGE, rateLimitText, retryAfterOf } from "../ui/rate-limit.js";
import { RATE_LIMIT_MESSAGE } from "../src/ratelimit";

describe("rate-limit copy follows the server's retry", () => {
  it("the client knows the server's one-minute message", () => { expect(SERVER_MINUTE_MESSAGE).toBe(RATE_LIMIT_MESSAGE); });
  it("one-minute limiter (plain message, retry 60 or absent) → the one-minute copy", () => {
    expect(rateLimitText(RATE_LIMIT_MESSAGE, "this is a rate limit (x) — try again in one minute", 60)).toBe(RATE_LIMIT_COPY);
    expect(rateLimitText(RATE_LIMIT_MESSAGE, undefined, undefined)).toBe(RATE_LIMIT_COPY);
  });
  it("hourly invite cap keeps its message, hint and hour — even if a retry of 60 came with it", () => {
    for (const retry of [3600, 60, undefined]) {
      const t = rateLimitText("at most 30 collaborator invitations per hour", "this cap resets over the next hour, not the next minute", retry);
      expect(t).not.toBe(RATE_LIMIT_COPY); expect(t).toMatch(/30 collaborator invitations per hour/); expect(t).toMatch(/next hour, not the next minute/);
    }
    expect(rateLimitText("at most 30 collaborator invitations per hour", undefined, 3600)).toMatch(/retry after 1 hour/);
  });
  it("mail cap: 900 s from the Retry-After header keeps the server's message and says 15 minutes", () => {
    const response = { headers: new Headers({ "retry-after": "900" }) };
    const error = { code: "RATE_LIMITED", message: "too many links requested for this address — use the newest email or wait 15 minutes" };
    const t = rateLimitText(error.message, undefined, retryAfterOf(error, response));
    expect(t).not.toBe(RATE_LIMIT_COPY); expect(t).toMatch(/wait 15 minutes/); expect(t).toMatch(/retry after 15 minutes/);
  });
  it("MCP panel: only a one-minute refusal renders as rate_limited; the hourly cap keeps message, hint and retry", () => {
    const html = readFileSync(new URL("../src/mcp-panel.html", import.meta.url), "utf8");
    const pick = (name: string) => { const m = new RegExp(`^const ${name} = .*$`, "m").exec(html); if (!m) throw new Error(name); return m[0]; };
    const fn = new Function("REFUSED", "esc", `${pick("oneMinute")}\n${pick("retryNote")}\n${pick("kindOf")}\n${html.match(/^function refusal\(e, what\) .*$/m)![0]}\nreturn { kindOf, refusal };`);
    const { kindOf, refusal } = fn(new Set(), (s: string) => String(s));
    expect(kindOf({ code: "RATE_LIMITED", message: RATE_LIMIT_MESSAGE, retry_after: 60 })).toBe("rate_limited");
    const hourly = { code: "RATE_LIMITED", message: "at most 30 collaborator invitations per hour", hint: "this cap resets over the next hour, not the next minute", retry_after: 3600 };
    expect(kindOf(hourly)).toBe("failed");
    const out = refusal(hourly, "invitations");
    expect(out).toMatch(/30 collaborator invitations per hour/); expect(out).toMatch(/next hour, not the next minute/); expect(out).toMatch(/retry after 1 hour/);
    expect(out).not.toMatch(/Wait one minute/);
  });
});

describe("assess refusal paints the rate-limit hint once (Bugbot 4290741304)", () => {
  it("refusalError folds the hint into the message and carries no separate .hint for a rate limit", async () => {
    // @ts-expect-error plain browser module, no types
    const { refusalError } = await import("../ui/rate-limit.js");
    const hint = "this cap resets over the next hour, not the next minute";
    const e = refusalError(429, { code: "RATE_LIMITED", message: "at most 30 collaborator invitations per hour", hint, data: { retry_after: 3600 } }, undefined);
    const painted = `${e.message}${e.hint ? ` — ${e.hint}` : ""}`; // ui/assess/permissions.js fail()
    expect(painted.split(hint).length - 1).toBe(1);
    expect(e.code).toBe("RATE_LIMITED"); expect(e.status).toBe(429);
    const other = refusalError(403, { code: "FORBIDDEN", message: "not yours", hint: "ask the owner" }, undefined);
    expect(other.message).toBe("not yours"); expect(other.hint).toBe("ask the owner"); // non-rate-limit refusals keep their hint
  });
  it("both assess.js envelope paths (api, apiFull) build their error with refusalError", () => {
    const src = readFileSync(new URL("../ui/assess/assess.js", import.meta.url), "utf8");
    expect(src.match(/throw refusalError\(r\.status, j\?\.error, r\)/g)?.length).toBe(2);
    expect(src).not.toMatch(/e\.hint = j\?\.error\?\.hint/);
  });
});
