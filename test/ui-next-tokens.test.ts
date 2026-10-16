// UI Next (v4) tokens + conformance lint (status: provisional).
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs script, no type declarations
import { generate, render, OUTPUT, SOURCE } from "../scripts/ui-next-tokens.mjs";
// @ts-expect-error -- plain .mjs script, no type declarations
import { lintText, lintDir } from "../scripts/ui-next-lint.mjs";

const script = (name: string) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
const run = (name: string, args: string[] = []) => spawnSync(process.execPath, [script(name), ...args], { encoding: "utf8" });
const tmp = mkdtempSync(join(tmpdir(), "ui-next-lint-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("ui-next/tokens.css", () => {
  it("is up to date with ui-next/tokens.source.json", () => {
    expect(readFileSync(OUTPUT, "utf8")).toBe(generate());
    const r = run("ui-next-tokens.mjs", ["--check"]);
    expect(r.status, r.stderr).toBe(0);
  });

  it("changes when the source changes (one source, no hand edits)", () => {
    const src = JSON.parse(readFileSync(SOURCE, "utf8"));
    src.blocks[0].decls["--ground"] = "#000000";
    expect(render(src)).not.toBe(readFileSync(OUTPUT, "utf8"));
  });

  it("carries the light, dark, semantic and paper scopes of the contract", () => {
    const css = readFileSync(OUTPUT, "utf8");
    expect(css).toMatch(/\.app \{[^}]*--ground: #edf2f5;/);
    expect(css).toMatch(/\.app\[data-theme=dark\] \{[^}]*color-scheme: dark;[^}]*--ground: #0b1520;/);
    expect(css).toMatch(/\.app \{[^}]*--radius-xl: 26px;[^}]*--t-56: 56px;[^}]*--target: 44px;/);
    expect(css).toMatch(/\.paper \{[^}]*--ink: #13263a;[^}]*--church: #b0770f;/);
    // every theme token in light is overridden in dark
    const src = JSON.parse(readFileSync(SOURCE, "utf8"));
    const light = Object.keys(src.blocks[0].decls);
    const dark = Object.keys(src.blocks[1].decls);
    expect(light.filter((k) => !dark.includes(k))).toEqual([]);
  });
});

describe("ui-next conformance lint", () => {
  it("passes on ui-next/", () => {
    const r = run("ui-next-lint.mjs");
    expect(r.status, r.stdout).toBe(0);
    expect(r.stdout).toContain("0 violations in 0 files");
  });

  const seeded: Array<[string, string, string]> = [
    ["inline px type", "a.css", ".x{font-size:14px}", ],
    ["inline px type (one space)", "b.html", '<p style="font-size: 13px">x</p>'],
    ["non-token radius", "c.css", ".x{border-radius:12px}"],
    ["raw hex outside .paper", "d.css", ".x{color:#13263a}"],
    ["raw hex in a .paper-prefixed class", "d.css", ".paper-card{color:#f00}"],
    ["raw hex in a selector list led by .paper", "d.css", ".paper, .x{color:#f00}"],
    ["raw hex in a sibling of .paper (+)", "d.css", ".paper + .card{color:#f00}"],
    ["raw hex in a sibling of .paper (~)", "d.css", ".paper~.x{color:#f00}"],
    ["raw hex in html", "e.html", '<main><p style="color:#fff">x</p></main>'],
    ["pt by class letter", "f.html", '<span class="pt t"></span>'],
    ["legacy .status", "g.html", '<span class="status">x</span>'],
    ["two primaries", "h.html", '<a class="btn btn-primary">a</a><a class="btn btn-primary">b</a>'],
    ["nested label", "i.html", "<label>a <label>b</label></label>"],
    ["placeholder text", "j.html", "<p>[CONTACT NAME]</p>"],
  ].map(([what, file, text]) => [what, file, text] as [string, string, string]);

  it.each(seeded)("fails on %s", (_what, file, text) => {
    expect(lintText(file, text).length).toBeGreaterThan(0);
  });

  it("allows what lint.py allows: tokens, 50 radius, one primary, hex inside .paper", () => {
    expect(lintText("ok.css", ".x{font-size:var(--t-14);border-radius:var(--radius-m);color:var(--ink)}.d{border-radius:50%}.e{border-radius:50px}")).toEqual([]);
    expect(lintText("ok.html", '<main><a class="btn btn-primary">Go</a><div class="paper"><p style="color:#111">x</p></div></main>')).toEqual([]);
    expect(lintText("ok.css", ".paper{background:#fff}.paper .rl{border-bottom:1px solid #999}")).toEqual([]);
    expect(lintText("ok.html", '<style>.x{}</style></helmet><main><p class="small">x</p></main>')).toEqual([]);
  });

  it("fails the CLI on a seeded directory and skips tokens.css", () => {
    const dir = join(tmp, "seeded");
    mkdirSync(join(dir, "nested"), { recursive: true });
    writeFileSync(join(dir, "tokens.css"), ".app{--ground:#edf2f5}");
    writeFileSync(join(dir, "nested", "bad.css"), ".x{color:#ff0000;font-size:12px;border-radius:7px}");
    writeFileSync(join(dir, "nested", "tokens.css"), ".x{color:#00ff00}");
    const result = lintDir(dir);
    expect([...result.keys()]).toEqual([join("nested", "bad.css"), join("nested", "tokens.css")]);
    expect(result.get(join("nested", "bad.css"))).toHaveLength(3);
    const r = run("ui-next-lint.mjs", [dir]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("4 violations in 2 files");
  });
});
