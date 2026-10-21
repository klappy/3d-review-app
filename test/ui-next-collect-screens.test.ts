// @vitest-environment jsdom
// UI Next (v4) collect lane screens (status: provisional): collect, close-collection, qr-room, print-qr.
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Collect, CollectPhone, CollectMenu, CollectMenuPhone, CollectDark,
// CloseCollection, CloseCollectionPhone, QRRoom, QRRoomPhone, PrintQR, PrintQRPhone (.dc.html); contract canvas/design-system.md
// (§2 Room health, Offline actions, Dialog and sheet states, Top bar variants); data ui-next/fixtures/collect/collect.json.
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import Collect from "../ui-next/src/screens/collect/Collect.svelte";
import CloseCollection from "../ui-next/src/screens/collect/CloseCollection.svelte";
import QRRoom from "../ui-next/src/screens/collect/QRRoom.svelte";
import PrintQR from "../ui-next/src/screens/collect/PrintQR.svelte";
import fixture from "../ui-next/fixtures/collect/collect.json";
// @ts-expect-error -- plain .js module, no type declarations
import collect from "../ui-next/src/screens/collect/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { collectModel, stageTabs, pct, href, qrModules } from "../ui-next/src/screens/collect/model.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { STAGES } from "../ui/stage-screens.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";

type Props = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shot = (C: any, props: Props = {}) => render(C, { props }).container.querySelector(".app") as HTMLElement;
const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const all = (a: ParentNode, sel: string) => [...a.querySelectorAll(sel)].map(text);

