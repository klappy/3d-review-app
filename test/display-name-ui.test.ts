// Ruling a1 (2026-10-02; cookbook work/queued/2026-09-29-3d-train22-audit-backlog/RULING-2026-10-02-greet-alias.md):
// every greeting reads the account's own display_name with the email as fallback; first sign-in asks (skippable); the account
// menu edits it later; the MCP panel greets from read cap.auth.me. Pure-module checks plus source pins for the DOM wiring.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-ignore — plain browser ES modules
import { displayNameOf, greetingName, welcomeLine, accountLine, shouldAskName, nameAskCard, nameToSend, skipKey, NAME_MAX } from "../ui/v3/components/greeting.js";
// @ts-ignore
import { homeView } from "../ui/v3/home.js";
// @ts-ignore
import { shellModel } from "../ui/kit/app-adapter.js";
// @ts-ignore
import { createActionCard } from "../ui/mcp/action-card.js";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const P = (display_name: unknown, kind = "user") => ({ id: "usr_1", kind, display_name });
const routes = { workspaces: "#workspaces", projects: "#projects", workspace: (id: string) => `#workspace/${id}`, project: (id: string) => `#project/${id}`, assessment: (id: string) => `#assessment/${id}` };

describe("greeting helpers", () => {
  it("greet by display name, fall back to the email, then a plain word", () => {
    expect(welcomeLine(P("Mara"), "mara@example.invalid")).toBe("Welcome, Mara");
    expect(welcomeLine(P(null), "mara@example.invalid")).toBe("Welcome, mara@example.invalid");
    expect(welcomeLine(P("   "), "")).toBe("Welcome");
    expect(accountLine(P("Mara  K."), "m@example.invalid")).toBe("Account: Mara K.");
    expect(accountLine(P(null), "m@example.invalid")).toBe("Account: m@example.invalid");
    expect(accountLine(P(null), "")).toBe("Signed in");
    expect(greetingName(P("x".repeat(NAME_MAX + 1)), "e@example.invalid")).toBe("e@example.invalid");
    expect(displayNameOf(P(7))).toBe("");
  });
  it("first sign-in ask: only a signed-in account with no name that has not skipped; escaped; skippable", () => {
    expect(shouldAskName(P(null), false)).toBe(true);
    expect(shouldAskName(P(null), true)).toBe(false);
    expect(shouldAskName(P("Mara"), false)).toBe(false);
    expect(shouldAskName(P(null, "participant"), false)).toBe(false);
    expect(shouldAskName(null, false)).toBe(false);
    expect(skipKey("usr_1")).toBe("3dr.name-ask.skipped.usr_1");
    const card = nameAskCard({ value: '"><img src=x onerror=alert(1)>' });
    expect(card).toMatch(/What should we call you\?/);
    expect(card).toMatch(/data-name-skip/);
    expect(card).toContain(`maxlength="${NAME_MAX}"`);
    expect(card).not.toMatch(/<img/);
  });
  it("nameToSend trims, clears on empty, refuses over the limit", () => {
    expect(nameToSend("  Mara   K. ")).toEqual({ ok: true, value: "Mara K." });
    expect(nameToSend("   ")).toEqual({ ok: true, value: null });
    expect(nameToSend("x".repeat(NAME_MAX + 1)).ok).toBe(false);
  });
});

describe("screens that greet", () => {
  it("home greets with the name escaped, and shows the ask only when asked", () => {
    const html = homeView({ projects: [], listFor: () => null, greeting: welcomeLine(P("<b>Mara</b>"), "") });
    expect(html).toContain("data-v3h-greeting>Welcome, &lt;b&gt;Mara&lt;/b&gt;<");
    expect(html).not.toContain("<b>Mara");
    expect(html).not.toContain("data-name-ask");
    expect(homeView({ projects: [], listFor: () => null, greeting: "Welcome", askName: true })).toContain("data-name-ask");
    expect(homeView({ projects: [], listFor: () => null })).not.toContain("data-v3h-greeting");
  });
  it("kit shell welcome title reads the display name, the email as fallback", () => {
    expect(shellModel({ route: { kind: "entry" }, routes, principal: P("Mara"), email: "m@example.invalid" }).title).toBe("Welcome, Mara");
    expect(shellModel({ route: { kind: "entry" }, routes, principal: P(null), email: "m@example.invalid" }).title).toBe("Welcome, m@example.invalid");
    expect(shellModel({ route: { kind: "entry" }, routes, principal: P(null) }).title).toBe("Welcome");
    expect(shellModel({ route: { kind: "entry" }, routes, principal: null }).title).toBe("3D Review");
  });
  it("the header account line, the account-menu editor and the first sign-in ask are wired (textContent, PATCH /v2/me)", () => {
    const assess = src("../ui/assess/assess.js"), scope = src("../ui/assess/scope.js"), index = src("../ui/index.html");
    expect(assess).toContain("who.textContent = accountLine(state.principal, state.accountEmail);");
    expect(assess).toMatch(/api\('\/v2\/me', \{ method: 'PATCH', body: \{ display_name: next\.value \} \}\)/);
    expect(scope).toMatch(/ctx\.api\('\/v2\/me', \{ method: 'PATCH', body: \{ display_name: next\.value \} \}\)/);
    expect(scope).toContain("greeting: signedIn ? welcomeLine(principal, ctx.state?.accountEmail) : ''");
    expect(index).toContain('id="account-name"');
    expect(index).toMatch(/id="account-name-input"[^>]*maxlength="60"|maxlength="60"[^>]*id="account-name-input"/);
    expect(src("../ui/app.js")).toContain("Signed in as ${name}");
  });
});

describe("MCP panel", () => {
  it("greets from read cap.auth.me (textContent) and the built panel carries it", () => {
    const panel = src("../ui/mcp/panel-src.html");
    expect(panel).toContain("greet(state.me)");
    expect(panel).toContain("$('who').textContent = me?.principal ? (n ? `Signed in as ${n}` : 'Signed in') : 'Tool result';");
    expect(src("../src/mcp-panel.html")).toContain("Signed in as ${n}");
  });
  it("the action card names a saved or cleared name, escaped", () => {
    const root: any = { innerHTML: "", querySelector: () => ({ onclick: null, addEventListener() {} }) };
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const card = createActionCard({ root, esc, call: async () => ({}), explore() {}, execution() {} });
    card.receiveResult({ structuredContent: { ok: true, capability: "cap.me.update", result: { display_name: "<i>Ion</i>" }, trace_id: "t1" } });
    expect(root.innerHTML).toContain("Name saved");
    expect(root.innerHTML).toContain("&lt;i&gt;Ion&lt;/i&gt;");
    card.receiveResult({ structuredContent: { ok: true, capability: "cap.me.update", result: { display_name: null }, trace_id: "t2" } });
    expect(root.innerHTML).toContain("Name cleared");
  });
});
