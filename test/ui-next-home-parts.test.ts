// @vitest-environment jsdom
// UI Next (v4) Home's components: TopBar, Menu, Tag, Level, PhoneHeader, PhoneBar + the ?page=home states page (status: provisional).
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2 (Top bar variants and breadcrumb;
// Tag states; .lvl[data-level]; Disclosure and menu roles; Phone chrome) and section 9.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";
import TopBar from "../ui-next/src/TopBar.svelte";
import Menu from "../ui-next/src/Menu.svelte";
import Tag, { TAG_STATES, PRACTICE_LABEL } from "../ui-next/src/Tag.svelte";
import Level, { LEVELS, SKINS } from "../ui-next/src/Level.svelte";
import PhoneHeader, { HEADER_STATES } from "../ui-next/src/PhoneHeader.svelte";
import PhoneBar from "../ui-next/src/PhoneBar.svelte";
import HomeParts from "../ui-next/src/HomeParts.svelte";
import { createRawSnippet } from "svelte";

const r = (C: any, props: Record<string, unknown> = {}) => render(C, { props }).container;
const first = (C: any, props: Record<string, unknown> = {}) => r(C, props).firstElementChild as HTMLElement;
const sum = createRawSnippet(() => ({ render: () => "<span>More</span>" }));
const CRUMBS = [{ label: "BCS · India", href: "#w" }, { label: "Hindi New Testament", href: "#p" }, { label: "Mark 1–4 draft" }];

describe("TopBar", () => {
  it("signed-in: brand → workspace switcher → APG breadcrumb → help → account menu", () => {
    const top = first(TopBar, { crumbs: CRUMBS });
    expect(top.tagName).toBe("HEADER");
    expect([...top.classList]).toEqual(["top"]);
    expect(top.dataset.variant).toBe("signed-in");
    expect([...top.children].map((c) => c.className)).toEqual(["brand", "dd", "crumb", "top-end"]);
    const nav = top.querySelector("nav.crumb")!;
    expect(nav.getAttribute("aria-label")).toBe("Breadcrumb");
    const lis = [...nav.querySelectorAll("ol > li")];
    expect(lis.map((l) => l.textContent)).toEqual(CRUMBS.map((c) => c.label));
    expect(lis.slice(0, 2).every((l) => l.firstElementChild!.matches("a.link[href]"))).toBe(true);
    const cur = lis[2].firstElementChild!;
    expect(cur.tagName).toBe("SPAN");
    expect(cur.getAttribute("aria-current")).toBe("page");
    expect(nav.textContent).not.toMatch(/[/›]/);
    expect(top.querySelector(".top-end a.btn.btn-quiet.btn-icon[aria-label=Help]")).not.toBeNull();
    expect(top.querySelectorAll("details.dd").length).toBe(2);
  });
  it("public: no switcher, no account, no crumb; Help and FAQ quiet + Sign in", () => {
    const top = first(TopBar, { variant: "public" });
    expect(top.dataset.variant).toBe("public");
    expect(top.querySelector("details, nav.crumb, .av")).toBeNull();
    expect([...top.querySelectorAll(".top-end .btn")].map((b) => [b.className, b.textContent])).toEqual([["btn btn-quiet", "Help and FAQ"], ["btn", "Sign in"]]);
  });
  it("refuses unported variants and a public crumb", () => {
    expect(() => r(TopBar, { variant: "flow" })).toThrow(/not ported/);
    expect(() => r(TopBar, { variant: "public", crumbs: CRUMBS })).toThrow(/no breadcrumb/);
  });
  it("the account menu opens from its prop and is a disclosure, not role=menu", () => {
    const top = first(TopBar, { accountOpen: true });
    const dd = top.querySelector(".top-end details.dd") as HTMLDetailsElement;
    expect(dd.open).toBe(true);
    expect(top.querySelector("[role=menu],[role=menuitem],[aria-haspopup]")).toBeNull();
    expect(dd.querySelector("summary .av")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Menu", () => {
  const items = [{ label: "Edit", href: "#e" }, { kind: "hr" }, { label: "Delete this review", danger: true, refused: "Reviews with responses can't be deleted. This one has 18." }];
  it("details.dd > summary + .glass-hi.menu, items in source order, no menu roles", () => {
    const d = first(Menu, { summary: sum, label: "More for this review", items, id: "t" });
    expect(d.matches("details.dd")).toBe(true);
    expect((d as HTMLDetailsElement).open).toBe(false);
    expect(d.querySelector(":scope > summary")!.getAttribute("aria-label")).toBe("More for this review");
    expect([...d.querySelector(".menu")!.classList]).toEqual(["glass-hi", "menu"]);
    expect([...d.querySelectorAll(".menu > *")].map((e) => e.tagName)).toEqual(["A", "HR", "BUTTON", "P"]);
    expect(d.querySelector("[role]")).toBeNull();
  });
  it("refused item: button.mi.danger[aria-disabled=true] described by the visible reason", () => {
    const d = first(Menu, { summary: sum, items, id: "t", open: true });
    const b = d.querySelector("button.mi.danger")!;
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.hasAttribute("disabled")).toBe(false);
    const why = d.querySelector(`#${b.getAttribute("aria-describedby")}`)!;
    expect([...why.classList]).toEqual(["mi-why", "small"]);
    expect(why.textContent).toMatch(/can't be deleted/);
  });
  it("enforces the danger-last-after-hr and refused-never-a-link rules", () => {
    expect(() => r(Menu, { summary: sum, items: [{ label: "Delete", danger: true }, { label: "Edit", href: "#" }] })).toThrow(/last/);
    expect(() => r(Menu, { summary: sum, items: [{ label: "Edit", href: "#" }, { label: "Delete", danger: true }] })).toThrow(/hr/);
    expect(() => r(Menu, { summary: sum, items: [{ label: "X", href: "#", refused: "why" }] })).toThrow(/never a link/);
  });
});

describe("Tag", () => {
  it("neutral label chip", () => {
    const t = first(Tag, { label: "1 new" });
    expect([...t.classList]).toEqual(["tag"]);
    expect(t.textContent).toBe("1 new");
    expect(t.hasAttribute("data-state")).toBe(false);
  });
  for (const [state, words] of Object.entries(TAG_STATES)) {
    it(`state ${state}: word + aria-hidden icon, no dot`, () => {
      const t = first(Tag, { state });
      expect(t.dataset.state).toBe(state);
      expect(t.textContent).toBe(words);
      expect(t.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
      expect(t.querySelector(".lensdot")).toBeNull();
    });
  }
  it("practice slot carries R5's words", () => {
    const t = first(Tag, { kind: "practice" });
    expect(t.dataset.kind).toBe("practice");
    expect(t.textContent).toBe(PRACTICE_LABEL);
  });
  it("lens dot only for a perspective, from data-lens", () => {
    const t = first(Tag, { label: "Community", lens: "community" });
    expect(t.querySelector("i.lensdot[data-lens=community][aria-hidden=true]")).not.toBeNull();
    expect(() => r(Tag, { state: "ready", lens: "team" })).toThrow();
    expect(() => r(Tag, { state: "nope" })).toThrow();
    expect(() => r(Tag, {})).toThrow();
  });
});

describe("Level", () => {
  const ON: Record<string, number> = { strong: 4, growing: 3, support: 2, urgent: 1, more: 0 };
  for (const [level, name] of Object.entries(LEVELS)) {
    it(`${level}: .lvl[data-level] with four aria-hidden skins and the name "${name}"`, () => {
      const l = first(Level, { level });
      expect([...l.classList]).toEqual(["lvl"]);
      expect(l.dataset.level).toBe(level);
      const gs = [...l.querySelectorAll(":scope > .g")];
      expect(gs.map((g) => SKINS.find((s: string) => g.classList.contains(`g-${s}`)))).toEqual(SKINS);
      expect(gs.every((g) => g.getAttribute("aria-hidden") === "true")).toBe(true);
      expect(l.querySelectorAll(".g-bars b.on").length).toBe(ON[level]);
      expect(l.querySelector(".g-bars")!.classList.contains("gap")).toBe(level === "more");
      expect(l.querySelector(".lvl-name")!.textContent).toBe(name);
    });
  }
  it("refuses unknown levels and caller labels", () => {
    expect(() => r(Level, { level: "ok" })).toThrow();
    expect(() => r(Level, { level: "strong", label: "x" })).toThrow();
  });
});

describe("PhoneHeader", () => {
  it("ports the four facilitator states", () => expect(HEADER_STATES).toEqual(["root", "nested", "public", "setup-step"]));
  const cases: [string, Record<string, unknown>, string[]][] = [
    ["root", {}, ["A.brand", "A.menu-btn"]],
    ["nested", { title: "Hindi New Testament", parent: "Home" }, ["A.btn btn-quiet btn-icon", "SPAN.phone-title", "A.menu-btn"]],
    ["public", {}, ["A.brand", "A.btn btn-quiet"]],
    ["setup-step", { step: 3 }, ["A.btn btn-quiet btn-icon", "SPAN.phone-step"]],
  ];
  for (const [state, props, kids] of cases) {
    it(`${state}: .phone-top[data-shell=facilitator][data-state], ≤ 3 targets`, () => {
      const h = first(PhoneHeader, { state, ...props });
      expect(h.tagName).toBe("HEADER");
      expect([...h.classList]).toEqual(["phone-top"]);
      expect(h.dataset.shell).toBe("facilitator");
      expect(h.dataset.state).toBe(state);
      expect([...h.children].map((c) => `${c.tagName}.${c.className}`)).toEqual(kids);
      expect(h.querySelectorAll("a, button").length).toBeLessThanOrEqual(3);
      expect(h.querySelector(".crumb")).toBeNull();
    });
  }
  it("names its controls", () => {
    expect(first(PhoneHeader, { state: "nested", title: "T", parent: "Home" }).querySelector("[aria-label='Back to Home']")).not.toBeNull();
    expect(first(PhoneHeader, { state: "setup-step", step: 2 }).querySelector("[aria-label='Close setup']")).not.toBeNull();
    expect(first(PhoneHeader, { state: "setup-step", step: 2 }).textContent).toContain("Step 2 of 5");
    expect(first(PhoneHeader).querySelector("[aria-label='Workspace and account']")).not.toBeNull();
    expect(() => r(PhoneHeader, { state: "nested" })).toThrow();
    expect(() => r(PhoneHeader, { state: "setup-step", step: 9 })).toThrow();
  });
});

describe("PhoneBar", () => {
  it("one primary, optional quiet Back first", () => {
    const b = first(PhoneBar, { label: "Next", backHref: "#b", href: "#n" });
    expect([...b.classList]).toEqual(["glass", "phone-bar"]);
    expect(b.querySelectorAll(".btn-primary").length).toBe(1);
    expect([...b.querySelectorAll(".btn")].map((x) => x.className)).toEqual(["btn btn-quiet", "btn btn-primary btn-lg"]);
    expect(first(PhoneBar, { label: "Start a 3D Review", lead: "plus" }).querySelectorAll(".btn").length).toBe(1);
    expect(() => r(PhoneBar, {})).toThrow();
  });
  it("disabled: the primary is a native disabled button (no link), tied to its reason by aria-describedby (actions R4-2)", () => {
    const b = first(PhoneBar, { label: "Print surveys", href: "#print", disabled: true, ariaDescribedby: "why" });
    const p = b.querySelector(".btn-primary") as HTMLButtonElement;
    expect(p.tagName).toBe("BUTTON");
    expect(p.disabled).toBe(true);
    expect(p.getAttribute("aria-describedby")).toBe("why");
    expect(b.querySelector("a")).toBeNull();
    const on = first(PhoneBar, { label: "Print surveys", href: "#print", ariaDescribedby: "why" }).querySelector(".btn-primary") as HTMLAnchorElement;
    expect(on.tagName).toBe("A");
    expect(on.getAttribute("href")).toBe("#print");
    expect(on.getAttribute("aria-describedby")).toBe("why");
    expect(first(PhoneBar, { label: "Next", href: "#n" }).querySelector("[aria-describedby], [disabled]")).toBeNull();
    const back = first(PhoneBar, { label: "Next", backHref: "#b", href: "#n", disabled: true });
    expect((back.querySelector(".btn-quiet") as HTMLAnchorElement).getAttribute("href")).toBe("#b");
    expect(() => r(PhoneBar, { label: "Next", disabled: "yes" })).toThrow();
    expect(() => r(PhoneBar, { label: "Next", ariaDescribedby: "#why" })).toThrow();
  });
  it("trail: a named icon after the label, as Button's trail draws it (integration N3: ResultsPhone \"Plan the next step\" arrow)", () => {
    const a = first(PhoneBar, { label: "Plan the next step", href: "#next", trail: "arrow" }).querySelector(".btn-primary") as HTMLAnchorElement;
    expect(a.tagName).toBe("A");
    expect(a.textContent).toBe("Plan the next step");
    const nodes = [...a.childNodes].filter((n) => n.nodeType === 1 || (n.textContent ?? "").trim());
    expect(nodes.map((n) => (n.nodeType === 1 ? (n as Element).tagName.toLowerCase() : "label"))).toEqual(["label", "svg"]);
    expect(a.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(a.querySelector("svg path")!.getAttribute("d")).toBe("M5 12h14M13 6l6 6-6 6");
    const both = first(PhoneBar, { label: "Next", href: "#n", lead: "plus", trail: "arrow" }).querySelector(".btn-primary")!;
    expect([...both.childNodes].filter((n) => n.nodeType === 1 || (n.textContent ?? "").trim())
      .map((n) => (n.nodeType === 1 ? (n as Element).tagName.toLowerCase() : "label"))).toEqual(["svg", "label", "svg"]);
    const off = first(PhoneBar, { label: "Next", href: "#n", trail: "arrow", disabled: true }).querySelector(".btn-primary")!;
    expect(off.tagName).toBe("BUTTON");
    expect(off.querySelectorAll("svg").length).toBe(1);
    expect(first(PhoneBar, { label: "Next", href: "#n", trail: "arrow", demoted: true }).querySelector("a.btn svg")).not.toBeNull();
    expect(first(PhoneBar, { label: "Next", href: "#n" }).querySelector("svg")).toBeNull();
    expect(() => r(PhoneBar, { label: "Next", trail: "plus" })).toThrow(/unknown trail icon/);
    expect(() => r(PhoneBar, { label: "Next", trail: "chevron" })).toThrow(/unknown trail icon/);
  });
  it("demoted: no primary in the bar while a dialog or sheet holds it; the action stays a block secondary (people C6)", () => {
    const b = first(PhoneBar, { label: "New project", lead: "plus", href: "#setup", demoted: true });
    expect([...b.classList]).toEqual(["glass", "phone-bar"]);
    expect(b.getAttribute("role")).toBe("group");
    expect(b.querySelector(".btn-primary")).toBeNull();
    const a = b.querySelector("a.btn") as HTMLAnchorElement;
    expect(a.className).toBe("btn btn-lg btn-block");
    expect(a.getAttribute("href")).toBe("#setup");
    expect(a.textContent).toBe("New project");
    expect(a.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect([...first(PhoneBar, { label: "Next", backHref: "#b", href: "#n", demoted: true }).querySelectorAll(".btn")].map((x) => x.className)).toEqual(["btn btn-quiet", "btn btn-lg btn-block"]);
    expect(() => r(PhoneBar, { label: "Next", demoted: 1 })).toThrow();
  });
});

describe("?page=home states page", () => {
  it("both themes, every component state, no inline style", () => {
    const c = r(HomeParts);
    const sheets = [...c.querySelectorAll("section.app.gx-sheet")];
    expect(sheets.map((s) => s.getAttribute("data-theme"))).toEqual(["light", "dark"]);
    for (const s of sheets) {
      expect([...s.querySelectorAll(".top")].map((t) => t.getAttribute("data-variant"))).toEqual(["signed-in", "signed-in", "signed-in", "public"]);
      expect(s.querySelectorAll(".mi[aria-disabled=true]").length).toBe(1);
      expect(s.querySelectorAll(".tag[data-state]").length).toBe(3);
      expect(s.querySelector(".tag[data-kind=practice]")).not.toBeNull();
      expect([...s.querySelectorAll("[data-imagery]")].map((e) => e.getAttribute("data-imagery"))).toEqual(SKINS);
      expect(s.querySelectorAll(".lvl").length).toBe(20);
      expect([...s.querySelectorAll(".phone-top")].map((h) => h.getAttribute("data-state"))).toEqual(HEADER_STATES);
      expect(s.querySelectorAll(".phone-bar").length).toBe(4);
      const off = s.querySelector(".phone-bar button.btn-primary[disabled]") as HTMLElement;
      expect(s.querySelector(`#${off.getAttribute("aria-describedby")}`)?.textContent).toContain("nothing ticked");
      expect(s.querySelectorAll(".phone-bar .btn-block:not(.btn-primary)").length).toBe(1);
    }
    expect(c.querySelector("[style]")).toBeNull();
    expect(c.querySelector("[role=menu]")).toBeNull();
  });
  it("phone mode drops the desktop top bar (8.4: desktop only)", () => {
    expect(r(HomeParts, { phone: true }).querySelector(".top")).toBeNull();
  });
  it("lint is clean on ui-next and the new CSS paints only from tokens", () => {
    const res = lintDir(resolve(process.cwd(), "ui-next"));
    expect(res.size).toBe(0);
    for (const f of ["topbar", "menu", "tag", "level", "phone"]) expect(readFileSync(resolve(process.cwd(), `ui-next/components/${f}.css`), "utf8")).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
