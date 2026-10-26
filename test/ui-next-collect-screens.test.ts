// @vitest-environment jsdom
// UI Next (v4) collect lane screens (status: provisional): collect, close-collection, qr-room, print-qr.
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas Collect, CollectPhone, CollectMenu, CollectMenuPhone, CollectDark,
// CloseCollection, CloseCollectionPhone, QRRoom, QRRoomPhone, PrintQR, PrintQRPhone (.dc.html); contract canvas/design-system.md
// (§2 Room health, Offline actions, Dialog and sheet states (R14), Field and button states (R16), Top bar variants); data
// ui-next/fixtures/collect/collect.json (one source per value). Links come from the shared screens/href.js, which carries ?w= and ?theme=
// from location.search: each render sets the URL the route would have (at()).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLevelMinimum } from "../ui-next/src/screens/results/data.js";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRawSnippet, flushSync } from "svelte";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import Collect from "../ui-next/src/screens/collect/Collect.svelte";
import CloseCollection from "../ui-next/src/screens/collect/CloseCollection.svelte";
import QRRoom from "../ui-next/src/screens/collect/QRRoom.svelte";
import PrintQR from "../ui-next/src/screens/collect/PrintQR.svelte";
import Dialog from "../ui-next/src/screens/collect/Dialog.svelte";
import Bar from "../ui-next/src/screens/collect/Bar.svelte";
import fixture from "../ui-next/fixtures/collect/collect.json";
// @ts-expect-error -- plain .js module, no type declarations
import collect from "../ui-next/src/screens/collect/index.js";
// @ts-expect-error -- plain .js module, no type declarations
import { collectModel, stageTabs, pct, pickState, pickSurvey, pickedSurveys, pickLayout, printPages, pagesLabel, plural, deleteRefusal } from "../ui-next/src/screens/collect/model.js";
// @ts-expect-error -- Svelte module export, no type declarations
import { LENSES } from "../ui-next/src/LensDot.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { STAGES } from "../ui/stage-screens.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintDir } from "../scripts/ui-next-lint.mjs";

