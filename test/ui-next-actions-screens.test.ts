// @vitest-environment jsdom
// UI Next (v4) actions lane screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas NextStep, NextStepPhone, ActionPlan, ActionPlanPhone, Print, PrintPhone,
// Share, SharePhone, Sandbox, SandboxPhone, PaperEntry, PaperEntryPhone, MenuPhone (.dc.html); unit work/active/2026-10-21-ui-next-screens-fanout.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import NextStep from "../ui-next/src/screens/actions/NextStep.svelte";
import ActionPlan from "../ui-next/src/screens/actions/ActionPlan.svelte";
import Print from "../ui-next/src/screens/actions/Print.svelte";
import Share from "../ui-next/src/screens/actions/Share.svelte";
import Sandbox from "../ui-next/src/screens/actions/Sandbox.svelte";
import Paper from "../ui-next/src/screens/actions/Paper.svelte";
import PaperEntry from "../ui-next/src/screens/actions/PaperEntry.svelte";
import MenuSheet from "../ui-next/src/screens/actions/MenuSheet.svelte";
import Qr from "../ui-next/src/screens/actions/Qr.svelte";
import Bar from "../ui-next/src/screens/actions/Bar.svelte";
import GapBar from "../ui-next/src/screens/actions/GapBar.svelte";
import ReviewHead from "../ui-next/src/screens/actions/ReviewHead.svelte";
import CollectGroups from "../ui-next/src/screens/actions/CollectGroups.svelte";
import CopyButton from "../ui-next/src/screens/actions/CopyButton.svelte";
import ShareOut from "../ui-next/src/screens/actions/ShareOut.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { shareText } from "../ui-next/src/screens/actions/copy.js";
// @ts-expect-error -- plain .js module, no type declarations
import actions from "../ui-next/src/screens/actions/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { CAN_SHARE as LEGACY_CAN_SHARE, copy as SHARE_COPY } from "../ui/assess/share.js";
// @ts-expect-error -- plain .js module, no type declarations
import { PRINT_IN_LANGUAGE as LEGACY_PRINT_IN_LANGUAGE, printLanguages as legacyPrintLanguages, printLanguageField as legacyPrintLanguageField } from "../ui/assess/print-lang.js";
// @ts-expect-error -- plain .js module, no type declarations
import { CAN_SHARE, READ_ONLY, PRINT_IN_LANGUAGE, printLanguages, showPrintLanguage } from "../ui-next/src/screens/actions/legacy.js";
import R from "../ui-next/fixtures/actions/review.json";
import PLAN from "../ui-next/fixtures/actions/action-plan.json";

