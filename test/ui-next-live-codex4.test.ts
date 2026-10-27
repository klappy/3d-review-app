// @vitest-environment jsdom
// UI Next (v4) live wiring: Codex review findings on 112a0f6e (status: provisional). Report list paging and the newest-by-time
// choice, the report build's dry-run confirm before execute, Setup 5's blocked launch, viewer-safe Results / Results held actions,
// the results review's language and (absent) closure date, and the Project model's honest workspace, trend gaps and surfaced failures.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { reports, newestReport, resultsModel, projectModel, setupModel, shortDate, levelsOf, respondentsOf, levelTriples } from "../ui-next/src/app/data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { forget, me as sessionMe } from "../ui-next/src/app/session.js";
import { exploreModel, liveReport, gapsOf, phonePayload } from "../ui-next/src/app/data.js";
import { exploreRows } from "../ui-next/src/screens/explore/explore-data.js";
import Help from "../ui-next/src/screens/explore/Help.svelte";
import ReportDetailed from "../ui-next/src/screens/results/ReportDetailed.svelte";
import Report from "../ui-next/src/screens/results/Report.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { to } from "../ui-next/src/app/router.js";
import Live from "../ui-next/src/app/Live.svelte";
import Results from "../ui-next/src/screens/results/Results.svelte";
import ResultsHeld from "../ui-next/src/screens/results/ResultsHeld.svelte";
import Setup5 from "../ui-next/src/screens/setup/Setup5.svelte";
import Project from "../ui-next/src/screens/setup/Project.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { REPORT, useLevelMinimum, currentLevelMin } from "../ui-next/src/screens/results/data.js";
import projectFixture from "../ui-next/fixtures/setup/project.json";
import setupFixture from "../ui-next/fixtures/setup/setup.json";

type Call = { method: string; url: string; body: unknown };
type Route = (url: string, body: unknown, method: string) => unknown;
const realFetch = globalThis.fetch;
const calls: Call[] = [];
// A fake /v2: `routes` maps "METHOD path" (query included) to a result or a function of (url, body); a missing route answers 404.
const serve = (routes: Record<string, unknown | Route>) => {
  calls.length = 0;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET"; const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const key = `${method} ${url}`; const r = routes[key] ?? routes[`${method} ${url.split("?")[0]}`];
    if (r === undefined) return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: `no route ${key}` } }), { status: 404, headers: { "content-type": "application/json" } });
    if (r instanceof Error) return new Response(JSON.stringify({ ok: false, error: { code: "FAILED", message: r.message } }), { status: 500, headers: { "content-type": "application/json" } });
    const result = typeof r === "function" ? (r as Route)(url, body, method) : r;
    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
};
afterEach(() => { globalThis.fetch = realFetch; forget(); });

const AID = "asm_1", PID = "prj_1";
const payload = { lenses: [{ lens: "Translation Team", score: 80, sub_dimensions: [] }, { lens: "Community", score: 50, sub_dimensions: [] }], cross_lens_multi: [] };
const assessment = (over: Record<string, unknown> = {}) => ({ assessment: { id: AID, project_id: PID, name: "Mark 1–4", stage: "understand", format: "written", language_id: "lang_1", role: "owner", created_at: "2026-10-01T00:00:00Z", ...over }, surveys: [{ id: "s1", perspective: "Translation Team", template_name: "Translators" }, { id: "s2", perspective: "Community", template_name: "Community" }] });
const counts = { survey: {}, counts: { responses: 4, respondents: 4 } };
const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  "GET /v2/me": { principal: { id: "p1", display_name: "Kay Facilitator" } },
  [`GET /v2/assessments/${AID}`]: assessment(),
  [`GET /v2/assessments/${AID}/results`]: { status: "ready", report_build_allowed: true },
  [`GET /v2/projects/${PID}`]: { project: { id: PID, name: "Kikuyu", workspace_id: null } },
  [`GET /v2/projects/${PID}/languages`]: { languages: [{ id: "lang_1", name: "Kikuyu" }] },
  [`GET /v2/assessments/${AID}/surveys/s1`]: counts, [`GET /v2/assessments/${AID}/surveys/s2`]: counts,
  // Three pages of five, ordered by id (report.ts list): the newest by created_at sits on the last page under an early id.
  [`GET /v2/assessments/${AID}/reports`]: { reports: [1, 2, 3, 4, 5].map((n) => ({ id: `rep_0${n}`, created_at: `2026-10-0${n}T00:00:00Z` })), next_cursor: "c1" },
  [`GET /v2/assessments/${AID}/reports?cursor=c1`]: { reports: [6, 7, 8, 9].map((n) => ({ id: `rep_0${n}`, created_at: `2026-10-0${n}T00:00:00Z` })).concat([{ id: "rep_10", created_at: "2026-10-10T00:00:00Z" }]), next_cursor: "c2" },
  [`GET /v2/assessments/${AID}/reports?cursor=c2`]: { reports: [{ id: "rep_11", created_at: "2026-10-20T00:00:00Z" }], next_cursor: null },
  "GET /v2/reports/rep_11": { report: { id: "rep_11", created_at: "2026-10-20T00:00:00Z", payload } },
  ...over,
});

describe("report list paging (P1)", () => {
  it("reports() follows next_cursor until exhausted and the newest report is chosen by created_at, not by the first page's ids", async () => {
    serve(base());
    const r = await reports(AID);
    expect(r.reports).toHaveLength(11); expect(r.next_cursor).toBeNull();
    expect(calls.filter((c) => c.url.includes("/reports")).map((c) => c.url)).toEqual([`/v2/assessments/${AID}/reports`, `/v2/assessments/${AID}/reports?cursor=c1`, `/v2/assessments/${AID}/reports?cursor=c2`]);
    expect(newestReport(r.reports)?.id).toBe("rep_11");
    expect(newestReport([{ id: "a", created_at: "2026-01-02" }, { id: "b", created_at: "2026-01-03" }, { id: "c", created_at: "2026-01-01" }])?.id).toBe("b");
    expect(newestReport([])).toBeNull();
    const m = await resultsModel(AID);
    expect(m.reportId).toBe("rep_11"); expect(m.review.builtOn).toBe(shortDate("2026-10-20T00:00:00Z"));
  });
});

