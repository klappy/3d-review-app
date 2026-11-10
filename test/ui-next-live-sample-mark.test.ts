// @vitest-environment jsdom
// UI Next (v4) live: the sample review carries one plain "Sample review" tag, never the developer "Design preview" card
// (its micro title, its "Sample data: a made-up review…" sentence, its Home button). Real reviews carry neither.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, waitFor } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { forget } from "../ui-next/src/app/session.js";
// @ts-expect-error -- plain .js module, no type declarations
import { to, SAMPLE_AID } from "../ui-next/src/app/router.js";
import Live from "../ui-next/src/app/Live.svelte";
import Status from "../ui-next/src/app/Status.svelte";

const realFetch = globalThis.fetch;
const urls: string[] = [];
const serve = (routes: Record<string, unknown>) => {
  urls.length = 0;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${url}`; urls.push(key);
    const r = routes[key];
    if (r === undefined) return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: `no route ${key}` } }), { status: 404, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, result: r }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
};
afterEach(() => { globalThis.fetch = realFetch; forget(); });

const noCard = (a: Element) => {
  const t = a.textContent ?? "";
  expect(t).not.toContain("Design preview");
  expect(t).not.toContain("Sample data: a made-up review");
  expect(t).not.toContain("Your own reviews read their results from the server");
  expect(t).not.toContain("Nothing here is saved");
};
const marks = (a: Element) => [...a.querySelectorAll("[data-sample-mark]")];

describe("the sample review: one plain Sample review tag, no Design preview card", () => {
  const SAMPLE: [string, string, string][] = [
    ["Results", to("results", { aid: SAMPLE_AID }), "Mark 1–4 draft"],
    ["Overview (report)", to("report", { aid: SAMPLE_AID }), "Mark 1–4 draft"],
    ["Detailed (report-detailed)", to("report-detailed", { aid: SAMPLE_AID }), "Mark 1–4 draft"],
    ["Gaps", to("results-gaps", { aid: SAMPLE_AID }), "Mark 1–4 draft"],
    ["next step", to("next-step", { aid: SAMPLE_AID }), "Mark 1–4 draft"],
    ["bare #results (the lanes' sample link)", "#results", "Mark 1–4 draft"],
  ];
  for (const [name, hash, text] of SAMPLE) {
    it(`${name}: the tag shows once, the card, its sentence and its Home button do not, and no API is called`, async () => {
      serve({});
      globalThis.location.hash = hash;
      const a = render(Live as never, { props: {} }).container;
      await waitFor(() => expect(a.textContent).toContain(text));
      const m = marks(a);
      expect(m).toHaveLength(1);
      expect(m[0].textContent).toBe("Sample review");
      expect(m[0].querySelector(".tag")).not.toBeNull();
      expect(m[0].querySelector(".card, p, a, button")).toBeNull(); // a tag only: no card, no paragraph, no Home link or button
      noCard(a);
      expect(urls.filter((u) => u.includes("/v2/assessments"))).toEqual([]);
    });
  }
  it("a sample fixture screen (project) shows the tag and no card", async () => {
    serve({});
    globalThis.location.hash = to("project", { pid: SAMPLE_AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(marks(a)).toHaveLength(1));
    expect(marks(a)[0].textContent).toBe("Sample review");
    noCard(a);
  });
  it("sample answers keep the held line (sample data has no answer rows) under the same tag", async () => {
    serve({});
    globalThis.location.hash = to("results-answers", { aid: SAMPLE_AID });
    const a = render(Live as never, { props: {} }).container;
    await waitFor(() => expect(a.textContent).toContain("sample data has no answer rows"));
    expect(a.textContent).toContain("Held by policy");
    expect(marks(a)).toHaveLength(1); noCard(a);
  });
});

describe("a real review carries no sample tag", () => {
  const AID = "asm_1", PID = "prj_1";
  const payload = { lenses: [{ lens: "Translation Team", score: 80, sub_dimensions: [] }, { lens: "Community", score: 50, sub_dimensions: [] }], cross_lens_multi: [] };
  const counts = { survey: {}, counts: { responses: 4, respondents: 4 } };
  const real = {
    "GET /v2/me": { principal: { id: "p1", display_name: "Kay Facilitator" } },
    [`GET /v2/assessments/${AID}`]: { assessment: { id: AID, project_id: PID, name: "Mark 1–4", stage: "understand", format: "written", language_id: "lang_1", role: "owner", created_at: "2026-10-01T00:00:00Z" }, surveys: [{ id: "s1", perspective: "Translation Team", template_name: "Translators" }, { id: "s2", perspective: "Community", template_name: "Community" }] },
    [`GET /v2/assessments/${AID}/results`]: { status: "ready", report_build_allowed: true },
    [`GET /v2/projects/${PID}`]: { project: { id: PID, name: "Kikuyu", workspace_id: null } },
    [`GET /v2/projects/${PID}/languages`]: { languages: [{ id: "lang_1", name: "Kikuyu" }] },
    [`GET /v2/assessments/${AID}/surveys/s1`]: counts, [`GET /v2/assessments/${AID}/surveys/s2`]: counts,
    [`GET /v2/assessments/${AID}/reports`]: { reports: [{ id: "rep_1", created_at: "2026-10-20T00:00:00Z" }], next_cursor: null },
    "GET /v2/reports/rep_1": { report: { id: "rep_1", created_at: "2026-10-20T00:00:00Z", payload } },
  };
  for (const screen of ["results", "report", "report-detailed"]) {
    it(`${screen}: the real model renders from the server with no tag and no card`, async () => {
      serve(real);
      globalThis.location.hash = to(screen, { aid: AID });
      const a = render(Live as never, { props: {} }).container;
      await waitFor(() => expect(a.textContent).toContain("Kikuyu"));
      expect(marks(a)).toEqual([]);
      expect(a.textContent).not.toContain("Sample review");
      noCard(a);
      expect(urls).toContain("GET /v2/reports/rep_1");
    });
  }
});

describe("Status states are unchanged", () => {
  const TITLES: [string, string][] = [["loading", "Loading…"], ["empty", "Nothing here yet"], ["failed", "Something went wrong"], ["refused", "Not visible to you"], ["not_built", "Not built yet"], ["held", "Held by policy"], ["unavailable", "Not available yet"]];
  for (const [kind, title] of TITLES) {
    it(`${kind} → ${title}`, () => {
      const a = render(Status as never, { props: { kind, message: "m", back: "#/", backLabel: "Home" } }).container;
      expect(a.querySelector("h1")?.textContent).toBe(title);
    });
  }
});

// No loader sets page.data.preview today, so its branch is checked at the source: it draws the same sampleMark (tag + its one existing
// link), and no Status kind="preview" card or "Design preview" title remains anywhere in the live root or Status.
describe("no Design preview card remains in the source", () => {
  const live = readFileSync("ui-next/src/app/Live.svelte", "utf8");
  const status = readFileSync("ui-next/src/app/Status.svelte", "utf8");
  it("Live.svelte renders no kind=\"preview\" Status and its preview branch uses sampleMark with the existing link", () => {
    expect(live).not.toMatch(/kind="preview"/);
    expect(live).not.toMatch(/design preview/i);
    const branch = live.slice(live.indexOf("{:else if page.data.preview}"), live.indexOf("{:else if page.data.screen === \"p-code\"}"));
    expect(branch).toContain("{@render sampleMark({ href: page.data.editHref ?? ");
    expect(branch).toContain("Edit ${page.data.assessment?.name ?? \"this review\"} in the current design");
    expect(branch).not.toMatch(/<Status|<Card|<p[ >]/);
  });
  it("Status.svelte has no preview title", () => {
    expect(status).not.toMatch(/preview/i);
  });
});
