import { defineConfig } from "vitest/config";
import fs from "node:fs";
// wrangler serves *.yaml as Text (wrangler.toml rules); mirror that for vitest.
export default defineConfig({
  plugins: [{ name: "yaml-as-text", transform(_code, id) { if (id.endsWith(".yaml")) return { code: `export default ${JSON.stringify(fs.readFileSync(id, "utf8"))};`, map: null }; } }],
  test: { include: ["test/**/*.test.ts"], testTimeout: 30000 },
});
