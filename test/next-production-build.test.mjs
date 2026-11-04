// UI Next /next/ in production (owner request PR576 comment 6480605514): a WORKERS_CI_BRANCH=production build emits ui/next/
// with the fixture harness compiled out, and the default entry `/` stays the current UI with the menu link as the only way in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

function build(branch) {
  const out = mkdtempSync(join(tmpdir(), "next-build-"));
  const env = { ...process.env };
  if (branch) env.WORKERS_CI_BRANCH = branch; else delete env.WORKERS_CI_BRANCH;
  const r = spawnSync(process.execPath, ["scripts/build-next-guarded.mjs", "--outDir", out, "--emptyOutDir"], { cwd: root, env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const js = readdirSync(join(out, "assets")).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(out, "assets", f), "utf8")).join("\n");
  return { out, js, log: r.stdout };
}
// Strings only the fixture galleries draw (src/App.svelte, src/HomeParts.svelte).
const GALLERY = ["Leading / trailing icon", "Recommendation states (word + icon)", "Dot with visible name (decorative)"];

test("WORKERS_CI_BRANCH=production: the guarded build emits ui/next/index.html, live app only (no fixture galleries)", { timeout: 120_000 }, () => {
  const prod = build("production");
  const dev = build("");
  try {
    assert.ok(existsSync(join(prod.out, "index.html")), "production build emits index.html");
    assert.match(prod.log, /WORKERS_CI_BRANCH=production/);
    for (const s of GALLERY) {
      assert.ok(dev.js.includes(s), `non-production bundle keeps the harness: ${s}`);
      assert.ok(!prod.js.includes(s), `production bundle drops the harness: ${s}`);
    }
    assert.ok(prod.js.includes("Sample review"), "the live app's sample data stays labelled");
    assert.ok(!prod.js.includes("Sample data: a made-up review"), "no developer design-preview card copy ships");
    assert.ok(!prod.js.includes("Design preview"), "no Design preview card title ships");
  } finally {
    rmSync(prod.out, { recursive: true, force: true });
    rmSync(dev.out, { recursive: true, force: true });
  }
});

test("the default entry `/` is the current UI: no automatic navigation, cookie or default flip to /next/", () => {
  const html = read("ui/index.html").replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, ""); // code, not comments
  assert.doesNotMatch(html, /http-equiv=["']?refresh/i);
  assert.doesNotMatch(html, /location\s*\.\s*(assign|replace)\s*\(|location(\.href)?\s*=[^=]/);
  assert.doesNotMatch(html, /document\.cookie/);
  // The only reference to /next/ is the opt-in menu link (plus the HEAD probe that hides it when /next/ is not served).
  const refs = [...html.matchAll(/\/next\//g)].length;
  assert.equal(refs, 2);
  assert.match(html, /<a href="\/next\/\?ui_next=on" data-ui-next>Try the new design<\/a>/);
  assert.match(html, /fetch\('\/next\/',\{method:'HEAD'[^)]*\)\.then\(r=>\{if\(!r\.ok\)l\.hidden=true;\}/);
  // The Worker never routes `/` to /next/: no source file names the /next/ path.
  const src = spawnSync("grep", ["-rln", "/next", "src"], { cwd: root, encoding: "utf8" });
  assert.equal(src.stdout.trim(), "");
  // The assets binding serves ./ui at `/` as before.
  assert.match(read("wrangler.toml"), /\[assets\]\ndirectory = "\.\/ui"/);
});