describe("resultsModel (P2: language, closure date, role flags)", () => {
  it("resolves language_id through the project's languages as Collect does, labels no created_at as a close date, and carries the role flags", async () => {
    serve(base());
    const m = await resultsModel(AID);
    expect(m.review.language).toBe("Kikuyu");
    expect(m.review.closed).toBe(""); expect(m.review.closedLong).toBe("");
    expect(m.canBuild).toBe(true); expect(m.canReadResponses).toBe(true); expect(m.canReopen).toBe(true); expect(m.review.canReadResponses).toBe(true);
    serve(base({ [`GET /v2/assessments/${AID}`]: assessment({ role: "viewer", language_name: "Gikuyu" }) }));
    const v = await resultsModel(AID);
    expect(v.review.language).toBe("Gikuyu"); expect(calls.some((c) => c.url.endsWith("/languages"))).toBe(false);
    expect(v.canBuild).toBe(false); expect(v.canReadResponses).toBe(false); expect(v.canReopen).toBe(false); expect(v.review.canReopen).toBe(false);
  });
  it("Results: a viewer gets no See the answers link (desktop cards) and a disabled button with its reason (phone); Results held: a viewer's Reopen collection is disabled with its reason, no See the answers so far", () => {
    const live = { review: { ...REPORT.desktop.review, closed: "", canReadResponses: false, canReopen: false }, counts: REPORT.desktop.counts, payload: REPORT.desktop.payload, gaps: REPORT.desktop.gaps, radar: REPORT.desktop.radar, lookNext: [] };
    const d = render(Results as never, { props: { report: live } }).container;
    expect(d.textContent).not.toContain("See the answers");
    expect(d.textContent).toContain("Collection closed"); expect(d.textContent).not.toMatch(/Closed\s+·/);
    const p = render(Results as never, { props: { report: live, phone: true } }).container;
    const b = [...p.querySelectorAll("button")].find((x) => x.textContent?.trim() === "See the answers") as HTMLButtonElement;
    expect(b.disabled).toBe(true); expect(p.querySelector(`#${b.getAttribute("aria-describedby")}`)?.textContent).toContain("Owners and members");
    expect(p.querySelector('a[href*="results-answers"]')).toBeNull();
    const ok = render(Results as never, { props: { report: { ...live, review: { ...live.review, canReadResponses: true } } } }).container;
    expect(ok.querySelectorAll('a[href*="results-answers"]').length).toBeGreaterThan(0);
    const held = { review: { ...REPORT.desktop.review, closed: "", canReadResponses: false, canReopen: false }, counts: { team: 2, community: 1, church: 0 }, payload: REPORT.desktop.payload, held: null };
    const h = render(ResultsHeld as never, { props: { report: held } }).container;
    const prim = h.querySelector(".btn-primary") as HTMLButtonElement;
    expect(prim.tagName).toBe("BUTTON"); expect(prim.disabled).toBe(true); expect(h.querySelector("#primary-why")?.textContent).toContain("owner or member");
    expect(h.querySelector('a[href*="share"]')).toBeNull();
    const hp = render(ResultsHeld as never, { props: { report: held, phone: true } }).container;
    expect((hp.querySelector(".phone-bar .btn-primary") as HTMLButtonElement).disabled).toBe(true); expect(hp.textContent).not.toContain("See the answers so far"); expect(hp.querySelector("#reopen-why")?.textContent).toContain("owner or member");
    const hm = render(ResultsHeld as never, { props: { report: { ...held, review: { ...held.review, canReopen: true, canReadResponses: true } } } }).container;
    expect(hm.querySelector("a.btn-primary")?.getAttribute("href")).toContain("share"); expect(hm.textContent).not.toContain("owner or member");
  });
});

