// UI Next (v4) /next/ build, run from the npm lifecycle hooks (pretypecheck, pretest) so the default
// Workers Builds command builds it without a trigger edit. Status: provisional.
//
// ui/next/ is served by wrangler.toml [assets] directory "./ui" (see vite.next.config.mjs) at /next/, on every branch including
// `production` (owner request PR576 comment 6480605514): UI Next is an opt-in reached from the current UI's account menu
// ("Try the new design", ui/index.html); `/` stays the current UI and nothing redirects, sets a cookie or flips the default.
// Workers Builds injects WORKERS_CI_BRANCH = the branch of the triggering push
// (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ — default variables).
// On branch `production` the build still runs, but vite.next.config.mjs compiles the fixture harness out (__UI_NEXT_FIXTURE_HARNESS__
// = false): /next/ always mounts the live app, never the ?screen= boards or ?page= galleries with their unlabelled fixture data.
// Every other branch, local runs and GitHub Actions build the harness as before.
// Extra arguments pass through to vite (test/next-production-build.test.mjs builds into a temp --outDir).
import { spawnSync } from "node:child_process";

const branch = process.env.WORKERS_CI_BRANCH ?? "";
if (branch === "production") console.log("build:next — WORKERS_CI_BRANCH=production: emitting ui/next/ with the fixture harness compiled out");
const r = spawnSync("npm", ["run", "build:next", ...(process.argv.length > 2 ? ["--", ...process.argv.slice(2)] : [])], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
