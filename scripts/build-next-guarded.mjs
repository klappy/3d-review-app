// UI Next (v4) /next/ build, run from the npm lifecycle hooks (pretypecheck, pretest) so the default
// Workers Builds command builds it without a trigger edit. Status: provisional.
//
// Production guard: ui/next/ is served unflagged by wrangler.toml [assets] directory "./ui"
// (see vite.next.config.mjs), so a production build must NOT emit it until the production ruling.
// Workers Builds injects WORKERS_CI_BRANCH = the branch of the triggering push
// (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ — default variables).
// On branch `production` this script skips the build and removes any stale ui/next/.
// Every other branch, local runs and GitHub Actions build it as before.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const branch = process.env.WORKERS_CI_BRANCH ?? "";
if (branch === "production") {
  rmSync(fileURLToPath(new URL("../ui/next", import.meta.url)), { recursive: true, force: true });
  console.log("build:next skipped — WORKERS_CI_BRANCH=production (ui/next/ not emitted; production untouched)");
  process.exit(0);
}
const r = spawnSync("npm", ["run", "build:next"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
