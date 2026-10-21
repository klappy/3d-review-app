// @vitest-environment jsdom
// UI Next (v4) setup lane screens (status: provisional): setup1-setup5 and project, desktop and phone (?w=phone).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Setup1-5.dc.html, Setup1Phone, Setup2Phone, SetupPhone (step 3),
// Setup4Phone, Setup5Phone, Project.dc.html, ProjectPhone.dc.html; contracts design-system.md section 2 and 8.
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
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

const NAMES = ["setup1", "setup2", "setup3", "setup4", "setup5", "project"];
const screen = (name: string, props: Record<string, unknown> = {}) => render(setup[name], { props }).container.querySelector(".app") as HTMLElement;
const text = (a: Element, sel: string) => [...a.querySelectorAll(sel)].map((e) => e.textContent!.trim());
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
  it("dark theme sets data-theme; an unknown ?state= throws (each board draws one state)", () => {
    for (const n of NAMES) {
      expect(screen(n, { theme: "dark" }).getAttribute("data-theme")).toBe("dark");
      expect(() => render(setup[n], { props: { state: "busy" } })).toThrow(/one state/);
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
  it("setup2 (Setup2): unnamed passage shows its error and a disabled Continue with the reason beside it (R16)", () => {
    const a = screen("setup2");
    expect(a.querySelector("h1")!.textContent).toBe("What will people respond to?");
    expect(a.querySelector("#pass")!.getAttribute("aria-invalid")).toBe("true");
    expect(a.querySelector(".field-error[role=alert]")!.textContent).toContain("Name the passage");
    const go = a.querySelector(".btn-primary") as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(a.querySelector(`#${go.getAttribute("aria-describedby")}`)!.textContent).toBe("Name what people will respond to first.");
    expect((a.querySelector("input[type=file]") as HTMLInputElement).accept).toBe(".usfm,.sfm,.usx,.pdf,.mp3");
    expect(text(a, ".chip")).toEqual(["English", "Hindi · hin", "Odia · ory"]);
    const p = screen("setup2", { phone: true });
    expect(p.querySelector("h1")!.textContent).toBe("The passage");
    expect((p.querySelector(".phone-bar .btn-primary") as HTMLAnchorElement).getAttribute("href")).toBe("?screen=setup3&w=phone");
  });
  it("setup3 (Setup3 / SetupPhone): three groups with the current UI's who-lines, roles and expected counts", () => {
    const a = screen("setup3");
    expect(text(a, ".su-group .h3")).toEqual(["Translation team", "Community", "Church"]);
    expect(text(a, ".su-group .h3 + p.small")).toEqual([PERSPECTIVE_WHO.team, PERSPECTIVE_WHO.community, PERSPECTIVE_WHO.church]);
    expect(text(a, ".su-role > span:first-of-type")).toEqual(["Translators", "Team leaders & mentors", "Pastor involved in the work", "Pastor in the community", "Denominational leader", "Consultant"]);
    expect([...a.querySelectorAll("input.su-count")].map((i) => (i as HTMLInputElement).value)).toEqual(["5", "3", "5", "2"]);
    expect(a.querySelector(".su-num")!.textContent).toBe("15");
    const p = screen("setup3", { phone: true });
    expect(p.querySelector("h1")!.textContent).toBe("Who will participate?");
    expect([...p.querySelectorAll("label.row-opt input.cb")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, false]);
  });
  it("setup4 (Setup4 / Setup4Phone): one disclosure per chosen survey, questions from context-fields.js, Community open", () => {
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
    const p = screen("setup4", { phone: true });
    expect(text(p, ".su-groups > details.disc > summary .su-name")).toEqual(["Translation team", "Community", "Church"]);
    expect((p.querySelector("#community-expected") as HTMLInputElement).value).toBe("15");
  });
  it("setup5 (Setup5 / Setup5Phone): summary rows with Edit back to their step, blank facilitator Not set, Launch the survey", () => {
    const a = screen("setup5");
    expect(text(a, ".su-sumrow > .lbl")).toEqual(["Review", "People respond to", "Answer languages", "Location or community", "Facilitator", "Survey open", "Who will participate", "About each group"]);
    expect([...a.querySelectorAll(".su-sumrow > a.link")].map((l) => l.getAttribute("href"))).toEqual(["?screen=setup1", "?screen=setup2", "?screen=setup2", "?screen=setup1", "?screen=setup1", "?screen=setup1", "?screen=setup3", "?screen=setup4"]);
    expect(a.querySelectorAll(".su-sumrow")[4].textContent).toContain("Not set");
    expect(a.textContent).toContain("When you launch, the questions are locked so everyone answers the same survey.");
    expect(a.querySelector(".btn-primary")!.textContent).toBe("Launch the survey");
    const p = screen("setup5", { phone: true });
    expect(p.querySelectorAll(".su-line").length).toBe(7);
    expect(p.querySelector(".phone-bar .btn-primary")!.textContent).toBe("Launch the survey");
  });
  it("project (Project / ProjectPhone): title, reviews newest first with stage pills and levels, over-time chart", () => {
    const a = screen("project");
    expect(a.querySelector("h1.title-page")!.textContent).toBe("Hindi New Testament");
    expect(a.querySelector("header.top[data-variant=signed-in]")).not.toBeNull();
    expect(text(a, ".su-rev .h3")).toEqual(["Mark 1–4 draft", "Luke 1–2 community review", "Acts listening review", "Workshop 1 · Mark 1"]);
    expect([...a.querySelectorAll(".su-rev .pill")].map((p) => p.getAttribute("data-stage"))).toEqual(["collecting", "results", "done", "done"]);
    expect(text(a, ".su-rev .lvl-name")).toEqual(["Growing", "Needs support", "Growing", "Growing", "Needs support", "Needs support", "Needs support", "More input needed", "Needs support"]);
    expect(a.querySelectorAll("aside svg[role=img] polyline").length).toBe(3);
    expect(a.querySelector(".btn-primary")!.textContent).toBe("Start a 3D Review");
    const p = screen("project", { phone: true });
    expect(p.querySelector("h1.title-phone")!.textContent).toBe("Hindi New Testament");
    expect(p.querySelectorAll("a.su-revline").length).toBe(4);
    expect(p.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?screen=setup1&w=phone");
  });
});

describe("ui-next lint on the setup lane", () => {
  it("0 violations in screens/setup and fixtures/setup", () => {
    for (const d of ["../ui-next/src/screens/setup", "../ui-next/fixtures/setup"]) expect([...lintDir(fileURLToPath(new URL(d, import.meta.url)))]).toEqual([]);
  });
});