describe("projectModel (P2: workspace, trend gaps, surfaced failures)", () => {
  const reviews = { assessments: [
    { id: "a1", name: "First", stage: "improve", created_at: "2026-08-01T00:00:00Z", role: "owner" },
    { id: "a2", name: "Second", stage: "understand", created_at: "2026-09-01T00:00:00Z", role: "owner" },
  ] };
  const two = { assessment: { id: "a1", project_id: PID, stage: "improve", role: "owner" }, surveys: [{ id: "s1", perspective: "Translation Team" }, { id: "s2", perspective: "Community" }] };
  const one = { assessment: { id: "a2", project_id: PID, stage: "understand", role: "owner" }, surveys: [{ id: "s1", perspective: "Translation Team" }] };
  const big = { survey: {}, counts: { responses: 6, respondents: 6 } };
  const routes = (over: Record<string, unknown> = {}) => ({
    "GET /v2/workspaces": { workspaces: [{ id: "ws_1", name: "Africa" }] },
    [`GET /v2/projects/${PID}`]: { project: { id: PID, name: "Kikuyu", workspace_id: null } },
    [`GET /v2/projects/${PID}/assessments`]: reviews,
    "GET /v2/assessments/a1": two, "GET /v2/assessments/a2": one,
    "GET /v2/assessments/a1/surveys/s1": big, "GET /v2/assessments/a1/surveys/s2": big, "GET /v2/assessments/a2/surveys/s1": big,
    "GET /v2/assessments/a1/reports": { reports: [{ id: "r1", created_at: "2026-08-02T00:00:00Z" }], next_cursor: null },
    "GET /v2/assessments/a2/reports": { reports: [{ id: "r2", created_at: "2026-09-02T00:00:00Z" }], next_cursor: null },
    "GET /v2/reports/r1": { report: { id: "r1", created_at: "2026-08-02T00:00:00Z", payload } },
    "GET /v2/reports/r2": { report: { id: "r2", created_at: "2026-09-02T00:00:00Z", payload: { lenses: [payload.lenses[0]] } } },
    ...over,
  });
  it("a project with workspace_id null is not shown under the first workspace; a lens a review never surveyed is a null trend point, which the Project chart skips", async () => {
    serve(routes());
    const m = await projectModel(PID);
    expect(m.workspace.name).toBe("No workspace");
    expect(m.trend.lines.team).toEqual(["strong", "strong"]);
    expect(m.trend.lines.community).toEqual(["support", null]);
    const a = render(Project as never, { props: { data: m } }).container;
    const team = a.querySelectorAll('circle[data-lens="team"]').length; // the chart may be drawn once per layout; the gap is one point fewer per drawing
    expect(team).toBeGreaterThan(0);
    expect(a.querySelectorAll('circle[data-lens="community"]').length).toBeLessThan(team);
    expect(a.querySelectorAll('polyline[data-lens="community"]').length).toBe(a.querySelectorAll('polyline[data-lens="team"]').length);
    serve(routes({ [`GET /v2/projects/${PID}`]: { project: { id: PID, name: "Kikuyu", workspace_id: "ws_1" } } }));
    expect((await projectModel(PID)).workspace.name).toBe("Africa");
    // The fixture still draws; a line with an inner gap draws two runs.
    const gap = { ...projectFixture, trend: { ...projectFixture.trend, lines: { ...projectFixture.trend.lines, church: ["strong", null, "growing", "support"] } } };
    const g = render(Project as never, { props: { data: gap } }).container;
    expect(g.querySelectorAll('polyline[data-lens="church"]').length).toBe(2);
    expect(g.querySelectorAll('circle[data-lens="church"]').length).toBe(4); // three points plus the legend dot;
  });
  it("Codex P1/P2 on 992b610: levels rest on the report's own evidence counts, and each summary level carries its count beside it", async () => {
    useLevelMinimum(1); // DEV: the direct levelsOf calls below band at the DEV level minimum
    // a report built from 1 team and 2 community responses; the live surveys now read 6 each
    const snap = { ...payload, evidence: [{ label: "Translation Team — Translators", n: 1 }, { label: "Community — Community", n: 2 }] };
    expect(respondentsOf(snap, { team: 6, community: 6 })).toEqual({ team: 1, community: 2 });
    expect(respondentsOf(payload, { team: 6, community: 6 })).toEqual({ team: 6, community: 6 }); // no evidence n: the live count stands in
    expect(levelsOf({ ...snap, evidence: [{ label: "Translation Team — Translators", n: 0 }, { label: "Community — Community", n: 2 }] }, { team: 6, community: 6 })).toEqual({ team: "more", community: "support" });
    expect(levelTriples({ team: { score: 80, responses: 2 }, church: { score: 50, responses: 0 } })).toEqual([["team", "strong", 2], ["church", "more", 0]]);
    // DEV serves level_minimum_responses 1 on each reported review's results read
    const dev = { "GET /v2/assessments/a1/results": { status: "held", level_minimum_responses: 1 }, "GET /v2/assessments/a2/results": { status: "held", level_minimum_responses: 1 } };
    serve(routes({ ...dev, "GET /v2/reports/r1": { report: { id: "r1", created_at: "2026-08-02T00:00:00Z", payload: snap } } }));
    const m = await projectModel(PID);
    expect(m.reviews.find((r: { id: string }) => r.id === "a1").levels).toEqual([["team", "strong", 1], ["community", "support", 2]]);
    expect(m.reviews.find((r: { id: string }) => r.id === "a2").levels).toEqual([["team", "strong", 6]]);
    const a = render(Project as never, { props: { data: m } }).container;
    const first = [...a.querySelectorAll("a.su-rev")].find((x) => x.querySelector(".h3")?.textContent === "First")!; // newest first: a1 is the second card
    expect([...first.querySelectorAll(".lvl-pair [data-coverage] [data-short]")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())).toEqual(["A few drops · 1", "A few drops · 2"]);
    expect(first.querySelector("[data-coverage]")!.getAttribute("title")).toBe("A few drops · 1 response");
  });
  it("Codex P2 4381562605: a perspective the review sent out but the built report has no lens for shows at More input needed with 0", async () => {
    useLevelMinimum(1);
    const dev = { "GET /v2/assessments/a1/results": { status: "held", level_minimum_responses: 1 }, "GET /v2/assessments/a2/results": { status: "held", level_minimum_responses: 1 } };
    const teamOnly = { lenses: [payload.lenses[0]], cross_lens_multi: [], evidence: [{ label: "Translation Team — Translators", n: 1 }] };
    serve(routes({ ...dev, "GET /v2/reports/r1": { report: { id: "r1", created_at: "2026-08-02T00:00:00Z", payload: teamOnly } } }));
    const m = await projectModel(PID);
    expect(m.reviews.find((r: { id: string }) => r.id === "a1").levels).toEqual([["team", "strong", 1], ["community", "more", 0]]); // a1 sent team + community
    expect(m.reviews.find((r: { id: string }) => r.id === "a2").levels).toEqual([["team", "strong", 6]]); // a2 sent team only: nothing added
  });
  it("level minimum from the server: production-like (3) holds a level at 1 or 2 responses; DEV (1) shows it; absent is the safe 3", async () => {
    const snap = { ...payload, evidence: [{ label: "Translation Team — Translators", n: 1 }, { label: "Community — Community", n: 2 }] };
    const at = (min: unknown) => ({ "GET /v2/assessments/a1/results": { status: "held", ...(min === undefined ? {} : { level_minimum_responses: min }) }, "GET /v2/assessments/a2/results": { status: "held", ...(min === undefined ? {} : { level_minimum_responses: min }) }, "GET /v2/reports/r1": { report: { id: "r1", created_at: "2026-08-02T00:00:00Z", payload: snap } } });
    const first = async () => (await projectModel(PID)).reviews.find((r: { id: string }) => r.id === "a1").levels;
    serve(routes(at(3)));
    expect(await first()).toEqual([["team", "more", 1], ["community", "more", 2]]);
    serve(routes(at(1)));
    expect(await first()).toEqual([["team", "strong", 1], ["community", "support", 2]]);
    serve(routes(at(undefined)));
    expect(await first()).toEqual([["team", "more", 1], ["community", "more", 2]]);
    serve(routes(at("1"))); // not a whole number: the safe 3
    expect(await first()).toEqual([["team", "more", 1], ["community", "more", 2]]);
    serve(routes({ ...at(1), "GET /v2/assessments/a2/results": new Error("results down") })); // one review unread: the strictest, 3
    expect(await first()).toEqual([["team", "more", 1], ["community", "more", 2]]);
  });
  it("a review's report list or count failing to read rejects the model (the shell's retryable error), never a review without levels", async () => {
    serve(routes({ "GET /v2/assessments/a2/reports": new Error("list down") }));
    await expect(projectModel(PID)).rejects.toThrow("list down");
    serve(routes({ "GET /v2/assessments/a1/surveys/s2": new Error("count down") }));
    await expect(projectModel(PID)).rejects.toThrow("count down");
  });
});

