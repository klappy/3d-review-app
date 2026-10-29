// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import LoadingFrame from "../ui-next/src/app/LoadingFrame.svelte";
import Live from "../ui-next/src/app/Live.svelte";
import * as D from "../ui-next/src/app/data.js";
import * as S from "../ui-next/src/app/session.js";
import { setLiveChrome } from "../ui-next/src/app/chrome.js";
import { setToken } from "../ui-next/src/app/api.js";
import { readFileSync } from "node:fs";

const person = (name = "Kay") => ({ principal: { id: name, display_name: name } });
const model = (aid: string, title: string) => ({ aid, review: { id: aid, title, project: "Current project", projectId: "project", language: "Current language", stage: "closed", responses: 0, liveResponses: 0 }, counts: { team: 0, community: 0, church: 0 }, payload: null, results: {}, canBuild: false, held: null });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const go = async (hash: string) => { location.hash = hash; await fireEvent(globalThis, new Event("hashchange")); await tick(); };
const start = (aid = "old") => { location.hash = `#/review/${aid}/results`; return render(Live as never, { props: {} }); };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); S.forget(); setToken(null); setLiveChrome(null); });

describe("content-shaped loading frame", () => {
  it.each([false, true])("keeps neutral navigation and one accessible status (phone=%s)", (phone) => {
    setLiveChrome({ who: "Previous Account", initials: "PA", workspace: "Previous Workspace" });
    const view = render(LoadingFrame as never, { props: { phone, kind: "results" } });
    expect(view.container.querySelector("header .brand")?.getAttribute("href")).toBe("#/home");
    const busy = view.container.querySelector('[aria-busy="true"]')!;
    expect(busy).not.toBeNull(); expect(view.getAllByRole("status")).toHaveLength(1);
    expect(busy.contains(view.getByRole("status"))).toBe(false); // busy regions must not defer the loading announcement
    expect(view.getByRole("status").textContent).toBe("Loading review content…");
    const shapes = view.container.querySelector(".loading-shapes")!;
    expect(shapes.getAttribute("aria-hidden")).toBe("true"); expect(shapes.hasAttribute("inert")).toBe(true);
    expect(shapes.querySelector("a,button,input,select,textarea")).toBeNull();
    expect(shapes.querySelectorAll(".l-card")).toHaveLength(4);
    expect(view.container.textContent).not.toMatch(/Previous Account|Previous Workspace|BCS|Bincy|responses|score/i);
    expect(view.container.querySelector(".app")?.getAttribute("data-w")).toBe(phone ? "phone" : null);
  });

  it("retains current-session account navigation without review breadcrumbs", () => {
    const chrome = { phone: true, who: { first: "Kay", initials: "KA" }, accountItems: [], session: person() };
    const view = render(LoadingFrame as never, { props: { phone: true, chrome, kind: "report" } });
    expect(view.getByRole("link", { name: "Workspace and account" }).getAttribute("href")).toBe("#/menu");
    expect(view.container.textContent).toContain("KA"); expect(view.container.querySelector('[aria-label="Breadcrumb"]')).toBeNull();
  });

  it("uses static shapes in every motion preference", () => {
    const css = readFileSync("ui-next/components/loading.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/animation|transition|@keyframes/);
    expect(css).toContain("var(--line-2)"); expect(css).toContain("max-width:100%");
  });
});

describe("pending route and session isolation", () => {
  it("clears the previous review immediately and keeps a shell during the next read", async () => {
    vi.spyOn(S, "me").mockResolvedValue(person());
    const next = deferred<ReturnType<typeof model>>();
    vi.spyOn(D, "resultsModel").mockImplementation((aid: string) => aid === "old" ? Promise.resolve(model(aid, "Previous review secret")) : next.promise);
    const view = start(); await waitFor(() => expect(view.container.textContent).toContain("Previous review secret"));
    await go("#/review/new/results");
    expect(view.container.textContent).not.toContain("Previous review secret");
    expect(view.container.querySelector('[data-loading-frame][aria-busy="true"]')).not.toBeNull();
    expect(view.container.querySelector("header .brand")).not.toBeNull();
    next.resolve(model("new", "Current review"));
    await waitFor(() => expect(view.container.textContent).toContain("Current review"));
    expect(view.container.querySelector("[data-loading-frame]")).toBeNull();
  });

  it("never shows the previous account while the replacement session is unresolved", async () => {
    const session = deferred<ReturnType<typeof person>>(); let replace = false;
    vi.spyOn(S, "me").mockImplementation(() => replace ? session.promise : Promise.resolve(person("Former Person")));
    vi.spyOn(D, "resultsModel").mockImplementation((aid: string) => Promise.resolve(model(aid, aid === "old" ? "Former review" : "Replacement review")));
    const view = start(); await waitFor(() => expect(view.container.textContent).toContain("Former review"));
    replace = true; setToken("synthetic-replacement-token");
    await go("#/review/new/results");
    expect(view.container.textContent).not.toMatch(/Former Person|Former review|FP/);
    expect(view.container.querySelector("[data-loading-frame]")).not.toBeNull();
    expect(view.container.querySelector('[aria-label="Workspace and account"]')).toBeNull();
    session.resolve(person("Current Person"));
    await waitFor(() => expect(view.container.textContent).toContain("Replacement review"));
    expect(view.container.textContent).not.toContain("Former");
  });

  it("shows the real failure and Retry, then returns through the skeleton to content", async () => {
    vi.spyOn(S, "me").mockResolvedValue(person());
    const first = deferred<ReturnType<typeof model>>(), retry = deferred<ReturnType<typeof model>>();
    vi.spyOn(D, "resultsModel").mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    const view = start(); await waitFor(() => expect(view.container.querySelector("[data-loading-frame]")).not.toBeNull());
    first.reject(new Error("Read failed honestly"));
    await waitFor(() => expect(view.container.textContent).toContain("Read failed honestly"));
    expect(view.container.querySelector("[data-loading-frame]")).toBeNull();
    await fireEvent.click(view.getByRole("button", { name: "Retry" }));
    expect(view.container.querySelector("[data-loading-frame]")).not.toBeNull();
    retry.resolve(model("old", "Retried review")); await waitFor(() => expect(view.container.textContent).toContain("Retried review"));
  });

  it("ignores both late data and late session completions from an earlier navigation", async () => {
    const oldSession = deferred<ReturnType<typeof person>>();
    const oldData = deferred<ReturnType<typeof model>>(); let sessionCalls = 0;
    vi.spyOn(S, "me").mockImplementation(() => ++sessionCalls === 1 ? oldSession.promise : Promise.resolve(person("Current Person")));
    const read = vi.spyOn(D, "resultsModel").mockImplementation((aid: string) => aid === "middle" ? oldData.promise : Promise.resolve(model(aid, "Newest review")));
    const view = start("old"); await go("#/review/middle/results");
    await waitFor(() => expect(read).toHaveBeenCalledWith("middle", { build: false }));
    await go("#/review/new/results"); await waitFor(() => expect(view.container.textContent).toContain("Newest review"));
    oldSession.resolve(person("Previous Person")); oldData.resolve(model("middle", "Late old review"));
    await tick(); for (let i = 0; i < 20; i++) await Promise.resolve(); await tick();
    expect(read.mock.calls.some(([aid]) => aid === "old")).toBe(false);
    expect(view.container.textContent).toContain("Newest review"); expect(view.container.textContent).not.toMatch(/Previous Person|Late old review/);
  });
});
