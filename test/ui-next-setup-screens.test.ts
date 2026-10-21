// @vitest-environment jsdom
// UI Next (v4) setup lane screens (status: provisional): setup1-setup5 and project, desktop and phone (?w=phone).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Setup1-5.dc.html, Setup1Phone, Setup2Phone, SetupPhone (step 3),
// Setup4Phone, Setup5Phone, Project.dc.html, ProjectPhone.dc.html; contracts design-system.md section 2 and 8.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { LANES, REGISTRY } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import setup from "../ui-next/src/screens/setup/index.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";
// @ts-expect-error -- plain .js module, no type declarations
import { GROUP_FIELDS, RESPONDENT_FIELDS } from "../ui/v3/components/context-fields.js";
// @ts-expect-error -- plain .js module, no type declarations
import { PERSPECTIVE_WHO } from "../ui/assess/scope.js";
// @ts-expect-error -- plain .svelte component, rendered on its own for the status-line check
import LangSearch from "../ui-next/src/screens/setup/LangSearch.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { OUT, out } from "../ui-next/src/screens/setup/links.js";
// @ts-expect-error -- plain .js module, no type declarations
import { surveys, whoLines, whoShort, aboutLine } from "../ui-next/src/screens/setup/draft.js";
import setupData from "../ui-next/fixtures/setup/setup.json";
import projectData from "../ui-next/fixtures/setup/project.json";

const NAMES = ["setup1", "setup2", "setup3", "setup4", "setup5", "project"];
const screen = (name: string, props: Record<string, unknown> = {}) => render(setup[name], { props }).container.querySelector(".app") as HTMLElement;
const text = (a: Element, sel: string) => [...a.querySelectorAll(sel)].map((e) => e.textContent!.trim());
const LANE = resolve(__dirname, "../ui-next/src/screens/setup");
const at = (search: string) => window.history.replaceState(null, "", `/next/${search}`);
afterEach(() => at(""));
const on = () => { const m = new Map<string, string>([["ui_next", "on"]]); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("setup lane registry and route", () => {
  it("registers the six setup lane screens under lowercase kebab names", () => {
    expect(Object.keys(setup)).toEqual(NAMES);
    expect(LANES.setup).toBe(setup);
    for (const n of NAMES) expect(REGISTRY[n]).toBe(setup[n]);
  });
  it("every screen is reachable at /next/?ui_next=on&screen=<name>, phone twin via &w=phone", () => {
    const names = Object.keys(REGISTRY);
    for (const n of NAMES) {
      expect(route(new URLSearchParams(`?ui_next=on&screen=${n}`), on(), names)).toEqual({ view: n, props: { phone: false, theme: "light", state: undefined } });
      expect(route(new URLSearchParams(`?screen=${n}&w=phone&theme=dark`), on(), names)).toEqual({ view: n, props: { phone: true, theme: "dark", state: undefined } });
    }
  });
});

describe("every screen, desktop and phone: shell, one primary, no inline style, layout levels", () => {
  for (const n of NAMES) for (const phone of [false, true]) {
    it(`${n}${phone ? " (phone)" : ""}`, () => {
      const a = screen(n, { phone });
      expect(a.matches(".app.l-screen")).toBe(true);
      expect(a.getAttribute("data-w")).toBe(phone ? "phone" : null);
      expect(a.querySelector(phone ? ".phone-top" : "header.top")).not.toBeNull();
      expect(a.querySelector(phone ? "header.top" : ".phone-top")).toBeNull();
      expect(a.querySelectorAll("h1").length).toBe(1);
      expect(a.querySelector("[style]")).toBeNull();
      expect(a.querySelectorAll(".btn-primary").length).toBe(1);
      if (phone) expect(a.querySelector(".phone-bar .btn-primary")).not.toBeNull();
      for (const el of a.querySelectorAll(".l-stack, .l-row, .l-grid, .l-card")) expect(el.closest(".l-page, .l-phone"), el.className).not.toBeNull();
      const ids = [...a.querySelectorAll("[id]")].map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const l of a.querySelectorAll("label[for]")) expect(a.querySelector(`#${l.getAttribute("for")}`), l.getAttribute("for")!).not.toBeNull();
    });
  }
  it("dark theme sets data-theme; an unknown ?state= renders the default state and never throws (each board draws one state)", () => {
    for (const n of NAMES) for (const phone of [false, true]) {
      expect(screen(n, { theme: "dark", phone }).getAttribute("data-theme")).toBe("dark");
      const plain = screen(n, { phone }).innerHTML;
      for (const state of ["busy", "", "menu", "1"]) {
        const a = screen(n, { phone, state });
        expect(a.innerHTML, `${n} state=${state}`).toBe(plain);
        expect(a.querySelectorAll("h1").length).toBe(1);
      }
    }
  });
});

