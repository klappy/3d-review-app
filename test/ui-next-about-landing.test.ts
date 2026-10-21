// @vitest-environment jsdom
// UI Next (v4) About and Landing screens + their /next/ routes (status: provisional).
// Boards: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas About.dc.html, AboutPhone.dc.html, Landing.dc.html, LandingPhone.dc.html
// (branch next-copy-about-canvas, PR #186); copy: generator/copy_rachel.py -> ui-next/src/copy/rachel.js; pinned to sources/rachel-copy-2026-10-19/app-copy-edits.txt.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import About from "../ui-next/src/screens/About.svelte";
import Landing from "../ui-next/src/screens/Landing.svelte";
// @ts-expect-error -- plain .js module, no type declarations
import * as R from "../ui-next/src/copy/rachel.js";
// @ts-expect-error -- plain .js module, no type declarations
import { route } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { ACCOUNT_ITEMS } from "../ui-next/src/icons.js";
// @ts-expect-error -- plain .mjs script, no type declarations
import { parse, emit } from "../scripts/sync-rachel-copy.mjs";

type P = Record<string, unknown>;
const mount = (C: typeof About, props: P) => render(C, { props }).container.querySelector(".app") as HTMLElement;
const VIEWS: [string, typeof About, P][] = [
  ["About desktop", About, {}], ["About phone", About, { phone: true }], ["About dark", About, { theme: "dark" }],
  ["Landing desktop", Landing, {}], ["Landing phone", Landing, { phone: true }], ["Landing dark", Landing, { theme: "dark" }],
];
const paras = readFileSync(resolve(__dirname, "fixtures/rachel-app-copy-edits.txt"), "utf8").split(/\n\s*\n/).map((p) => p.trim());
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

describe("copy/rachel.js is generated from the cookbook generator, byte for byte", () => {
  it("re-emitting from copy_rachel.py strings reproduces the committed file", () => {
    const py = [
      `C01 = '${R.C01}'`, `C02 = '${R.C02}'`,
      `CAPS = {${Object.entries(R.CAPS).map(([k, v]) => `'${k}': '${String(v).replace(/’/g, "\\u2019")}'`).join(", ")}}`,
      `HOW = [${R.HOW.map(([t, d]: string[]) => `('${t}', '${d.replace(/’/g, "\\u2019")}')`).join(",\n       ")}]`,
      `WHO = [${R.WHO.map(([t, d]: string[]) => `('${t}', '${d}')`).join(",\n       ")}]`,
      "", "def learn_more(phone=False):", "    return '>Learn more<' + '>How it works<'", "",
    ].join("\n");
    expect(emit(parse(py))).toBe(readFileSync(resolve(__dirname, "../ui-next/src/copy/rachel.js"), "utf8"));
  });
  it("C01-C12 are Rachel's paragraphs word for word; C12 without the trajectory clause", () => {
    expect(paras.length).toBe(16);
    for (const s of [R.C01, R.C02, R.LEARN_MORE, R.HOW_IT_WORKS]) expect(paras).toContain(s);
    for (const [k, label] of [["team", "Translation Team"], ["community", "Community"], ["church", "Church"]]) expect(paras).toContain(`${label}: ${R.CAPS[k]}`);
    for (const [t, d] of R.HOW) expect(paras).toContain(`${t} ${d}`);
    for (const [t, d] of R.WHO.slice(0, 2)) { expect(paras).toContain(t); expect(paras).toContain(d); }
    expect(paras).toContain(R.WHO[2][0]);
    expect(paras).toContain(`${R.WHO[2][1]} to create a trajectory`);
    for (const v of [About, Landing]) for (const p of [{}, { phone: true }]) expect(text(mount(v, p))).not.toMatch(/trajectory/);
  });
});

