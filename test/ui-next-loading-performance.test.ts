// @vitest-environment jsdom
// Deferred HTTP fixtures prove scheduling, not user-device latency. No timers stand in for a live benchmark.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import Live from "../ui-next/src/app/Live.svelte";
import { forget } from "../ui-next/src/app/session.js";
import { resultsModel } from "../ui-next/src/app/data.js";
import { useSessionLevelMinimum } from "../ui-next/src/screens/results/data.js";

const aid = "asm_loading", pid = "prj_loading";
const root = `/v2/assessments/${aid}`;
const project = `/v2/projects/${pid}`;
const count1 = `${root}/surveys/s1`, count2 = `${root}/surveys/s2`;
const reportPath = "/v2/reports/newest";
const payload = { lenses: [{ lens: "Translation Team", count: 4, score: 80, sub_dimensions: [] }], cross_lens_multi: [] };
const snapshot = { id: "newest", created_at: "2026-10-28T00:00:00Z", payload };
const fixtures = () => ({
  [root]: { assessment: { id: aid, project_id: pid, role: "owner", name: "Mark", format: "written", stage: "understand", language_id: "lang" }, surveys: [{ id: "s1", perspective: "Translation Team" }, { id: "s2", perspective: "Community" }, { id: "archived", perspective: "Church", archived_at: "2026-10-01" }] },
  [`${root}/results`]: { report_build_allowed: true, level_minimum_responses: 3 },
  [`${root}/reports`]: { reports: [{ id: "older", created_at: "2026-10-01" }], next_cursor: "page2" },
  [`${root}/reports?cursor=page2`]: { reports: [{ id: "newest", created_at: snapshot.created_at }], next_cursor: null },
  [project]: { project: { id: pid, name: "Kikuyu" } },
  [`${project}/languages`]: { languages: [{ id: "lang", name: "Kikuyu" }] },
  [count1]: { counts: { respondents: 4, responses: 6 } },
  [count2]: { counts: { respondents: 2, responses: 3 } },
  [reportPath]: { report: snapshot },
});
type Entry = { url: string; init: RequestInit };
function serve(overrides: Record<string, unknown> = {}, blocked: string[] = []) {
  const routes: Record<string, unknown> = { ...fixtures(), ...overrides };
  const calls: Entry[] = [];
  const gates = new Map<string, () => void>();
  const held = new Map(blocked.map((url) => [url, new Promise<void>((resolve) => gates.set(url, resolve))]));
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    await held.get(url);
    const result = routes[url];
    if (result instanceof Error || result === undefined) return new Response(JSON.stringify({ ok: false, error: { code: "FAILED", message: result instanceof Error ? result.message : `unexpected ${url}` } }), { status: 500 });
    return new Response(JSON.stringify({ ok: true, result }));
  }));
  return { calls, release: (url: string) => gates.get(url)?.(), releaseAll: () => gates.forEach((release) => release()), started: (url: string) => calls.some((c) => c.url === url) };
}
afterEach(() => { cleanup(); forget(); vi.unstubAllGlobals(); useSessionLevelMinimum(undefined); });

describe("resultsModel independent request scheduling", () => {
  it("starts counts, language and newest report while project remains unresolved; retains the complete model", async () => {
    const http = serve({}, [project]);
    const pending = resultsModel(aid);
    try {
      await vi.waitFor(() => {
        expect(http.started(project)).toBe(true);
        expect(http.started(count1)).toBe(true); expect(http.started(count2)).toBe(true);
        expect(http.started(`${project}/languages`)).toBe(true);
        expect(http.started(reportPath)).toBe(true);
      });
    } finally { http.releaseAll(); await pending; }
    const m = await pending;
    expect(m.counts).toEqual({ team: 4, community: 2, church: 0 });
    expect(m.review).toMatchObject({ language: "Kikuyu", project: "Kikuyu", liveResponses: 9, responses: 4, canReadResponses: true });
    expect(m.reportId).toBe("newest"); expect(m.payload).toEqual(payload);
    expect(m.canBuild).toBe(true); expect(m.held).toBeNull();
    expect(http.calls.map((c) => c.url).sort()).toEqual(Object.keys(fixtures()).sort());
    expect(http.calls.every((c) => c.init.method === "GET" && c.init.credentials === "same-origin" && c.init.cache === "no-store")).toBe(true);
  });

  it("does not postpone report or language behind a slow survey count", async () => {
    const http = serve({}, [count1]);
    const pending = resultsModel(aid);
    try {
      await vi.waitFor(() => {
        expect(http.started(count2)).toBe(true);
        expect(http.started(reportPath)).toBe(true);
        expect(http.started(`${project}/languages`)).toBe(true);
      });
    } finally { http.releaseAll(); await pending; }
    await expect(pending).resolves.toMatchObject({ counts: { team: 4, community: 2, church: 0 } });
  });

  it("keeps each repeated navigation fresh with the same request count", async () => {
    const http = serve();
    await resultsModel(aid);
    const first = http.calls.map((c) => c.url).sort();
    await resultsModel(aid);
    expect(http.calls.slice(first.length).map((c) => c.url).sort()).toEqual(first);
    expect(first).toHaveLength(9);
  });

  it.each([count1, reportPath, `${root}/reports?cursor=page2`])("surfaces a required read failure (%s) rather than returning fabricated empty data", async (url) => {
    serve({ [url]: new Error("required read failed") });
    await expect(resultsModel(aid)).rejects.toThrow("required read failed");
  });

  it("retains optional project/language fallbacks and a failed results read", async () => {
    serve({ [project]: new Error("project unavailable"), [`${project}/languages`]: new Error("language unavailable"), [`${root}/results`]: new Error("results unavailable") });
    const m = await resultsModel(aid);
    expect(m.review).toMatchObject({ project: "Project", projectId: pid, language: "", liveResponses: 9 });
    expect(m.results.error).toBeInstanceOf(Error); expect(m.canBuild).toBe(false);
    expect(m.reportId).toBe("newest");
  });

  it("never starts an explicit build if a required count fails", async () => {
    const http = serve({ [`${root}/reports`]: { reports: [] }, [count1]: new Error("count unavailable") });
    await expect(resultsModel(aid, { build: true })).rejects.toThrow("count unavailable");
    expect(http.calls.every((c) => c.init.method === "GET")).toBe(true);
  });

  it("does not implicitly build a missing report and retains viewer permissions", async () => {
    const all = fixtures();
    const http = serve({ [root]: { ...all[root], assessment: { ...all[root].assessment, role: "viewer", language_name: "Named language" } }, [`${root}/reports`]: { reports: [] }, [`${root}/results`]: { report_build_allowed: false, report_hold_reason: "count", responses_needed: 3, responses_in: 2 } });
    const m = await resultsModel(aid);
    expect(m.review).toMatchObject({ language: "Named language", responses: 9, liveResponses: 9, canReadResponses: false, canReopen: false });
    expect(m.canBuild).toBe(false); expect(m.payload).toBeNull(); expect(m.held).toMatchObject({ responses_needed: 3 });
    expect(http.calls.every((c) => c.init.method === "GET")).toBe(true);
    expect(http.started(reportPath)).toBe(false); expect(http.started(`${project}/languages`)).toBe(false);
  });
});