type P = Record<string, unknown>;
type C = typeof NextStep;
const mount = (Comp: C, props: P = {}) => render(Comp, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const p = (q: string) => new URLSearchParams(q);
const on = () => { const m = new Map<string, string>([["ui_next", "on"]]); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

// [screen name, component, board copy rows desktop, board copy rows phone (null = phone only / desktop only)]
const SCREENS: [string, C, string[] | null, string[]][] = [
  ["next-step", NextStep, ["What will you talk about?", "Where the perspectives disagree", "Weakest areas", "Recommended for this review", "At a glance", "Take it out of the room", "Complete the review"],
    ["Where the perspectives pull apart. Add what you will act on to the plan.", "Clarity / naturalness", "In the plan", "Print or share the plan", "Complete the review"]],
  ["action-plan", ActionPlan, ["Next steps · 1 page · Mark 1–4 draft", "What we will talk about", "What we noticed", "The next step", "Share this plan.", "Download PDF"],
    ["Luke 1–2 · improve", "Listening session with the two villages", "Read-only link, expires in 90 days.", "Share the PDF"]],
  ["print", Print, ["Print paper surveys", "Which surveys", "Language on paper", "Paper size", "2 phrases are not translated into Hindi yet", "Print 2 surveys", "Community survey"],
    ["Paper surveys", "Odia · translating…", "Language", "Print 2 surveys"]],
  ["share", Share, ["Share the survey", "Copied", "Show QR codes for the room", "Access codes, for people who lose the link"],
    ["Each survey has its own link. Send it, show the QR, or hand the phone over.", "8/15", "Email the links to someone", "Show QR codes for the room"]],
  ["sandbox", Sandbox, ["Mark 1–4 draft · practice", "Practice copy · not a real review", "Simulated responses", "Where this stays", "Generate 30 responses", "Responses", "Fill with simulated responses"],
    ["Practice copy · not a real review", "of 30 simulated", "Share the practice survey", "Delete this practice copy", "Fill with simulated responses"]],
  ["paper-entry", PaperEntry, ["Enter a paper answer", "Code on the paper", "Most of it is easy, but some parts are hard", "Save and enter the next paper", "Entered today", "Last receipt · Reference R2048732 · "],
    ["Paper · Community · sheet 7 · question 1 of 13", "Their words", "Next question"]],
  ["menu", MenuSheet, null, ["Your reviews", "Bincy K · bincy@bcs.org.in", "BCS · India — switch workspace", "Sign out", "Start a 3D Review"]],
];

describe("actions lane registry and routes", () => {
  it("registers exactly the lane's seven screen names, all reachable under the flag", () => {
    expect(Object.keys(actions).sort()).toEqual(["action-plan", "menu", "next-step", "paper-entry", "print", "sandbox", "share"]);
    expect(LANES.actions).toBe(actions);
    for (const [name, Comp] of SCREENS) {
      expect(REGISTRY[name], name).toBe(Comp);
      expect(route(p(`?ui_next=on&screen=${name}`), on(), Object.keys(REGISTRY)), name).toEqual({ view: name, props: { phone: false, theme: "light", state: undefined } });
      expect(route(p(`?screen=${name}&w=phone&theme=dark`), on(), Object.keys(REGISTRY)).props, name).toEqual({ phone: true, theme: "dark", state: undefined });
    }
  });
});

describe("actions lane screens render as the boards draw them", () => {
  for (const [name, Comp, desk, phone] of SCREENS) {
    const views: [string, P, string[]][] = [];
    if (desk) views.push(["desktop", {}, desk], ["dark", { theme: "dark" }, desk]);
    views.push(["phone", { phone: true }, phone]);
    for (const [v, props, rows] of views) {
      it(`${name} ${v}: renders, one .btn-primary at most, board copy rows`, () => {
        const a = mount(Comp, props);
        expect(a, `${name} ${v}`).toBeTruthy();
        expect(a.dataset.theme).toBe(props.theme ?? "light");
        if (props.phone || name === "menu") expect(a.dataset.w).toBe("phone");
        expect([...a.querySelectorAll(".btn-primary")].filter(el => !el.closest("dialog:not([open])")).length).toBeLessThanOrEqual(1);
        expect(a.querySelectorAll("[style]").length).toBe(0);
        for (const r of rows) expect(text(a), r).toContain(r);
      });
    }
  }
});

describe("actions lane: every route keeps one h1 and ignores an unknown ?state=", () => {
  for (const [name, Comp, desk] of SCREENS) {
    const views: [string, P][] = desk ? [["desktop", {}], ["phone", { phone: true }]] : [["phone", { phone: true }]];
    for (const [v, props] of views) {
      it(`${name} ${v}: exactly one h1, and state "nope" renders the default view`, () => {
        const a = mount(Comp, props);
        expect(a.querySelectorAll("h1, [role=heading][aria-level='1']").length, `${name} ${v} h1`).toBe(1); // the plan sheet's title is the board's div.paper-title with the heading role (§8.11)
        const plain = text(a);
        const odd = mount(Comp, { ...props, state: "nope" });
        expect(text(odd)).toBe(plain);
      });
    }
  }
  it("the route hands an unknown state through and the screen still mounts", () => {
    for (const [name] of SCREENS) expect(route(p(`?ui_next=on&screen=${name}&state=nope`), on(), Object.keys(REGISTRY)).props.state).toBe("nope");
  });
});

// The literal screen names test/ui-next-links.test.ts sees in this lane's sources (same two patterns: ?screen=<name> and href("<name>").
const LANE_DIR = resolve(__dirname, "../ui-next/src/screens/actions");
const LIT = "([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?![a-z0-9-]|\\$\\{)";
const declared = new Set<string>(readdirSync(LANE_DIR).filter((f) => f.endsWith(".svelte")).flatMap((f) => {
  const src = readFileSync(join(LANE_DIR, f), "utf8");
  return [...src.matchAll(new RegExp(`[?&;]screen=${LIT}`, "g")), ...src.matchAll(new RegExp(`\\bhref\\(\\s*(["'\`])${LIT}\\1`, "g"))].map((m) => m[m.length - 1]);
}));

describe("actions lane links: the shared href() helper, literal names, w/theme carried", () => {
  it("lane sources name screens only through href(\"<name>\") (no hand-written ?screen= links)", () => {
    for (const f of readdirSync(LANE_DIR).filter((x) => /\.(svelte|js)$/.test(x))) {
      const src = readFileSync(join(LANE_DIR, f), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(src.match(/[?&]screen=/g), f).toBeNull();
    }
    expect([...declared].sort()).toEqual(["about", "action-plan", "close-collection", "collect", "explore", "feedback", "help", "home", "invitations", "landing", "menu", "next-step", "paper-entry", "people", "print", "project", "qr-room", "results", "sandbox", "setup1", "setup5", "share", "sign-in", "workspace"]);
  });
  it("no fixture carries a link (links are built in the .svelte files, where the shared link test reads them)", () => {
    const dir = resolve(__dirname, "../ui-next/fixtures/actions");
    for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/screen=|"href"/);
  });
  for (const [name, Comp, desk] of SCREENS) {
    const views: [string, P][] = [["phone", { phone: true }], ["phone dark", { phone: true, theme: "dark" }]];
    if (desk) views.push(["desktop", {}], ["desktop dark", { theme: "dark" }]);
    for (const [v, props] of views) {
      it(`${name} ${v}: every screen link is a declared literal and carries w/theme`, () => {
        const a = mount(Comp, props);
        // The shared TopBar's own account menu (ui-next/src/icons.js ACCOUNT_ITEMS "?screen=about") is not the lane's: handed back.
        const own = [...a.querySelectorAll("a[href*='screen=']")].filter((el) => !(el.closest("header.top[data-variant=signed-in]") && !el.closest("nav")));
        const links = own.map((el) => new URLSearchParams((el.getAttribute("href") ?? "").split("#")[0]));
        expect(links.length).toBeGreaterThan(0);
        for (const q of links) {
          expect(q.get("ui_next")).toBe("on");
          expect(declared.has(q.get("screen") ?? ""), `${q}`).toBe(true);
          expect(q.get("w"), `${q}`).toBe(props.phone ? "phone" : null);
          expect(q.get("theme"), `${q}`).toBe(props.theme === "dark" ? "dark" : null);
        }
      });
    }
  }
  it("phone ⋯ opens Collect's menu sheet (collect, state menu); the account sheet's setup card goes to setup1", () => {
    const n = mount(NextStep, { phone: true });
    expect(n.querySelector("a[aria-label='More actions']")?.getAttribute("href")).toBe("?ui_next=on&screen=collect&w=phone&state=menu");
    const m = mount(MenuSheet);
    expect([...m.querySelectorAll("a.card-link")].map((el) => new URLSearchParams(el.getAttribute("href") ?? "").get("screen"))).toEqual(["invitations", "collect", "setup1", "results", "sandbox"]);
  });
});

describe("actions lane wiring through the current UI's modules", () => {
  it("the lane adapter states exactly what ui/assess/share.js and print-lang.js export (and the lane imports neither)", () => {
    expect([...CAN_SHARE].sort()).toEqual([...LEGACY_CAN_SHARE].sort());
    expect(READ_ONLY).toBe(SHARE_COPY.readOnly);
    expect(PRINT_IN_LANGUAGE).toBe(LEGACY_PRINT_IN_LANGUAGE);
    for (const [aLwc, pLwc] of [[R.lwc.assessment, R.lwc.project], [[], []], [["hin"], ["hin", "ory", "ase"]], [["xx-unknown"], undefined], [["eng", "hin"], ["ory"]]] as [unknown, unknown][])
      expect(printLanguages(aLwc, pLwc), JSON.stringify([aLwc, pLwc])).toEqual(legacyPrintLanguages(aLwc, pLwc));
    for (const f of readdirSync(LANE_DIR)) expect(readFileSync(join(LANE_DIR, f), "utf8"), f).not.toMatch(/ui\/assess\/(share|print-lang)\.js["']/);
  });
  it("print: the language picker shows exactly when legacy printLanguageField draws one (none without a participant language)", () => {
    const esc = (x: string) => x;
    for (const [aLwc, pLwc] of [[R.lwc.assessment, R.lwc.project], [[], []], [["hin"], []], [["xx-unknown"], undefined], [["eng"], []]] as [unknown, unknown][])
      expect(showPrintLanguage(printLanguages(aLwc, pLwc)), JSON.stringify([aLwc, pLwc])).toBe(legacyPrintLanguageField(legacyPrintLanguages(aLwc, pLwc), "en", esc) !== "");
    expect(showPrintLanguage([])).toBe(false);
  });
  it("share: copy actions follow CAN_SHARE; another role reads the readOnly line", () => {
    const owner = mount(Share, { role: "owner" });
    expect(owner.querySelectorAll("button.btn").length).toBeGreaterThanOrEqual(5);
    expect(text(owner)).not.toContain(SHARE_COPY.readOnly);
    const viewer = mount(Share, { role: "viewer" });
    expect(text(viewer)).toContain(SHARE_COPY.readOnly);
    expect(text(viewer)).not.toContain("Copied");
    expect([...owner.querySelectorAll("input.in[readonly]")].map((i) => (i as HTMLInputElement).value)).toEqual(R.surveys.map((s) => `${R.host}${s.code}`));
  });
  it("print: language choices come from printLanguages (English first, then the review's and project's LWCs)", () => {
    const sel = mount(Print).querySelector("select#pt-lang") as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(["English", "Hindi", "Odia"]);
    expect(sel.value).toBe("hi");
  });
  it("paper-entry: isOtherOption finds the write-in choice by its code; receiptLine formats a resp_ receipt", () => {
    const a = mount(PaperEntry);
    const other = [...a.querySelectorAll("input[data-other]")];
    expect(other.length).toBe(1);
    expect(text(other[0].closest("label") as Element)).toBe("Other (please describe)");
    const last = [...a.querySelectorAll("p.kbd")].map(text).find((t) => t.startsWith("Last receipt")) ?? "";
    expect(last).toMatch(/^Last receipt · Reference R2048732 · \S/);
    expect(last).not.toContain("resp_");
    expect(mount(PaperEntry, { phone: true }).querySelector("h1")?.textContent).toBe("As a group, how would we describe how easy or difficult this translation is to understand?");
  });
});

describe("actions lane parts", () => {
  it("review head: viewed tab is aria-current, the live phase carries Now, done phases a done dot, tabs link the phases", () => {
    const a = render(ReviewHead, { props: { title: "T", stage: "collecting", viewed: "collect", live: "collect", done: ["prepare"], deleteRefused: "No." } }).container;
    const tabs = [...a.querySelectorAll("a.tab")];
    expect(tabs.map((t) => t.getAttribute("aria-current"))).toEqual([null, "page", null, null]);
    expect(tabs[1].querySelector(".now")?.textContent).toBe("Now");
    expect(tabs[0].querySelector(".dot.done")).toBeTruthy();
    expect(tabs.map((t) => t.getAttribute("href"))).toEqual(["setup5", "collect", "results", "next-step"].map((n) => `?ui_next=on&screen=${n}`));
    expect(a.querySelector("summary.btn.btn-icon svg")?.getAttribute("width")).toBe("20");
    expect(() => render(ReviewHead, { props: { title: "T", stage: "collecting", viewed: "nope", live: "collect" } })).toThrow(/phases/);
  });
  it("qr, bar and gap bar draw from attributes only and refuse bad input", () => {
    const q = render(Qr, { props: { bits: R.qr.plan, size: 72 } }).container.querySelector("svg.qr") as SVGElement;
    expect(q.getAttribute("width")).toBe("72");
    // A bare svg flex item shrank beside ActionPlan's long share line (43px wide in Chromium); the plain wrapper's minimum is the svg's width.
    expect(q.parentElement?.tagName).toBe("DIV");
    expect(q.parentElement?.attributes.length).toBe(0);
    expect(() => render(Qr, { props: { bits: "101" } })).toThrow(/441/);
    const b = render(Bar, { props: { pct: 80, lens: "team", w: 180 } }).container.querySelector(".bar rect") as SVGElement;
    expect(b.getAttribute("width")).toBe("80%");
    expect(() => render(Bar, { props: { pct: 120, lens: "team" } })).toThrow(/0..100/);
    const g = render(GapBar, { props: { pts: [["team", 87.5, "Strong"], ["community", 12.5, "Needs urgent attention"]], span: [12.5, 87.5], wide: true } }).container.querySelector("svg") as SVGElement;
    expect(g.getAttribute("aria-label")).toBe("Translation team · Strong, Community · Needs urgent attention");
  });
  it("bar: the fill rect sits inside the 8px overflow:hidden track (block svg at the track's top, rect 0..8)", () => {
    // jsdom has no layout, so this pins the geometry that decides it: base.css .bar is an 8px track that clips (overflow hidden); the svg
    // is display=block (an inline svg sits on the text baseline, 9px down, and the track clipped the whole fill) and 8px tall; the rect
    // starts at y 0 and is 8px tall. Measured in Chromium in RESULTS-actions round 2 (Sandbox, PaperEntryPhone).
    const css = readFileSync(resolve(__dirname, "../ui-next/components/base.css"), "utf8");
    const track = css.match(/(?:^|[}\n])\.bar\{([^}]*)\}/)?.[1] ?? "";
    expect(track).toMatch(/height:8px/);
    expect(track).toMatch(/overflow:hidden/);
    const el = render(Bar, { props: { pct: 8, lens: "community", label: "Question 1 of 13" } }).container.querySelector(".bar") as HTMLElement;
    const svg = el.querySelector(":scope > svg") as SVGElement;
    expect(svg.getAttribute("display")).toBe("block");
    expect(svg.getAttribute("height")).toBe("8");
    const rect = svg.querySelector("rect") as SVGElement;
    expect(Number(rect.getAttribute("y") ?? 0)).toBe(0);
    expect(rect.getAttribute("height")).toBe("8");
    expect(rect.getAttribute("width")).toBe("8%");
  });
  it("menu: the account sheet is a native dialog.sheet with the eight board rows, a Close, and a backdrop tap that closes it", async () => {
    const a = mount(MenuSheet);
    const d = a.querySelector("dialog.glass-hi.sheet[data-pad=menu]") as HTMLDialogElement;
    expect(d).toBeTruthy();
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.getAttribute("closedby")).toBe("any");
    expect(d.querySelectorAll("a.mi[data-size=lg]").length).toBe(8);
    // MenuPhone: "Public website home" (design-system.md :344/:603), then the theme row right after it (:346)
    const web = [...d.querySelectorAll("a.mi")].find((x) => x.textContent === "Public website home")!;
    expect(new URLSearchParams(web.getAttribute("href")!).get("screen")).toBe("landing");
    expect(web.nextElementSibling!.matches("div.mi-theme[role=group]")).toBe(true);
    expect(d.querySelector("a.mi")?.hasAttribute("data-autofocus")).toBe(true);
    expect(document.activeElement).toBe(d.querySelector("a.mi"));
    expect(d.querySelector(".sheet-handle")?.getAttribute("aria-hidden")).toBe("true");
    d.getBoundingClientRect = () => ({ left: 0, right: 390, top: 400, bottom: 844, width: 390, height: 444, x: 0, y: 400, toJSON: () => ({}) });
    await fireEvent.click(d, { clientX: 200, clientY: 500 }); // inside the sheet: kept
    expect(d.hasAttribute("open")).toBe(true);
    await fireEvent.click(d, { clientX: 200, clientY: 100 }); // on the backdrop above it: closed
    expect(d.hasAttribute("open")).toBe(false);
    const b = mount(MenuSheet).querySelector("dialog") as HTMLDialogElement;
    await fireEvent.click(b.querySelector("button[aria-label=Close]") as HTMLElement);
    expect(b.hasAttribute("open")).toBe(false);
  });
  it("print: the desktop panel is a modal wide dialog holding the page's one primary; the title takes focus; Close closes it", async () => {
    const a = mount(Print);
    const d = a.querySelector("dialog.glass-hi[data-w=wide]") as HTMLDialogElement;
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.getAttribute("aria-labelledby")).toBe("pt");
    expect(d.querySelectorAll(".btn-primary").length).toBe(1);
    const h = d.querySelector("h2#pt") as HTMLElement;
    expect(h.getAttribute("tabindex")).toBe("-1");
    expect(h.hasAttribute("data-autofocus")).toBe(true);
    expect(document.activeElement).toBe(h);
    expect(a.querySelectorAll(".l-grid[data-tpl=survey-row]").length).toBe(R.surveys.length);
    await fireEvent.click(d.querySelector("button[aria-label=Close]") as HTMLElement);
    expect(d.hasAttribute("open")).toBe(false);
  });
  it("paper preview: Print and Sandbox draw the sheet on the section 2 Paper preview row (.psheet[data-fit]); phone draws none (VALIDATION-integration N1)", () => {
    for (const C of [Print, Sandbox]) {
      const s = mount(C).querySelectorAll(".psheet");
      expect(s.length).toBe(1);
      expect(s[0].getAttribute("data-fit")).toBe("a4");
      expect(s[0].getAttribute("aria-hidden")).toBe("true");
      expect(s[0].querySelector(":scope > .paper")).not.toBeNull();
      expect(mount(C, { phone: true }).querySelector(".psheet")).toBeNull(); // PrintPhone and SandboxPhone draw no preview, as their boards
    }
    const letter = render(Paper, { props: { paper: R.paper, qr: R.qr.survey, fit: "letter" } }).container.querySelector(".psheet")!;
    expect(letter.getAttribute("data-fit")).toBe("letter");
    expect(() => render(Paper, { props: { paper: R.paper, qr: R.qr.survey, fit: "preview" } })).toThrow(/fit is "a4" or "letter"/);
  });
  it("print: the dialog's columns fit 1280x800 on arrival (16px form column, form-well notice, 8px preview column; Chromium: content 748px in the 750px box)", () => {
    const d = mount(Print).querySelector("dialog") as HTMLDialogElement;
    const [form, preview] = [...d.querySelectorAll(":scope > .l-grid > .l-stack")];
    expect(form.getAttribute("data-gap")).toBe("4");
    expect(preview.getAttribute("data-gap")).toBe("2");
    expect(form.querySelector(":scope > .solid.l-card")!.getAttribute("data-pad")).toBe("form");
    expect(form.lastElementChild!.querySelector(".btn-primary")).not.toBeNull(); // the action row closes the form column
  });
  it("copy controls are buttons that copy the link (not links that navigate)", async () => {
    const rows = render(CollectGroups, { props: { groups: R.groups, surveys: R.surveys, host: R.host } }).container;
    const copy = [...rows.querySelectorAll("[aria-label^='Copy link for']")];
    expect(copy.length).toBe(R.surveys.length);
    for (const c of copy) expect(c.tagName).toBe("BUTTON");
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      const btn = render(CopyButton, { props: { text: "3dreview.app/s/K7Q4F2", name: "Translators", icon: true } }).container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(btn);
      await vi.waitFor(() => expect(btn.getAttribute("aria-label")).toBe("Link copied for Translators"));
      expect(writeText).toHaveBeenCalledWith("3dreview.app/s/K7Q4F2");
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
    const off = render(CopyButton, { props: { text: "x", name: "Y" } }).container.querySelector("button") as HTMLButtonElement;
    await fireEvent.click(off);
    await vi.waitFor(() => expect(text(off)).toBe("Copy failed"));
  });
  // Validator round 3 R3-5: a refused copy or share showed only as a title tooltip.
  it("a refused copy or share is visible on the control and announced by its status line", async () => {
    const live = (root: Element) => root.querySelector(".sr-only[role=status]") as HTMLElement;
    // Labelled form: the visible label (its accessible name) changes to the short "Copy failed" (R4-1: the row keeps its width);
    // the status line, empty until then, carries the guidance.
    const lab = render(CopyButton, { props: { text: "x", label: "Copy share link", lead: "link" } }).container;
    expect(text(live(lab))).toBe("");
    await fireEvent.click(lab.querySelector("button") as HTMLElement);
    await vi.waitFor(() => expect(text(lab.querySelector("button") as HTMLElement)).toBe("Copy failed"));
    expect(text(live(lab))).toBe("Copy failed: select the link to copy it.");
    // Default form: visible "Copy failed", named with whose link it is (the visible words are in the name).
    const def = render(CopyButton, { props: { text: "x", name: "Translators" } }).container;
    await fireEvent.click(def.querySelector("button") as HTMLElement);
    await vi.waitFor(() => expect(def.querySelector("button")?.getAttribute("aria-label")).toBe("Copy failed for Translators"));
    expect(text(live(def))).toBe("Copy failed for Translators: select the link to copy it.");
    // Icon form: the warning glyph replaces the copy glyph, and the name says so.
    const ic = render(CopyButton, { props: { text: "x", name: "Translators", icon: true } }).container;
    const icb = ic.querySelector("button") as HTMLButtonElement;
    const glyph = () => icb.querySelector("path")?.getAttribute("d");
    const before = glyph();
    await fireEvent.click(icb);
    await vi.waitFor(() => expect(icb.getAttribute("aria-label")).toBe("Copy failed: select the link for Translators"));
    expect(glyph()).not.toBe(before);
    expect(text(live(ic))).toBe("Copy failed for Translators: select the link to copy it.");
    // Success is announced too.
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      const ok = render(CopyButton, { props: { text: "x", name: "Community", icon: true } }).container;
      await fireEvent.click(ok.querySelector("button") as HTMLElement);
      await vi.waitFor(() => expect(text(live(ok))).toBe("Link copied for Community."));
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
    // Share-out with neither a share sheet nor a clipboard.
    const so = render(ShareOut, { props: { text: "x", name: "Translators" } }).container;
    const sob = so.querySelector("button") as HTMLButtonElement;
    expect(text(live(so))).toBe("");
    await fireEvent.click(sob);
    await vi.waitFor(() => expect(sob.getAttribute("aria-label")).toBe("Sharing failed: select the link for Translators"));
    await vi.waitFor(() => expect(text(live(so))).toBe("Sharing failed: select the link for Translators."));
  });
  // Validator round 4 R4-3: a repeated outcome left the status text identical, so the DOM did not change and nothing was re-announced.
  it("a repeated outcome is announced again: the status line is cleared, then set (copy and share-out)", async () => {
    const said = async (root: Element) => {
      const st = root.querySelector(".sr-only[role=status]") as HTMLElement;
      const seen: string[] = [];
      const mo = new MutationObserver(() => seen.push(st.textContent ?? ""));
      mo.observe(st, { childList: true, characterData: true, subtree: true });
      return { st, seen, stop: () => mo.disconnect() };
    };
    for (const [root, want] of [
      [render(CopyButton, { props: { text: "x", name: "Translators" } }).container, "Copy failed for Translators: select the link to copy it."],
      [render(ShareOut, { props: { text: "x", name: "Translators" } }).container, "Sharing failed: select the link for Translators."],
    ] as [HTMLElement, string][]) {
      const b = root.querySelector("button") as HTMLButtonElement;
      const s = await said(root);
      await fireEvent.click(b);
      await vi.waitFor(() => expect(text(s.st)).toBe(want));
      s.seen.length = 0;
      await fireEvent.click(b);
      await vi.waitFor(() => expect(s.seen.at(-1)).toBe(want));
      s.stop();
      expect(s.seen).toContain("");
      expect(text(s.st)).toBe(want);
    }
  });
});

