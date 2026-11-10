// UI Next /next/ in production (owner request PR576 comment 6480605514): a WORKERS_CI_BRANCH=production build emits ui/next/
// with the fixture harness compiled out, and the default entry `/` stays the current UI with the menu link as the only way in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

function build(branch) {
  const out = mkdtempSync(join(tmpdir(), "next-build-"));
  // Simulate a previous DEV output in the exact production output directory.
  if (branch === 'production') {
    mkdirSync(join(out, 'player-matrix'), { recursive: true });
    writeFileSync(join(out, 'player-matrix/stale.html'), 'diagnostic');
    writeFileSync(join(out, 'player-diagnostic.html'), 'diagnostic');
  }
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
    assert.ok(existsSync(join(dev.out, 'player-matrix/a0.html')));
    assert.ok(existsSync(join(dev.out, 'player-matrix/r5.html')));
    assert.ok(existsSync(join(dev.out, 'player-diagnostic.html')));
    assert.ok(!existsSync(join(prod.out, 'player-matrix')), 'production removes all matrix pages, bundles and stale output');
    assert.ok(!existsSync(join(prod.out, 'player-diagnostic.html')), 'production removes the legacy diagnostic');
    assert.ok(!prod.js.includes('media error '), 'numeric player diagnostics do not ship in the product bundle');
    assert.ok(!prod.js.includes('Player cases'), 'the matrix is not imported by the product');
    assert.ok(prod.js.includes("Sample review"), "the live app's sample data stays labelled");
    assert.ok(!prod.js.includes("Sample data: a made-up review"), "no developer design-preview card copy ships");
    assert.ok(!prod.js.includes("Design preview"), "no Design preview card title ships");
  } finally {
    rmSync(prod.out, { recursive: true, force: true });
    rmSync(dev.out, { recursive: true, force: true });
  }
});

test("production root delegates to the reviewed default bootstrap with an explicit legacy escape", () => {
  const html = read("ui/index.html");
  assert.match(html, /import \{ bootDefaultEntry \} from "\/default-entry\.js"; bootDefaultEntry\(\);/);
  assert.doesNotMatch(html, /<script[^>]+src="\/assess\/assess\.js/);
  const bootstrap = read("ui/default-entry.js");
  assert.match(bootstrap, /location\.replace\(target\)/);
  assert.match(bootstrap, /loadCurrent = \(\) => import\('\.\/assess\/assess\.js'\)/);
  assert.match(html, /href="\/next\/\?ui_next=on" data-ui-next/);
  assert.match(read("wrangler.toml"), /\[assets\]\ndirectory = "\.\/ui"/);
});

test('diagnostic guard purges sibling assets from a previous DEV build without relying on Vite emptyOutDir', async () => {
  const { buildPlayerDiagnostics } = await import('../scripts/build-player-diagnostics.mjs');
  const assets = mkdtempSync(join(tmpdir(), 'player-assets-'));
  try {
    mkdirSync(join(assets, 'player-matrix/assets'), { recursive: true });
    writeFileSync(join(assets, 'player-matrix/assets/stale.js'), 'numeric diagnostics');
    writeFileSync(join(assets, 'player-matrix/r0.html'), 'test player');
    writeFileSync(join(assets, 'player-diagnostic.html'), 'old test player');
    writeFileSync(join(assets, 'index.html'), 'ordinary homepage');
    assert.deepEqual(await buildPlayerDiagnostics({ branch: 'production', assetsDir: assets }), { emitted: false });
    assert.ok(!existsSync(join(assets, 'player-matrix')));
    assert.ok(!existsSync(join(assets, 'player-diagnostic.html')));
    assert.equal(readFileSync(join(assets, 'index.html'), 'utf8'), 'ordinary homepage');
  } finally { rmSync(assets, { recursive: true, force: true }); }
});
