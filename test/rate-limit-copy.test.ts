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
    expect(page).toMatch(/setControlLabel\(retryButton, T\('tryAgain'\)\);/);
  });
  it("ready copy: once the wait is over the notice no longer says 'in one minute'", () => {
    expect(sharedCopy.rateLimitedReady).not.toMatch(/minute/); expect(sharedCopy.rateLimitedReady).toMatch(/^Rate limit/);
    expect(page).toMatch(/onReady: \(\) => \{ paintReadyNotice\(journey\.state\); retryButton\.focus\(\); \}/);
  });
});

describe("#490 re-review lows (terry-rereview490-0341)", () => {
  const page = readFileSync(new URL("../ui/participate/page.js", import.meta.url), "utf8");
  const held = async (label: string) => {
    const { holdRetry } = await import("../ui/rate-limit.js");
    let t = 0, tick: () => void = () => {};
    const button = { disabled: false, textContent: label, dataset: {} as Record<string, string> };
    holdRetry(button as unknown as HTMLButtonElement, 60, { setTimer: (fn: () => void) => { tick = fn; return 1; }, clearTimer: () => {}, now: () => t });
    return { button, advance: (ms: number) => { t += ms; tick(); } };
  };
  it("low 1: a language switch mid-wait relabels the Check countdown and the control after it", async () => {
    const { setControlLabel } = await import("../ui/rate-limit.js");
    const { button, advance } = await held("Check my answers");
    setControlLabel(button as unknown as HTMLButtonElement, "Vérifier mes réponses");
    advance(30_000);
    expect(button.textContent).toBe("Vérifier mes réponses (30 s)");
    advance(30_000);
    expect(button.textContent).toBe("Vérifier mes réponses"); expect(button.disabled).toBe(false);
    setControlLabel(button as unknown as HTMLButtonElement, "Check my answers");
    expect(button.textContent).toBe("Check my answers");
    expect(page).toMatch(/function applyStatic\(\) \{ for \(const \[sel, key\] of STATIC\) setControlLabel\(document\.querySelector\(sel\), T\(key, staticEn\[key\]\)\);/);
  });
  it("low 2: once a longer cap's wait ends, its own '15 minutes' notice is replaced too", async () => {
    const { rateLimitWaitOver } = await import("../ui/rate-limit.js");
    const state = { phase: "unavailable", rateLimited: true, notice: "Rate limit reached. Retry after 15 minutes.", retryAfter: 900 };
    const { button, advance } = await held("Try again");
    expect(rateLimitWaitOver(state, button)).toBe(false);
    advance(60_000);
    expect(rateLimitWaitOver(state, button)).toBe(true);
    expect(rateLimitWaitOver({ ...state, rateLimited: false }, button)).toBe(false);
    expect(rateLimitWaitOver({ ...state, phase: "form" }, button)).toBe(false);
    expect(rateLimitWaitOver(state, null)).toBe(false);
    // A Try again in flight is not "ready": the page hides the button meanwhile (see the #495 review block below).
    expect(rateLimitWaitOver(state, { ...button, hidden: true })).toBe(false);
    expect(page).toMatch(/function paintReadyNotice\(state\) \{\s*const text = rateLimitNotice\(state, retryButton, \{ retrying: linkCopy\.labelOpening, ready: linkCopy\.rateLimitedReady \}\);\s*if \(text\) \$\('notice'\)\.textContent = text;/);
    expect(page).not.toMatch(/state\.notice === linkCopy\.rateLimited/);
  });
  it("prior low 3: a failed Try again start says so instead of an unhandled rejection", () => {
    expect(page).toMatch(/journey\.start\(\{ retry: true \}\)\.then\([^\n]*\)\.catch\(\(\) => \{ \$\('notice'\)\.textContent = /);
  });
});

describe("#495 review lows (terry review495-0441)", () => {
  const limited = { phase: "unavailable", rateLimited: true, notice: sharedCopy.rateLimited, retryAfter: 60, limitId: 1 };
  const words = { retrying: sharedCopy.labelOpening, ready: sharedCopy.rateLimitedReady };
  const shown = () => ({ hidden: false, disabled: false, textContent: "Try again", dataset: {} as Record<string, string> });
  it("ready check reads the button's hidden state, not busy: a rejected Try again (busy false, button still hidden) is not ready", async () => {
    const { rateLimitWaitOver } = await import("../ui/rate-limit.js");
    expect(rateLimitWaitOver({ ...limited, busy: false }, { ...shown(), hidden: true })).toBe(false); // reject path
    expect(rateLimitWaitOver({ ...limited, busy: true }, { ...shown(), hidden: true })).toBe(false); // in flight
    expect(rateLimitWaitOver({ ...limited, busy: false }, shown())).toBe(true); // wait over, control visible
  });
  it("low: while a Try again is in flight the notice is neutral, not the wait copy that already ran out", async () => {
    const { rateLimitNotice } = await import("../ui/rate-limit.js");
    const hidden = { ...shown(), hidden: true };
    // The controller emits { ...state, busy: true } (same phase, same notice) before the request; the click hid the button.
    const inFlight = rateLimitNotice({ ...limited, busy: true }, hidden, words);
    expect(inFlight).toBe(sharedCopy.labelOpening);
    expect(inFlight).not.toMatch(/minute/);
    expect(rateLimitNotice({ ...limited, notice: "Rate limit reached. Retry after 15 minutes.", busy: true }, hidden, words)).toBe(sharedCopy.labelOpening);
    expect(rateLimitNotice({ ...limited, busy: false }, shown(), words)).toBe(sharedCopy.rateLimitedReady); // wait over
    expect(rateLimitNotice({ ...limited, busy: false }, hidden, words)).toBe(null); // rejected: keep the page's own failure words
    expect(rateLimitNotice({ phase: "form", busy: true }, hidden, words)).toBe(null);
  });
});
describe("#496 review lows (terry review496-0541)", () => {
  it("(1) shared Recover/Submit copy uses the Retry-After wait; one minute stays the words for 60 s or absent", async () => {
    // @ts-expect-error plain browser module, no types
    const shared: any = await import("../ui/shared-link.js");
    expect(typeof shared.rateLimitedCopy).toBe("function");
    expect(shared.rateLimitedCopy(undefined)).toBe(sharedCopy.rateLimited);
    expect(shared.rateLimitedCopy("60")).toBe(sharedCopy.rateLimited);
    expect(shared.rateLimitedCopy("30")).toBe(sharedCopy.rateLimited.replace("one minute", "30 seconds"));
    expect(shared.rateLimitedCopy(120)).toBe(sharedCopy.rateLimited.replace("one minute", "2 minutes"));
    expect(shared.rateLimitedCopy(1)).toMatch(/Try again in 1 second\.$/);
  });
  it("nit: the legacy participant footer carries no banned on-screen word (design-lens@1 vocabulary: workspace)", () => {
    const html = readFileSync(new URL("../ui/legacy/index.html", import.meta.url), "utf8");
    const footer = html.match(/<p class="participant-footer">([^<]*)<\/p>/)?.[1] ?? "";
    expect(footer).toMatch(/^Participants never sign in\./);
    expect(footer).not.toMatch(/workspace/i);
  });
});

// DoD 6, participant translation: when every /v2/translate call is refused with 429, the page said "not available …
// check the internet connection" — not that it was a rate limit. The refusal now carries the rate-limit kind and wait,
// and the page words it as a rate limit and holds its Try again for the wait.
describe("translation refused by a rate limit (DoD 6)", () => {
  it("fetchTranslationsProgressive rejects with RATE_LIMITED and the server's wait when nothing came back and a 429 did", async () => {
    // @ts-expect-error plain browser module, no types
    const { fetchTranslationsProgressive } = await import("../ui/participate/i18n.js");
    const fetchImpl = async () => new Response(JSON.stringify({ error: "rate_limited", hint: "translation is busy — try again shortly" }), { status: 429, headers: { "retry-after": "45" } }); // upstream-429 body (src/translate.ts:240): no retry_after, so the header is read
    const err: any = await fetchTranslationsProgressive({ lang: "es", context: "participant-ui", sourceTexts: { a: "Hello" }, fetchImpl }).catch((e: any) => e);
    expect(err).toBeInstanceOf(Error); expect(err.code).toBe("RATE_LIMITED"); expect(err.status).toBe(429); expect(err.retryAfter).toBe("45");
    const other: any = await fetchTranslationsProgressive({ lang: "es", context: "participant-ui", sourceTexts: { a: "Hello" }, fetchImpl: async () => new Response("{}", { status: 502 }) }).catch((e: any) => e);
    expect(other.code).toBeUndefined(); // a non-limit failure keeps the existing "not available" path
  });
  it("PR501 6216474718: a 429 is not resent in the second round, and the body's top-level retry_after is read (not only the header)", async () => {
    const { fetchTranslationsProgressive } = await import("../ui/participate/i18n.js");
    let calls = 0;
    const fetchImpl = async () => { calls++; return new Response(JSON.stringify({ error: "rate_limited", message: RATE_LIMIT_MESSAGE, retry_after: 120 }), { status: 429 }); }; // the body /v2/translate sends (src/translate.ts), no header
    const err: any = await fetchTranslationsProgressive({ lang: "es", context: "participant-ui", sourceTexts: { a: "Hello" }, fetchImpl }).catch((e: any) => e);
    expect(calls).toBe(1);
    expect(err.code).toBe("RATE_LIMITED"); expect(String(err.retryAfter)).toBe("120");
  });
  it("the page words a rate-limited translation as a rate limit and holds Try again for the wait", () => {
    const page = readFileSync(new URL("../ui/participate/page.js", import.meta.url), "utf8");
    expect(page).toMatch(/catch \(error\) \{\s*if \(seq !== loadSeq\) return;[^\n]*\n[^\n]*\n\s*showTranslateFailed\(error\);/);
    expect(page).toMatch(/function showTranslateFailed\(error\) \{[\s\S]{0,600}isRateLimitedError\(error\)[\s\S]{0,300}rateLimitedTranslate\(error\.retryAfter\)[\s\S]{0,300}holdRetry\(trRetry, error\.retryAfter/);
  });
  it("rateLimitedTranslate says rate limit, keeps English, and names the wait", async () => {
    // @ts-expect-error plain browser module, no types
    const { rateLimitedTranslate } = await import("../ui/rate-limit.js");
    expect(rateLimitedTranslate()).toBe("Rate limit: too many requests right now. Showing English. Try again in one minute.");
    expect(rateLimitedTranslate("30")).toBe("Rate limit: too many requests right now. Showing English. Try again in 30 seconds.");
  });
});