// Validator round 2 N2 + N4 (VALIDATION-actions-r2.md): controls that looked live but did nothing.
describe("actions lane controls act, and the ones that cannot yet are named debt", () => {
  const byText = (root: Element, sel: string, t: string) => [...root.querySelectorAll(sel)].find((el) => text(el) === t) as HTMLElement;
  it("action plan: the share-link copies are buttons that copy the plan link; Email it prepares a draft at both widths; Print prints", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const before = window.print;
    const print = vi.fn();
    window.print = print;
    try {
      const d = mount(ActionPlan);
      const copy = byText(d, "button", "Copy share link");
      expect(copy.getAttribute("type")).toBe("button");
      expect(copy.hasAttribute("aria-label")).toBe(false); // the visible label is the name
      await fireEvent.click(copy);
      await vi.waitFor(() => expect(text(copy)).toBe("Copied"));
      expect(writeText).toHaveBeenLastCalledWith(PLAN.share.url);
      expect(byText(d, "button", "Email it").getAttribute("aria-haspopup")).toBe("dialog");
      await fireEvent.click(byText(d, "button", "Print"));
      expect(print).toHaveBeenCalledTimes(1);
      const ph = mount(ActionPlan, { phone: true });
      const pc = byText(ph, "button", "Copy link");
      expect(pc.className).toBe("btn btn-block");
      await fireEvent.click(pc);
      await vi.waitFor(() => expect(text(pc)).toBe("Copied"));
      expect(writeText).toHaveBeenCalledTimes(2);
      expect(byText(ph, "button", "Email it").getAttribute("aria-haspopup")).toBe("dialog");
      expect(ph.querySelector("input[readonly]")).toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
      window.print = before;
    }
  });
  // Validator round 4 R4-1: the refused label "Select the link to copy" widened the button past the card at 390 and pointed at a
  // link ActionPlanPhone does not draw.
  it("action plan phone: a refused copy keeps a short label, the row may wrap, and the link to select appears", async () => {
    const ph = mount(ActionPlan, { phone: true });
    const pc = [...ph.querySelectorAll("button")].find((b) => text(b) === "Copy link") as HTMLButtonElement;
    expect(pc.parentElement!.hasAttribute("data-wrap")).toBe(true);
    expect(ph.querySelector("input[readonly]")).toBeNull();
    await fireEvent.click(pc);
    await vi.waitFor(() => expect(text(pc)).toBe("Copy failed"));
    const link = ph.querySelector("input.in[readonly]") as HTMLInputElement;
    expect(link.value).toBe(PLAN.share.url);
    expect(link.getAttribute("aria-label")).toBe("Link to this plan");
    expect(text(ph.querySelector(".sr-only[role=status]") as HTMLElement)).toBe("Copy failed: select the link to copy it.");
    // Desktop prints the link on the page, so it adds no field.
    const d = mount(ActionPlan);
    const dc = [...d.querySelectorAll("button")].find((b) => text(b) === "Copy share link") as HTMLButtonElement;
    await fireEvent.click(dc);
    await vi.waitFor(() => expect(text(dc)).toBe("Copy failed"));
    expect(d.querySelector("input[readonly]")).toBeNull();
    expect(text(d.querySelector(".paper .plan-share .mono") as HTMLElement)).toBe(PLAN.share.url);
    const all = (a: Element, q: string) => [...a.querySelectorAll(q)].map((e) => text(e as HTMLElement));
    // Paper sheet contents (design-system.md:861 @697c974d): the next-steps sheet on the board's classes, no .small/.h3/inline type
    const sheet = d.querySelector(".paper")!;
    expect([...sheet.children].map((e) => e.className || e.tagName)).toEqual(["paper-title-row", "plan-cols", "DIV", "plan-notes", "plan-dates", "plan-share", "pfoot"]);
    expect([...sheet.querySelectorAll(".plan-row")].map((r) => [...r.children].map((c) => c.className))).toEqual(Array(PLAN.talk.length).fill(["plan-check", "", "plan-gap"]));
    expect(all(sheet, ".plan-gap")).toEqual(PLAN.talk.map(([, g]) => g));
    expect(all(sheet, ".plan-notes p.plan-note")).toEqual([PLAN.noticed, PLAN.next]);
    expect(all(sheet, ".plan-dates .plan-dt")).toEqual(PLAN.facts.map(([k]) => k));
    expect(all(sheet, ".plan-dates .plan-dd")).toEqual(PLAN.facts.map(([, v]) => v));
    expect(sheet.querySelectorAll(".small, .h3, h1, h2, .kbd, [style]").length).toBe(0);
    expect(sheet.querySelector(".paper-title-row > svg.mk[width='40']")).not.toBeNull();
  });
  it("share phone: the share-out icon hands the row's link to the share sheet, else copies it", async () => {
    const s = R.surveys[0];
    const link = `${R.shortHost}${s.code}`;
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    try {
      const b = mount(Share, { phone: true }).querySelector(`button[aria-label='Share link for ${s.name}']`) as HTMLButtonElement;
      expect(b.className).toBe("btn btn-quiet btn-icon");
      await fireEvent.click(b);
      await vi.waitFor(() => expect(share).toHaveBeenCalledWith({ title: `${R.review.title}: ${s.name}`, text: link }));
    } finally {
      Reflect.deleteProperty(navigator, "share");
    }
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      const b = mount(Share, { phone: true }).querySelector(`button[aria-label='Share link for ${s.name}']`) as HTMLButtonElement;
      await fireEvent.click(b);
      await vi.waitFor(() => expect(b.getAttribute("aria-label")).toBe(`Link copied for ${s.name}`));
      expect(writeText).toHaveBeenCalledWith(link);
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  it("shareText: a closed share sheet does not fall through to the clipboard; with neither it resolves false", async () => {
    const writeText = vi.fn(async () => {});
    const abort = Object.assign(new Error("closed"), { name: "AbortError" });
    expect(await shareText("x", "t", { share: async () => { throw abort; }, clipboard: { writeText } })).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
    expect(await shareText("x", "t", { share: async () => { throw new Error("NotAllowed"); }, clipboard: { writeText } })).toBe("copied");
    expect(await shareText("x", "t", {})).toBe(false);
  });
  it("the only inert controls left are the itemised wiring debt (plan store, codes API, plan PDF)", () => {
    const found: string[] = [];
    for (const f of readdirSync(LANE_DIR).filter((x) => x.endsWith(".svelte"))) {
      const src = readFileSync(join(LANE_DIR, f), "utf8").replace(/<!--[\s\S]*?-->/g, "");
      // A disabled Button is not inert-looking: it shows it is off, with its reason beside it (Print with nothing ticked).
      for (const [tag] of src.matchAll(/<Button\b[^>]*>/g)) if (!/\bhref=/.test(tag) && !/\sdisabled[\s/>]/.test(tag)) found.push(`${f} ${(tag.match(/\blabel=("[^"]*"|\{[^}]*\})/) ?? tag.match(/ariaLabel=(\{[^}]*\}|"[^"]*")/))?.[1]}`);
      for (const [, hash] of src.matchAll(/href="(#[a-z-]+)"/g)) found.push(`${f} ${hash}`);
    }
    expect(found.sort()).toEqual([
      "ActionPlan.svelte #pdf", // Download PDF (desktop), Share the PDF (phone-bar): no PDF of the plan yet
      "ActionPlan.svelte #pdf",
      'NextStep.svelte "Add to plan"', // the plan store (debt 3)
      'NextStep.svelte "Not this one"',
      'NextStep.svelte "Not this one"',
      'NextStep.svelte {it.inPlan ? "In the plan" : "Add to plan"}',
    ]);
  });

  // Validator round 3 R3-2: the guard above only sees a Button with no href; a link that only stands in for an action (Print goes to
  // Collect, Save reloads the form) passed it. This one renders every view and classifies every link-styled control the lane draws
  // (a.btn, a.mi, a.link; the shared TopBar and PhoneHeader are not the lane's, and hash-only links are the inert list above) as
  // "label → screen[state]#hash". NAV: the label names where it goes, or it leaves without acting. STAND_IN: it should act but only
  // navigates, each named debt in RESULTS-actions round 4. A new control in neither list fails, so no stand-in is silent.
  const NAV = [
    "+ filter → explore", "Cancel → collect", "Cancel → sandbox", "Close collection now → close-collection", "Discard → collect", "Done → collect",
    "Edit details and dates → setup1", "Explore all → explore", "Help and FAQ → help", "Hindi New Testament → project", "Invitations · 1 new → invitations",
    "Luke 1–2 · improve → next-step", "Mark 1–4 draft → collect", "Meeting offline? Print and paper → collect#offline", "Meeting offline? card on Collect → collect#offline",
    "More actions → collect[menu]", "People with access → people", "Print or share the plan → action-plan", "Print {survey} survey → print",
    "QR code for {survey} → qr-room", "QR for {survey} → qr-room", "See all results → results", "Public website home → landing", "Send app feedback → feedback", "Share the practice survey → share",
    "Share the survey → share", "Show QR codes for the room → qr-room", "Start a 3D Review → setup1", "BCS · India — switch workspace → workspace",
    "Why 3D Review exists → about", "Open email app → mailto",
  ];
  const STAND_IN: Record<string, string> = {
    "Complete the review → home": "debt 3: no review-stage write in UI Next",
    "Print 2 surveys → collect": "debt 2: printing not wired (printDocumentHtml / openPrintDocument)",
    "Try translating again → print": "debt 2: translatePrint not called",
    "Save and enter the next paper → paper-entry": "debt 5: saving a paper response not wired",
    "Next question → paper-entry": "debt 5: one question drawn, no answer state",
    "Back → paper-entry": "debt 5: one question drawn, no answer state",
    "Fill with simulated responses → results": "debt 4: no practice-copy store",
    "Generate 30 responses → results": "debt 4: no practice-copy store",
    "Clear → sandbox": "debt 4: no practice-copy store",
    "Clear simulated responses → results": "debt 4: no practice-copy store",
    "Delete this practice copy → home": "debt 4: no practice-copy store",
    "Sign out → sign-in": "debt 8: no sign-out seam in UI Next",
    "Use another account → sign-in": "debt 8: no sign-out seam in UI Next",
  };
  const control = (a: HTMLAnchorElement) => {
    if ((a.getAttribute("href") ?? "").startsWith("mailto:")) return `${text(a)} → mailto`;
    let label = (a.getAttribute("aria-label") ?? text(a)).replace(/\s+/g, " ").trim();
    for (const sv of R.surveys) label = label.replace(sv.name, "{survey}");
    const [query, hash] = (a.getAttribute("href") ?? "").split("#");
    const q = new URLSearchParams(query);
    return `${label} → ${q.get("screen")}${q.get("state") ? `[${q.get("state")}]` : ""}${hash ? `#${hash}` : ""}`;
  };
  const lanesLinks = (root: Element) => [...root.querySelectorAll<HTMLAnchorElement>("a.btn, a.mi, a.link")]
    .filter((a) => !a.closest("header.top[data-variant=signed-in], header.phone-top") && !(a.getAttribute("href") ?? "").startsWith("#"));
  it("every link-styled control either goes where its label says or is a named stand-in (no silent stand-ins)", () => {
    expect(NAV.filter((n) => n in STAND_IN)).toEqual([]);
    const found = new Set<string>();
    for (const [, Comp, desk] of SCREENS) for (const props of desk ? [{}, { phone: true }] : [{ phone: true }]) for (const a of lanesLinks(mount(Comp, props))) found.add(control(a));
    // Print with nothing ticked draws a disabled button at both widths (phone: the shared PhoneBar's disabled, R4-2), so no link appears.
    const none = mount(Print, { phone: true });
    for (const cb of none.querySelectorAll<HTMLInputElement>("input.cb")) if (cb.checked) cb.click();
    flushSync();
    expect(lanesLinks(none).map(control)).not.toContain("Print surveys → collect");
    for (const a of lanesLinks(none)) found.add(control(a));
    expect([...found].sort()).toEqual([...NAV, ...Object.keys(STAND_IN)].sort());
  });

  // Validator round 3 R3-1: the count came from the fixture, so unticking left "Print 2 surveys" on the button and the phone bar.
  it("print: the primary counts the ticked surveys; with none ticked it is disabled and says why", () => {
    const d = mount(Print);
    const boxes = [...d.querySelectorAll<HTMLInputElement>("dialog input.cb")];
    expect(boxes.filter((b) => b.checked).length).toBe(2);
    const primary = () => d.querySelector("dialog .btn-primary") as HTMLElement;
    const reason = () => text(d.querySelector("dialog p[role=status]") as HTMLElement);
    expect(text(primary())).toBe("Print 2 surveys");
    expect(primary().tagName).toBe("A");
    expect(reason()).toBe("");
    const ticked = boxes.filter((b) => b.checked);
    ticked[0].click();
    flushSync();
    expect(text(primary())).toBe("Print 1 survey");
    ticked[1].click();
    flushSync();
    expect(primary().tagName).toBe("BUTTON");
    expect((primary() as HTMLButtonElement).disabled).toBe(true);
    expect(text(primary())).toBe("Print surveys");
    expect(reason()).toBe("Tick at least one survey to print.");
    expect(primary().getAttribute("aria-describedby")).toBe(d.querySelector("dialog p[role=status]")!.id);
    expect(d.querySelectorAll(".btn-primary").length).toBe(1);
    boxes[0].click();
    boxes[4].click();
    boxes[1].click();
    flushSync();
    expect(text(primary())).toBe("Print 3 surveys");
    expect(primary().tagName).toBe("A");
    expect(reason()).toBe("");

    const ph = mount(Print, { phone: true });
    const bar = () => text(ph.querySelector(".phone-bar .btn-primary") as HTMLElement);
    const pb = [...ph.querySelectorAll<HTMLInputElement>("input.cb")];
    expect(bar()).toBe("Print 2 surveys");
    pb.filter((b) => b.checked)[0].click();
    flushSync();
    expect(bar()).toBe("Print 1 survey");
    pb.filter((b) => b.checked)[0].click();
    flushSync();
    expect(bar()).toBe("Print surveys");
    expect(text(ph.querySelector("[role=status]") as HTMLElement)).toBe("Tick at least one survey to print.");
    // R4-2: the phone-bar primary is the shared PhoneBar's disabled button (no link), tied to the reason in the card.
    const pp = ph.querySelector(".phone-bar .btn-primary") as HTMLButtonElement;
    expect(pp.tagName).toBe("BUTTON");
    expect(pp.disabled).toBe(true);
    expect(pp.hasAttribute("href")).toBe(false);
    expect(ph.querySelector(`#${pp.getAttribute("aria-describedby")}`)).toBe(ph.querySelector("[role=status]"));
    expect(text(ph.querySelector(".phone-bar .btn-quiet") as HTMLElement)).toBe("Cancel");
    pb[0].click();
    flushSync();
    expect(bar()).toBe("Print 1 survey");
    expect(ph.querySelector(".phone-bar .btn-primary")!.tagName).toBe("A");
  });

  // Validator round 3 R3-3: an unguarded percentage made Bar throw (n > of, or of 0), so Print and Sandbox failed to render.
  it("collect rows: more answers than expected draw a full bar, no expected count an empty one, and nothing throws", () => {
    const surveys = R.surveys.map((sv, i) => ({ ...sv, n: [40, 3, 0, 5, 2][i], of: [30, 0, 0, 5, -1][i] }));
    const rows = render(CollectGroups, { props: { groups: R.groups, surveys, host: R.host } }).container;
    const widths = [...rows.querySelectorAll(".bar rect")].map((r) => r.getAttribute("width"));
    const order = R.groups.flatMap((g) => g.surveys);
    expect(widths).toEqual(order.map((i) => ["100%", "0%", "0%", "100%", "0%"][i]));
  });
  it("Share takes live data: a new review with zero responses and no open survey renders (ReviewHead's refusal reason is the honest capability line), and real links replace the fixture", () => {
    const base = { user: { first: "A", initials: "A" }, workspace: "", project: "P", role: "owner", review: { title: "New review", language: "", modality: "", updated: "just now" }, host: "", shortHost: "", surveys: [] as Array<{ lens: string; name: string; code: string; n: number; of: string | number; pages: number }>, noLinks: "No survey is collecting yet, so there is no link to share. Open collection on the review page first.", deleteRefused: "Deleting a review is done from the current design's review page; this screen does not delete yet." };
    const share = { copied: -1, lead: "lead", phoneLead: "phone lead", codes: { code: "", line: "", unused: "no codes yet" } };
    for (const phone of [false, true]) {
      const a = render(Share, { props: { phone, data: base, share } }).container;
      expect(text(a)).toContain("No survey is collecting yet");
      expect(a.querySelectorAll("input.in[readonly]")).toHaveLength(0);
      expect(text(a)).not.toContain("3dreview.app");
    }
    const withLink = { ...base, surveys: [{ lens: "community", name: "Written", code: "http://x/next/?ui_next=on#survey=link_1", n: 0, of: "—", pages: 0 }], noLinks: "" };
    const b = render(Share, { props: { phone: false, data: withLink, share } }).container;
    expect((b.querySelector("input.in[readonly]") as HTMLInputElement).value).toBe("http://x/next/?ui_next=on#survey=link_1");
    expect(text(b)).toContain("Open a real review to issue access codes."); expect(b.querySelector("button[aria-label='Copy link for Written']")).not.toBeNull();
  });
});

describe("live QA N6: print copy counts right and says where printing went", () => {
  it("printOpenedLine pluralises and never says 'Use Print below'; a survey row's question count is not called pages", async () => {
    const { printOpenedLine } = await import("../ui-next/src/app/print.js");
    expect(printOpenedLine({ items: [1] })).toBe("1 question ready; the print tab has opened.");
    expect(printOpenedLine({ items: [1, 2, 3] })).toBe("3 questions ready; the print tab has opened.");
    expect(printOpenedLine({ items: [1], lang: "hi", language: "Hindi", english: 0, phrases: 4, review: true })).toBe("1 question ready in Hindi. Machine translation, not yet checked by a speaker of this language. The print tab has opened.");
    expect(printOpenedLine({ items: [1], lang: "hi", language: "Hindi", english: 2, phrases: 4 })).toMatch(/^Translation incomplete for Hindi\. 2 of 4 phrases .* The print tab uses these English fallbacks; choose Print again to retry\.$/);
    for (const v of [printOpenedLine({ items: [1] }), printOpenedLine({ items: [1], lang: "hi", language: "Hindi", english: 1, phrases: 2 })]) expect(v).not.toContain("Use Print below");
    const src = readFileSync(resolve(__dirname, "../ui-next/src/screens/actions/Print.svelte"), "utf8");
    expect(src).toContain('{#if typeof s.pages === "string"}{s.pages}'); // a live row's "1 question" is shown as it is, never "1 question pages"
    expect(src).toContain('{s.pages === 1 ? "page" : "pages"}');
  });
});
