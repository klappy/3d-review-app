// UI Next (v4) /next/ build. Status: provisional.
// Builds ui-next/index.html (Svelte 5 entry) into ui/next/ (gitignored), which wrangler.toml [assets] directory "./ui" serves at /next/ unchanged.
// Relative base so the same output also works as a self-contained static folder.
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./ui-next", import.meta.url)),
  base: "./",
  plugins: [svelte({ compilerOptions: { customElement: false, css: "external" } })],
  build: { outDir: fileURLToPath(new URL("./ui/next", import.meta.url)), emptyOutDir: true, assetsDir: "assets" },
});