describe("Setup 5 launch (P2)", () => {
  it("setupModel says why a launch is blocked (viewer role, no surveys) and Setup5 draws a disabled primary with the reason instead of a link to Collect", async () => {
    const prep = (over: Record<string, unknown>, surveys: unknown[]) => ({
      [`GET /v2/assessments/${AID}`]: { assessment: { id: AID, project_id: PID, name: "Mark 1–4", stage: "prepare", format: "written", role: "owner", created_at: "2026-10-01T00:00:00Z", ...over }, surveys },
      [`GET /v2/projects/${PID}`]: { project: { id: PID, name: "Kikuyu" } },
      [`GET /v2/assessments/${AID}/passages`]: { passages: [] },
      [`GET /v2/assessments/${AID}/surveys/s1`]: counts,
    });
    serve(prep({ role: "viewer" }, [{ id: "s1", perspective: "Translation Team", template_name: "Translators" }]));
    const viewer = await setupModel(AID);
    expect(viewer.canLaunch).toBe(false); expect(viewer.launchBlocked).toMatch(/owner or member/);
    serve(prep({}, []));
    const none = await setupModel(AID);
    expect(none.canLaunch).toBe(false); expect(none.launchBlocked).toMatch(/at least one survey/);
    serve(prep({}, [{ id: "s1", perspective: "Translation Team", template_name: "Translators" }]));
    const ok = await setupModel(AID);
    expect(ok.canLaunch).toBe(true); expect(ok.launchBlocked).toBe("");
    for (const phone of [false, true]) {
      const a = render(Setup5 as never, { props: { data: viewer, phone } }).container;
      const prim = a.querySelector(".btn-primary") as HTMLButtonElement;
      expect(prim.tagName).toBe("BUTTON"); expect(prim.disabled).toBe(true); expect(prim.textContent).toContain("Launch the survey");
      expect(a.querySelector(`#${prim.getAttribute("aria-describedby")}`)?.textContent).toMatch(/owner or member/);
      expect(a.querySelector('a[href*="collect"]')).toBeNull();
      const live = render(Setup5 as never, { props: { data: ok, phone } }).container;
      expect(live.querySelector(".btn-primary")?.tagName).toBe("A");
    }
    expect(render(Setup5 as never, { props: { data: setupFixture } }).container.querySelector(".btn-primary")?.tagName).toBe("A"); // the fixture: unchanged
  });
});

