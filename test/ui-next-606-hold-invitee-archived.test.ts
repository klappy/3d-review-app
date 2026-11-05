// @vitest-environment jsdom
// HOLD follow-ups from https://github.com/klappy/3d-review-app/pull/606#pullrequestreview-5789010549
// and https://github.com/klappy/3d-review-app/pull/606#discussion_r4482885347:
// P1 assessment-only invitees get a limited parent-project entry; P2 archived reviews are discoverable inside the opened Project.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { homeModel, projectModel } from "../ui-next/src/app/data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { forget } from "../ui-next/src/app/session.js";
import Home from "../ui-next/src/screens/Home.svelte";
import Project from "../ui-next/src/screens/setup/Project.svelte";
import projectFixture from "../ui-next/fixtures/setup/project.json";

const PID = "proj_shared";
const SIBLING = "asm_sibling";
const MINE = "asm_mine";
const ARCHIVED = "asm_archived";
const meInvitee = {
  principal: { id: "u_invitee", display_name: "Ivy Invitee", access_mode: "my" },
  grants: [{ scope_type: "assessment", scope_id: MINE, role: "viewer" }, { scope_type: "assessment", scope_id: ARCHIVED, role: "viewer" }],
};
const meOwner = {
  principal: { id: "u_owner", display_name: "Owen Owner", access_mode: "my" },
  grants: [{ scope_type: "project", scope_id: PID, role: "owner" }],
};
const calls: string[] = [];
const realFetch = globalThis.fetch;
const serve = (routes: Record<string, unknown>, statusFor: Record<string, number> = {}) => {
  calls.length = 0;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${String(url).split("?")[0]}`;
    calls.push(key);
    if (statusFor[key]) {
      return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE", message: "not visible" } }), { status: statusFor[key], headers: { "content-type": "application/json" } });
    }
    const r = routes[key];
    if (r === undefined) return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: `no route ${url}` } }), { status: 404 });
    return new Response(JSON.stringify({ ok: true, result: r }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
};
afterEach(() => { globalThis.fetch = realFetch; forget(); vi.restoreAllMocks(); });

describe("P1: assessment-only invitee limited project entry", () => {
  it("homeModel shows a limited parent-project card from assessment grants when /v2/projects is empty", async () => {
    serve({
      "GET /v2/projects": { projects: [] },
      "GET /v2/workspaces": { workspaces: [] },
      [`GET /v2/assessments/${MINE}`]: { assessment: { id: MINE, project_id: PID, name: "Shared Mark review", stage: "collect", created_at: "2026-10-01T00:00:00Z" }, surveys: [] },
      [`GET /v2/assessments/${ARCHIVED}`]: { assessment: { id: ARCHIVED, project_id: PID, name: "Old Luke", stage: "improve", archived_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" }, surveys: [] },
      // Sibling must never be fetched: invitee has no grant on it.
      [`GET /v2/assessments/${SIBLING}`]: { assessment: { id: SIBLING, project_id: PID, name: "Secret sibling", stage: "collect", created_at: "2026-07-01T00:00:00Z" }, surveys: [] },
    });
    const m = await homeModel(meInvitee);
    expect(m.empty).toBe(false);
    expect(m.projectCards).toHaveLength(1);
    expect(m.projectCards[0]).toMatchObject({ id: PID, title: "Limited access", limited: true, href: expect.stringContaining(PID) });
    expect(m.projectCards[0].meta).toMatch(/Assessment only/i);
    expect(m.projectCards[0].meta).toMatch(/project invite/i);
    expect(calls.some((u) => u.includes(SIBLING))).toBe(false);
    // Home still lists no review titles as cards of their own — only the limited project entry.
    const view = render(Home, { props: { state: "projects", data: m } });
    expect(view.container.textContent).toContain("Limited access");
    expect(view.container.textContent).toContain("Assessment only");
    expect(view.container.textContent).toMatch(/Open project/);
  });

  it("projectModel for an invitee builds a limited project with only granted reviews (no siblings, no project-wide read)", async () => {
    serve({
      [`GET /v2/projects/${PID}`]: {},
      [`GET /v2/projects/${PID}/assessments`]: { assessments: [
        { id: MINE, name: "Shared Mark review", stage: "collect", created_at: "2026-10-01T00:00:00Z" },
        { id: SIBLING, name: "Secret sibling", stage: "collect", created_at: "2026-07-01T00:00:00Z" },
        { id: ARCHIVED, name: "Old Luke", stage: "improve", archived_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" },
      ] },
      "GET /v2/workspaces": { workspaces: [] },
      [`GET /v2/assessments/${MINE}`]: { assessment: { id: MINE, project_id: PID, name: "Shared Mark review", stage: "collect", created_at: "2026-10-01T00:00:00Z" }, surveys: [] },
      [`GET /v2/assessments/${ARCHIVED}`]: { assessment: { id: ARCHIVED, project_id: PID, name: "Old Luke", stage: "improve", archived_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" }, surveys: [] },
      [`GET /v2/assessments/${ARCHIVED}/reports`]: { reports: [] },
      [`GET /v2/assessments/${MINE}/reports`]: { reports: [] },
    }, {
      [`GET /v2/projects/${PID}`]: 404,
      [`GET /v2/projects/${PID}/assessments`]: 404,
    });
    const m = await projectModel(PID, meInvitee);
    expect(m.limitedAccess).toBe(true);
    expect(m.limitedGuidance).toMatch(/project invite/i);
    expect(m.reviews.map((r: { title: string }) => r.title)).toEqual(["Shared Mark review"]);
    expect(m.archivedReviews.map((r: { title: string }) => r.title)).toEqual(["Old Luke"]);
    expect(m.reviews.concat(m.archivedReviews).map((r: { title: string }) => r.title)).not.toContain("Secret sibling");
    expect(calls.some((u) => u.includes(SIBLING))).toBe(false);
    // Project list/assessment list were refused; only assessment.get for granted ids.
    expect(calls.filter((u) => u.includes(`/v2/projects/${PID}/assessments`)).length).toBeGreaterThan(0); // attempted then fell back
    const view = render(Project, { props: { data: m } });
    expect(view.container.textContent).toContain("Shared Mark review");
    expect(view.container.textContent).toContain("Assessment only");
    expect(view.container.textContent).toMatch(/project invite/i);
    expect(view.container.textContent).not.toContain("Secret sibling");
    expect(view.queryByRole("link", { name: /Start a 3D Review/i })).toBeNull();
  });

  it("fresh login (same grants, empty projects) still finds the limited entry", async () => {
    serve({
      "GET /v2/projects": { projects: [] },
      "GET /v2/workspaces": { workspaces: [] },
      [`GET /v2/assessments/${MINE}`]: { assessment: { id: MINE, project_id: PID, name: "Shared Mark review", stage: "collect", created_at: "2026-10-01T00:00:00Z" }, surveys: [] },
      [`GET /v2/assessments/${ARCHIVED}`]: { assessment: { id: ARCHIVED, project_id: PID, name: "Old Luke", stage: "improve", archived_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" }, surveys: [] },
    });
    const first = await homeModel(meInvitee);
    forget();
    const again = await homeModel(meInvitee);
    expect(again.projectCards.map((c: { id: string }) => c.id)).toEqual(first.projectCards.map((c: { id: string }) => c.id));
    expect(again.projectCards[0].limited).toBe(true);
  });
});

describe("P2: archived reviews discoverable inside the opened Project", () => {
  it("projectModel returns archived reviews separately for a project owner", async () => {
    serve({
      [`GET /v2/projects/${PID}`]: { project: { id: PID, name: "Kikuyu", organization: "BCS", workspace_id: null, role: "owner" } },
      [`GET /v2/projects/${PID}/assessments`]: { assessments: [
        { id: MINE, name: "Live Mark", stage: "collect", created_at: "2026-10-01T00:00:00Z" },
        { id: ARCHIVED, name: "Archived Luke", stage: "improve", archived_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" },
      ] },
      "GET /v2/workspaces": { workspaces: [] },
      [`GET /v2/assessments/${ARCHIVED}/reports`]: { reports: [] },
      [`GET /v2/assessments/${MINE}/reports`]: { reports: [] },
    });
    const m = await projectModel(PID, meOwner);
    expect(m.limitedAccess).toBe(false);
    expect(m.reviews.map((r: { title: string }) => r.title)).toEqual(["Live Mark"]);
    expect(m.archivedReviews).toHaveLength(1);
    expect(m.archivedReviews[0]).toMatchObject({ title: "Archived Luke", archived: true, id: ARCHIVED });
    expect(m.archivedReviews[0].href).toContain(ARCHIVED);
  });

  it("Project screen Active/Archived/All lets an owner discover and open an archived review", async () => {
    const data = {
      ...projectFixture,
      reviews: [{ id: MINE, when: "Oct 2026", title: "Live Mark", stage: "collecting", to: "collect", href: `#/review/${MINE}`, note: "No results yet" }],
      archivedReviews: [{ id: ARCHIVED, when: "Aug 2026", title: "Archived Luke", stage: "done", to: "nextStep", href: `#/results/${ARCHIVED}`, note: "No results yet", archived: true }],
      limitedAccess: false,
      limitedGuidance: null,
    };
    const view = render(Project, { props: { data } });
    expect(view.container.textContent).toContain("Live Mark");
    expect(view.container.textContent).not.toContain("Archived Luke");
    const archivedRadio = view.getByRole("radio", { name: "Archived" });
    await fireEvent.click(archivedRadio);
    expect(view.container.textContent).toContain("Archived Luke");
    expect(view.container.textContent).not.toContain("Live Mark");
    const link = view.getByRole("link", { name: /Archived Luke/i });
    expect(link.getAttribute("href")).toContain(ARCHIVED);
    const allRadio = view.getByRole("radio", { name: "All" });
    await fireEvent.click(allRadio);
    expect(view.container.textContent).toContain("Live Mark");
    expect(view.container.textContent).toContain("Archived Luke");
  });
});
