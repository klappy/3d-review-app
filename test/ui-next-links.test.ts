// UI Next (v4) cross-screen links point at screens that exist (status: provisional). Screens fanout
// (3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/): seven lanes link to each other's screens by name;
// a name nobody registered silently falls back to Home (route.js). This reads every ui-next/src/screens/**/*.svelte and *.js
// source (the helper screens/href.js excepted: its comments are examples) and fails on any literal ?screen=<name>, href("<name>")
// call to screens/href.js, or cross-lane OUT table entry [ "<name>", "<lane>" ] (screens/<lane>/links.js: setup, results) that is
// neither registered in screens/registry.js nor a built-in ?screen= view, so a lane link to an unmerged or renamed screen fails
// here (cookbook work/active/2026-10-21-ui-next-screens-fanout/VALIDATION-setup-r3.md N1: links.js was outside this scan).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
// @ts-expect-error -- plain .js module, no type declarations
import { SCREENS } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";
import { ROUTES } from "../ui-next/src/app/router.js";

const ROOT = resolve(__dirname, "..");
const DIR = join(ROOT, "ui-next/src/screens");
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

// A literal name: lowercase kebab chars not followed by more name chars or a ${...} interpolation (template-built links are skipped).
const LIT = "([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?![a-z0-9-]|\\$\\{)";
const SCREEN_PARAM = new RegExp(`[?&;]screen=${LIT}`, "g");
const HREF_CALL = new RegExp(`\\bhref\\(\\s*(["'\`])${LIT}\\1`, "g");
// A cross-lane OUT table (links.js): export const OUT = Object.freeze({ key: ["<name>", "<lane>"], ... }).
const OUT_TABLE = /\bOUT\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/g;
const OUT_ENTRY = new RegExp(`\\[\\s*(["'\`])${LIT}\\1\\s*,\\s*(["'\`])[a-z]+\\3\\s*\\]`, "g");

function screenLinks(src: string): string[] {
  const names = [...src.matchAll(SCREEN_PARAM)].map((m) => m[1]);
  if (/screens\/href\.js|\.\/href\.js|\.\.\/href\.js/.test(src)) {
    names.push(...[...src.matchAll(HREF_CALL)].map((m) => m[2]));
    for (const t of src.matchAll(OUT_TABLE)) names.push(...[...t[1].matchAll(OUT_ENTRY)].map((m) => m[2]));
  }
  return names;
}
const SCANNED = (f: string) => /\.(svelte|js)$/.test(f) && relative(DIR, f) !== "href.js";

describe("cross-screen links name a registered screen", () => {
  it("the scanner reads literal links and skips built ones", () => {
    expect(screenLinks(`<a href="?ui_next=on&screen=collect-menu&w=phone">`)).toEqual(["collect-menu"]);
    expect(screenLinks(`const A = "?screen=results&w=phone", B = '?ui_next=on&amp;screen=qr-room';`)).toEqual(["results", "qr-room"]);
    expect(screenLinks("const s = (n) => `?screen=setup${n}`; const t = `?screen=${name}`;")).toEqual([]);
    expect(screenLinks(`import { href } from "../href.js"; const a = href("action-plan", { state: "x" }); const b = href(name);`)).toEqual(["action-plan"]);
    expect(screenLinks(`const a = href("not-ours");`)).toEqual([]); // no href.js import: some other href()
    expect(screenLinks(`?page=home&state=first`)).toEqual([]);
  });
  it("reads .js lane modules too: literal links, href() calls and OUT tables (setup and results keep cross-lane names in links.js)", () => {
    const links = `import { href } from "../href.js";\nexport const OUT = Object.freeze({\n  collect: ["collect", "collect"], // a comment\n  nextStep: ['next-step', 'actions'],\n});\nconst SELF = href("setup1");`;
    expect(screenLinks(links)).toEqual(["setup1", "collect", "next-step"]);
    expect(screenLinks(`export const OUT = Object.freeze({ a: ["collect", "collect"] });`)).toEqual([]); // no href.js import: not a links table
    expect(screenLinks(`const DATA = { rows: [["Mark", "draft"]] }; const u = "?ui_next=on&screen=p-about&w=phone";`)).toEqual(["p-about"]);
    const files = walk(DIR).filter(SCANNED).map((f) => relative(DIR, f));
    expect(files).toContain("registry.js");
    expect(files).not.toContain("href.js");
  });
  it("every screen name linked from ui-next/src/screens/**/*.svelte and *.js is registered or built in", () => {
    const known = new Set<string>([...SCREENS, ...Object.keys(REGISTRY), ...ROUTES.map(([name]) => name)]);
    const files = walk(DIR).filter(SCANNED);
    expect(files.length).toBeGreaterThan(0);
    const bad = files.flatMap((f) => screenLinks(readFileSync(f, "utf8")).filter((n) => !known.has(n)).map((n) => `${relative(ROOT, f)}: ?screen=${n}`));
    expect(bad, `links to screens nobody registered (register them in screens/<lane>/index.js or fix the name): ${[...known].join(", ")} are known`).toEqual([]);
  });
});