describe("report build confirm (P1: Live.svelte)", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  it("Build the report and Refresh with new answers run the dry run, show the response count and build only after Build the results; Not now builds nothing", async () => {
    let executed = 0;
    const post = (_u: string, body: { mode: string; confirm_token?: string }) => {
      if (body.mode === "dry_run") return { assessment_id: AID, suppressed: false, status: "ready", confirm_token: "tok_1", expires_in: 60 };
      executed++; expect(body.confirm_token).toBe("tok_1"); return { assessment_id: AID, suppressed: false, report: { id: "rep_new", created_at: "2026-10-21T00:00:00Z", payload } };
    };
    // No report yet: the not-built page offers Build the report.
    serve(base({ [`GET /v2/assessments/${AID}/reports`]: { reports: [], next_cursor: null }, [`POST /v2/assessments/${AID}/reports`]: post }));
    globalThis.location.hash = to("results", { aid: AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(a.textContent).toContain("No report has been built"));
    const trigger = [...a.querySelectorAll("button")].find((b) => b.textContent === "Build the report")!;
    // live QA N1: the action and its confirm sit inside the signed-in shell (.app with its top bar), never after it
    expect(trigger.closest(".app")).not.toBeNull(); expect(a.querySelector(".app header.top")).not.toBeNull();
    await fireEvent.click(trigger);
    await waitFor(() => expect(a.querySelector("[data-confirm-text]")).not.toBeNull());
    expect(a.querySelector("[data-confirm-report]")!.closest(".app main")).not.toBeNull();
    expect(a.querySelector("[data-confirm-text]")!.textContent).toBe("Build results from 8 responses? Everyone with access can see them.");
    expect(calls.filter((c) => c.method === "POST").map((c) => (c.body as { mode: string }).mode)).toEqual(["dry_run"]);
    expect(executed).toBe(0);
    expect(a.querySelectorAll(".btn-primary").length).toBe(1); // the confirm takes the page's one primary; the trigger is gone
    await fireEvent.click(a.querySelector("[data-cancel-report]")!);
    await flush();
    expect(a.querySelector("[data-confirm-text]")).toBeNull(); expect(executed).toBe(0);
    expect(a.textContent).toContain("Cancelled. Nothing was built.");
    await fireEvent.click([...a.querySelectorAll("button")].find((b) => b.textContent === "Build the report")!);
    await waitFor(() => expect(a.querySelector("[data-confirm-report]")).not.toBeNull());
    // The built report is read back on the reload.
    (globalThis.fetch as unknown as { routes?: unknown }); serve(base({ [`GET /v2/assessments/${AID}/reports`]: { reports: [{ id: "rep_new", created_at: "2026-10-21T00:00:00Z" }], next_cursor: null }, "GET /v2/reports/rep_new": { report: { id: "rep_new", created_at: "2026-10-21T00:00:00Z", payload } }, [`POST /v2/assessments/${AID}/reports`]: post }));
    await fireEvent.click(a.querySelector("[data-confirm-report]")!);
    await waitFor(() => expect(executed).toBe(1));
    await waitFor(() => expect(a.textContent).toContain("Refresh with new answers"));
    // Refresh with new answers: the same preview → confirm → execute; nothing is built before the confirm.
    await fireEvent.click([...a.querySelectorAll("button")].find((b) => b.textContent?.includes("Refresh with new answers"))!);
    await waitFor(() => expect(a.querySelector("[data-confirm-text]")).not.toBeNull());
    expect(executed).toBe(1);
    expect(a.querySelector("[data-confirm-report]")!.classList.contains("btn-primary")).toBe(false); // Results keeps its one primary (Plan the next step)
    expect(a.querySelector("[data-confirm-report]")!.closest(".app main")).not.toBeNull(); // the refresh confirm is drawn inside Results' shell
    await fireEvent.click(a.querySelector("[data-confirm-report]")!);
    await waitFor(() => expect(executed).toBe(2));
  });
  it("a held dry run builds nothing and says so", async () => {
    serve(base({ [`GET /v2/assessments/${AID}/reports`]: { reports: [], next_cursor: null }, [`POST /v2/assessments/${AID}/reports`]: () => ({ assessment_id: AID, suppressed: true, status: "held", responses_in: 2, responses_needed: 3 }) }));
    globalThis.location.hash = to("results", { aid: AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(a.textContent).toContain("No report has been built"));
    await fireEvent.click([...a.querySelectorAll("button")].find((b) => b.textContent === "Build the report")!);
    await waitFor(() => expect(a.textContent).toContain("can’t be built yet"));
    expect(a.querySelector("[data-confirm-text]")).toBeNull();
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });
});

describe("the served level minimum reaches Help, Explore and the detailed report (Codex P2s on 5d3633e)", () => {
  const faqNeed = (el: Element) => [...el.querySelectorAll("details .disc-body, .disc-body")].map((d) => d.textContent ?? "").find((t) => t.startsWith("A perspective shows its level")) ?? "";
  it("Help: a fresh DEV session reads level_minimum_responses from /v2/me before the page and says 1; without it, the safe 3", async () => {
    useLevelMinimum(undefined);
    serve({ "GET /v2/me": { principal: { id: "p1", display_name: "Kay" }, grants: [], level_minimum_responses: 1 } });
    await sessionMe();
    expect(currentLevelMin()).toBe(1);
    expect(faqNeed(render(Help as never, { props: {} }).container)).toContain("from its first answer");
    forget(); serve({ "GET /v2/me": { principal: { id: "p1", display_name: "Kay" }, grants: [] } });
    await sessionMe();
    expect(currentLevelMin()).toBe(3);
    expect(faqNeed(render(Help as never, { props: {} }).container)).toContain("once it has at least 3 answers");
  });
  it("Codex P2 4381912241: a cached /v2/me re-applies its policy; a failed or malformed per-review read never overwrites it", async () => {
    serve({ "GET /v2/me": { principal: { id: "p1", display_name: "Kay" }, grants: [], level_minimum_responses: 1 } });
    await sessionMe();
    useLevelMinimum(3); // a later per-review read served 3 (another environment's value cannot occur; this only proves the re-apply)
    await sessionMe(); // cache hit
    expect(currentLevelMin()).toBe(1);
    for (const bad of [undefined, null, "1", 0, 2.5]) { useLevelMinimum(bad); expect(currentLevelMin()).toBe(1); } // failed / malformed read
    // a results read that fails keeps the session's 1 (resultsModel: res is { error })
    serve({ ...base({ [`GET /v2/assessments/${AID}/results`]: new Error("results down") }), "GET /v2/me": { principal: { id: "p1" }, grants: [], level_minimum_responses: 1 } });
    await resultsModel(AID);
    expect(currentLevelMin()).toBe(1);
    forget(); // a forgotten session leaves no policy: the safe 3 until a value is served again
    useLevelMinimum(undefined);
    expect(currentLevelMin()).toBe(3);
  });
  it("Explore bands with the served cut-off, as Results and Project do: 2 responses show a level on DEV, are held at 3 or unread", async () => {
    const snap = { lenses: [{ lens: "Translation Team", score: 80, sub_dimensions: [] }], cross_lens_multi: [], evidence: [{ label: "Translation Team — Translators", n: 2 }] };
    const routes = (min: unknown) => ({
      "GET /v2/projects": { projects: [{ id: PID, name: "Kikuyu" }] }, "GET /v2/workspaces": { workspaces: [] },
      [`GET /v2/projects/${PID}/assessments`]: { assessments: [{ id: "a1", name: "First", stage: "understand", created_at: "2026-08-01T00:00:00Z", language_name: "Kikuyu" }] },
      "GET /v2/assessments/a1": { assessment: { id: "a1", project_id: PID, stage: "understand", role: "owner" }, surveys: [{ id: "s1", perspective: "Translation Team" }] },
      "GET /v2/assessments/a1/surveys/s1": { survey: {}, counts: { responses: 2, respondents: 2 } },
      "GET /v2/assessments/a1/results": { status: "held", ...(min === undefined ? {} : { level_minimum_responses: min }) },
      "GET /v2/assessments/a1/reports": { reports: [{ id: "r1", created_at: "2026-08-02T00:00:00Z" }], next_cursor: null },
      "GET /v2/reports/r1": { report: { id: "r1", created_at: "2026-08-02T00:00:00Z", payload: snap } },
    });
    const team = async (min: unknown) => { serve(routes(min)); const m = await exploreModel({ principal: { id: "p1", display_name: "Kay" }, grants: [] }); return [m.levelMinimum, exploreRows(m.reviews)[0].levels.team]; };
    expect(await team(1)).toEqual([1, "strong"]);
    expect(await team(3)).toEqual([3, "more"]);
    expect(await team(undefined)).toEqual([3, "more"]);
  });
  it("detailed report: \"How to read the scores\" names the minimum in force (DEV 1: no answers; otherwise fewer than 3); the drops … show", () => {
    useLevelMinimum(1);
    expect(render(ReportDetailed as never, { props: {} }).container.textContent).toContain("A perspective with no answers shows More input needed and no score; the drops beside each perspective show how many answered");
    useLevelMinimum(3);
    expect(render(ReportDetailed as never, { props: {} }).container.textContent).toContain("A perspective with fewer than 3 answers shows More input needed and no score; the drops beside each perspective show how many answered");
    useLevelMinimum(undefined);
  });
});

describe("Codex P2 4382475727: the results summary is a hold only with its low-count fields", () => {
  it("DEV, one response, no built report: a member sees Not built yet with Build; a viewer sees the honest not-built state, not 'needs more answers'", async () => {
    const noReports = { [`GET /v2/assessments/${AID}/reports`]: { reports: [], next_cursor: null }, [`GET /v2/assessments/${AID}/results`]: { status: "held", suppressed: true, level_minimum_responses: 1, report_build_allowed: true } };
    for (const role of ["owner", "viewer"]) {
      serve(base({ ...noReports, [`GET /v2/assessments/${AID}`]: assessment({ role }) }));
      const m = await resultsModel(AID);
      expect(m.held).toBeNull();
      globalThis.location.hash = to("results", { aid: AID });
      const a = render(Live as never, { props: {} }).container;
      await waitFor(() => expect(a.textContent).toContain("Not built yet"));
      expect(a.textContent).not.toMatch(/Results are held|needs \d+ more|more answers/);
      expect(!![...a.querySelectorAll("button")].find((b) => b.textContent === "Build the report")).toBe(role === "owner");
      if (role === "viewer") expect(a.textContent).toContain("An owner or member of the review builds it.");
    }
    // below the server minimum the summary carries its low-count fields: the hold applies to every role, members included
    // (Codex P2 4382607192: a member below the floor is never offered a Build that can only fail)
    const below = { status: "held", report_build_allowed: false, responses_in: 0, responses_needed: 1, reason: "0 responses so far; at least 1 is needed before any score is shown. Scores are held until then." };
    for (const role of ["viewer", "owner", "member"]) {
      serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: below, [`GET /v2/assessments/${AID}`]: assessment({ role }) }));
      expect((await resultsModel(AID)).held).toMatchObject({ responses_needed: 1 });
    }
    serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: below, [`GET /v2/assessments/${AID}`]: assessment({ role: "owner" }) }));
    globalThis.location.hash = to("results", { aid: AID });
    const held = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(held.textContent).toContain("Results are held"));
    expect(held.textContent).toContain("0 of 1 responses so far");
    expect([...held.querySelectorAll("button")].find((b) => b.textContent === "Build the report")).toBeUndefined();
  });
});

