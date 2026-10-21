import { defineConfig } from "vitest/config";
import fs from "node:fs";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
// wrangler serves *.yaml, seed/*.sql and src/mcp-panel.html as Text (wrangler.toml rules); mirror that for vitest.
const textPlugin = { name: "yaml-as-text", transform(_code: string, id: string) { if (id.endsWith(".yaml") || id.endsWith(".sql") || id.endsWith("mcp-panel.html")) return { code: `export default ${JSON.stringify(fs.readFileSync(id, "utf8"))};`, map: null }; } };
const UI_NEXT = "test/ui-next-*.test.ts";
export default defineConfig({
  plugins: [textPlugin],
  resolve: { alias: { "cloudflare:workers": new URL("./test/stubs/cloudflare-workers.ts", import.meta.url).pathname } },
  // Bound concurrent test files for the local Miniflare correctness harnesses.
  test: {
    fileParallelism: false, testTimeout: 30000, server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
    projects: [
      // Worker, UI and Miniflare suites: Node resolve conditions (Miniflare's ws needs the node build).
      { extends: true, test: { name: "app", include: ["test/**/*.test.ts"], exclude: [UI_NEXT, "**/node_modules/**"] } },
      // UI Next Svelte components: compiled for the browser and rendered under jsdom (svelteTesting adds the browser condition + cleanup).
      { extends: true, plugins: [svelte({ compilerOptions: { customElement: false, css: "external" } }), svelteTesting()], test: { name: "ui-next", include: [UI_NEXT] } },
    ],
  },
});
