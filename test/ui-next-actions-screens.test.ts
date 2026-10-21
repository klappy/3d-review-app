// @vitest-environment jsdom
// UI Next (v4) actions lane screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas NextStep, NextStepPhone, ActionPlan, ActionPlanPhone, Print, PrintPhone,
// Share, SharePhone, Sandbox, SandboxPhone, PaperEntry, PaperEntryPhone, MenuPhone (.dc.html); unit work/active/2026-10-21-ui-next-screens-fanout.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import NextStep from "../ui-next/src/screens/actions/NextStep.svelte";
import ActionPlan from "../ui-next/src/screens/actions/ActionPlan.svelte";
import Print from "../ui-next/src/screens/actions/Print.svelte";
import Share from "../ui-next/src/screens/actions/Share.svelte";
import Sandbox from "../ui-next/src/screens/actions/Sandbox.svelte";
import PaperEntry from "../ui-next/src/screens/actions/PaperEntry.svelte";
import MenuSheet from "../ui-next/src/screens/actions/MenuSheet.svelte";
import Qr from "../ui-next/src/screens/actions/Qr.svelte";
import Bar from "../ui-next/src/screens/actions/Bar.svelte";
import GapBar from "../ui-next/src/screens/actions/GapBar.svelte";
import ReviewHead from "../ui-next/src/screens/actions/ReviewHead.svelte";
import CollectGroups from "../ui-next/src/screens/actions/CollectGroups.svelte";
import CopyButton from "../ui-next/src/screens/actions/CopyButton.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import actions from "../ui-next/src/screens/actions/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { CAN_SHARE as LEGACY_CAN_SHARE, copy as SHARE_COPY } from "../ui/assess/share.js";
// @ts-expect-error -- plain .js module, no type declarations
import { PRINT_IN_LANGUAGE as LEGACY_PRINT_IN_LANGUAGE, printLanguages as legacyPrintLanguages } from "../ui/assess/print-lang.js";
// @ts-expect-error -- plain .js module, no type declarations
import { CAN_SHARE, READ_ONLY, PRINT_IN_LANGUAGE, printLanguages } from "../ui-next/src/screens/actions/legacy.js";
import R from "../ui-next/fixtures/actions/review.json";

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
        expect(a.querySelectorAll(".btn-primary").length).toBeLessThanOrEqual(1);
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
        expect(a.querySelectorAll("h1").length, `${name} ${v} h1`).toBe(1);
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
    expect([...declared].sort()).toEqual(["about", "action-plan", "close-collection", "collect", "explore", "feedback", "help", "home", "invitations", "menu", "next-step", "paper-entry", "people", "print", "project", "qr-room", "results", "sandbox", "setup1", "setup5", "share", "sign-in", "workspace"]);
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
    expect(sel.value).toBe("Hindi");
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
  it("menu: the account sheet is a native dialog.sheet with the seven board rows, a Close, and a backdrop tap that closes it", async () => {
    const a = mount(MenuSheet);
    const d = a.querySelector("dialog.glass-hi.sheet[data-pad=menu]") as HTMLDialogElement;
    expect(d).toBeTruthy();
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.getAttribute("closedby")).toBe("any");
    expect(d.querySelectorAll("a.mi[data-size=lg]").length).toBe(7);
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
    await vi.waitFor(() => expect(off.getAttribute("title")).toMatch(/select the link/));
    expect(text(off)).toBe("Copy");
  });
});
