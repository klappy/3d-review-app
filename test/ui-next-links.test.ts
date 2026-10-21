// UI Next (v4) cross-screen links point at screens that exist (status: provisional). Screens fanout
// (3d-review-cookbook work/active/2026-10-21-ui-next-screens-fanout/): seven lanes link to each other's screens by name;
// a name nobody registered silently falls back to Home (route.js). This reads every ui-next/src/screens/**/*.svelte source
// and fails on any literal ?screen=<name> (or href("<name>") call to screens/href.js) that is neither registered in
// screens/registry.js nor a built-in ?screen= view, so a lane link to an unmerged or renamed screen fails here.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
// @ts-expect-error -- plain .js module, no type declarations
import { SCREENS } from "../ui-next/src/route.js";
// @ts-expect-error -- plain .js module, no type declarations
import { REGISTRY } from "../ui-next/src/screens/registry.js";

const ROOT = resolve(__dirname, "..");
const DIR = join(ROOT, "ui-next/src/screens");
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

// A literal name: lowercase kebab chars not followed by more name chars or a ${...} interpolation (template-built links are skipped).
const LIT = "([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?![a-z0-9-]|\\$\\{)";
const SCREEN_PARAM = new RegExp(`[?&;]screen=${LIT}`, "g");
const HREF_CALL = new RegExp(`\\bhref\\(\\s*(["'\`])${LIT}\\1`, "g");

function screenLinks(src: string): string[] {
  const names = [...src.matchAll(SCREEN_PARAM)].map((m) => m[1]);
  if (/screens\/href\.js|\.\/href\.js|\.\.\/href\.js/.test(src)) names.push(...[...src.matchAll(HREF_CALL)].map((m) => m[2]));
  return names;
}

describe("cross-screen links name a registered screen", () => {
  it("the scanner reads literal links and skips built ones", () => {
    expect(screenLinks(`<a href="?ui_next=on&screen=collect-menu&w=phone">`)).toEqual(["collect-menu"]);
    expect(screenLinks(`const A = "?screen=results&w=phone", B = '?ui_next=on&amp;screen=qr-room';`)).toEqual(["results", "qr-room"]);
    expect(screenLinks("const s = (n) => `?screen=setup${n}`; const t = `?screen=${name}`;")).toEqual([]);
    expect(screenLinks(`import { href } from "../href.js"; const a = href("action-plan", { state: "x" }); const b = href(name);`)).toEqual(["action-plan"]);
    expect(screenLinks(`const a = href("not-ours");`)).toEqual([]); // no href.js import: some other href()
    expect(screenLinks(`?page=home&state=first`)).toEqual([]);
  });
  it("every literal ?screen= value in ui-next/src/screens/**/*.svelte is registered or built in", () => {
    const known = new Set<string>([...SCREENS, ...Object.keys(REGISTRY)]);
    const files = walk(DIR).filter((f) => f.endsWith(".svelte"));
    expect(files.length).toBeGreaterThan(0);
    const bad = files.flatMap((f) => screenLinks(readFileSync(f, "utf8")).filter((n) => !known.has(n)).map((n) => `${relative(ROOT, f)}: ?screen=${n}`));
    expect(bad, `links to screens nobody registered (register them in screens/<lane>/index.js or fix the name): ${[...known].join(", ")} are known`).toEqual([]);
  });
});
