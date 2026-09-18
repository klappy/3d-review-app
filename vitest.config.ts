import { defineConfig } from "vitest/config";
import fs from "node:fs";
// wrangler serves *.yaml, seed/*.sql and src/mcp-panel.html as Text (wrangler.toml rules); mirror that for vitest.
export default defineConfig({
  plugins: [{ name: "yaml-as-text", transform(_code, id) { if (id.endsWith(".yaml") || id.endsWith(".sql") || id.endsWith("mcp-panel.html")) return { code: `export default ${JSON.stringify(fs.readFileSync(id, "utf8"))};`, map: null }; } }],
  resolve: { alias: { "cloudflare:workers": new URL("./test/stubs/cloudflare-workers.ts", import.meta.url).pathname } },
  // Bound concurrent test files for the local Miniflare correctness harnesses.
  test: { fileParallelism: false, include: ["test/**/*.test.ts"], testTimeout: 30000, server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } } },
});
