// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import Settings from "../ui-next/src/app/ProjectSettings.svelte";
import Live from "../ui-next/src/app/Live.svelte";
import { forget } from "../ui-next/src/app/session.js";
import { setLiveContext } from "../ui-next/src/screens/href.js";
import { loadProjectSettings, saveProjectSettings } from "../ui-next/src/app/project-settings.js";
const initial = { id: "project/synthetic", name: "Synthetic project", organization: "Before", role: "owner" };
const original = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = original; forget(); setLiveContext(null); });
function server({ role = "owner", fail = false, stale = false } = {}) {
  let stored = { ...initial, role };
  const calls: any[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : null });
    if (url === "/v2/me") return new Response(JSON.stringify({ ok: true, result: { principal: { id: "synthetic-owner", display_name: "Synthetic Owner" } } }));
    if (url === "/v2/workspaces") return new Response(JSON.stringify({ ok: true, result: { workspaces: [] } }));
    if (url.endsWith("/assessments")) return new Response(JSON.stringify({ ok: true, result: { assessments: [] } }));
    if (init.method === "PATCH") {
      if (fail || role !== "owner") return new Response(JSON.stringify({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE", message: "Owner required" } }), { status: 403 });
      if (!stale) stored = { ...stored, ...JSON.parse(String(init.body)) };
    }
    return new Response(JSON.stringify({ ok: true, result: { project: stored } }), { status: 200 });
  }) as typeof fetch;
  return { calls, read: () => stored };
}
describe("existing project settings", () => {
  it("hides the prior editor during a deferred settings A to B read", async () => {
    server(); forget();
    const upstream = globalThis.fetch;
    let release: (r: Response) => void = () => {};
    globalThis.fetch = (async (url: string, init: RequestInit) => url === "/v2/projects/second" ? new Promise<Response>(r => { release = r; }) : upstream(url, init)) as typeof fetch;
    location.hash = "#/project/project%2Fsynthetic/settings";
    const view = render(Live);
    await waitFor(() => view.getByLabelText("Project name"));
    location.hash = "#/project/second/settings"; dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(view.queryByLabelText("Project name")).toBeNull());
    release(new Response(JSON.stringify({ ok: true, result: { project: { ...initial, id: "second", name: "Second project" } } })));
    await waitFor(() => expect((view.getByLabelText("Project name") as HTMLInputElement).value).toBe("Second project"));
  });
  for (const phone of [false, true]) it(`initial read refusal ${phone} has usable Home escape`, async () => {
    const s = server(); forget();
    const upstream = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      if (url === "/v2/projects/denied") return new Response(JSON.stringify({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE" } }), { status: 403 });
      if (url === "/v2/projects") return new Response(JSON.stringify({ ok: true, result: { projects: [] } }));
      return upstream(url, init);
    }) as typeof fetch;
    globalThis.matchMedia = ((query: string) => ({ matches: phone, media: query, addEventListener() {}, removeEventListener() {} })) as any;
    location.hash = "#/project/denied/settings";
    const view = render(Live);
    const home = await waitFor(() => view.getByRole("link", { name: "Home" }));
    location.hash = home.getAttribute("href")!; dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(view.queryByRole("heading", { name: "Not visible to you" })).toBeNull());
    await waitFor(() => expect(view.container.textContent).toContain("Start"));
    expect(s.calls.some(c => c.method === "PATCH")).toBe(false);
  });
  for (const phone of [false, true]) it(`Live route ${phone}: Project → settings → verified save → project`, async () => {
    const s = server(); forget();
    globalThis.matchMedia = ((query: string) => ({ matches: phone, media: query, addEventListener() {}, removeEventListener() {} })) as any;
    globalThis.location.hash = "#/project/project%2Fsynthetic";
    const view = render(Live);
    const settingsLink = await waitFor(() => view.getByRole("link", { name: phone ? "Settings" : "Project settings" }));
    expect(settingsLink.getAttribute("href")).toBe("#/project/project%2Fsynthetic/settings");
    globalThis.location.hash = settingsLink.getAttribute("href")!;
    globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
    const name = await waitFor(() => view.getByLabelText("Project name"));
    await fireEvent.input(name, { target: { value: "Saved through live route" } });
    await fireEvent.click(view.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("saved and verified"));
    globalThis.location.hash = view.getByRole("link", { name: "Cancel" }).getAttribute("href")!;
    globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(view.getByRole("heading", { name: "Saved through live route" })).toBeTruthy());
    expect(s.calls.filter(c => c.method === "PATCH")).toHaveLength(1);
    expect(s.calls.some(c => c.method === "POST")).toBe(false);
  });
  for (const phone of [false, true]) it(`${phone ? "phone" : "desktop"}: persisted readback and escape`, async () => {
    const s = server();
    const project = await loadProjectSettings(initial.id);
    const view = render(Settings, { phone, project });
    await fireEvent.input(view.getByLabelText("Project name"), { target: { value: "Renamed synthetic" } });
    await fireEvent.input(view.getByLabelText("Organization (optional)"), { target: { value: "After" } });
    await fireEvent.click(view.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("saved and verified"));
    expect(s.read()).toMatchObject({ name: "Renamed synthetic", organization: "After" });
    expect(s.calls.map(c => c.method)).toEqual(["GET", "PATCH", "GET"]);
    expect(s.calls.every(c => c.url === "/v2/projects/project%2Fsynthetic")).toBe(true);
    expect(view.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("#/project/project%2Fsynthetic");
    // Reopening reads the persisted record, not the form's draft or PATCH response.
    cleanup();
    const reopened = render(Settings, { phone, project: await loadProjectSettings(initial.id) });
    expect((reopened.getByLabelText("Project name") as HTMLInputElement).value).toBe("Renamed synthetic");
  });
  for (const role of ["member", "viewer"]) for (const phone of [false, true]) it(`${role} ${phone}: read-only with escape`, async () => {
    const s = server({ role });
    const project = await loadProjectSettings(initial.id);
    const view = render(Settings, { phone, project });
    expect((view.getByLabelText("Project name") as HTMLInputElement).disabled).toBe(true);
    expect(view.queryByRole("button", { name: "Save settings" })).toBeNull();
    expect(view.getByRole("link", { name: "Cancel" })).toBeTruthy();
    await expect(saveProjectSettings(project, { name: "Forbidden" })).rejects.toThrow(/owner/);
    expect(s.calls.map(c => c.method)).toEqual(["GET"]);
  });
  for (const stale of [false, true]) it(`refusal or failed readback ${stale}: reload before retry`, async () => {
    const s = server({ fail: !stale, stale });
    const view = render(Settings, { project: await loadProjectSettings(initial.id) });
    await fireEvent.input(view.getByLabelText("Project name"), { target: { value: "Changed" } });
    await fireEvent.click(view.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("Reload settings"));
    expect((view.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByRole("status").textContent).not.toContain("saved");
    await fireEvent.click(view.getByRole("button", { name: "Reload settings" }));
    await waitFor(() => expect((view.getByLabelText("Project name") as HTMLInputElement).value).toBe(initial.name));
    expect(s.calls.filter(c => c.method === "PATCH")).toHaveLength(1);
  });
});