// Every board in the lane: [board, component, props, the query that reaches it under the flag]
const BOARDS: [string, unknown, Props, string][] = [
  ["Collect", Collect, {}, "screen=collect"],
  ["CollectPhone", Collect, { phone: true }, "screen=collect&w=phone"],
  ["CollectMenu", Collect, { state: "menu" }, "screen=collect&state=menu"],
  ["CollectMenuPhone", Collect, { phone: true, state: "menu" }, "screen=collect&w=phone&state=menu"],
  ["CollectDark", Collect, { theme: "dark" }, "screen=collect&theme=dark"],
  ["CloseCollection", CloseCollection, {}, "screen=close-collection"],
  ["CloseCollectionPhone", CloseCollection, { phone: true }, "screen=close-collection&w=phone"],
  ["QRRoom", QRRoom, {}, "screen=qr-room"],
  ["QRRoomPhone", QRRoom, { phone: true }, "screen=qr-room&w=phone"],
  ["PrintQR", PrintQR, {}, "screen=print-qr"],
  ["PrintQRPhone", PrintQR, { phone: true }, "screen=print-qr&w=phone"],
];
const store = () => { const m = new Map<string, string>([["ui_next", "on"]]); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("collect lane registry and routes", () => {
  it("registers four kebab names, merged into the shared registry", () => {
    expect(Object.keys(collect)).toEqual(["collect", "close-collection", "qr-room", "print-qr"]);
    for (const [name, C] of Object.entries(collect)) expect(REGISTRY[name]).toBe(C);
  });
  for (const [board, C, props, q] of BOARDS) {
    it(`${board}: /next/?ui_next=on&${q} reaches the screen with its props`, () => {
      const r = route(new URLSearchParams(`?ui_next=on&${q}`), store(), Object.keys(REGISTRY));
      expect(REGISTRY[r.view]).toBe(C);
      expect(r.props.phone).toBe(Boolean(props.phone));
      expect(r.props.theme).toBe(props.theme ?? "light");
      expect(r.props.state).toBe(props.state);
    });
  }
});

describe("every board renders: shell, at most one primary, no inline style", () => {
  for (const [board, C, props] of BOARDS) {
    it(board, () => {
      const a = shot(C, props);
      expect(a.matches(".app")).toBe(true);
      expect(a.getAttribute("data-theme")).toBe((props.theme as string) ?? "light");
      expect(a.getAttribute("data-w")).toBe(props.phone ? "phone" : null);
      expect(a.querySelectorAll(".btn-primary").length).toBeLessThanOrEqual(1);
      expect(a.querySelector("[style]")).toBeNull();
      if (props.phone) { expect(a.querySelector(".phone-top")).not.toBeNull(); expect(a.querySelector("header.top")).toBeNull(); }
      else expect(a.querySelector("header.top")).not.toBeNull();
    });
  }
});

describe("Collect (Collect, CollectPhone, CollectMenu, CollectMenuPhone, CollectDark)", () => {
  it("desktop: crumb, title, stage pill, tabs with Now on Collect, 18 of 30, room health with the instruction, five survey rows", () => {
    const a = shot(Collect);
    expect(all(a, "nav.crumb li")).toEqual(["Hindi New Testament", "Mark 1–4 draft"]);
    expect(text(a.querySelector("h1.title-page"))).toBe("Mark 1–4 draft");
    expect(a.querySelector(".pill")!.getAttribute("data-stage")).toBe("collecting");
    expect(text(a.querySelector("main p.small.t-15"))).toBe("Hindi New Testament · Hindi · Written · Updated just now");
    expect(all(a, "nav.tabs .tab")).toEqual(["Prepare", "2Collect Now", "3Understand", "4Improve"]);
    expect(a.querySelector(".tab[aria-current=page]")!.textContent).toContain("Collect");
    expect(a.querySelector(".tab .dot.done svg")).not.toBeNull();
    expect(text(a.querySelector(".btn-primary"))).toBe("Share the survey");
    expect(all(a, "h2.h2")).toEqual(["Responses"]);
    expect(all(a, ".num[data-size='40']")).toEqual(["18"]);
    expect(all(a.querySelector("[role=status]")!, ":scope > *")).toEqual(["38 surveys opened in the last minute", "6 opens turned away"]);
    expect(a.querySelector("[role=status]")!.getAttribute("aria-live")).toBe("polite");
    expect(a.querySelector(".tag[data-kind=warn]")).not.toBeNull();
    expect(a.textContent).toContain("Ask people on shared Wi-Fi to switch to mobile data, or hand out paper surveys.");
    expect(all(a, ".glass .l-row > .h3")).toEqual(["Translation team", "Community", "Church"]);
    expect(all(a, "[data-tpl=survey-row] .h3")).toEqual(["Translators", "Team leaders & mentors", "Community", "Pastor involved in the work", "Denominational leader"]);
    expect(all(a, "[data-tpl=survey-row] .num")).toEqual(["4 of 5", "2 of 3", "8 of 15", "3 of 5", "1 of 2"]);
    expect(all(a, "[data-tpl=survey-row] .kbd")).toEqual(["3dreview.app/s/K7Q4F2", "3dreview.app/s/M3X9A1", "3dreview.app/s/P8L2W4", "3dreview.app/s/R5T7N2", "3dreview.app/s/D2C6H9"]);
    expect(all(a, ".l-row.l-row > .small.tab-n, .l-row > span.small.tab-n")).toEqual(["6 of 8 expected", "8 of 15 expected", "4 of 7 expected"]);
    expect([...a.querySelectorAll(".bar rect")].map((r) => r.getAttribute("width"))).toEqual(["80%", "66%", "53%", "60%", "50%"]);
    expect(a.querySelector("[aria-label='QR code for Community']")!.getAttribute("href")).toBe("?screen=qr-room");
  });
  it("desktop aside: survey window, the one offline home with three actions, the passage", () => {
    const a = shot(Collect);
    expect(all(a, "aside .h3")).toEqual(["Survey open", "Meeting offline?", "Before people answer"]);
    expect(a.textContent).toContain("28 Sep – 31 Oct · 33 days left");
    expect(a.textContent).toContain("Results open on 31 Oct, or earlier if you close collection from the ⋯ menu.");
    expect(all(a, "#offline .btn")).toEqual(["Print surveys", "Print QR pages", "Enter paper answers"]);
    expect(a.querySelector("#offline a[href='?screen=print-qr']")).not.toBeNull();
    expect(a.textContent).toContain("Read or play Mark 1–4 to everyone answering. The survey shows it too.");
  });
  it("the ⋯ menu: closed by default, open in state menu; delete is refused with its reason, last after an hr", () => {
    expect(shot(Collect).querySelector("details.dd:not([open]) summary[aria-label='More actions']")).not.toBeNull();
    const a = shot(Collect, { state: "menu" });
    const menu = a.querySelector("details.dd[open] .menu")!;
    expect(all(menu, ".mi")).toEqual(["Edit details and dates", "People with access", "Close collection now", "Meeting offline? Print and paper", "Delete this review"]);
    const del = menu.querySelector(".mi.danger")!;
    expect(del.tagName).toBe("BUTTON");
    expect(del.getAttribute("aria-disabled")).toBe("true");
    expect(text(menu.querySelector(".mi-why"))).toBe("Reviews with responses can't be deleted. This one has 18.");
    expect(menu.querySelector(".mi[href='?screen=close-collection']")).not.toBeNull();
    expect(() => render(Collect, { props: { state: "busy" } })).toThrow(/unknown state/);
  });
  it("phone: header root, compact stage words, hero card with 18 of 30 · 5 surveys, quiet room line, list rows, offline block, phone-bar primary", () => {
    const a = shot(Collect, { phone: true });
    expect(a.querySelector(".phone-top[data-state=root]")).not.toBeNull();
    expect(text(a.querySelector("h1.title-phone"))).toBe("Mark 1–4 draft");
    expect(all(a, "nav.tabs .tab")).toEqual(["Prepare", "Collect", "Understand", "Improve"]);
    expect(all(a.querySelector(".l-card[data-pad=hero] .l-row")!, ":scope > *")).toEqual(["18", "of 30 · 5 surveys"]);
    expect(all(a.querySelector("[role=status]")!, ":scope > *")).toEqual(["38 surveys opened in the last minute", "0 opens turned away"]);
    expect(a.querySelector(".tag[data-kind=warn]")).toBeNull();
    expect(a.textContent).not.toContain("Ask people on shared Wi-Fi");
    expect(all(a, ".l-card .small.tab-n")).toEqual(["4/5", "2/3", "8/15", "3/5", "1/2"]);
    expect(all(a, "#offline .btn")).toEqual(["Print surveys", "Print QR pages", "Enter paper answers"]);
    expect(text(a.querySelector(".phone-bar .btn-primary"))).toBe("Share the survey");
    expect(a.querySelector("[aria-label='More actions']")!.getAttribute("href")).toBe("?screen=collect&w=phone&state=menu");
    expect(a.querySelector("dialog")).toBeNull();
  });
  it("phone menu (CollectMenuPhone): the ⋯ sheet over the card, labelled by the review title, delete refused", () => {
    const a = shot(Collect, { phone: true, state: "menu" });
    const d = a.querySelector("dialog.glass-hi.sheet")!;
    expect(d.hasAttribute("open")).toBe(true);
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`))).toBe("Mark 1–4 draft");
    expect(all(d, ".mi")).toEqual(["Edit details and dates", "People with access", "Open the passage", "Meeting offline? Print and paper", "Close collection now", "Delete this review"]);
    expect(d.querySelector(".mi.danger")!.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("CloseCollection (CloseCollection, CloseCollectionPhone)", () => {
  it("desktop: modal dialog with title, consequence, per-perspective counts, Keep collecting then the one primary", () => {
    const a = shot(CloseCollection);
    const d = a.querySelector("dialog.glass-hi:not(.sheet)")!;
    expect(d.hasAttribute("open")).toBe(true);
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`))).toBe("Close collection now?");
    expect(text(d.querySelector("p.small"))).toBe("Links and codes stop working and the review moves to Understand. 18 responses are in. You can reopen collection later — results refresh when you do.");
    expect(text(d.querySelector(".solid"))).toBe("Translation team 6 · Community 8 · Church 4. Every perspective has at least 3 answers, so results can show.");
    expect(all(d, ".btn")).toEqual(["Keep collecting", "Yes, close and see results"]);
    expect(a.querySelectorAll(".btn-primary").length).toBe(1);
    expect(text(a.querySelector(".btn-primary"))).toBe("Yes, close and see results");
    expect(text(a.querySelector("main .l-row > .l-row .btn:not(details .btn)"))).toBe("Share the survey");
  });
  it("the 3-answer line is said only when every perspective has 3 answers", () => {
    const thin = structuredClone(fixture);
    thin.groups[2].surveys[0].answered = 1;
    const a = shot(CloseCollection, { data: thin });
    expect(text(a.querySelector("dialog .solid"))).toBe("Translation team 6 · Community 8 · Church 2.");
  });
  it("phone: the sheet holds the primary; the phone bar's Share goes secondary; Keep collecting takes focus", () => {
    const a = shot(CloseCollection, { phone: true });
    const d = a.querySelector("dialog.glass-hi.sheet")!;
    expect(text(d.querySelector("h2"))).toBe("Close collection now?");
    expect(text(d.querySelector("p.small"))).toBe("18 of 30 expected have answered. Links stop working; you can reopen later.");
    expect(all(d, ".btn")).toEqual(["Yes, close and see results", "Keep collecting"]);
    expect(document.activeElement?.textContent).toBe("Keep collecting");
    expect(a.querySelector(".phone-bar .btn-primary")).toBeNull();
    expect(text(a.querySelector(".phone-bar .btn"))).toBe("Share the survey");
    expect(() => render(CloseCollection, { props: { state: "busy" } })).toThrow(/one state/);
  });
});

