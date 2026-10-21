// @vitest-environment jsdom
// UI Next (v4) people lane screens + their /next/ routes (status: provisional).
// Unit: 3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/ (people lane). Boards: design/2026-10-15-glass-redesign/canvas
// People, PeoplePhone, PeopleWorkspace, PeopleWorkspacePhone, Workspace, WorkspacePhone, WorkspaceGroup, WorkspaceGroupPhone, Invitations,
// InvitationsPhone, SignInCheck, SignInCheckPhone, SignInPhone (.dc.html). Data: ui-next/fixtures/people/ through screens/people/people-data.js.
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import lane from "../ui-next/src/screens/people/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { rosterRows, inviteOptions, groupRows, invitationRows } from "../ui-next/src/screens/people/people-data.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";
import People from "../ui-next/src/screens/people/People.svelte";
import Workspace from "../ui-next/src/screens/people/Workspace.svelte";
import SignIn from "../ui-next/src/screens/people/SignIn.svelte";
import people from "../ui-next/fixtures/people/people.json";
import invites from "../ui-next/fixtures/people/invitations.json";

type P = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mount = (C: any, props: P = {}) => render(C, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const p = (q: string) => new URLSearchParams(q);
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

// board, screen, phone, key copy rows (word for word from the board)
const BOARDS: [string, string, boolean, string[]][] = [
  ["People", "people", false, ["Mark 1–4 draft", "People with access to this review", "Share the survey", "Roles flow down, never up: a workspace member can run every review in it; a review viewer sees only that review."]],
  ["PeoplePhone", "people", true, ["People with access", "Invite by email", "People · 4", "Invited · 3 days ago", "Send invitation"]],
  ["PeopleWorkspace", "people-workspace", false, ["People in this workspace", "Someone invited only to a project or a review does not appear here.", "Can create projects and run reviews in all of them"]],
  ["PeopleWorkspacePhone", "people-workspace", true, ["People in this workspace", "BCS · India", "People · 4"]],
  ["Workspace", "workspace", false, ["Bridge Connectivity Solutions · India", "Partners never see each other's workspaces.", "Completed this year", "No results yet", "lists everything you facilitate."]],
  ["WorkspacePhone", "workspace", true, ["BCS · India", "Projects · 5", "Collecting · Hindi · Written", "Your reviews across workspaces", "New project"]],
  ["WorkspaceGroup", "workspace-group", false, ["Add a project to this workspace", "Only a direct project owner can group it; a role inherited from a workspace is never enough.", "Inherited · cannot group", "Add to workspace"]],
  ["WorkspaceGroupPhone", "workspace-group", true, ["Add a project to this workspace", "Cannot group: your access comes from the workspace, not a project grant", "Add to workspace"]],
  ["Invitations", "invitations", false, ["Your invitations", "Odia New Testament · project", "From Andy V. · as a Member — you can start and run reviews · expires 24 Oct", "Psalms reading group · review", "Back to your reviews"]],
  ["InvitationsPhone", "invitations", true, ["Invitations", "Steve invited you to facilitate reviews in this workspace · 2 days ago", "Accepted · Aug 2026", "Accept and open the workspace"]],
  ["SignInCheck", "sign-in-check", false, ["Check your email", "It works for 30 minutes. Check your spam folder if it is slow.", "I've opened the link", "Link not working? Use the 6-digit code instead"]],
  ["SignInCheckPhone", "sign-in-check", true, ["Check your email", "Open it on this phone to sign in.", "I've opened the link", "Send it again"]],
  ["SignInPhone", "sign-in", true, ["Sign in", "We email you a link. No password to remember.", "Email me a sign-in link", "enter your code"]],
];

describe("people lane registry and routes", () => {
  it("registers seven kebab-case screens, merged into the shared registry under the people lane", () => {
    expect(Object.keys(lane)).toEqual(["people", "people-workspace", "workspace", "workspace-group", "invitations", "sign-in", "sign-in-check"]);
    expect(LANES.people).toBe(lane);
    for (const name of Object.keys(lane)) expect(REGISTRY[name], name).toBe(lane[name]);
  });
  it("every board's screen URL routes to its screen with phone, theme and state", () => {
    const names = Object.keys(REGISTRY);
    for (const [board, name, phone] of BOARDS) {
      const q = `?ui_next=on&screen=${name}${phone ? "&w=phone" : ""}&theme=dark`;
      expect(route(p(q), store(), names), board).toEqual({ view: name, props: { phone, theme: "dark", state: undefined } });
    }
  });
});

describe("each board renders as a screen", () => {
  for (const [board, name, phone, copy] of BOARDS) {
    it(`${board} (?screen=${name}${phone ? "&w=phone" : ""}): renders, at most one .btn-primary, key copy, no inline style`, () => {
      const a = mount(lane[name], { phone });
      expect(a).not.toBeNull();
      expect(a.getAttribute("data-w")).toBe(phone ? "phone" : null);
      expect(a.querySelector(phone ? "header.phone-top" : "main.l-main")).not.toBeNull();
      expect(a.querySelectorAll(".btn-primary").length).toBeLessThanOrEqual(1);
      expect(a.querySelectorAll("h1").length).toBe(1);
      for (const c of copy) expect(text(a), c).toContain(c);
      expect(a.querySelector("[style]")).toBeNull();
      expect(mount(lane[name], { phone, theme: "dark" }).getAttribute("data-theme")).toBe("dark");
    });
  }
  it("a ?state= no board draws, an unknown scope or an unknown step throws", () => {
    for (const C of Object.values(lane)) expect(() => mount(C, { state: "nope" })).toThrow(/no board draws state "nope"/);
    expect(() => mount(People, { scope: "project" })).toThrow(/unknown scope/);
    expect(() => mount(SignIn, { step: "code" })).toThrow(/unknown step/);
  });
  it("the people lane's screens lint clean (no <style>, no inline style, tokens only)", () => {
    expect(lintDir(resolve(__dirname, "../ui-next/src/screens/people")).size).toBe(0);
  });
});

describe("People: roster gating comes from ui/scope-invitations.js", () => {
  it("review scope (owner): role select only where canUpdateGrant, inherited row changes on the project, pending invitation row", () => {
    const a = mount(lane.people);
    const rows = [...a.querySelectorAll("tbody tr")];
    expect(rows.map((r) => [r.querySelector(".av")!.textContent, r.querySelector("b")!.textContent, r.querySelector("td .small")!.textContent])).toEqual([["BK", "Bincy Kurian (you)", "bincy@example.org"], ["AV", "Andy V.", "andy@example.org"], ["SW", "Steve W.", "steve@example.org"], ["?", "rina@example.org", "Invited 2 Oct · not yet accepted"]]);
    expect(rows.map((r) => r.querySelectorAll("td")[1].querySelector("select") !== null)).toEqual([false, true, true, false]);
    expect(rows.map((r) => [...r.querySelectorAll("td")[3].querySelectorAll(".btn, .small")].map((b) => b.textContent))).toEqual([["Transfer ownership"], ["Change on the project"], ["Remove"], ["Resend", "Withdraw"]]);
    expect(text(rows[1])).toContain("from project");
    expect([...a.querySelectorAll("#pp-as option")].map((o) => o.textContent)).toEqual(["Viewer — reads results", "Member — runs reviews", "Owner — everything"]);
    expect(a.querySelector("nav.tabs [aria-current=page]")!.textContent).toContain("Collect");
    expect(a.querySelector("button.mi.danger[aria-disabled=true]")!.textContent).toContain("Delete this review");
    expect(text(a)).toContain("Reviews with responses can't be deleted. This one has 18.");
  });
  it("workspace scope (member): no role select and no owner transfer — the server refuses both to a member", () => {
    const a = mount(lane["people-workspace"]);
    expect(a.querySelectorAll("tbody select").length).toBe(0);
    expect(text(a)).not.toContain("Transfer ownership");
    expect([...a.querySelectorAll("tbody tr")].map((r) => text(r.querySelectorAll("td")[3]))).toEqual(["", "Remove", "Remove", "Remove"]);
    expect([...a.querySelectorAll("#pp-as option")].map((o) => o.textContent)).toEqual(["Viewer — reads results", "Member — runs reviews"]);
  });
  it("phone: one action menu per person, destructive item last after an hr, phone role labels", () => {
    const a = mount(lane.people, { phone: true });
    const menus = [...a.querySelectorAll("details.dd")];
    expect(menus.map((m) => m.querySelector("summary")!.getAttribute("aria-label"))).toEqual(["Actions for Bincy K", "Actions for Ravi S", "Actions for steve@seed.org", "Actions for Amanda M"]);
    expect(menus.map((m) => [...m.querySelectorAll(".mi")].map((i) => i.textContent))).toEqual([["Transfer ownership"], ["Transfer ownership", "Remove"], ["Resend", "Withdraw"], ["Remove"]]);
    for (const m of menus) { const d = m.querySelector(".mi.danger"); if (d && d.previousElementSibling) expect(d.previousElementSibling.className).toBe("hr"); }
    expect([...a.querySelectorAll("#pp-role option")].map((o) => o.textContent)).toEqual(["Member — can run reviews", "Viewer — can read results"]);
    expect(a.querySelector(".phone-bar .btn-primary")!.textContent).toBe("Send invitation");
  });
});

describe("Workspace and the group dialog", () => {
  it("desktop: five stats, five project cards with stage pills, levels or No results yet, New project is the primary", () => {
    const a = mount(Workspace);
    expect([...a.querySelectorAll(".num.h1")].map((n) => n.textContent)).toEqual(["12", "9", "3", "2", "7"]);
    expect([...a.querySelectorAll("a.card-link.glass")].map((c) => c.querySelector("h3")!.textContent)).toEqual(["Hindi New Testament", "Odia New Testament", "Kurubaru Scripture", "ISL Mark", "Lao Old Testament"]);
    expect([...a.querySelectorAll("a.card-link .pill")].map((x) => x.getAttribute("data-stage"))).toEqual(["collecting", "setup", "collecting", "done", "setup"]);
    expect(a.querySelectorAll(".lvl").length).toBe(9);
    expect(a.querySelector(".btn-primary")!.textContent).toBe("New project");
    expect(a.querySelector("dialog")).toBeNull();
  });
  it("group (WorkspaceGroup): a native open <dialog>, rows gated by mayGroup, the dialog holds the one primary", () => {
    for (const phone of [false, true]) {
      const a = mount(Workspace, { group: true, phone });
      const dlg = a.querySelector("dialog")!;
      expect(dlg.hasAttribute("open")).toBe(true);
      expect(dlg.getAttribute("aria-labelledby")).toBe("ws-group-title");
      expect([...dlg.querySelectorAll("input.rd")].map((r) => (r as HTMLInputElement).disabled)).toEqual([false, false, true]);
      expect(a.querySelectorAll(".btn-primary").length).toBe(1);
      expect(dlg.querySelector(".btn-primary")!.textContent).toBe("Add to workspace");
    }
  });
});

describe("Invitations and sign-in", () => {
  it("desktop invitations: the first Accept is the primary, the second a secondary with a check", () => {
    const a = mount(lane.invitations);
    const accepts = [...a.querySelectorAll(".btn")].filter((b) => b.textContent === "Accept");
    expect(accepts.map((b) => b.classList.contains("btn-primary"))).toEqual([true, false]);
  });
  it("sign-in: the email field carries the board's address; the check step keeps the 6-digit code fallback", () => {
    // two mounted screens share the id si-email; jsdom resolves "#id" document-first, so query by type inside each .app
    const ph = mount(lane["sign-in"], { phone: true }).querySelector("input[type=email]") as HTMLInputElement;
    const dt = mount(lane["sign-in"]).querySelector("input[type=email]") as HTMLInputElement;
    expect([ph?.value, dt?.value]).toEqual(["bincy@bcs.org.in", "bincy@example.org"]);
    const c = mount(lane["sign-in-check"]);
    expect(c.querySelector("details.disc > summary.disc-sum")!.textContent).toBe("Link not working? Use the 6-digit code instead");
    expect(c.querySelector("#si-code")!.getAttribute("autocomplete")).toBe("one-time-code");
  });
});

describe("people-data.js adapts through the current UI's modules", () => {
  const roles = people.roles;
  it("rosterRows: a viewer is offered nothing; a member never a role change; an owner never removes an owner", () => {
    const roster = { grants: [{ id: "a", principal_id: "me", role: "viewer" }, { id: "b", principal_id: "x", role: "member" }, { id: "c", principal_id: "y", role: "owner" }], pending_invitations: [{ id: "i", role: "viewer", status: "pending", email: "z@example.org", invited: "1 Oct" }, { id: "j", role: "viewer", status: "revoked", email: "gone@example.org" }] };
    const v = rosterRows(roster, { me: "me", roles });
    expect(v.myRole).toBe("viewer");
    expect(v.rows.flatMap((r: { actions: string[] }) => r.actions)).toEqual([]);
    expect(v.rows.map((r: { key: string }) => r.key)).toEqual(["a", "b", "c", "i"]);
    const m = rosterRows({ ...roster, grants: roster.grants.map((g) => (g.principal_id === "me" ? { ...g, role: "member" } : g)) }, { me: "me", roles });
    expect(m.rows.some((r: { editable: boolean }) => r.editable)).toBe(false);
    const o = rosterRows({ ...roster, grants: roster.grants.map((g) => (g.principal_id === "me" ? { ...g, role: "owner" } : g)) }, { me: "me", roles });
    expect(o.rows.find((r: { key: string }) => r.key === "c").actions).toEqual([]);
    expect(o.rows.find((r: { key: string }) => r.key === "b").editable).toBe(true);
  });
  it("inviteOptions follows invitationRoles; groupRows follows mayGroup; invitationRows drops malformed rows", () => {
    expect(inviteOptions("viewer", people.inviteLabels)).toEqual([]);
    expect(inviteOptions("owner", people.inviteLabels).map(([r]: string[]) => r)).toEqual(["viewer", "member", "owner"]);
    expect(groupRows({ workspaceRole: "viewer", candidates: [{ title: "A", directRole: "owner" }] })[0].can).toBe(false);
    expect(groupRows({ workspaceRole: "member", candidates: [{ title: "A", directRole: "owner" }, { title: "B", directRole: "member" }] }).map((r: { can: boolean }) => r.can)).toEqual([true, false]);
    const rows = invitationRows({ invitations: [...invites.desktop.invitations, { id: "", role: "viewer", scope: { type: "project" } }, { id: "x", scope: { type: "project", name: "No role" } }] }, { kinds: invites.kinds, can: invites.can, roles: invites.roles });
    expect(rows.map((r: { title: string }) => r.title)).toEqual(["Odia New Testament · project", "Psalms reading group · review"]);
  });
});
