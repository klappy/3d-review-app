// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import AccessMode from "../ui-next/src/app/AccessMode.svelte";
// @ts-expect-error plain JS module
import { switchAccessMode, watchAccessMode, preferenceOf } from "../ui-next/src/app/access-mode.js";

describe("Next access mode uses the existing server-authorized preference", () => {
  it("does not show or change mode for an ordinary account or the sample", () => {
    const ordinary = render(AccessMode, { principal: { super_admin: false, access_mode: "my" } });
    expect(screen.queryByRole("combobox", { name: "Access mode" })).toBeNull(); ordinary.unmount();
    render(AccessMode, { principal: { super_admin: true, access_mode: "my" }, sample: true });
    expect(screen.queryByRole("combobox", { name: "Access mode" })).toBeNull();
    const doc = { cookie: "" }, location = { replace: vi.fn(), reload: vi.fn() };
    expect(switchAccessMode({ super_admin: false }, "global", { document: doc, location })).toBe(false);
    expect(doc.cookie).toBe(""); expect(location.reload).not.toHaveBeenCalled();
  });
  it("renders the effective served mode and actual project navigation", () => {
    document.cookie = "review_access=global; Path=/";
    render(AccessMode, { principal: { id: "admin", super_admin: true, access_mode: "global" } });
    expect((screen.getByRole("combobox", { name: "Access mode" }) as HTMLSelectElement).value).toBe("global");
    expect(screen.getByRole("status").textContent).toContain("Support mode: browse all workspaces");
    expect(screen.queryByRole("link", { name: "All projects" })).toBeNull();
  });
  it("writes only an allowed preference and fully reloads after navigating to projects", () => {
    const doc = { cookie: "" }, location = { replace: vi.fn(), reload: vi.fn() }, storage = { setItem: vi.fn(() => { throw new Error("storage unavailable"); }) }, channel = { postMessage: vi.fn() };
    const principal = { super_admin: true, access_mode: "my" };
    expect(switchAccessMode(principal, "invalid", { document: doc, location })).toBe(false);
    expect(switchAccessMode(principal, "my", { document: doc, location })).toBe(false);
    expect(switchAccessMode(principal, "global", { document: doc, location, storage, channel })).toBe(true);
    expect(doc.cookie).toBe("review_access=global; Path=/; SameSite=Lax");
    expect(channel.postMessage).toHaveBeenCalledWith("global");
    expect(location.replace).toHaveBeenCalledWith("/next/#/projects"); expect(location.reload).toHaveBeenCalledOnce();
  });
  it("invalidates once for a changed shared cookie on tab focus and removes listeners", () => {
    const doc = { cookie: "review_access=my" }, events = new EventTarget(), location = { reload: vi.fn() }, onChange = vi.fn();
    const stop = watchAccessMode({ super_admin: true, access_mode: "global" }, { document: doc, events, location, onChange });
    events.dispatchEvent(new Event("focus")); events.dispatchEvent(new Event("pageshow"));
    expect(onChange).toHaveBeenCalledOnce(); expect(location.reload).toHaveBeenCalledOnce(); stop();
    events.dispatchEvent(new Event("focus")); expect(location.reload).toHaveBeenCalledOnce();
    expect(preferenceOf("x=global; review_access=invalid")).toBe("my");
  });
});