describe("live QA Q4: a live report's Where to look next and What stands out come from its own levels and gaps", () => {
  it("fills both on the overview from the built report, with no store and no invented judgement", async () => {
    const snap = { lenses: [{ lens: "Translation Team", score: 80, sub_dimensions: [{ sub_dimension: "External review", score: 30 }, { sub_dimension: "Brief", score: 85 }] }, { lens: "Community", score: 45, sub_dimensions: [{ sub_dimension: "Understandable", score: 20 }] }],
      cross_lens_multi: [{ construct_name: "Clarity", agreement_range: 60, lens_scores: [{ lens: "Translation Team", score: 85 }, { lens: "Community", score: 20 }] }],
      evidence: [{ label: "Translation Team — Translators", n: 4 }, { label: "Community — Community", n: 4 }] };
    serve(base({ "GET /v2/reports/rep_11": { report: { id: "rep_11", created_at: "2026-10-20T00:00:00Z", payload: snap } } }));
    useLevelMinimum(1);
    globalThis.location.hash = to("report", { aid: AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(a.textContent).toContain("Where to look next"));
    const items = [...a.querySelectorAll(".paper ol li")].map((l) => (l.textContent ?? "").trim());
    expect(items).toEqual(["Translation team · External review — Needs urgent attention", "Community · Understandable — Needs urgent attention"]); // urgent first, perspective order
    const stands = [...a.querySelectorAll(".paper [role=heading][aria-level='2']")].find((h) => h.textContent === "What stands out")!.nextElementSibling!.textContent;
    expect(stands).toBe("Overall: Translation team strong, Community needs support. The perspectives are furthest apart on Clarity (Translation team strong, Community needs urgent attention).");
    // no weak area: the section says so instead of an empty list
    const strong = { ...snap, lenses: snap.lenses.map((l) => ({ ...l, sub_dimensions: l.sub_dimensions.map((x) => ({ ...x, score: 90 })) })) };
    serve(base({ "GET /v2/reports/rep_11": { report: { id: "rep_11", created_at: "2026-10-20T00:00:00Z", payload: strong } } }));
    const b = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(b.textContent).toContain("No area reads Needs support or Needs urgent attention."));
    useLevelMinimum(undefined);
  });
});