describe("QRRoom (QRRoom, QRRoomPhone)", () => {
  it("projector: room top bar (no menus, no help), heading, one perspective card per survey with its code and link, the room instruction", () => {
    const a = shot(QRRoom);
    const top = a.querySelector("header.top[data-variant=room]")!;
    expect(top.querySelector("details, [aria-label=Help]")).toBeNull();
    expect(text(top.querySelector(".crumb [aria-current=page]"))).toBe("Mark 1–4 draft");
    expect(all(top.querySelector("[role=status]")!, ":scope > *")).toEqual(["38 surveys opened in the last minute", "6 opens turned away"]);
    expect(top.textContent).not.toContain("Ask people on shared Wi-Fi");
    expect(all(top, ".tag:not([data-kind])")).toEqual(["18 answered"]);
    expect(all(top, ".btn")).toEqual(["Meeting offline? Print and paper", "Exit room view"]);
    expect(text(a.querySelector("h1.display"))).toBe("Scan the code for your role");
    const cards = [...a.querySelectorAll("main .glass-hi[data-lens]")];
    expect(cards.map((c) => c.getAttribute("data-lens"))).toEqual(["team", "team", "community", "church", "church"]);
    expect(cards.map((c) => text(c.querySelector(".h2")))).toEqual(["Translators", "Team leaders & mentors", "Everyone in the community", "Pastor involved in the work", "Denominational leader"]);
    expect(cards.map((c) => c.querySelectorAll(".qr i").length)).toEqual([441, 441, 441, 441, 441]);
    expect(a.querySelector(".btn-primary")).toBeNull();
    expect(a.textContent).toContain("Survey not opening? Switch from the shared Wi-Fi to mobile data, or ask for a paper survey.");
  });
  it("phone: nested header, survey 3 of 5 (Community), its code and short link, room health with the instruction, Previous / Next", () => {
    const a = shot(QRRoom, { phone: true });
    expect(text(a.querySelector(".phone-top .phone-title"))).toBe("Show a QR code");
    expect(a.textContent).toContain("Survey 3 of 5");
    expect(text(a.querySelector("main .h2"))).toBe("Community");
    expect(text(a.querySelector("main .l-card p.small"))).toBe("Scan to open the Hindi survey3dr.app/s/C4K7P");
    expect(a.querySelector(".qr[data-size=phone]")!.querySelectorAll("i.o").length).toBe([...fixture.qrRoomPhone.qr].filter((c) => c === "0").length);
    expect(a.textContent).toContain("Ask people on shared Wi-Fi to switch to mobile data, or hand out paper surveys.");
    expect(all(a, ".phone-bar .btn")).toEqual(["Previous", "Next survey"]);
    expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?screen=qr-room&w=phone&state=4");
    const first = shot(QRRoom, { phone: true, state: "1" });
    expect(text(first.querySelector("main .h2"))).toBe("Translators");
    expect(text(first.querySelector("main .l-card b"))).toBe("3dreview.app/s/K7Q4F2");
    expect(() => render(QRRoom, { props: { phone: true, state: "9" } })).toThrow(/survey number/);
  });
});