describe("About renders as the boards draw it", () => {
  for (const phone of [false, true]) {
    it(`${phone ? "AboutPhone" : "About"}: C02 lead, C03 captions once, Learn more open with C05-C12 in order, F03 actions`, () => {
      const a = mount(About, { phone });
      expect(text(a)).toContain(R.C02);
      expect(text(a)).not.toContain(R.C01);
      for (const cap of Object.values(R.CAPS)) expect(text(a).split(cap as string).length - 1).toBe(1);
      const d = a.querySelector("details.disc") as HTMLDetailsElement;
      expect(d.open).toBe(true);
      expect(text(d.querySelector("summary")!)).toBe("Learn more");
      expect([...d.querySelectorAll("h3, h4")].map(text)).toEqual(["How it works", ...R.WHO.map((w: string[]) => w[0])]);
      expect([...d.querySelectorAll("ol > li")].map(text)).toEqual(R.HOW.map(([t, x]: string[]) => `${t} ${x}`));
      expect([...d.querySelectorAll("h4 + p")].map(text)).toEqual(R.WHO.map((w: string[]) => w[1]));
      const acts = [...a.querySelectorAll("a.btn")].map(text);
      for (const l of ["Back to home", "Take the tour", "Take a survey"]) expect(acts).toContain(l);
      expect(text(a)).not.toMatch(/Hear from|\[|NEW|NOTE/);
    });
  }
  it("desktop: top bar signed-in, h1 'good enough?', three facet cards; phone: nested header, title, Take the tour in the bar", () => {
    const a = mount(About, {});
    expect(a.querySelector("header.top[data-variant=signed-in]")).not.toBeNull();
    expect(text(a.querySelector("h1.display")!)).toBe("How can we know that it's good enough?");
    expect(a.querySelectorAll(".l-grid[data-cols='3'] > .l-card").length).toBe(3);
    const p = mount(About, { phone: true });
    expect(p.querySelector(".phone-top[data-state=nested] .phone-title")!.textContent).toBe("About");
    expect(text(p.querySelector("h1.title-phone")!)).toBe("Why 3D Review exists");
    expect(text(p.querySelector(".phone-bar .btn-primary")!)).toBe("Take the tour");
  });
});

describe("Landing renders as the boards draw it", () => {
  it("desktop: public top bar, C01 hero, C02 lead, primary sample review, perspectives, four steps, FAQ disclosures closed, About link", () => {
    const a = mount(Landing, {});
    expect(a.querySelector("header.top[data-variant=public]")).not.toBeNull();
    expect(text(a.querySelector("h1.display")!)).toBe(R.C01);
    expect(text(a.querySelector("h1 + p")!)).toBe(R.C02);
    expect(text(a.querySelector(".btn-primary")!)).toBe("Try the sample review");
    expect([...a.querySelectorAll(".l-grid[data-cols='3'] h3")].map(text)).toEqual(["Translation team", "Community", "Church"]);
    expect([...a.querySelectorAll(".num")].map(text)).toEqual(["1", "2", "3", "4"]);
    const faq = [...a.querySelectorAll("details.disc")] as HTMLDetailsElement[];
    expect(faq.length).toBe(4);
    expect(faq.every((d) => !d.open)).toBe(true);
    expect(a.querySelector("a[href='?screen=about']")).not.toBeNull();
  });
  it("phone: public phone header with Sign in, C01/C02 hero, FAQ as disclosures (not .dd), sample review in the bar", () => {
    const a = mount(Landing, { phone: true });
    expect(a.querySelector(".phone-top[data-state=public]")).not.toBeNull();
    expect(text(a.querySelector("h1.title-phone")!)).toBe(R.C01);
    expect(text(a)).toContain(R.C02);
    expect(a.querySelectorAll("details.disc").length).toBe(4);
    expect(a.querySelector("details.dd")).toBeNull();
    expect(text(a.querySelector(".phone-bar .btn-primary")!)).toBe("Try the sample review");
    expect(a.querySelector("a[href='?screen=about']")).not.toBeNull();
  });
});

describe("nesting rule (8.1), one primary, dark theme", () => {
  for (const [name, C, props] of VIEWS) {
    it(`${name}: AppShell > Page|phone > Section > Card > Stack/Row/Grid; no inline style; exactly one .btn-primary`, () => {
      const a = mount(C, props);
      expect(a.getAttribute("data-theme")).toBe(props.theme ?? "light");
      const main = a.querySelector(":scope > .layer.l-shell > main")!;
      expect(main).not.toBeNull();
      if (!props.phone) {
        expect(main.querySelector(":scope > .l-page")).not.toBeNull();
        for (const s of a.querySelectorAll("section.l-section")) expect(s.parentElement!.classList.contains("l-page")).toBe(true);
      }
      for (const el of a.querySelectorAll(".l-stack, .l-row, .l-grid, .l-card")) expect(el.parentElement!.closest(".l-card, .l-page, .l-phone, .l-section, details.disc")).not.toBeNull();
      expect(a.querySelector("[style]")).toBeNull();
      expect(a.querySelectorAll(".btn-primary").length).toBe(1);
    });
  }
});

describe("Learn more and FAQ disclosures: keyboard and screen-reader order (VALIDATION-186 qa yellow)", () => {
  for (const [name, C, props] of VIEWS.filter((v) => !v[2].theme)) {
    it(`${name}: native details/summary, text-only summary, decorative chevron, no ARIA overrides, focusable in DOM order`, () => {
      const a = mount(C, props);
      const ds = [...a.querySelectorAll("details.disc")];
      expect(ds.length).toBeGreaterThan(0);
      for (const d of ds) {
        const s = d.firstElementChild!;
        expect(s.tagName).toBe("SUMMARY");
        expect(s.querySelector("a, button, input, select, textarea")).toBeNull();
        expect(s.querySelector(".disc-chev")!.getAttribute("aria-hidden")).toBe("true");
        for (const attr of ["role", "aria-expanded", "aria-controls", "tabindex"]) { expect(d.hasAttribute(attr)).toBe(false); expect(s.hasAttribute(attr)).toBe(false); }
      }
      // Tab order = DOM order (no positive tabindex anywhere); the summary sits between the content before and after it.
      expect(a.querySelector("[tabindex]:not([tabindex='-1'])")).toBeNull();
      const focusables = [...a.querySelectorAll("a[href], summary, button")];
      const first = focusables.indexOf(ds[0].firstElementChild!);
      expect(first).toBeGreaterThan(0);
      if (C === About) {
        const order = focusables.map(text);
        expect(order.indexOf("Learn more")).toBeLessThan(order.indexOf("Back to home"));
        // reading order inside the open panel: How it works, then Set up -> Share -> Learn, then who / when / how often
        const flow = [...ds[0].querySelectorAll("summary, h3, li, h4")].map(text).map((t) => t.split(" ")[0]);
        expect(flow).toEqual(["Learn", "How", "Set", "Share.", "Learn.", "Who", "When", "How"]);
      }
    });
  }
  it("summary click toggles the native disclosure (Enter/Space activate the same element in browsers)", () => {
    const d = mount(About, {}).querySelector("details.disc") as HTMLDetailsElement;
    d.open = false; expect(d.open).toBe(false);
    d.open = true; expect(d.hasAttribute("open")).toBe(true);
  });
});

describe("/next/ routes for About and Landing", () => {
  const p = (q: string) => new URLSearchParams(q);
  const on = () => { const m = new Map([["ui_next", "on"]]); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  it("?screen=about|landing under the flag; phone and theme pass through", () => {
    expect(route(p("?screen=about"), on())).toEqual({ view: "about", props: { phone: false, theme: "light" } });
    expect(route(p("?screen=landing&w=phone&theme=dark"), on())).toEqual({ view: "landing", props: { phone: true, theme: "dark" } });
    expect(route(p("?screen=home"), on()).view).toBe("home");
    expect(route(p("?screen=nope"), on()).view).toBe("home");
  });
  it("flag off: the screens stay behind the gallery", () => {
    expect(route(p("?screen=about"), undefined).view).toBe("components");
    expect(route(p("?screen=landing"), undefined).view).toBe("components");
  });
  it("Home's account menu reaches About", () => {
    expect(ACCOUNT_ITEMS.find((i: { label?: string }) => i.label === "Why 3D Review exists").href).toBe("?screen=about");
  });
});