describe("setup frame: flow top bar, stepper, phone progress", () => {
  const STEPS = ["Details", "The passage", "Who will participate?", "About each group", "Launch"];
  it("desktop: flow top bar (R12) and the stepper as ol.tabs.steps with done / current / upcoming (R17)", () => {
    for (let s = 1; s <= 5; s++) {
      const a = screen(`setup${s}`);
      const top = a.querySelector("header.top[data-variant=flow]")!;
      expect(top.querySelector(".crumb [aria-current=page]")!.textContent).toBe("Start a 3D Review");
      expect(top.querySelector("[role=status]")!.textContent).toBe("Draft saved");
      expect(top.querySelector(".menu, details.dd")).toBeNull();
      const ol = a.querySelector("ol.tabs.steps[aria-label='Setup steps']")!;
      expect(text(ol, "li .tab").map((t) => t.replace(/^\d/, ""))).toEqual(STEPS);
      expect(ol.querySelector("[aria-current=step]")!.textContent).toBe(`${s}${STEPS[s - 1]}`);
      expect(ol.querySelectorAll("a.tab .dot.done").length).toBe(s - 1);
      expect(ol.querySelectorAll(".tab[aria-disabled=true]").length).toBe(5 - s);
    }
  });
  it("phone: setup-step header (R13: Close · Step n of 5, no avatar), progress bar, Back from step 2", () => {
    for (let s = 1; s <= 5; s++) {
      const a = screen(`setup${s}`, { phone: true });
      expect(a.querySelector(".phone-top[data-state=setup-step] .phone-step")!.textContent).toBe(`Step ${s} of 5`);
      expect(a.querySelector(".phone-top .av")).toBeNull();
      expect(a.querySelector(".bar[role=progressbar]")!.getAttribute("aria-valuenow")).toBe(String(s));
      expect(a.querySelector(".phone-bar .btn-quiet") !== null).toBe(s > 1);
    }
  });
});