describe("final batch: report totals from the snapshot, held lines from the sent set (Codex P1 4381767661, P2 4381767676)", () => {
  it("resultsModel: a built report's total is the sum of its snapshot counts; the live total is kept apart for the newer notice", async () => {
    // the report used 2 team + 1 community responses; the live surveys now hold 4 responses each
    const snap = { ...payload, evidence: [{ label: "Translation Team — Translators", n: 2 }, { label: "Community — Community", n: 1 }] };
    serve(base({ "GET /v2/reports/rep_11": { report: { id: "rep_11", created_at: "2026-10-20T00:00:00Z", payload: snap } } }));
    const m = await resultsModel(AID);
    expect([m.review.responses, m.review.liveResponses]).toEqual([3, 8]);
    const R = { ...m, gaps: { biggest: [], agree: [] }, radar: [], lookNext: [] };
    const res = render(Results as never, { props: { report: R } }).container;
    expect(res.textContent).toContain("from 3 responses.");
    expect(res.textContent).toContain("newer response"); // the live total only drives the newer notice
    for (const C of [Report, ReportDetailed]) {
      const t = render(C as never, { props: { report: R } }).container.textContent ?? "";
      expect(t).toContain("· 3 responses"); expect(t).toContain("Built from 3 responses"); expect(t).not.toMatch(/\b8 responses/);
    }
  });
  it("ResultsHeld: the held lines and the phone's first perspective come from report.sent, so a sent perspective at 0 shows with no payload; never an unsent one", () => {
    const review = { ...REPORT.desktop.review, closed: "", canReadResponses: true, canReopen: true, responses: 3 };
    const held = { review, counts: { team: 3, community: 0, church: 0 }, sent: ["team", "church"], payload: { lenses: [] }, held: null };
    useLevelMinimum(1);
    const d = render(ResultsHeld as never, { props: { report: held } }).container;
    const lines = [...d.querySelectorAll(".held-lines .small")].map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(lines).toEqual(["Translation team 3 — ready", "Church 0 — needs 1 more"]);
    expect(d.textContent).toContain("Church has 0 of 1."); expect(d.textContent).not.toContain("Community");
    const p = render(ResultsHeld as never, { props: { report: held, phone: true } }).container;
    expect(p.textContent).toContain("The church survey has 0 answers");
    // only team sent and ready: the first is team, never the unsent community or church
    const ready = render(ResultsHeld as never, { props: { report: { ...held, sent: ["team"] }, phone: true } }).container;
    expect(ready.textContent).toContain("The translation team survey has 3 answers"); expect(ready.textContent).not.toMatch(/church|community/i);
    useLevelMinimum(undefined);
  });
});

describe("Codex P2s on ed291878: the report readers' payload and the stands-out claim", () => {
  type Sub = { sub_dimension: string; score: number | null };
  type M = { review: unknown; counts: Record<string, number>; sent?: string[]; payload: { lenses: { lens: string; sub_dimensions?: Sub[] }[]; cross_lens_multi: unknown[] } };
  const fromFixture = (): M => { const f = JSON.parse(JSON.stringify(REPORT.desktop)); return { review: f.review, counts: f.counts, payload: f.payload }; };
  it("4383033516: overview and detailed read the full snapshot at phone width; only phone Results gets the compact cards", () => {
    useLevelMinimum(1);
    const m = fromFixture(), full = m.payload.lenses[0].sub_dimensions as Sub[];
    expect(full.length).toBeGreaterThan(2);
    for (const screen of ["report", "report-detailed", "results-gaps", "results-answers"]) expect(liveReport(m, { phone: true, screen }).payload).toBe(m.payload);
    expect(liveReport(m, { phone: false, screen: "results" }).payload).toBe(m.payload);
    const compact = liveReport(m, { phone: true, screen: "results" }).payload.lenses[0].sub_dimensions as Sub[];
    // Codex P2 4383599311: the strongest and the weakest SCORED area; Governance (null) is never the weakest
    expect(compact.map((x) => x.sub_dimension)).toEqual(["Translation process & brief", "External review"]);
    // the derived claims are the same at both widths, from the full snapshot
    expect(liveReport(m, { phone: true, screen: "results" }).lookNext).toEqual(liveReport(m, { phone: false, screen: "results" }).lookNext);
    expect(liveReport(m, { phone: true, screen: "report" }).standsOut).toBe(liveReport(m, { phone: false, screen: "report" }).standsOut);
    // the phone evidence sheet ("Every area, with evidence") draws a middle area the compact payload would drop
    const el = render(ReportDetailed as never, { props: { phone: true, report: liveReport(m, { phone: true, screen: "report-detailed" }) } }).container;
    expect(el.textContent).toContain("Every area, with evidence");
    expect(el.textContent).toContain("Understanding the source");
    useLevelMinimum(undefined);
  });
  it("4383033523: What stands out uses gapRows' post-suppression order; a hidden low-count perspective neither picks nor leaks", () => {
    useLevelMinimum(3); // outside DEV: church has 1 answer, so its scores are suppressed
    const area = (name: string, team: number, community: number, church: number) => ({ construct_name: name, question: `${name}?`,
      agreement_range: Math.max(team, community, church) - Math.min(team, community, church),
      lens_scores: [{ lens: "team", score: team }, { lens: "community", score: community }, { lens: "church", score: church }] });
    const m: M = { review: { title: "R" }, counts: { team: 6, community: 8, church: 1 }, payload: {
      lenses: [{ lens: "team", score: 70, sub_dimensions: [] }, { lens: "community", score: 60, sub_dimensions: [] }, { lens: "church", score: 20, sub_dimensions: [] }],
      cross_lens_multi: [area("Hidden swing", 70, 72, 5), area("Raw two", 60, 62, 10), area("Raw three", 50, 52, 95), area("Visible gap", 80, 45, 50), area("Quiet", 66, 68, 64)] } };
    // the raw agreement_range top three are all chosen by the hidden church score, and miss the gap the shown perspectives have
    expect(gapsOf(m.payload).biggest).toEqual(["Hidden swing", "Raw two", "Raw three"]);
    const said = liveReport(m, { phone: false, screen: "report" }).standsOut as string;
    const gap = said.slice(said.indexOf("furthest apart"));
    expect(said).toContain("furthest apart on Visible gap (Translation team strong, Community needs support).");
    expect(gap).not.toMatch(/church|hidden swing|raw two|raw three|\b(5|10|95|50)\b/i);
    expect(said).not.toMatch(/hidden swing|raw two|raw three/i);
    expect(liveReport(m, { phone: true, screen: "report" }).standsOut).toBe(said);
    useLevelMinimum(undefined);
  });
});

