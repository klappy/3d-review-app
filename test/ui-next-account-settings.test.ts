// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import AccountSettings from "../ui-next/src/app/AccountSettings.svelte";
// @ts-expect-error plain JS module
import { saveAccountName, loadAccountSettings, shouldAskName, skipAccountName, NAME_SKIP_KEY, loadRoadmapHistory } from "../ui-next/src/app/account-settings.js";
const principal = { id: "synthetic-account", kind: "user", display_name: "Before" };
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; localStorage.clear(); });
const envelope = (result: unknown) => new Response(JSON.stringify({ ok: true, result }));

describe("account name persistence and optional skip", () => {
  for (const phone of [false, true]) it(`${phone ? "phone" : "desktop"}: saves, reads back and reloads the actual account name`, async () => {
    let stored = { ...principal }; const calls: { url: string, method?: string, body?: any }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : null; calls.push({ url, method: init.method, body });
      if (init.method === "PATCH") stored = { ...stored, display_name: body.display_name };
      return envelope({ principal: stored });
    }) as typeof fetch;
    const saved = vi.fn(); const view = render(AccountSettings, { phone, principal, onsaved: saved });
    await fireEvent.input(view.getByLabelText("Your name"), { target: { value: "  Ada   Example  " } });
    await fireEvent.click(view.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("saved and verified"));
    expect(stored.display_name).toBe("Ada Example"); expect(saved).toHaveBeenCalledWith(stored);
    expect(calls.filter(x => x.method === "PATCH")).toEqual([{ url: "/v2/me", method: "PATCH", body: { display_name: "Ada Example", id: principal.id } }]);
    expect(calls.filter(x => x.method === "GET")).toHaveLength(2);
    view.unmount();
    const reopened = render(AccountSettings, { phone, principal: await loadAccountSettings(principal.id) });
    expect((reopened.getByLabelText("Your name") as HTMLInputElement).value).toBe("Ada Example");
  });
  it("clears a name with null and refuses a changed identity before writing", async () => {
    let stored: any = { ...principal }; const request = vi.fn(async (_url, init) => {
      if (init?.method === "PATCH") stored.display_name = init.body.display_name;
      return { principal: stored };
    });
    expect((await saveAccountName(principal, "  ", request)).display_name).toBeNull();
    expect(request.mock.calls[1][1].body.display_name).toBeNull();
    request.mockClear(); stored = { ...principal, id: "another-account" };
    await expect(saveAccountName(principal, "Wrong identity", request)).rejects.toThrow("account changed");
    expect(request).toHaveBeenCalledOnce();
  });
  it("does not claim a persisted save on stale readback and locks repeat writes until reload", async () => {
    let patches = 0;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      if (init.method === "PATCH") { patches++; return envelope({ principal: { ...principal, display_name: "New name" } }); }
      return envelope({ principal });
    }) as typeof fetch;
    const view = render(AccountSettings, { principal });
    await fireEvent.input(view.getByLabelText("Your name"), { target: { value: "New name" } });
    await fireEvent.click(view.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("could not be verified"));
    expect((view.getByRole("button", { name: "Save name" }) as HTMLButtonElement).disabled).toBe(true);
    expect(patches).toBe(1);
    await fireEvent.click(view.getByRole("button", { name: "Reload settings" }));
    await waitFor(() => expect((view.getByRole("button", { name: "Save name" }) as HTMLButtonElement).disabled).toBe(false));
    expect((view.getByLabelText("Your name") as HTMLInputElement).value).toBe("Before");
  });
  it("skips only the optional prompt for this device/account without a server write", async () => {
    const unnamed = { ...principal, display_name: null }; const skip = vi.fn(); globalThis.fetch = vi.fn() as typeof fetch;
    expect(shouldAskName(unnamed, localStorage)).toBe(true);
    const view = render(AccountSettings, { principal: unnamed, onskip: skip });
    await fireEvent.click(view.getByRole("button", { name: "Not now" }));
    expect(skip).toHaveBeenCalledOnce(); expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(NAME_SKIP_KEY(principal.id))).toBe("1"); expect(shouldAskName(unnamed, localStorage)).toBe(false);
    expect(shouldAskName({ ...unnamed, id: "different-account" }, localStorage)).toBe(true);
    expect(() => skipAccountName(unnamed, { setItem() { throw Error(); } })).not.toThrow();
  });
  it("keeps sample and participant settings read-only", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const sample = render(AccountSettings, { principal, sample: true });
    expect((sample.getByRole("button", { name: "Save name" }) as HTMLButtonElement).disabled).toBe(true); sample.unmount();
    const participant = render(AccountSettings, { principal: { ...principal, kind: "participant" } });
    expect((participant.getByRole("button", { name: "Save name" }) as HTMLButtonElement).disabled).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("account switch and public product information", () => {
  it("cancel and Escape keep the same session; only explicit confirmation invokes the existing switch flow", async () => {
    const change = vi.fn().mockResolvedValue(undefined), view = render(AccountSettings, { principal, onswitch: change, initialView: "switch" });
    await fireEvent.click(view.getByRole("button", { name: "Cancel account switch" })); expect(change).not.toHaveBeenCalled();
    await fireEvent.click(view.getByRole("button", { name: "Use another account", exact: true }));
    await fireEvent.keyDown(window, { key: "Escape" }); expect(change).not.toHaveBeenCalled();
    await fireEvent.click(view.getByRole("button", { name: "Use another account", exact: true }));
    await fireEvent.click(view.getByRole("button", { name: "Sign out and use another account" }));
    await waitFor(() => expect(change).toHaveBeenCalledOnce());
  });
  it("reads deployed release identity and changelog as text, and exposes same-origin public routes", async () => {
    const calls: any[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(url === "/v2/health" ? { ok: false, result: { version: "0.37.2", build: "0.37.2+abcdef0", commit: "abcdef0123", release_source: "1234567890" } } : { current: "0.37.2", versions: [{ version: "0.37.2", status: "candidate", sections: { fixed: ["<img src=x> synthetic note"] } }] }));
    }) as typeof fetch;
    const view = render(AccountSettings, { principal, initialView: "release" });
    await waitFor(() => expect(view.container.textContent).toContain("0.37.2+abcdef0"));
    expect(view.container.textContent).toContain("<img src=x> synthetic note"); expect(view.container.querySelector("img")).toBeNull();
    expect(view.getByRole("link", { name: "Open public roadmap" }).getAttribute("href")).toBe("/roadmap/");
    expect(view.getByRole("link", { name: "Shipped versions" }).getAttribute("href")).toBe("/roadmap/#versions");
    expect(calls.every(x => x.init.credentials === "omit")).toBe(true);
  });
  it("reads actual roadmap windows and paginated same-generation history without claiming delivery", async () => {
    const item = { id: "roadmap-1", title: "Synthetic real-feed item", provenance: { scope: "Fixture tests a real public feed shape" }, operations: { workflow: "now" }, stages: Object.fromEntries(["planned", "built", "reviewed", "dev", "production"].map(x => [x, { state: "pending", reason: "Not independently accepted", evidence: [] }])) };
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("/history")) return envelope({ generation: 3, events: [{ recorded_at: "2026-10-30", value: { kind: "summary", summary: { scope: url.includes("after=0") ? "First history page" : "Second history page" } } }], next: url.includes("after=0") ? 2 : null });
      return envelope({ generation: 3, cursor: 5, source_mode: "dev_provisional", items: [{ value: item }], item_next: null, last_event_at: null });
    }) as typeof fetch;
    const view = render(AccountSettings, { principal, initialView: "roadmap" });
    await waitFor(() => expect(view.container.textContent).toContain(item.title));
    expect(view.container.textContent).toContain("Not verified");
    await fireEvent.click(view.getByRole("button", { name: "Future · 0" })); expect(view.queryByRole("heading", { name: item.title })).toBeNull();
    await fireEvent.click(view.getByRole("button", { name: "Now · 1" }));
    await fireEvent.click(view.getByText("Why this work · evidence · history"));
    await fireEvent.click(view.getByRole("button", { name: "Read full history" }));
    await waitFor(() => expect(view.container.textContent).toContain("First history page"));
    await fireEvent.click(view.getByRole("button", { name: "Read next history page" }));
    await waitFor(() => expect(view.container.textContent).toContain("Second history page"));
    expect(view.container.textContent).toContain("History loaded."); expect(calls.some(x => x.includes("after=2"))).toBe(true);
  });
  it("rejects history from another generation instead of appending it", async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope({ generation: 4, events: [], next: null }));
    await expect(loadRoadmapHistory("roadmap-1", 3, 0, fetcher)).rejects.toMatchObject({ code: "STALE_GENERATION" });
  });
});
