// @vitest-environment jsdom
// Owner rule: nobody sees a review/assessment outside an opened project. Home, the phone menu, the Workspace view and the Projects list
// show workspaces and projects only; reviews render only once a project is opened (Project screen / projectModel).
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain .js module, no type declarations
import { homeModel, menuModel, workspaceModel, projectModel } from "../ui-next/src/app/data.js";
// @ts-expect-error -- plain .js module, no type declarations
import { forget } from "../ui-next/src/app/session.js";
// @ts-expect-error -- plain .js module, no type declarations
import { parse } from "../ui-next/src/app/router.js";
import Home from "../ui-next/src/screens/Home.svelte";
import MenuSheet from "../ui-next/src/screens/actions/MenuSheet.svelte";
import Workspace from "../ui-next/src/screens/people/Workspace.svelte";
import Project from "../ui-next/src/screens/setup/Project.svelte";
import { REGISTRY as registry } from "../ui-next/src/screens/registry.js";
import projectFixture from "../ui-next/fixtures/setup/project.json";

const PID = "p1";
const me = { principal: { id: "u1", display_name: "Kay Writer", access_mode: "my" }, grants: [] };
const ASSESSMENT_URL = /\/assessments|\/reports|\/results|\/surveys/;
const calls: string[] = [];
const realFetch = globalThis.fetch;
const serve = (routes: Record<string, unknown>) => {
  calls.length = 0;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push(String(url));
    const r = routes[`${init.method ?? "GET"} ${String(url).split("?")[0]}`];
    if (r === undefined) return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: `no route ${url}` } }), { status: 404 });
    return new Response(JSON.stringify({ ok: true, result: r }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
};
afterEach(() => { globalThis.fetch = realFetch; forget(); vi.restoreAllMocks(); });

const REVIEW_WORDS = /Results ready|Collecting|Setting up|Completed|Explore|Read the results|Share the survey|Continue setup|Not yet reviewed/;
const projects = [{ id: PID, name: "Kikuyu", workspace_id: "w1", assessment_count: 3, response_count: 12, role: "owner" }];
const reads = {
  "GET /v2/projects": { projects },
  [`GET /v2/projects/${PID}`]: { project: projects[0] },
  "GET /v2/workspaces": { workspaces: [{ id: "w1", name: "WS", role: "owner" }] },
  "GET /v2/workspaces/w1": { workspace: { id: "w1", name: "WS", role: "owner" }, projects },
  [`GET /v2/projects/${PID}/assessments`]: { assessments: [{ id: "a1", name: "First review", stage: "collect", created_at: "2026-08-01T00:00:00Z" }] },
  "GET /v2/assessments/a1": { assessment: { id: "a1", project_id: PID, stage: "collect", role: "owner" }, surveys: [] },
};

describe("no review or assessment outside an opened project (owner rule)", () => {
  it("homeModel lists projects, reads no assessment endpoint, and carries no review field", async () => {
    serve(reads);
    const m = await homeModel(me);
    expect(m.projectCards.map((c: { title: string }) => c.title)).toEqual(["Kikuyu"]);
    for (const k of ["groups", "completed", "reviews", "phoneOrder"]) expect(m, k).not.toHaveProperty(k);
    expect(calls.filter((u) => ASSESSMENT_URL.test(u))).toEqual([]);
  });
  it("menuModel (the phone account sheet) carries project cards only", async () => {
    serve(reads);
    const m = menuModel(me, await homeModel(me), {});
    expect(m.projectCards.length).toBe(1);
    for (const k of ["reviews", "completed", "groups"]) expect(m, k).not.toHaveProperty(k);
    const view = render(MenuSheet, { data: m });
    expect(view.container.textContent).not.toMatch(REVIEW_WORDS);
    expect(view.container.textContent).toContain("Kikuyu");
  });
  it("workspaceModel reads and shows no review, stage or level", async () => {
    serve(reads);
    const m = await workspaceModel("w1", me);
    expect(calls.filter((u) => ASSESSMENT_URL.test(u))).toEqual([]);
    expect(JSON.stringify(m)).not.toMatch(/"(levels|stage|activity|language|format)"/);
  });
  it("the Home screen, in both states and on the phone, renders no review", () => {
    for (const props of [{ state: "projects" }, { state: "first" }, { state: "projects", phone: true }]) {
      const view = render(Home, { props });
      expect(view.container.textContent, JSON.stringify(props)).not.toMatch(REVIEW_WORDS);
      expect(view.container.querySelector(".pill, .chip, .lvl, input.cb")).toBeNull();
      view.unmount();
    }
  });
  it("the Workspace screen renders no review, stage or level", () => {
    for (const phone of [false, true]) {
      const view = render(Workspace, { props: { phone } });
      expect(view.container.querySelector(".pill, .lvl, [data-coverage]")).toBeNull();
      expect(view.container.textContent).not.toMatch(REVIEW_WORDS);
      view.unmount();
    }
  });
  it("there is no cross-project review search: no explore route, screen, model or fixture", () => {
    expect(Object.keys(registry)).not.toContain("explore");
    expect(parse("#/explore").name).toBe("home");
    const root = resolve(__dirname, "../ui-next");
    for (const f of ["src/screens/explore/Explore.svelte", "src/screens/explore/ExploreLive.svelte", "src/screens/explore/discovery.js", "src/screens/explore/explore-data.js", "fixtures/explore/explore.json"]) expect(existsSync(resolve(root, f)), f).toBe(false);
    const dataSrc = readFileSync(resolve(root, "src/app/data.js"), "utf8");
    expect(dataSrc).not.toMatch(/export (async )?function exploreModel|export const exploreModel/);
    const src = readdirSync(resolve(root, "src/app")).filter((f) => /\.(js|svelte)$/.test(f)).map((f) => readFileSync(resolve(root, "src/app", f), "utf8")).join("\n");
    expect(src).not.toMatch(/screens\/explore\/(Explore|discovery|explore-data)/);
  });
});

describe("reviews still render inside an opened project", () => {
  it("projectModel reads the project's reviews and returns them", async () => {
    serve(reads);
    const m = await projectModel(PID, me);
    expect(calls.some((u) => u.includes(`/v2/projects/${PID}/assessments`))).toBe(true);
    expect(m.reviews.map((r: { title: string }) => r.title)).toEqual(["First review"]);
  });
  it("the Project screen lists each review with its stage", () => {
    const view = render(Project, { props: { data: projectFixture } });
    const titles = (projectFixture as { reviews: { title: string }[] }).reviews.map((r) => r.title);
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(view.container.textContent).toContain(t);
    expect(view.container.querySelector(".pill")).not.toBeNull();
  });
});