describe("key copy and data, per board", () => {
  it("setup1 (Setup1 / Setup1Phone): details fields, language search state, format", () => {
    const a = screen("setup1");
    expect(a.querySelector("h1")!.textContent).toBe("Tell us about this review");
    expect(text(a, "label.lbl, span.lbl")).toEqual(["Name this review", "Project", "Language being reviewed", "Location or community (optional)", "Facilitator (optional)", "Translation format", "Survey opens (optional)", "Survey closes"]);
    expect((a.querySelector("#name") as HTMLInputElement).value).toBe("Mark 1–4 draft");
    expect(a.querySelector(".chip")!.textContent!.trim()).toBe("Odia · ory");
    expect(a.querySelector("p[role=status]")!.textContent).toBe("1 match");
    expect(text(a, "label.row-opt")).toEqual(["Written", "Audio", "Video or sign"]);
    expect((a.querySelector("input.rd:checked") as HTMLInputElement).value).toBe("Written");
    expect(a.querySelector(".btn-primary")!.textContent).toBe("Continue");
    const p = screen("setup1", { phone: true });
    expect(p.querySelector("h1")!.textContent).toBe("Details");
    expect(text(p, "#f option")).toEqual(["Written", "Audio", "Video", "Sign"]);
  });
  it("language search: the match line stays silent until there is a query (F10), then counts", () => {
    const status = (props: Record<string, unknown>) => render(LangSearch, { props: { id: "q", ...props } }).container.querySelector("[role=status]")!.textContent;
    expect(status({ query: "", matches: [] })).toBe("");
    expect(status({ query: "  ", matches: [] })).toBe("");
    expect(status({ query: "zz", matches: [] })).toBe("No matching languages.");
    expect(status({ query: "od", matches: [{ name: "Odia", code: "ory" }, { name: "Adivasi Odia", code: "ort" }] })).toBe("2 matches");
  });
  it("no setup lane source imports ui/v3/wizard.js (F3) or ui/assess/scope.js (N6: each pulled a large graph into /next/) and the lane has no stylesheet (F1)", () => {
    for (const f of readdirSync(LANE)) expect(readFileSync(`${LANE}/${f}`, "utf8"), f).not.toMatch(/(?:from\s*|import\s*\(?\s*)["'][^"']*(?:ui\/v3\/wizard\.js|ui\/assess\/scope\.js|\.css)["']/);
    expect(existsSync(`${LANE}/setup.css`)).toBe(false);
  });
  it("setup2 (Setup2): unnamed passage shows its error and a disabled Continue with the reason beside it (R16)", () => {
    const a = screen("setup2");
    expect(a.querySelector("h1")!.textContent).toBe("What will people respond to?");
    expect(a.querySelector("#pass")!.getAttribute("aria-invalid")).toBe("true");
    expect(a.querySelector(".field-error[role=alert]")!.textContent).toContain("Name the passage");
    const go = a.querySelector(".btn-primary") as HTMLButtonElement;
    expect(go.tagName).toBe("BUTTON");
    expect(go.disabled).toBe(true);
    expect(go.textContent).toBe("Continue");
    expect(go.previousElementSibling!.textContent).toBe("Name what people will respond to first.");
    const file = a.querySelector("input[type=file]") as HTMLInputElement;
    expect(file.accept).toBe(".usfm,.sfm,.usx,.pdf,.mp3");
    // F4: the chooser is a focusable button (helmet .app button:focus-visible ring) that opens the one hidden file input.
    expect(a.querySelectorAll("input[type=file]").length).toBe(1);
    expect(file.hidden).toBe(true);
    expect(a.querySelector("label.btn")).toBeNull();
    const choose = [...a.querySelectorAll("button.btn")].find((b) => b.textContent === "Choose file") as HTMLButtonElement;
    const click = vi.spyOn(file, "click").mockImplementation(() => {});
    choose.click();
    expect(click).toHaveBeenCalledTimes(1);
    expect(text(a, ".chip")).toEqual(["English", "Hindi · hin", "Odia · ory"]);
    const p = screen("setup2", { phone: true });
    expect(p.querySelector("h1")!.textContent).toBe("The passage");
    expect((p.querySelector(".phone-bar .btn-primary") as HTMLAnchorElement).getAttribute("href")).toBe("?ui_next=on&screen=setup3&w=phone");
    expect([...p.querySelectorAll("button.btn")].some((b) => b.textContent === "Choose a file")).toBe(true);
    // F7: a group field is described by its help.
    const g = p.querySelector("[role=group][aria-labelledby=sl-lbl]")!;
    expect(p.querySelector(`#${g.getAttribute("aria-describedby")}`)!.textContent).toBe("Participants pick their language on the first screen.");
    // N5: Preview is the shared Button on both widths, never a link to an id that does not exist.
    for (const s of [a, p]) expect([...s.querySelectorAll("button.btn")].filter((b) => b.textContent === "Preview").length, s === p ? "phone" : "desktop").toBe(1);
    expect(p.querySelector("a[href='#preview']")).toBeNull();
  });
  it("in-page links (#id) on every lane screen point at an id on that screen (N5); the shared top bars and menus are not lane markup", () => {
    for (const n of NAMES) for (const phone of [false, true]) {
      const a = screen(n, { phone });
      for (const l of a.querySelectorAll("a[href^='#']")) {
        if (l.closest("header.top, .phone-top, .menu")) continue;
        expect(a.querySelector(l.getAttribute("href")!), `${n}${phone ? " phone" : ""} ${l.getAttribute("href")}`).not.toBeNull();
      }
    }
  });
  it("in-flow links carry ?theme= and ?w= through screens/href.js (F8)", () => {
    at("?ui_next=on&screen=setup2&theme=dark");
    const a = screen("setup2", { theme: "dark" });
    expect(a.querySelector("section .btn-quiet[href]")!.getAttribute("href")).toBe("?ui_next=on&screen=setup1&theme=dark");
    expect(a.querySelector("ol.steps a.tab")!.getAttribute("href")).toBe("?ui_next=on&screen=setup1&theme=dark");
    expect(a.querySelector("header.top a.brand")!.getAttribute("href")).toBe("?ui_next=on&screen=home&theme=dark");
    at("?ui_next=on&screen=setup5&w=phone&theme=dark");
    const p = screen("setup5", { phone: true, theme: "dark" });
    expect(p.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=collect&w=phone&theme=dark");
    expect(p.querySelector(".su-line a.link")!.getAttribute("href")).toBe("?ui_next=on&screen=setup1&w=phone&theme=dark");
    at("?ui_next=on&screen=project&theme=dark");
    const j = screen("project", { theme: "dark" });
    expect(j.querySelector(".btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=setup1&theme=dark");
    expect([...j.querySelectorAll("a.su-rev")].map((r) => r.getAttribute("href"))).toEqual(["collect", "results", "next-step", "next-step"].map((n) => `?ui_next=on&screen=${n}&theme=dark`));
  });
  it("setup3 (Setup3 / SetupPhone): three groups with the current UI's who-lines, roles and expected counts", () => {
    const a = screen("setup3");
    expect(text(a, ".su-group .h3")).toEqual(["Translation team", "Community", "Church"]);
    expect(text(a, ".su-group .h3 + p.small")).toEqual([PERSPECTIVE_WHO.team, PERSPECTIVE_WHO.community, PERSPECTIVE_WHO.church]);
    // N6: the fixture carries the current UI's who-lines, pinned equal to ui/assess/scope.js PERSPECTIVE_WHO (the screen no longer imports it).
    for (const g of setupData.groups) expect(g.who, g.lens).toBe(PERSPECTIVE_WHO[g.lens]);
    expect(text(a, ".su-role > span:first-of-type")).toEqual(["Translators", "Team leaders & mentors", "Pastor involved in the work", "Pastor in the community", "Denominational leader", "Consultant"]);
    expect([...a.querySelectorAll("input.su-count")].map((i) => (i as HTMLInputElement).value)).toEqual(["5", "3", "5", "2"]);
    expect(a.querySelector(".su-num")!.textContent).toBe("15 expected");
    // N4: the stepper buttons name their subject and the count is a status text (an aria-label on a role-less span is ignored).
    const st = a.querySelector(".su-stepper")!;
    expect([...st.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Fewer Community participants", "More Community participants"]);
    expect(st.querySelector(".su-num")!.getAttribute("role")).toBe("status");
    expect(st.querySelector(".su-num")!.hasAttribute("aria-label")).toBe(false);
    expect(st.querySelector(".su-num .sr-only")!.textContent).toBe(" expected");
    expect(text(a, ".su-group > .l-row > span.small")).toEqual(["How many? (optional) · per role below", "How many? (optional) · per role below"]);
    // F6: the group chips draw ic("people") (boards_fac.py), four paths in glyphs.js, not the two-path "person".
    expect([...a.querySelectorAll(".su-group .icn svg")].map((s) => s.querySelectorAll("path").length)).toEqual([4, 4, 4]);
    const p = screen("setup3", { phone: true });
    expect(p.querySelector("h1")!.textContent).toBe("Who will participate?");
    expect([...p.querySelectorAll("label.row-opt input.cb")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, false]);
    expect([...p.querySelectorAll("label.row-opt .icn svg")].map((s) => s.querySelectorAll("path").length)).toEqual([4, 4, 4]);
  });
  it("setup4 (Setup4 / Setup4Phone): one disclosure per survey step 3 checked (F9), questions from context-fields.js, Community open", () => {
    const a = screen("setup4");
    const sums = [...a.querySelectorAll(".su-ctx > details.disc")];
    expect(sums.map((d) => d.querySelector(".su-name .h3")!.textContent)).toEqual(["Translators", "Team leaders & mentors", "Community", "Pastor involved in the work", "Denominational leader"]);
    const n = (p: string) => GROUP_FIELDS[p].length;
    expect(sums.map((d) => d.querySelectorAll(".disc-body input.in").length)).toEqual([n("Translation Team"), n("Translation Team"), n("Community"), n("Church"), n("Church")]);
    expect(sums.map((d) => d.hasAttribute("open"))).toEqual([false, false, true, false, false]);
    expect((a.querySelector("#community-facilitator_role") as HTMLInputElement).value).toBe("Facilitator");
    expect(a.querySelectorAll("details.dd").length).toBe(0);
    expect(text(a, "label.row-opt.compact")).toEqual(RESPONDENT_FIELDS.map((f: { label: string }) => f.label));
    expect(a.querySelector(".tag")!.textContent).toBe("Off by default");
    // Desktop step 3 checks every group; the unchecked roles (Pastor in the community, Consultant) have no survey.
    expect(text(a, ".su-ctx .su-name .h3")).not.toContain("Consultant");
    // Phone step 3 (SetupPhone) leaves Church unchecked, so phone step 4 asks about two groups (Setup4Phone draws three: board line).
    const p = screen("setup4", { phone: true });
    expect(text(p, ".su-groups > details.disc > summary .su-name")).toEqual(["Translation team", "Community"]);
    expect([...p.querySelectorAll(".su-groups > details.disc")].map((d) => d.hasAttribute("open"))).toEqual([false, true]);
    expect((p.querySelector("#community-expected") as HTMLInputElement).value).toBe("15");
    expect((p.querySelector("input[id='community-facilitator_role']") as HTMLInputElement).value).toBe("Facilitator"); // attribute form: the desktop render above holds the same id
    // Answers are keyed by survey: the Community survey's answers do not leak into the Translators survey of another perspective.
    const tr = [...p.querySelectorAll("input[id^=translators-]")].filter((i) => i.id !== "translators-expected") as HTMLInputElement[];
    expect(tr.length).toBe(GROUP_FIELDS["Translation Team"].length);
    expect(tr.map((i) => i.value).filter(Boolean)).toEqual([]);
  });
  it("setup5 (Setup5 / Setup5Phone): summary rows with Edit back to their step, blank facilitator Not set, Launch the survey", () => {
    const a = screen("setup5");
    expect(text(a, ".su-sumrow > .lbl")).toEqual(["Review", "People respond to", "Answer languages", "Location or community", "Facilitator", "Survey open", "Who will participate", "About each group"]);
    expect([...a.querySelectorAll(".su-sumrow > a.link")].map((l) => l.getAttribute("href"))).toEqual([1, 2, 2, 1, 1, 1, 3, 4].map((n) => `?ui_next=on&screen=setup${n}`));
    expect(a.querySelectorAll(".su-sumrow")[4].textContent).toContain("Not set");
    expect(a.textContent).toContain("When you launch, the questions are locked so everyone answers the same survey.");
    expect(a.querySelector(".btn-primary")!.textContent).toBe("Launch the survey");
    const p = screen("setup5", { phone: true });
    expect(p.querySelectorAll(".su-line").length).toBe(7);
    // N3: step 5 says what steps 3 and 4 show. Desktop keeps the board's words; the phone leaves out Church, which SetupPhone unchecks.
    expect(text(a, ".su-sumrow:nth-child(7) .t-15 .l-stack > span")).toEqual(["Translation team · Translators, Team leaders & mentors · 8 expected", "Community · Community · 15 expected", "Church · Pastor involved in the work, Denominational leader · 7 expected"]);
    expect(a.querySelectorAll(".su-sumrow")[7].querySelector(".t-15")!.textContent!.trim()).toBe("Community described · 4 surveys left blankParticipants asked age range and gender (skippable)");
    const kv = (label: string) => [...p.querySelectorAll(".su-line .su-kv")].find((k) => k.querySelector(".micro")!.textContent === label)!.querySelector(".h3")!.textContent;
    expect(kv("Who")).toBe("Translation team · Community");
    expect(kv("About each group")).toBe("Community described · 2 left blank");
    const p4 = screen("setup4", { phone: true });
    expect(kv("Who")).toBe(text(p4, ".su-groups > details.disc > summary .su-name").join(" · "));
    expect(p.querySelector(".phone-bar .btn-primary")!.textContent).toBe("Launch the survey");
    expect(p.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=collect&w=phone");
    expect(a.querySelector(".btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=collect");
  });
  it("project (Project / ProjectPhone): title, reviews newest first with stage pills and levels, over-time chart", () => {
    const a = screen("project");
    expect(a.querySelector("h1.title-page")!.textContent).toBe("Hindi New Testament");
    expect(a.querySelector("header.top[data-variant=signed-in]")).not.toBeNull();
    expect(text(a, ".su-rev .h3")).toEqual(["Mark 1–4 draft", "Luke 1–2 community review", "Acts listening review", "Workshop 1 · Mark 1"]);
    expect([...a.querySelectorAll(".su-rev .pill")].map((p) => p.getAttribute("data-stage"))).toEqual(["collecting", "results", "done", "done"]);
    expect(text(a, ".su-rev .lvl-name")).toEqual(["Growing", "Needs support", "Growing", "Growing", "Needs support", "Needs support", "Needs support", "More input needed", "Needs support"]);
    expect(a.querySelectorAll("aside svg[role=img] polyline").length).toBe(3);
    // F11: the chart takes the aside's width (viewBox 420x190, no fixed px width) and its y labels end before the plot starts.
    const svg = a.querySelector("aside svg[role=img]")!;
    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.hasAttribute("height")).toBe(false);
    expect(svg.getAttribute("viewBox")).toBe("0 0 420 190");
    const firstX = Math.min(...[...svg.querySelectorAll("circle")].map((c) => Number(c.getAttribute("cx"))));
    for (const t of svg.querySelectorAll("text[text-anchor=end]")) expect(Number(t.getAttribute("x"))).toBeLessThan(firstX - 5 - 8);
    expect([...a.querySelectorAll("a[href]")].filter((l) => /screen=(people|workspace)/.test(l.getAttribute("href")!)).map((l) => l.getAttribute("href"))).toEqual(["?ui_next=on&screen=workspace", "?ui_next=on&screen=people"]);
    expect(a.querySelector(".btn-primary")!.textContent).toBe("Start a 3D Review");
    const p = screen("project", { phone: true });
    expect(p.querySelector("h1.title-phone")!.textContent).toBe("Hindi New Testament");
    expect(p.querySelectorAll("a.su-revline").length).toBe(4);
    expect(p.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=setup1&w=phone");
    expect([...p.querySelectorAll("a.su-revline")].map((r) => r.getAttribute("href"))).toEqual(["collect", "results", "next-step", "next-step"].map((n) => `?ui_next=on&screen=${n}&w=phone`));
  });
});

describe("setup lane links and derived lines", () => {
  it("cross-lane destinations (links.js OUT, N1): each name is registered once its owning lane is merged; the fixture's review rows use OUT keys", () => {
    for (const [key, [name, lane]] of Object.entries(OUT as Record<string, [string, string]>)) {
      expect(Object.keys(LANES), key).toContain(lane);
      expect(lane, key).not.toBe("setup");
      if (Object.keys(LANES[lane]).length) expect(REGISTRY[name], `${lane} lane registers ${name}`).toBeDefined();
    }
    for (const r of projectData.reviews) expect(Object.keys(OUT), r.title).toContain(r.to);
    expect(out("nextStep", { w: "phone" }, "?theme=dark")).toBe("?ui_next=on&screen=next-step&w=phone&theme=dark");
    expect(() => out("nope")).toThrow(/unknown cross-lane destination/);
  });
  it("draft.js: one survey list for steps 4 and 5; lines follow the checked state", () => {
    const g = setupData.groups;
    expect(surveys(g).map((s: { key: string }) => s.key)).toEqual(["translators", "team-leaders-mentors", "community", "pastor-involved-in-the-work", "denominational-leader"]);
    expect(surveys(g, true).map((s: { key: string }) => s.key)).toEqual(["translators", "team-leaders-mentors", "community"]);
    expect(whoLines(g).map(([n]: [string]) => n)).toEqual(["Translation team", "Community", "Church"]);
    expect(whoShort(g, false)).toBe("Translation team · Community · Church (2 roles)"); // the board's line, when Church is checked
    expect(whoShort(g, true)).toBe("Translation team · Community");
    expect(aboutLine(surveys(g), setupData.context.values)).toBe("Community described · 4 surveys left blank");
    expect(aboutLine(surveys(g, true), setupData.context.values, true)).toBe("Community described · 2 left blank");
    expect(aboutLine(surveys(g, true).slice(0, 2), {}, false)).toBe("2 surveys left blank");
    expect(aboutLine(surveys(g, true).slice(2), setupData.context.values, false)).toBe("Community described");
  });
});

describe("ui-next lint on the setup lane", () => {
  it("0 violations in screens/setup and fixtures/setup", () => {
    for (const d of ["../ui-next/src/screens/setup", "../ui-next/fixtures/setup"]) expect([...lintDir(fileURLToPath(new URL(d, import.meta.url)))]).toEqual([]);
  });
});