describe("Codex P2 4383266687: Build is offered only on the server's report_build_allowed", () => {
  const noReports = { [`GET /v2/assessments/${AID}/reports`]: { reports: [], next_cursor: null } };
  const buildButton = (el: Element) => [...el.querySelectorAll("button")].find((b) => b.textContent === "Build the report");
  it("flag off with 5 or more responses: no Build, and the hold says reports aren't available here, not 'more answers'", async () => {
    // production without PARTICIPANT_REPORTS (or an unknown environment): no low-count fields, and the server says no build
    serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: { status: "held", suppressed: true, level_minimum_responses: 3, report_build_allowed: false, report_hold_reason: "environment" } }));
    const m = await resultsModel(AID);
    expect(m.review.responses).toBeGreaterThanOrEqual(5);
    expect(m.held).toMatchObject({ unavailable: true });
    globalThis.location.hash = to("results", { aid: AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(a.textContent).toContain("Reports aren’t available here"));
    expect(a.textContent).toContain("this environment doesn’t build reports from participant answers");
    expect(a.textContent).not.toMatch(/Not built yet|needs \d+ more|more answers are needed|has enough answers/);
    expect(buildButton(a)).toBeUndefined();
  });
  it("DEV eligible: report_build_allowed true offers a member Build", async () => {
    serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: { status: "held", suppressed: true, level_minimum_responses: 1, report_build_allowed: true } }));
    expect((await resultsModel(AID)).held).toBeNull();
    globalThis.location.hash = to("results", { aid: AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(a.textContent).toContain("Not built yet"));
    expect(buildButton(a)).toBeDefined();
  });
  it("the field absent (an older server, or a failed read): no Build", async () => {
    for (const res of [{ status: "held", suppressed: true, level_minimum_responses: 1 }, new Error("results down")]) {
      serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: res }));
      expect((await resultsModel(AID)).held).toMatchObject({ unavailable: true });
      globalThis.location.hash = to("results", { aid: AID });
      const a = render(Live as never, { props: {} }).container;
      await waitFor(() => expect(a.textContent).toContain("Reports aren’t available here"));
      expect(a.textContent).toContain("the server didn’t confirm that a report can be built");
      expect(buildButton(a)).toBeUndefined();
    }
  });
});

describe("Codex P2 4383599311: the phone cards' strongest and weakest are scored areas only", () => {
  it("null, blank and non-numeric scores (the fixture's Governance and Impact observation) are never the weakest", () => {
    const f = JSON.parse(JSON.stringify(REPORT.desktop));
    const nulls = f.payload.lenses.flatMap((l: { lens: string; sub_dimensions: { sub_dimension: string; score: unknown }[] }) => l.sub_dimensions.filter((x) => x.score === null).map((x) => x.sub_dimension));
    expect(nulls).toEqual(expect.arrayContaining(["Governance", "Impact observation"]));
    const pick = (p: unknown) => (phonePayload(p).lenses as { lens: string; sub_dimensions: { sub_dimension: string; score: unknown }[] }[]).map((l) => [l.lens, l.sub_dimensions.map((x) => x.sub_dimension)]);
    for (const [, names] of pick(f.payload)) expect(names).not.toContain("Governance"), expect(names).not.toContain("Impact observation");
    expect(pick(f.payload)[0]).toEqual(["team", ["Translation process & brief", "External review"]]);
    // a blank or non-numeric score is unscored too; a numeric string still counts
    f.payload.lenses[0].sub_dimensions[2].score = " "; f.payload.lenses[0].sub_dimensions[3].score = "41";
    expect(pick(f.payload)[0]).toEqual(["team", ["Translation process & brief", "Consistency"]]);
  });
});

describe("Codex P2 4383751986: the hold copy follows the server's report_hold_reason", () => {
  const noReports = { [`GET /v2/assessments/${AID}/reports`]: { reports: [], next_cursor: null } };
  const buildButton = (el: Element) => [...el.querySelectorAll("button")].find((b) => b.textContent === "Build the report");
  const open = async (results: unknown, role = "owner") => {
    serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: results, [`GET /v2/assessments/${AID}`]: assessment({ role }) }));
    globalThis.location.hash = to("results", { aid: AID });
    return render(Live as never, { props: {} }).container;
  };
  it("environment: reports aren't available here, never the count ask, even with the count fields present", async () => {
    const res = { status: "held", report_build_allowed: false, report_hold_reason: "environment", responses_in: 3, responses_needed: 5, reason: "3 responses so far; at least 5 are needed before any score is shown. Scores are held until then." };
    serve(base({ ...noReports, [`GET /v2/assessments/${AID}/results`]: res }));
    expect((await resultsModel(AID)).held).toMatchObject({ unavailable: true });
    const a = await open(res);
    await waitFor(() => expect(a.textContent).toContain("Reports aren’t available here"));
    expect(a.textContent).toContain("more answers won’t change that");
    expect(a.textContent).not.toMatch(/3 of 5|at least 5|more answers are needed|responses so far/);
    expect(buildButton(a)).toBeUndefined();
  });
  it("count: the count copy with the server's numbers, no Build", async () => {
    const a = await open({ status: "held", report_build_allowed: false, report_hold_reason: "count", responses_in: 0, responses_needed: 1, reason: "0 responses so far; at least 1 is needed before any score is shown. Scores are held until then." });
    await waitFor(() => expect(a.textContent).toContain("0 of 1 responses so far"));
    expect(a.textContent).not.toContain("Reports aren’t available here");
    expect(buildButton(a)).toBeUndefined();
  });
  it("null with allowed: Build for a member; the not-built line for a viewer", async () => {
    const ok = { status: "held", report_build_allowed: true, report_hold_reason: null, level_minimum_responses: 1 };
    const m = await open(ok, "member");
    await waitFor(() => expect(m.textContent).toContain("Not built yet"));
    expect(buildButton(m)).toBeDefined();
    const v = await open(ok, "viewer");
    await waitFor(() => expect(v.textContent).toContain("An owner or member of the review builds it."));
    expect(buildButton(v)).toBeUndefined();
  });
  it("a held preview under the environment reason never asks for more answers", async () => {
    // @ts-expect-error -- plain .js module
    const { heldBuildText } = await import("../ui-next/src/app/data.js");
    const preview = { suppressed: true, status: "held", responses_in: 3, responses_needed: 5 };
    expect(heldBuildText(preview, "Nothing was built.", "environment")).toBe("The results can’t be built here: reports aren’t available in this environment. Nothing was built.");
    expect(heldBuildText(preview, "Nothing was built.", "count")).toBe("The results can’t be built yet: more answers are needed. Nothing was built.");
  });
});