type Props = Record<string, unknown>;
const LANE = resolve(__dirname, "../ui-next/src/screens/collect");
// The URL the route would be at for these props (href() reads ?w= and ?theme= from it).
const at = (props: Props = {}) => {
  const q = new URLSearchParams({ ui_next: "on", screen: "x" });
  if (props.phone) q.set("w", "phone");
  if (props.theme) q.set("theme", String(props.theme));
  window.history.replaceState(null, "", `/next/?${q}`);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shot = (C: any, props: Props = {}) => { at(props); return render(C, { props }).container.querySelector(".app") as HTMLElement; };
const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const all = (a: ParentNode, sel: string) => [...a.querySelectorAll(sel)].map(text);
// The links under sel (jsdom's selector engine misreads [href='…=…&…'] values, so match hrefs in JS).
const links = (a: ParentNode, sel: string) => [...a.querySelectorAll(sel)].map((e) => e.getAttribute("href"));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

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

describe("every board renders: shell, exactly one h1, at most one primary, no inline style", () => {
  for (const [board, C, props] of BOARDS) {
    it(board, () => {
      const a = shot(C, props);
      expect(a.matches(".app")).toBe(true);
      expect(a.getAttribute("data-theme")).toBe((props.theme as string) ?? "light");
      expect(a.getAttribute("data-w")).toBe(props.phone ? "phone" : null);
      expect(a.querySelectorAll("h1").length).toBe(1);
      expect(a.querySelectorAll(".btn-primary").length).toBeLessThanOrEqual(1);
      expect(a.querySelector("[style]")).toBeNull();
      if (props.phone) { expect(a.querySelector(".phone-top")).not.toBeNull(); expect(a.querySelector("header.top")).toBeNull(); }
      else expect(a.querySelector("header.top")).not.toBeNull();
    });
  }
  it("an unknown ?state= renders the default state, never throws (every screen, desktop and phone)", () => {
    for (const C of [Collect, CloseCollection, QRRoom, PrintQR]) for (const phone of [false, true]) for (const state of ["busy", "9", "0", "", "menu-x"]) {
      expect(() => shot(C, { phone, state })).not.toThrow();
      cleanup();
    }
    expect(shot(Collect, { state: "busy" }).querySelector("details.dd[open]")).toBeNull();
    cleanup();
    expect(text(shot(QRRoom, { phone: true, state: "9" }).querySelector("h1"))).toBe("Community");
  });
});

describe("links: the shared href(), registered names, carried ?w= and ?theme=", () => {
  it("desktop: tabs, crumb, menu, aside, offline and survey-row links name the fanout's screens", () => {
    const a = shot(Collect, { theme: "dark" });
    expect([...a.querySelectorAll("nav.tabs .tab")].map((t) => t.getAttribute("href"))).toEqual(["setup5", "collect", "results", "next-step"].map((s) => `?ui_next=on&screen=${s}&theme=dark`));
    expect(a.querySelector("nav.crumb a")!.getAttribute("href")).toBe("?ui_next=on&screen=project&theme=dark");
    expect(a.querySelector("header.top a.brand")!.getAttribute("href")).toBe("?ui_next=on&screen=home&theme=dark");
    expect(a.querySelector("[aria-label='QR code for Community']")!.getAttribute("href")).toBe("?ui_next=on&screen=qr-room&theme=dark&state=3");
    expect(a.querySelector("[aria-label='Print Community survey']")!.getAttribute("href")).toBe("?ui_next=on&screen=print&theme=dark");
    expect(links(a, "#offline a")).toEqual(["print", "print-qr", "paper-entry"].map((s) => `?ui_next=on&screen=${s}&theme=dark`));
    expect(links(a, "main .menu a.mi")).toEqual(["setup1", "people", "close-collection", "collect"].map((s) => `?ui_next=on&screen=${s}&theme=dark`).map((h, i) => (i === 3 ? `${h}#offline` : h)));
  });
  it("phone: the avatar opens the actions lane's MenuPhone sheet (menu), ⋯ opens the sheet state, each row's QR opens that survey", () => {
    const a = shot(Collect, { phone: true });
    expect(a.querySelector(".phone-top [aria-label='Workspace and account']")!.getAttribute("href")).toBe("?ui_next=on&screen=menu&w=phone");
    expect(a.querySelector("[aria-label='More actions']")!.getAttribute("href")).toBe("?ui_next=on&screen=collect&w=phone&state=menu");
    expect(a.querySelector("[aria-label='QR for Community']")!.getAttribute("href")).toBe("?ui_next=on&screen=qr-room&w=phone&state=3");
    expect(a.querySelector(".phone-bar .btn")!.getAttribute("href")).toBe("?ui_next=on&screen=share&w=phone");
    cleanup();
    const q = shot(QRRoom, { phone: true });
    expect(q.querySelector(".phone-top [aria-label='Workspace and account']")!.getAttribute("href")).toBe("?ui_next=on&screen=menu&w=phone");
    expect(q.querySelector(".phone-bar .btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=qr-room&w=phone&state=4");
  });
  it("no lane-local link builder and no menu-phone name left", () => {
    for (const f of readdirSync(LANE)) {
      const src = readFileSync(resolve(LANE, f), "utf8");
      expect(src, f).not.toMatch(/menu-phone/);
      if (/href\(/.test(src) && f !== "model.js") expect(src, f).toMatch(/from "\.\.\/href\.js"/);
    }
  });
});

describe("Collect (Collect, CollectPhone, CollectMenu, CollectMenuPhone, CollectDark)", () => {
  it("desktop: crumb, title, stage pill, tabs with Now on Collect, 18 of 30, no room-health line (retired), five survey rows", () => {
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
    expect(text(a.querySelector(".num[data-size='40'] + .small"))).toBe("of 30 expected · updated just now");
    // Retired (cookbook PR 198; RULING-2026-10-16-scrap-app-ratelimit): no room-health counter, refusal tag or Wi-Fi advice.
    expect(a.querySelector("[role=status]")).toBeNull();
    expect(a.querySelector(".tag[data-kind=warn]")).toBeNull();
    expect(a.textContent).not.toMatch(/turned away|opened in the last minute|Wi-Fi|mobile data/);
    expect(all(a, ".glass .l-row > .h3")).toEqual(["Translation team", "Community", "Church"]);
    expect(all(a, "[data-tpl=survey-row] .h3")).toEqual(["Translators", "Team leaders & mentors", "Community", "Pastor involved in the work", "Denominational leader"]);
    expect(all(a, "[data-tpl=survey-row] .num")).toEqual(["4 of 5", "2 of 3", "8 of 15", "3 of 5", "1 of 2"]);
    expect(all(a, "[data-tpl=survey-row] .kbd")).toEqual(["3dreview.app/s/K7Q4F2", "3dreview.app/s/M3X9A1", "3dreview.app/s/P8L2W4", "3dreview.app/s/R5T7N2", "3dreview.app/s/D2C6H9"]);
    expect(all(a, ".l-row.l-row > .small.tab-n, .l-row > span.small.tab-n")).toEqual(["6 of 8 expected", "8 of 15 expected", "4 of 7 expected"]);
    expect([...a.querySelectorAll(".bar rect")].map((r) => r.getAttribute("width"))).toEqual(["80%", "66%", "53%", "60%", "50%"]);
  });
  it("the updated line has one source: the review's updated value feeds the head and the Responses line", () => {
    const d = structuredClone(fixture);
    d.review.updated = "2 min ago";
    const a = shot(Collect, { data: d });
    expect(text(a.querySelector("main p.small.t-15"))).toBe("Hindi New Testament · Hindi · Written · Updated 2 min ago");
    expect(text(a.querySelector(".num[data-size='40'] + .small"))).toBe("of 30 expected · updated 2 min ago");
  });
  it("desktop aside: survey window, the one offline home with three actions, the passage", () => {
    const a = shot(Collect);
    expect(all(a, "aside .h3")).toEqual(["Survey open", "Meeting offline?", "Before people answer"]);
    expect(a.textContent).toContain("28 Sep – 31 Oct · 33 days left");
    expect(a.textContent).toContain("Results open on 31 Oct, or earlier if you close collection from the ⋯ menu.");
    expect(all(a, "#offline .btn")).toEqual(["Print surveys", "Print QR pages", "Enter paper answers"]);
    expect(a.textContent).toContain("Read or play Mark 1–4 to everyone answering. The survey shows it too.");
  });
  it("the ⋯ menu: a 44x44 .btn-icon summary, closed by default, open in state menu; delete is refused with its reason, last after an hr", () => {
    const s = shot(Collect).querySelector("details.dd:not([open]) summary[aria-label='More actions']")!;
    expect(s.className).toBe("btn btn-icon");
    cleanup();
    const a = shot(Collect, { state: "menu" });
    const menu = a.querySelector("details.dd[open] .menu")!;
    expect(all(menu, ".mi")).toEqual(["Edit details and dates", "People with access", "Close collection now", "Meeting offline? Print and paper", "Delete this review"]);
    const del = menu.querySelector(".mi.danger")!;
    expect(del.tagName).toBe("BUTTON");
    expect(del.getAttribute("aria-disabled")).toBe("true");
    expect(text(menu.querySelector(".mi-why"))).toBe("Reviews with responses can't be deleted. This one has 18.");
  });
  it("phone: header root, compact stage words, hero card with 18 of 30 · 5 surveys, the one room, list rows, offline block, phone-bar primary", () => {
    const a = shot(Collect, { phone: true });
    expect(a.querySelector(".phone-top[data-state=root]")).not.toBeNull();
    expect(text(a.querySelector("h1.title-phone"))).toBe("Mark 1–4 draft");
    expect(all(a, "nav.tabs .tab")).toEqual(["Prepare", "Collect", "Understand", "Improve"]);
    expect(all(a.querySelector(".l-card[data-pad=hero] .l-row")!, ":scope > *")).toEqual(["18", "of 30 · 5 surveys"]);
    expect(a.querySelector("[role=status]")).toBeNull(); // room-health counter retired (cookbook PR 198)
    expect(a.textContent).not.toMatch(/turned away|opened in the last minute|Wi-Fi|mobile data/);
    expect(all(a, ".l-card .small.tab-n")).toEqual(["4/5", "2/3", "8/15", "3/5", "1/2"]);
    expect([...a.querySelectorAll(".l-card .l-row > .l-row")].map((r) => r.querySelectorAll(".btn-icon").length)).toEqual([2, 2, 2, 2, 2]);
    expect(all(a, "#offline .btn")).toEqual(["Print surveys", "Print QR pages", "Enter paper answers"]);
    expect([...a.querySelectorAll("#offline .btn")].every((b) => b.classList.contains("btn-block"))).toBe(true);
    expect(text(a.querySelector(".phone-bar .btn-primary"))).toBe("Share the survey");
    expect(a.querySelector("dialog")).toBeNull();
  });
  it("phone menu (CollectMenuPhone): the ⋯ sheet with handle, title row + Close, 52px rows, first row focused, delete refused", () => {
    const a = shot(Collect, { phone: true, state: "menu" });
    const d = a.querySelector("dialog.glass-hi.sheet[data-pad=menu]")!;
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.querySelector(".sheet-handle")!.getAttribute("aria-hidden")).toBe("true");
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`))).toBe("Mark 1–4 draft");
    expect(d.querySelector("[aria-label=Close]")!.getAttribute("href")).toBe("?ui_next=on&screen=collect&w=phone");
    expect(all(d, ".mi")).toEqual(["Edit details and dates", "People with access", "Open the passage", "Meeting offline? Print and paper", "Close collection now", "Delete this review"]);
    expect([...d.querySelectorAll(".mi")].every((r) => r.getAttribute("data-size") === "lg")).toBe(true);
    expect(document.activeElement?.textContent).toBe("Edit details and dates");
    expect(d.querySelector(".mi.danger")!.getAttribute("aria-disabled")).toBe("true");
  });
  it("N2: with 0 responses the refused delete names what blocks it (its surveys), never 'This one has 0.', on desktop and phone", () => {
    const quiet = structuredClone(fixture);
    for (const g of quiet.groups) for (const s of g.surveys) s.answered = 0;
    const desk = shot(Collect, { state: "menu", data: quiet });
    expect(text(desk.querySelector("details.dd[open] .mi-why"))).toBe("Reviews with surveys can't be deleted. This one has 5 surveys.");
    cleanup();
    const ph = shot(Collect, { phone: true, state: "menu", data: quiet });
    const why = ph.querySelector("dialog .mi-why")!;
    expect(text(why)).toBe("Reviews with surveys can't be deleted. This one has 5 surveys.");
    expect(ph.querySelector("dialog .mi.danger")!.getAttribute("aria-describedby")).toBe(why.id);
    for (const t of [text(desk), text(ph)]) expect(t).not.toMatch(/has 0\b/);
  });
});

describe("Dialog (R14 dismissal): title row + Close, Escape, a forced close and a click outside go to cancel", () => {
  const title = createRawSnippet(() => ({ render: () => `<h2 id="t">Title</h2>` }));
  const body = createRawSnippet(() => ({ render: () => `<p class="body">Body</p>` }));
  const open = () => {
    const navigate = vi.fn();
    const { container } = render(Dialog, { props: { labelledby: "t", cancel: "?ui_next=on&screen=collect", title, children: body, navigate } });
    return { d: container.querySelector("dialog")!, navigate };
  };
  it("the visible Close is a 44px .btn-icon link to cancel, at the end of the title row", () => {
    const { d } = open();
    const row = d.querySelector(".l-row[data-split]")!;
    expect(row.firstElementChild!.id).toBe("t");
    const x = row.lastElementChild!;
    expect(x.getAttribute("aria-label")).toBe("Close");
    expect(x.className).toBe("btn btn-quiet btn-icon");
    expect(x.getAttribute("href")).toBe("?ui_next=on&screen=collect");
  });
  it("Escape (cancel) leaves the open state instead of stripping the page; a forced close does too, once", () => {
    const { d, navigate } = open();
    const ev = new Event("cancel", { cancelable: true });
    d.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    d.dispatchEvent(new Event("close"));
    expect(navigate.mock.calls).toEqual([["?ui_next=on&screen=collect"]]);
  });
  it("a click outside the dialog's rect (the backdrop) cancels; a click on its content does not", () => {
    const { d, navigate } = open();
    fireEvent.click(d.querySelector(".body")!);
    expect(navigate).not.toHaveBeenCalled();
    d.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 300, width: 200, height: 200, x: 100, y: 100, toJSON: () => ({}) });
    d.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 150, clientY: 150 }));
    expect(navigate).not.toHaveBeenCalled();
    d.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 20, clientY: 400 }));
    expect(navigate).toHaveBeenCalledWith("?ui_next=on&screen=collect");
  });
  it("refuses a dialog without its cancel href or title", () => {
    expect(() => render(Dialog, { props: { labelledby: "t", title } })).toThrow(/cancel/);
    expect(() => render(Dialog, { props: { labelledby: "t", cancel: "?x" } })).toThrow(/title/);
  });
});

describe("CloseCollection (CloseCollection, CloseCollectionPhone)", () => {
  beforeEach(() => { useLevelMinimum(1); }); // DEV-like fixtures band at 1, set explicitly
  it("desktop: modal dialog with icon tile + title + Close, consequence, per-perspective counts, Keep collecting (focused) then the one primary", () => {
    const a = shot(CloseCollection);
    const d = a.querySelector("dialog.glass-hi:not(.sheet)")!;
    expect(d.hasAttribute("open")).toBe(true);
    expect(text(a.querySelector(`#${d.getAttribute("aria-labelledby")}`))).toBe("Close collection now?");
    expect(d.querySelector("[aria-label=Close]")!.getAttribute("href")).toBe("?ui_next=on&screen=collect");
    expect(text(d.querySelector("p.small"))).toBe("Links and codes stop working and the review moves to Understand. 18 responses are in. You can reopen collection later — results refresh when you do.");
    expect(text(d.querySelector(".solid"))).toBe("Translation team 6 · Community 8 · Church 4. Every perspective has an answer, so its level can show; the drops beside each level show how much evidence it rests on. Answer-by-answer splits are not shown.");
    expect(all(d, ".btn:not(.btn-icon)")).toEqual(["Keep collecting", "Yes, close and see results"]);
    expect(document.activeElement?.textContent).toBe("Keep collecting");
    expect(a.querySelectorAll(".btn-primary").length).toBe(1);
    expect(text(a.querySelector(".btn-primary"))).toBe("Yes, close and see results");
    expect(a.querySelector(".btn-primary")!.getAttribute("href")).toBe("?ui_next=on&screen=results");
    expect(text(a.querySelector("main .l-row > .l-row .btn:not(details .btn)"))).toBe("Share the survey");
  });
  it("the ready line follows the served level minimum: DEV 1 says it from one answer; production-like or absent (3) waits for 3; no 3-answer promise", () => {
    useLevelMinimum(3);
    const two = structuredClone(fixture);
    two.groups[2].surveys.forEach((x: { answered: number }, i: number) => { x.answered = i ? 0 : 2; });
    expect(text(shot(CloseCollection, { data: two }).querySelector("dialog .solid"))).toBe("Translation team 6 · Community 8 · Church 2.");
    expect(text(shot(CloseCollection).querySelector("dialog .solid"))).toBe("Translation team 6 · Community 8 · Church 4. Every perspective has at least 3 answers, so its level can show; the drops beside each level show how much evidence it rests on. Answer-by-answer splits are not shown.");
    useLevelMinimum(undefined); // absent: the safe 3
    expect(text(shot(CloseCollection, { data: two }).querySelector("dialog .solid"))).toBe("Translation team 6 · Community 8 · Church 2.");
    useLevelMinimum(1);
    const one = structuredClone(fixture);
    one.groups[2].surveys.forEach((x: { answered: number }, i: number) => { x.answered = i ? 0 : 1; });
    const a = shot(CloseCollection, { data: one });
    expect(text(a.querySelector("dialog .solid"))).toBe("Translation team 6 · Community 8 · Church 1. Every perspective has an answer, so its level can show; the drops beside each level show how much evidence it rests on. Answer-by-answer splits are not shown.");
    expect(text(a)).not.toMatch(/at least 3 answers|results can show|splits wait/);
    const empty = structuredClone(fixture);
    empty.groups[2].surveys.forEach((x: { answered: number }) => { x.answered = 0; });
    expect(text(shot(CloseCollection, { data: empty }).querySelector("dialog .solid"))).toBe("Translation team 6 · Community 8 · Church 0.");
  });
  it("no perspectives: the 3-answer line is never said vacuously, no stray count line, no throw (desktop and phone)", () => {
    const none = structuredClone(fixture);
    none.groups = [];
    for (const phone of [false, true]) {
      const a = shot(CloseCollection, { phone, data: none });
      expect(a.textContent).not.toContain("Every perspective");
      expect(a.querySelector("dialog .solid")).toBeNull();
      expect(a.querySelectorAll("h1")).toHaveLength(1);
      expect(a.innerHTML).not.toMatch(/NaN|undefined/);
      cleanup();
    }
  });
  it("counts of one read singular: 1 response is in; no room-health counter is drawn for any count (retired, cookbook PR 198)", () => {
    const one = structuredClone(fixture);
    one.groups = [one.groups[0]];
    one.groups[0].surveys = [{ ...one.groups[0].surveys[0], answered: 1 }];
    const a = shot(CloseCollection, { data: one });
    expect(text(a.querySelector("dialog p.small"))).toContain("1 response is in.");
    expect(a.textContent).not.toMatch(/\b1 (responses|surveys|opens)\b/);
    cleanup();
    const c = shot(Collect, { data: one });
    expect(c.textContent).not.toMatch(/opened in the last minute|turned away/);
    expect(all(c, ".tag[data-kind=warn]")).toEqual([]);
    expect(c.textContent).not.toMatch(/\b1 (responses|surveys|opens)\b/);
    cleanup();
    const p = shot(Collect, { phone: true, data: one });
    expect(p.textContent).toContain("of 5 · 1 survey ");
    expect(p.textContent).not.toMatch(/\b1 (responses|surveys|opens)\b/);
    cleanup();
    const q = shot(QRRoom, { data: one });
    expect(q.textContent).not.toMatch(/opened in the last minute|turned away/);
    expect(all(q, ".tag[data-kind=warn]")).toEqual([]);
    expect([plural(1, "page", "pages"), plural(0, "page", "pages"), plural(18, "response is", "responses are")]).toEqual(["1 page", "0 pages", "18 responses are"]);
  });
  it("phone: the sheet holds the primary; Close in its title row; the phone bar's Share goes secondary; Keep collecting takes focus", () => {
    const a = shot(CloseCollection, { phone: true });
    const d = a.querySelector("dialog.glass-hi.sheet")!;
    expect(text(d.querySelector("h2"))).toBe("Close collection now?");
    expect(d.querySelector("[aria-label=Close]")!.getAttribute("href")).toBe("?ui_next=on&screen=collect&w=phone");
    expect(text(d.querySelector("p.small"))).toBe("18 of 30 expected have answered. Links stop working; you can reopen later.");
    expect(all(d, ".btn:not(.btn-icon)")).toEqual(["Yes, close and see results", "Keep collecting"]);
    expect(document.activeElement?.textContent).toBe("Keep collecting");
    expect(a.querySelector(".phone-bar .btn-primary")).toBeNull();
    expect(text(a.querySelector(".phone-bar .btn"))).toBe("Share the survey");
  });
});

describe("QRRoom (QRRoom, QRRoomPhone)", () => {
  it("projector: room top bar (no menus, no help), heading, five tiles across, each survey's own code and link, no retired room instruction", () => {
    const a = shot(QRRoom);
    const top = a.querySelector("header.top[data-variant=room]")!;
    expect(top.querySelector("details, [aria-label=Help]")).toBeNull();
    expect(text(top.querySelector(".crumb [aria-current=page]"))).toBe("Mark 1–4 draft");
    expect(top.querySelector("[role=status]")).toBeNull(); // room-health counter retired (cookbook PR 198)
    expect(top.textContent).not.toMatch(/turned away|opened in the last minute|Wi-Fi/);
    expect(all(top, ".tag:not([data-kind])")).toEqual(["18 answered"]);
    expect(all(top, ".btn")).toEqual(["Meeting offline? Print and paper", "Exit room view"]);
    expect(text(a.querySelector("h1.display"))).toBe("Scan the code for your role");
    expect(a.querySelector("main .l-grid")!.getAttribute("data-cols")).toBe("5");
    const cards = [...a.querySelectorAll("main .glass-hi[data-lens]")];
    expect(cards.map((c) => c.getAttribute("data-lens"))).toEqual(["team", "team", "community", "church", "church"]);
    expect(cards.map((c) => text(c.querySelector(".h2")))).toEqual(["Translators", "Team leaders & mentors", "Everyone in the community", "Pastor involved in the work", "Denominational leader"]);
    expect(cards.map((c) => c.querySelector(".qr")!.getAttribute("data-size"))).toEqual(["room", "room", "room", "room", "room"]);
    const surveys = fixture.groups.flatMap((g) => g.surveys);
    expect(cards.map((c) => [...c.querySelectorAll(".qr i")].map((i) => (i.classList.contains("o") ? "0" : "1")).join(""))).toEqual(surveys.map((s) => s.qr));
    expect(a.querySelector(".btn-primary")).toBeNull();
    expect(a.textContent).not.toMatch(/Survey not opening|Wi-Fi|mobile data/); // retired instruction (cookbook PR 198)
  });
  it("phone: nested header, the survey name is the h1, survey 3 of 5 (Community) with its own code and link, the one room, Previous / Next", () => {
    const a = shot(QRRoom, { phone: true });
    expect(text(a.querySelector(".phone-top .phone-title"))).toBe("Show a QR code");
    expect(a.textContent).toContain("Survey 3 of 5");
    expect(text(a.querySelector("h1.h2"))).toBe("Community");
    expect(text(a.querySelector("main .l-card p.small"))).toBe("Scan to open the Hindi survey · Community3dreview.app/s/P8L2W4");
    const community = fixture.groups[1].surveys[0];
    expect([...a.querySelectorAll(".qr[data-size=phone] i")].map((i) => (i.classList.contains("o") ? "0" : "1")).join("")).toBe(community.qr);
    expect(a.querySelector("[role=status]")).toBeNull(); // room-health counter retired (cookbook PR 198)
    expect(a.textContent).not.toMatch(/turned away|opened in the last minute|Wi-Fi|mobile data/);
    expect(all(a, ".phone-bar .btn")).toEqual(["Previous", "Next survey"]);
    cleanup();
    const first = shot(QRRoom, { phone: true, state: "1" });
    expect(text(first.querySelector("h1"))).toBe("Translation team");
    expect(text(first.querySelector("main .l-card b"))).toBe("3dreview.app/s/K7Q4F2");
  });
  it("a data row without the qrRoomPhone default starts on the first survey, desktop and phone, never throws", () => {
    const bare: Record<string, unknown> = structuredClone(fixture);
    delete bare.qrRoomPhone;
    for (const phone of [false, true]) for (const state of [undefined, "4", "bogus"]) {
      let a: HTMLElement | undefined;
      expect(() => { a = shot(QRRoom, { phone, data: bare, state }); }).not.toThrow();
      expect(a!.querySelectorAll("h1")).toHaveLength(1);
      if (phone) expect(a!.textContent).toContain(state === "4" ? "Survey 4 of 5" : "Survey 1 of 5");
      else expect(a!.querySelectorAll("main .glass-hi[data-lens]")).toHaveLength(5);
      cleanup();
    }
  });
  it("the default survey is clamped to the surveys there are; no surveys draws an empty state with one h1 and no pager", () => {
    const two = structuredClone(fixture);
    two.groups = [two.groups[0]];
    const a = shot(QRRoom, { phone: true, data: two });
    expect(a.textContent).toContain("Survey 2 of 2");
    expect(text(a.querySelector("h1"))).toBe("Translation team"); // the board's phone h1 is the lens label; the survey name sits in the caption
    expect(links(a, ".phone-bar .btn")).toEqual(["?ui_next=on&screen=qr-room&w=phone&state=1", "?ui_next=on&screen=qr-room&w=phone&state=1"]);
    cleanup();
    const none = structuredClone(fixture);
    for (const g of none.groups) g.surveys = [];
    for (const phone of [true, false]) {
      const e = shot(QRRoom, { phone, data: none, state: "2" });
      expect(e.querySelectorAll("h1")).toHaveLength(1);
      expect(e.innerHTML).not.toMatch(/NaN|undefined/);
      if (phone) {
        expect(text(e.querySelector("h1"))).toBe("No surveys yet");
        expect(e.querySelector(".phone-bar")).toBeNull();
      } else expect(e.querySelectorAll("main .glass-hi[data-lens]")).toHaveLength(0);
      cleanup();
    }
  });
});

describe("PrintQR (PrintQR, PrintQRPhone): controlled choices (F5)", () => {
  const ticks = (root: ParentNode) => [...root.querySelectorAll("label.row-opt input.cb")].map((c) => (c as HTMLInputElement).checked);
  it("desktop: wide modal, title focused (tabindex -1) with Close, pointer to Print paper surveys, five rows (three ticked), layouts, fields, Print 3 pages, preview", () => {
    const a = shot(PrintQR);
    const d = a.querySelector("dialog.glass-hi[data-w=wide]")!;
    const h = a.querySelector(`#${d.getAttribute("aria-labelledby")}`)!;
    expect(text(h)).toBe("Print QR code pages");
    expect(h.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(h);
    expect(d.querySelector("[aria-label=Close]")!.getAttribute("href")).toBe("?ui_next=on&screen=collect");
    expect(links(d, "a.link")).toEqual(["?ui_next=on&screen=print"]);
    // The intro sits under the title in the title block (as the board draws it) and describes the dialog.
    expect(d.getAttribute("aria-describedby")).toBe("print-qr-about");
    expect(text(d.querySelector("#print-qr-about"))).toBe("Pages people can scan or take away. These are not the surveys — to print the questions themselves, use Print paper surveys.");
    expect(d.querySelector(":scope > .l-stack > .l-row")!.contains(d.querySelector("#print-qr-about"))).toBe(true);
    expect(all(d, "a.link")).toEqual(["Print paper surveys"]);
    expect(ticks(d)).toEqual([true, true, true, false, false]);
    expect(all(d, "label.row-opt.compact .kbd")).toEqual(["K7Q4F2", "M3X9A1", "P8L2W4", "R5T7N2", "D2C6H9"]);
    expect(all(d, "label.row-opt input.rd + span .h3")).toEqual(["One page per survey", "Hand-out cards", "All on one page"]);
    expect(all(d, "label.row-opt input.rd + span .small")).toEqual(["A full-page code to pin up or hold up. 3 pages.", "Six cards per page, cut along the lines, one survey per sheet. 3 pages.", "Every selected code on one sheet, for the table. 1 page."]);
    expect([...d.querySelectorAll("input.rd")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, false, false]);
    expect(all(d, "label.lbl")).toEqual(["Text on the page", "Paper size"]);
    expect(all(d, "#print-qr-lang option")).toEqual(["English", "Hindi", "Odia"]);
    expect(text(d.querySelector("#print-qr-lang-help"))).toMatch(/prints in English for now/);
    expect(text(a.querySelector(".btn-primary"))).toBe("Print 3 pages");
    expect(text(d.querySelector(".micro"))).toBe("Preview · one page per survey · A4 · 3 pages");
    const sheet = d.querySelector(".psheet[data-fit=a4] > .paper")!; // section 2 Paper preview row (CORRECTIONS 31): CSS scales the sheet, no SVG stand-in
    expect(d.querySelector("svg.psheet, foreignObject, [style]")).toBeNull();
    expect(d.querySelector(".psheet")!.getAttribute("aria-hidden")).toBe("true");
    expect(text(sheet.querySelector(".ptitle"))).toBe("Translators");
    expect([...sheet.querySelectorAll(".qr i")].map((i) => (i.classList.contains("o") ? "0" : "1")).join("")).toBe(fixture.groups[0].surveys[0].qr);
    expect(text(sheet)).toContain("Scan to answer · or enter code K7Q 4F2 at 3dreview.app · Hindi · English · Odia");
    expect(text(sheet.querySelector(".pfoot"))).toBe("1 of 3");
    expect(d.querySelector(".psheet")!.getAttribute("data-layout")).toBe("survey");
  });
  it("the preview takes the chosen paper size: A4 or Letter on the Paper preview row", async () => {
    const d = shot(PrintQR).querySelector("dialog")!;
    const sel = d.querySelector("#print-qr-paper") as HTMLSelectElement;
    sel.value = "Letter";
    await fireEvent.change(sel);
    expect(d.querySelector(".psheet")!.getAttribute("data-fit")).toBe("letter");
    expect(text(d.querySelector(".micro"))).toBe("Preview · one page per survey · Letter · 3 pages");
    sel.value = "A4";
    await fireEvent.change(sel);
    expect(d.querySelector(".psheet")!.getAttribute("data-fit")).toBe("a4");
  });
  it("the preview draws the first page of the chosen layout: hand-out cards (six of the first survey), all on one page (every ticked code)", async () => {
    const a = shot(PrintQR);
    const d = a.querySelector("dialog")!;
    const codes = (root: ParentNode) => [...root.querySelectorAll(".qr")].map((q) => [...q.querySelectorAll("i")].map((i) => (i.classList.contains("o") ? "0" : "1")).join(""));
    const surveys = fixture.groups.flatMap((g) => g.surveys);
    await fireEvent.click(d.querySelectorAll("input.rd")[1]);
    let sheet = d.querySelector(".psheet")!;
    expect(sheet.getAttribute("data-layout")).toBe("sheet");
    expect(all(sheet, ".ptitle")).toEqual(Array(6).fill("Translators"));
    expect(codes(sheet)).toEqual(Array(6).fill(surveys[0].qr));
    expect([...sheet.querySelectorAll(".qr")].every((q) => q.getAttribute("data-size") === "room")).toBe(true);
    expect(text(sheet.querySelector(".pfoot"))).toBe("1 of 3");
    await fireEvent.click(d.querySelectorAll("input.rd")[2]);
    sheet = d.querySelector(".psheet")!;
    expect(sheet.getAttribute("data-layout")).toBe("one");
    expect(all(sheet, ".ptitle")).toEqual(["Translators", "Team leaders & mentors", "Community"]);
    expect(all(sheet, ".kbd")).toEqual(["3dreview.app/s/K7Q4F2", "3dreview.app/s/M3X9A1", "3dreview.app/s/P8L2W4"]);
    expect(codes(sheet)).toEqual(surveys.slice(0, 3).map((s) => s.qr));
    expect(text(sheet.querySelector(".pfoot"))).toBe("1 of 1");
  });
  it("ticks are keyed by survey code, not position; unknown codes are dropped; the choices start from the data, no warnings", () => {
    const moved = structuredClone(fixture);
    moved.printQr.checked = ["D2C6H9", "M3X9A1", "ZZZZZZ"];
    const a = shot(PrintQR, { data: moved });
    expect(ticks(a.querySelector("dialog")!)).toEqual([false, true, false, false, true]);
    expect(text(a.querySelector(".btn-primary"))).toBe("Print 2 pages");
    expect(text(a.querySelector(".ptitle"))).toBe("Team leaders & mentors");
    expect(pickedSurveys(collectModel(fixture).surveys, ["P8L2W4", "K7Q4F2"]).map((x: { code: string }) => x.code)).toEqual(["K7Q4F2", "P8L2W4"]);
    const src = readFileSync(resolve(LANE, "PrintQR.svelte"), "utf8");
    expect(src).not.toMatch(/\$state\([^)]*data\b/);
    expect(src).not.toMatch(/checked\.includes\(i\)/);
  });
  it("the count, the layouts' pages, the caption, the previewed survey and '1 of N' follow what the user ticks and picks", async () => {
    const a = shot(PrintQR);
    const d = a.querySelector("dialog")!;
    const cb = [...d.querySelectorAll("input.cb")] as HTMLInputElement[];
    await fireEvent.click(cb[0]);
    expect(text(a.querySelector(".btn-primary"))).toBe("Print 2 pages");
    expect(text(d.querySelector(".ptitle"))).toBe("Team leaders & mentors");
    expect(text(d.querySelector(".pfoot"))).toBe("1 of 2");
    await fireEvent.click(cb[4]);
    expect(text(d.querySelector(".micro"))).toBe("Preview · one page per survey · A4 · 3 pages");
    await fireEvent.click(d.querySelectorAll("input.rd")[2]);
    expect(text(a.querySelector(".btn-primary"))).toBe("Print 1 page");
    expect(text(d.querySelector(".micro"))).toBe("Preview · all on one page · A4 · 1 page");
    const paper = d.querySelector("#print-qr-paper") as HTMLSelectElement;
    paper.value = "Letter";
    await fireEvent.change(paper);
    expect(text(d.querySelector(".micro"))).toBe("Preview · all on one page · Letter · 1 page");
    const lang = d.querySelector("#print-qr-lang") as HTMLSelectElement;
    lang.value = "Odia";
    await fireEvent.change(lang);
    expect(lang.value).toBe("Odia");
  });
  it("nothing ticked: no throw, Print is a disabled button that says why, no preview sheet", async () => {
    const a = shot(PrintQR);
    const d = a.querySelector("dialog")!;
    for (const c of [...d.querySelectorAll("input.cb")] as HTMLInputElement[]) if (c.checked) await fireEvent.click(c);
    flushSync();
    const p = a.querySelector(".btn-primary") as HTMLButtonElement;
    expect(p.tagName).toBe("BUTTON");
    expect(p.disabled).toBe(true);
    expect(text(d.querySelector("[role=status]"))).toBe("Tick at least one survey to print its page.");
    // Saying why adds no line: the status sits in the action row beside Cancel and the disabled Print (R3-1, the 1280x800 fit).
    const row = d.querySelector("[role=status]")!.parentElement!;
    expect(row.matches(".l-row[data-justify=end]")).toBe(true);
    expect(row.contains(p)).toBe(true);
    expect(d.querySelectorAll("[role=status]")).toHaveLength(1);
    expect(d.querySelector(".psheet")).toBeNull();
    expect(text(d.querySelector(".micro"))).toBe("Preview · one page per survey · A4 · 0 pages");
    // N3: the preview column says what fills it instead of standing blank; the disabled Print names its reason (R16 V-41).
    expect(text(d.querySelector("#print-qr-empty"))).toBe("Tick a survey to preview its page here.");
    expect(d.querySelector("#print-qr-empty")!.parentElement!.contains(d.querySelector(".micro"))).toBe(true);
    expect(p.getAttribute("aria-describedby")).toBe("print-qr-why");
    expect(d.querySelector("#print-qr-why")).toBe(d.querySelector("[role=status]"));
    await fireEvent.click(d.querySelectorAll("input.cb")[0]);
    expect(d.querySelector("#print-qr-empty")).toBeNull();
    expect(d.querySelector(".psheet")).not.toBeNull();
    const none = structuredClone(fixture);
    none.printQr.checked = [];
    cleanup();
    expect(() => shot(PrintQR, { data: none })).not.toThrow();
    cleanup();
    expect(() => shot(PrintQR, { data: none, phone: true })).not.toThrow();
  });
  it("the status line lives in the action row from the start (a polite live region), empty while something is ticked", () => {
    const d = shot(PrintQR).querySelector("dialog")!;
    const st = d.querySelectorAll("[role=status]");
    expect(st).toHaveLength(1);
    expect(text(st[0])).toBe("");
    expect(st[0].parentElement!.matches(".l-row[data-justify=end]")).toBe(true);
  });
  it("the layout is keyed by title and resets with new data; data with fewer layouts never leaves it pointing at nothing", async () => {
    const r = (at(), render(PrintQR, { props: {} }));
    const d = () => r.container.querySelector("dialog")!;
    await fireEvent.click(d().querySelectorAll("input.rd")[2]);
    expect(text(d().querySelector(".micro"))).toBe("Preview · all on one page · A4 · 1 page");
    const fewer = structuredClone(fixture);
    fewer.printQr.layouts = [fewer.printQr.layouts[0]];
    await r.rerender({ data: fewer });
    flushSync();
    expect([...d().querySelectorAll("input.rd")].map((c) => (c as HTMLInputElement).checked)).toEqual([true]);
    expect(text(d().querySelector(".micro"))).toBe("Preview · one page per survey · A4 · 3 pages");
    expect(d().querySelector(".psheet")!.getAttribute("data-layout")).toBe("survey");
    await r.rerender({ data: structuredClone(fixture) });
    flushSync();
    expect([...d().querySelectorAll("input.rd")].map((c) => (c as HTMLInputElement).checked)).toEqual([true, false, false]);
    const L = fixture.printQr.layouts;
    expect([pickLayout(L, "Hand-out cards").per, pickLayout(L, "Poster").per, pickLayout(L, undefined).per]).toEqual(["sheet", "survey", "survey"]);
    expect(() => pickLayout([], undefined)).toThrow(/no layouts/);
  });
  it("phone: nested header, the QR code pages list with three ticked, Cancel + Print 3 pages in the bar, following the ticks", async () => {
    const a = shot(PrintQR, { phone: true });
    expect(text(a.querySelector(".phone-top .phone-title"))).toBe("Print QR code pages");
    expect(text(a.querySelector("main .micro"))).toBe("QR code pages");
    expect(a.textContent).toContain("One A4 page per survey, with the link printed under the code.");
    expect(ticks(a)).toEqual([true, true, true, false, false]);
    expect(all(a, ".phone-bar .btn")).toEqual(["Cancel", "Print 3 pages"]);
    expect(a.querySelector("dialog")).toBeNull();
    const cb = [...a.querySelectorAll("input.cb")] as HTMLInputElement[];
    await fireEvent.click(cb[3]);
    expect(all(a, ".phone-bar .btn")).toEqual(["Cancel", "Print 4 pages"]);
    for (const i of [0, 1, 2, 3]) await fireEvent.click(cb[i]);
    expect((a.querySelector(".phone-bar .btn-primary") as HTMLButtonElement).disabled).toBe(true);
    expect(text(a.querySelector("main [role=status]"))).toBe("Tick at least one survey to print its page.");
  });
  it("N1: the phone status is one live region mounted from the start (empty), and only its text changes as the ticks do", async () => {
    const a = shot(PrintQR, { phone: true });
    const st = a.querySelectorAll("main [role=status]");
    expect(st).toHaveLength(1);
    expect(text(st[0])).toBe("");
    const cb = [...a.querySelectorAll("input.cb")] as HTMLInputElement[];
    for (const c of cb) if (c.checked) await fireEvent.click(c);
    expect(a.querySelector("main [role=status]")).toBe(st[0]);
    expect(text(st[0])).toBe("Tick at least one survey to print its page.");
    expect(a.querySelector(".phone-bar .btn-primary")!.getAttribute("aria-describedby")).toBe(st[0].id);
    await fireEvent.click(cb[0]);
    expect(a.querySelector("main [role=status]")).toBe(st[0]);
    expect(text(st[0])).toBe("");
  });
});

describe("collect view model and data wiring", () => {
  const m = collectModel(fixture);
  it("deleteRefusal names only what blocks the delete (N2): responses, else surveys, never a zero count", () => {
    expect(deleteRefusal(m)).toBe("Reviews with responses can't be deleted. This one has 18.");
    expect(deleteRefusal({ answered: 0, surveys: [{}] })).toBe("Reviews with surveys can't be deleted. This one has 1 survey.");
    expect(deleteRefusal({ answered: 0, surveys: [] })).toBe("Deleting a review isn't available on this screen yet.");
  });
  it("totals and per-perspective counts come from the survey rows; surveys are numbered", () => {
    expect([m.answered, m.expected, m.surveys.length]).toEqual([18, 30, 5]);
    expect(m.groups.map((g: { label: string; answered: number; expected: number }) => [g.label, g.answered, g.expected])).toEqual([["Translation team", 6, 8], ["Community", 8, 15], ["Church", 4, 7]]);
    expect(m.byLens).toBe("Translation team 6 · Community 8 · Church 4");
    expect(m.surveys.map((s: { n: number }) => s.n)).toEqual([1, 2, 3, 4, 5]);
    expect([pct(2, 3), pct(8, 15), pct(1, 0)]).toEqual([66, 53, 0]);
  });
  it("one source per value: one link and code per survey; no room telemetry in the fixture (retired, cookbook PR 198)", () => {
    expect(fixture).not.toHaveProperty("room");
    expect(Object.keys(fixture.qrRoomPhone)).toEqual(["survey"]);
    expect(fixture.printQr).not.toHaveProperty("qr");
    // Ticks name surveys by code; the provenance lives in model.js, so the /next/ bundle carries none of it.
    const codes = fixture.groups.flatMap((g) => g.surveys.map((x) => x.code));
    expect(fixture.printQr.checked.every((c) => codes.includes(c))).toBe(true);
    expect(fixture).not.toHaveProperty("_source");
    expect(readFileSync(resolve(LANE, "model.js"), "utf8")).toMatch(/design\/2026-10-15-glass-redesign\/canvas/);
  });
  it("stage tabs read the current UI's STAGES (ui/stage-screens.js) and take the caller's links", () => {
    const t = stageTabs("collect", { prepare: "a", collect: "b", understand: "c", improve: "d" });
    expect(t.map((x: { label: string }) => x.label)).toEqual(STAGES.map((s: { label: string }) => s.label));
    expect(t.map((x: { done: boolean; current: boolean; href: string }) => [x.done, x.current, x.href])).toEqual([[true, false, "a"], [false, true, "b"], [false, false, "c"], [false, false, "d"]]);
    expect(() => stageTabs("share")).toThrow(/unknown stage/);
  });
  it("state pickers fall back to the default; pages follow the layout", () => {
    expect([pickState("menu", ["default", "menu"]), pickState("busy", ["default", "menu"]), pickState(undefined, ["default", "menu"])]).toEqual(["menu", "default", "default"]);
    expect([pickSurvey("1", 5, 2), pickSurvey("5", 5, 2), pickSurvey("6", 5, 2), pickSurvey("0", 5, 2), pickSurvey("2.5", 5, 2), pickSurvey("", 5, 2), pickSurvey(undefined, 5, 2)]).toEqual([0, 4, 2, 2, 2, 2, 2]);
    expect([pickSurvey(undefined, 2, 2), pickSurvey("9", 1, 4), pickSurvey(undefined, 3, -1), pickSurvey(undefined, 3, Number.NaN), pickSurvey("1", 0, 2), pickSurvey(undefined, 0, 0)]).toEqual([1, 0, 0, 0, -1, -1]);
    expect([printPages("survey", 3), printPages("sheet", 3), printPages("one", 3), printPages("one", 0), printPages("survey", 0)]).toEqual([3, 3, 1, 0, 0]);
    expect(() => printPages("poster", 1)).toThrow(/unknown layout/);
    expect([pagesLabel(1), pagesLabel(0), pagesLabel(3)]).toEqual(["1 page", "0 pages", "3 pages"]);
  });
  it("the bar's perspectives are the shared LENSES (LensDot.svelte), not a second list", () => {
    for (const lens of Object.keys(LENSES)) { expect(() => render(Bar, { props: { value: 1, max: 2, lens } })).not.toThrow(); cleanup(); }
    expect(() => render(Bar, { props: { value: 1, max: 2, lens: "elders" } })).toThrow(/team, community, church/);
    expect(readFileSync(resolve(LANE, "Bar.svelte"), "utf8")).not.toMatch(/\["team", "community", "church"\]/);
  });
  it("the lane draws cells it is given and never encodes: the one encoder call is app/data.js qrModules (wiring debt 7 closed; §8.7)", () => {
    for (const f of readdirSync(LANE)) expect(readFileSync(resolve(LANE, f), "utf8"), f).not.toMatch(/import .*vendor-qrcode/);
    expect(readFileSync(resolve(LANE, "../../app/data.js"), "utf8")).toMatch(/import qrcode from .*vendor-qrcode\.js/);
  });
  it("20px glyphs use the shared Icon; the lane Glyph draws only the sizes it cannot (13, 16, 18, 26)", () => {
    for (const f of readdirSync(LANE).filter((x) => x.endsWith(".svelte"))) expect(readFileSync(resolve(LANE, f), "utf8"), f).not.toMatch(/<Glyph[^>]*size=\{20\}/);
  });
  it("the lane passes the ui-next lint (no inline style, tokens only)", () => {
    expect([...lintDir(LANE)]).toEqual([]);
    expect([...lintDir(resolve(__dirname, "../ui-next/fixtures/collect"))]).toEqual([]);
  });
});

describe("live QA N5: a review with no closing date shows no blank date parts", () => {
  it("says what is true with and without a closing date (desktop aside and phone card)", () => {
    const t = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const withDate = shot(Collect);
    expect(t(withDate)).toContain("28 Sep – 31 Oct · 33 days left");
    expect(t(withDate)).toContain("Results open on 31 Oct, or earlier if you close collection from the ⋯ menu.");
    const none = structuredClone(fixture); none.review.closes = ""; (none.review as { daysLeft: number | null }).daysLeft = null;
    const d = shot(Collect, { data: none });
    expect(t(d)).toContain("Open since 28 Sep · no closing date set");
    expect(t(d)).toContain("Results open when you close collection from the ⋯ menu.");
    expect(t(d)).not.toMatch(/ – ·|days left|open on ,|Open until ·/);
    const p = shot(Collect, { data: none, phone: true });
    expect(t(p)).toContain("No closing date set");
    expect(t(p)).not.toMatch(/Open until ·|Open until $/);
    const one = structuredClone(fixture); (one.review as { daysLeft: number }).daysLeft = 1;
    expect(t(shot(Collect, { data: one }))).toContain("· 1 day left");
  });
});
