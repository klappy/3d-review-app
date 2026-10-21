// @vitest-environment jsdom
// UI Next (v4) actions lane screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas NextStep, NextStepPhone, ActionPlan, ActionPlanPhone, Print, PrintPhone,
// Share, SharePhone, Sandbox, SandboxPhone, PaperEntry, PaperEntryPhone, MenuPhone (.dc.html); unit work/active/2026-10-21-ui-next-screens-fanout.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
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
// @ts-expect-error -- plain .js module, no type declarations
import actions from "../ui-next/src/screens/actions/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY, LANES } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { copy as SHARE_COPY } from "../ui/assess/share.js";
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
  ["paper-entry", PaperEntry, ["Enter a paper answer", "Code on the paper", "Most of it is easy, but some parts are hard", "Save and enter the next paper", "Entered today", "Last receipt · R-2048-732"],
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

describe("actions lane wiring through the current UI's pure modules", () => {
  it("share: copy actions follow ui/assess/share.js CAN_SHARE; another role reads its readOnly line", () => {
    const owner = mount(Share, { role: "owner" });
    expect(owner.querySelectorAll("button.btn").length).toBeGreaterThanOrEqual(5);
    expect(text(owner)).not.toContain(SHARE_COPY.readOnly);
    const viewer = mount(Share, { role: "viewer" });
    expect(text(viewer)).toContain(SHARE_COPY.readOnly);
    expect(text(viewer)).not.toContain("Copied");
    expect([...owner.querySelectorAll("input.in[readonly]")].map((i) => (i as HTMLInputElement).value)).toEqual(R.surveys.map((s) => `${R.host}${s.code}`));
  });
  it("print: language choices come from ui/assess/print-lang.js (English first, then the review's and project's LWCs)", () => {
    const sel = mount(Print).querySelector("select#pt-lang") as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(["English", "Hindi", "Odia"]);
    expect(sel.value).toBe("Hindi");
  });
  it("paper-entry: the write-in choice is marked by ui/present.js isOtherOption; the receipt goes through receiptLine", () => {
    const a = mount(PaperEntry);
    const other = [...a.querySelectorAll("input[data-other]")];
    expect(other.length).toBe(1);
    expect(text(other[0].closest("label") as Element)).toBe("Other (please describe)");
    expect(text(a)).toContain("Last receipt · R-2048-732");
  });
});

describe("actions lane parts", () => {
  it("review head: viewed tab is aria-current, the live phase carries Now, done phases a done dot", () => {
    const a = render(ReviewHead, { props: { title: "T", stage: "collecting", viewed: "collect", live: "collect", done: ["prepare"] } }).container;
    const tabs = [...a.querySelectorAll("a.tab")];
    expect(tabs.map((t) => t.getAttribute("aria-current"))).toEqual([null, "page", null, null]);
    expect(tabs[1].querySelector(".now")?.textContent).toBe("Now");
    expect(tabs[0].querySelector(".dot.done")).toBeTruthy();
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
  it("menu: the account sheet is a native dialog with the seven board rows", () => {
    const a = mount(MenuSheet);
    const d = a.querySelector("dialog") as HTMLDialogElement;
    expect(d).toBeTruthy();
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.querySelectorAll("a.mi").length).toBe(7);
  });
});
