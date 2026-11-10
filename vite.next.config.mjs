// UI Next (v4) /next/ build. Status: provisional.
// Builds ui-next/index.html (Svelte 5 entry) into ui/next/ (gitignored), which wrangler.toml [assets] directory "./ui" serves at /next/ unchanged,
// production included (scripts/build-next-guarded.mjs): an opt-in from the current UI's menu; `/` stays the current UI.
// __UI_NEXT_FIXTURE_HARNESS__ is false on WORKERS_CI_BRANCH=production: main.js then always mounts the live app and the ?screen= boards,
// ?page= galleries and their fixture level minimum 1 are dead code, dropped from the bundle.
// Relative base so the same output also works as a self-contained static folder.
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./ui-next", import.meta.url)),
  base: "./",
  define: { __UI_NEXT_FIXTURE_HARNESS__: JSON.stringify(process.env.WORKERS_CI_BRANCH !== "production") },
  plugins: [svelte({ compilerOptions: { customElement: false, css: "external" } })],
  build: { outDir: fileURLToPath(new URL("./ui/next", import.meta.url)), emptyOutDir: true, assetsDir: "assets" },
});
