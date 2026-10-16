// Only the one-minute limiters get the one-minute copy (Bugbot 4290591302). The hourly invite cap and the 900 s mail
// cap keep the server's message, hint and retry time, so a facilitator is not told to retry in a minute and fail again.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain browser module, no types
import { RATE_LIMIT_COPY, SERVER_MINUTE_MESSAGE, rateLimitText, retryAfterOf } from "../ui/rate-limit.js";
// @ts-expect-error plain browser module, no types
import { copy as sharedCopy } from "../ui/shared-link.js";
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

describe("one-minute copy names no source the page cannot know (review 6207996655, copy finding)", () => {
  // The same copy covers the per-address, per-session (wr:) and global (g:) limiters, so it must not say "this network".
  const surfaces: [string, string][] = [
    ["ui/rate-limit.js RATE_LIMIT_COPY", RATE_LIMIT_COPY],
    ["ui/shared-link.js copy.rateLimited", sharedCopy.rateLimited],
    ["ui/assess/feedback.js", readFileSync(new URL("../ui/assess/feedback.js", import.meta.url), "utf8")],
    ["src/mcp-panel.html", readFileSync(new URL("../src/mcp-panel.html", import.meta.url), "utf8")],
  ];
  for (const [where, text] of surfaces) it(`${where}: no "from this network"`, () => { expect(text).not.toMatch(/from this network/i); });
  it("shared-link rate-limit copy says 'one minute' once and 'nothing … changed/lost' once", () => {
    const t: string = sharedCopy.rateLimited;
    expect(t.match(/minute/g)?.length).toBe(1);
    expect(t.match(/nothing/gi)?.length).toBe(1);
    expect(t).toMatch(/^Rate limit/); expect(t).toMatch(/one minute/);
  });
  it("design lens (#490): the participant notice gives the same instruction as its Try again button", () => {
    expect(sharedCopy.rateLimited).not.toMatch(/open your link again/i); expect(sharedCopy.rateLimited).toMatch(/Try again in one minute\.$/);
  });
  it("design lens (#490): the participant retry is the primary block button under a heading", () => {
    const src = readFileSync(new URL("../ui/participate/page.js", import.meta.url), "utf8");
    expect(src).toMatch(/retryButton\.id = 'rate-retry'; retryButton\.className = 'rv-btn primary participant-primary'/);
    expect(src).toMatch(/retryHeading = element\('h2', T\('rateLimitHeading'\)\)/); expect(src).toMatch(/\$\('notice'\)\.before\(retryHeading\)/);
  });
});

describe("#490 review follow-ups (Bugbot 4292184464, HOLD lows 1–4, ready copy)", () => {
  const page = readFileSync(new URL("../ui/participate/page.js", import.meta.url), "utf8");
  it("Bugbot 4292184464: Try again after a refused Interview another runs the next-person setup", () => {
    expect(page).toMatch(/journey\.start\(\{ retry: true \}\)\.then\(\(\) => \{ if \(journey\.state\.phase === 'form' && journey\.state\.fresh\) startNextPerson\(\); \}\)/);
    expect(page).toMatch(/async function interviewAnother\(\) \{\s*await journey\.another\(\);\s*if \(journey\.state\.phase === 'form'\) startNextPerson\(\);/);
    expect(page).toMatch(/function startNextPerson\(\) \{\s*if \(passageDetails\) passageDetails\.open = true;[^\n]*\n\s*document\.querySelector\('main'\)\?\.scrollIntoView\?\.\(\);/);
  });
  it("low 1: the Check countdown ends only when the phase leaves form/review", () => {
    expect(page).toMatch(/state\.rateLimited !== true && recoverHold && !\['form', 'review'\]\.includes\(state\.phase\)/);
  });
  it("low 2: /legacy/ (no Try again control) tells the person to open the link again", () => {
    const app = readFileSync(new URL("../ui/app.js", import.meta.url), "utf8");
    expect(app).toMatch(/rateLimited: sharedCopy\.rateLimitedReopen/);
    expect(sharedCopy.rateLimitedReopen).toMatch(/^Rate limit.*Open your link again in one minute\.$/);
  });
  it("low 3: the /v2/auth/email comment no longer says the dampener runs first", () => {
    const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/Per-IP dampener first/);
  });
  it("low 4: a label swapped mid-wait shows in the countdown and after it", async () => {
    const { holdRetry } = await import("../ui/rate-limit.js");
    let t = 0, tick: () => void = () => {};
    const button = { disabled: false, textContent: "Try again", dataset: {} as Record<string, string> };
    holdRetry(button as unknown as HTMLButtonElement, 60, { label: "Try again", setTimer: (fn: () => void) => { tick = fn; return 1; }, clearTimer: () => {}, now: () => t });
    expect(button.textContent).toBe("Try again (60 s)");
    button.dataset.retryLabel = "Réessayer"; t = 30_000; tick();
    expect(button.textContent).toBe("Réessayer (30 s)");
    t = 60_000; tick();
    expect(button.textContent).toBe("Réessayer"); expect(button.disabled).toBe(false);
    expect(page).toMatch(/if \(underHold\(retryButton\)\) retryButton\.dataset\.retryLabel = T\('tryAgain'\); else retryButton\.textContent = T\('tryAgain'\);/);
  });
  it("ready copy: once the wait is over the notice no longer says 'in one minute'", () => {
    expect(sharedCopy.rateLimitedReady).not.toMatch(/minute/); expect(sharedCopy.rateLimitedReady).toMatch(/^Rate limit/);
    expect(page).toMatch(/onReady: \(\) => \{ paintReadyNotice\(journey\.state\); retryButton\.focus\(\); \}/);
  });
});