describe("PrintQR (PrintQR, PrintQRPhone)", () => {
  it("desktop: wide modal, pointer to Print paper surveys, five survey rows (three ticked), three layouts, language and paper fields, Print 3 pages, preview", () => {
    const a = shot(PrintQR);
    const d = a.querySelector("dialog.glass-hi[data-w=wide]")!;
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`))).toBe("Print QR code pages");
    expect(d.querySelector("a.link[href='?screen=print']")!.textContent).toBe("Print paper surveys");
    expect([...d.querySelectorAll("label.row-opt input.cb")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, true, false, false]);
    expect(all(d, "label.row-opt.compact .kbd")).toEqual(["K7Q4F2", "M3X9A1", "P8L2W4", "R5T7N2", "D2C6H9"]);
    expect(all(d, "label.row-opt input.rd + span .h3")).toEqual(["One page per survey", "Hand-out cards", "All on one page"]);
    expect([...d.querySelectorAll("input.rd")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, false, false]);
    expect(all(d, "label.lbl")).toEqual(["Text on the page", "Paper size"]);
    expect(all(d, "#print-qr-lang option")).toEqual(["English", "Hindi", "Odia"]);
    expect(text(d.querySelector("#print-qr-lang-help"))).toBe('The language of the "scan to answer" line. The survey itself opens in whatever language the person picks.');
    expect(text(a.querySelector(".btn-primary"))).toBe("Print 3 pages");
    expect(text(d.querySelector(".micro"))).toBe("Preview · one page per survey · A4 · 3 pages");
    const sheet = d.querySelector("svg.psheet foreignObject .paper")!;
    expect(text(sheet.querySelector(".ptitle"))).toBe("Translators");
    expect(text(sheet)).toContain("Scan to answer · or enter code K7Q 4F2 at 3dreview.app · Hindi · English · Odia");
    expect(text(sheet.querySelector(".pfoot"))).toBe("1 of 3");
  });
  it("phone: nested header, the QR code pages list with three ticked, Cancel + Print 3 pages in the bar", () => {
    const a = shot(PrintQR, { phone: true });
    expect(text(a.querySelector(".phone-top .phone-title"))).toBe("Print QR code pages");
    expect(text(a.querySelector("main .micro"))).toBe("QR code pages");
    expect(a.textContent).toContain("One A4 page per survey, with the link printed under the code.");
    expect([...a.querySelectorAll("label.row-opt input.cb")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, true, false, false]);
    expect(all(a, ".phone-bar .btn")).toEqual(["Cancel", "Print 3 pages"]);
    expect(a.querySelector("dialog")).toBeNull();
  });
});

describe("collect view model and data wiring", () => {
  const m = collectModel(fixture);
  it("totals and per-perspective counts come from the survey rows", () => {
    expect([m.answered, m.expected, m.surveys.length]).toEqual([18, 30, 5]);
    expect(m.groups.map((g: { label: string; answered: number; expected: number }) => [g.label, g.answered, g.expected])).toEqual([["Translation team", 6, 8], ["Community", 8, 15], ["Church", 4, 7]]);
    expect(m.byLens).toBe("Translation team 6 · Community 8 · Church 4");
    expect([pct(2, 3), pct(8, 15), pct(1, 0)]).toEqual([66, 53, 0]);
  });
  it("stage tabs read the current UI's STAGES (ui/stage-screens.js)", () => {
    const t = stageTabs("collect");
    expect(t.map((x: { label: string }) => x.label)).toEqual(STAGES.map((s: { label: string }) => s.label));
    expect(t.map((x: { done: boolean; current: boolean }) => [x.done, x.current])).toEqual([[true, false], [false, true], [false, false], [false, false]]);
    expect(() => stageTabs("share")).toThrow(/unknown stage/);
    expect(href("qr-room", { phone: true, state: "2", hash: "x" })).toBe("?screen=qr-room&w=phone&state=2#x");
  });
  it("a short link encodes to a real 21x21 code through ui/assess/vendor-qrcode.js; a long one returns null", () => {
    const q = qrModules(fixture.qrRoomPhone.link)!;
    expect(q).toMatch(/^[01]{441}$/);
    expect(q.slice(0, 7)).toBe("1111111"); // finder pattern, top-left
    expect(q.slice(14, 21)).toBe("1111111"); // finder pattern, top-right
    expect(qrModules("https://3dreview.app/#survey=abcdefghijklmnopqrstuvwxyz")).toBeNull();
    expect(qrModules("")).toBeNull();
  });
  it("the lane passes the ui-next lint (no inline style, tokens only)", () => {
    expect([...lintDir(resolve(__dirname, "../ui-next/src/screens/collect"))]).toEqual([]);
    expect([...lintDir(resolve(__dirname, "../ui-next/fixtures/collect"))]).toEqual([]);
  });
});
