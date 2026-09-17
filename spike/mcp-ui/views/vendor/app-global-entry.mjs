// esbuild entry: exposes the ext-apps App class (dependency-bundled build) as window.McpApps.
// Bundled with `npm run build:sdk-bundle`; the output app-global.js is inlined into each view
// by server.mjs, so a served view loads no script from any CDN.
export { App } from "@modelcontextprotocol/ext-apps/app-with-deps";