describe("Live anchor navigation", () => {
  const navigate = async (hash: string) => {
    globalThis.location.hash = hash;
    await fireEvent(globalThis, new Event("hashchange"));
    await tick();
    // Drain promises started by the effect/session read without introducing a timing benchmark.
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await tick();
  };
  const signedIn = { "/v2/me": { principal: { id: "facilitator", display_name: "Kay" } } };

  it("adds zero reads for an anchor change, but reloads for a query change and after a confirmed build", async () => {
    let built = false;
    const http = serve(signedIn);
    const readFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
      if (String(input) === `${root}/reports` && init.method === "POST") {
        http.calls.push({ url: String(input), init });
        const body = JSON.parse(String(init.body));
        if (body.mode === "dry_run") return new Response(JSON.stringify({ ok: true, result: { confirm_token: "build-token", expires_in: 60 } }));
        expect(body.confirm_token).toBe("build-token"); built = true;
        return new Response(JSON.stringify({ ok: true, result: { report: snapshot } }));
      }
      return readFetch(input, init);
    }));
    globalThis.location.hash = `#/review/${aid}/results`;
    const view = render(Live as never, { props: {} });
    await waitFor(() => expect(view.container.textContent).toContain("Refresh with new answers"));
    // The existing anchor scroll effect remains active; jsdom has no native scrollIntoView.
    const target = document.createElement("div"); target.id = "loading-test-anchor";
    const scroll = vi.fn(); target.scrollIntoView = scroll; view.container.append(target);
    const before = http.calls.length;
    await navigate(`#/review/${aid}/results#loading-test-anchor`);
    expect(http.calls).toHaveLength(before); expect(scroll).toHaveBeenCalled();
    await navigate(`#/review/${aid}/results?filter=latest`);
    await waitFor(() => expect(http.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(view.container.textContent).toContain("Refresh with new answers"));
    const refresh = [...view.container.querySelectorAll("button")].find((b) => b.textContent?.includes("Refresh with new answers"))!;
    await fireEvent.click(refresh);
    await waitFor(() => expect(view.container.querySelector("[data-confirm-report]")).not.toBeNull());
    const beforeMutation = http.calls.filter((c) => c.url === root).length;
    await fireEvent.click(view.container.querySelector("[data-confirm-report]")!);
    await waitFor(() => expect(built).toBe(true));
    await waitFor(() => expect(http.calls.filter((c) => c.url === root)).toHaveLength(beforeMutation + 1));
    await waitFor(() => expect(view.container.querySelector("[data-confirm-report]")).toBeNull());
  });

  it("keeps the newer route when an earlier results load finishes late", async () => {
    const http = serve(signedIn, [project]);
    globalThis.location.hash = `#/review/${aid}/results`;
    const view = render(Live as never, { props: {} });
    try {
      await vi.waitFor(() => expect(http.started(project)).toBe(true));
      await navigate("#/about");
      await waitFor(() => expect(view.container.textContent).toContain("Why 3D Review exists"));
    } finally { http.releaseAll(); }
    for (let i = 0; i < 40; i++) await Promise.resolve();
    await tick();
    expect(view.container.textContent).toContain("Why 3D Review exists");
    expect(view.container.textContent).not.toContain("Refresh with new answers");
  });
});
